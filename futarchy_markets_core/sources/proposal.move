// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

module futarchy_markets_core::proposal;

use account_protocol::account;
use account_protocol::intents::ActionSpec;
use futarchy_core::dao_config::{Self, ConditionalCoinConfig};
use futarchy_core::futarchy_config;
use futarchy_core::sponsorship_auth::SponsorshipAuth;
use futarchy_markets_core::liquidity_initialize;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm::{Self, LiquidityPool};
use futarchy_markets_primitives::market_state;
use futarchy_types::signed::{Self as signed, SignedU128};
use std::ascii::String as AsciiString;
use std::option;
use std::string::{Self, String};
use std::type_name::{Self, TypeName};
use std::vector;
use sui::bag::{Self, Bag};
use sui::balance::{Self as balance, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};
use sui::event;

// === Introduction ===
// This defines the core proposal logic and details

// === Errors ===

const EInvalidAmount: u64 = 1;
const EInvalidState: u64 = 2;
const EAssetLiquidityTooLow: u64 = 4;
const EStableLiquidityTooLow: u64 = 5;
const EPoolNotFound: u64 = 6;
const EOutcomeOutOfBounds: u64 = 7;
const ESpotTwapNotReady: u64 = 9;
const ETooManyOutcomes: u64 = 10;
const EInvalidOutcome: u64 = 11;
const ENotFinalized: u64 = 12;
const ETwapNotSet: u64 = 13;
const ETooManyActions: u64 = 14;
const EInvalidConditionalCoinCount: u64 = 15;
const EConditionalCoinAlreadySet: u64 = 16;
const ENotLiquidityProvider: u64 = 17;
const EAlreadySponsored: u64 = 18;
const ESupplyNotZero: u64 = 19;
const EInsufficientBalance: u64 = 20;
const EPriceVerificationFailed: u64 = 21;
const ECannotSetActionsForRejectOutcome: u64 = 22;
const EInvalidAssetType: u64 = 23;
const EInvalidStableType: u64 = 24;
const EInsufficientFee: u64 = 25;
const ECannotSponsorReject: u64 = 26;


// === Constants ===

const STATE_PREMARKET: u8 = 0; // Proposal exists, outcomes can be added/mutated. No market yet.
const STATE_REVIEW: u8 = 1; // Market is initialized and locked for review. Not yet trading.
const STATE_TRADING: u8 = 2; // Market is live and trading.
const STATE_FINALIZED: u8 = 3; // Market has resolved.

// Outcome constants for TWAP calculation
// NOTE: Reject is ALWAYS outcome 0 (baseline/status quo)
// Accept is ALWAYS outcome 1+ (proposed actions)
const OUTCOME_REJECTED: u64 = 0;
const OUTCOME_ACCEPTED: u64 = 1;

// === Structs ===

/// Key for storing conditional coin caps in Bag
/// Each outcome has 2 coins: asset-conditional and stable-conditional
public struct ConditionalCoinKey has copy, drop, store {
    outcome_index: u64,
    is_asset: bool, // true for asset, false for stable
}

/// Configuration for proposal timing and periods
public struct ProposalTiming has store {
    created_at: u64,
    market_initialized_at: Option<u64>,
    review_period_ms: u64,
    trading_period_ms: u64,
    last_twap_update: u64,
    twap_start_delay: u64,
}

/// Configuration for liquidity requirements
public struct LiquidityConfig has store {
    min_asset_liquidity: u64,
    min_stable_liquidity: u64,
    asset_amounts: vector<u64>,
    stable_amounts: vector<u64>,
}

/// TWAP (Time-Weighted Average Price) configuration
public struct TwapConfig has store {
    twap_prices: vector<u128>,
    twap_initial_observation: u128,
    twap_step_max: u64,
    twap_threshold: SignedU128,
}

/// Outcome-related data
public struct OutcomeData has store {
    outcome_count: u64,
    outcome_messages: vector<String>,
    outcome_creators: vector<address>,
    intent_specs: vector<Option<vector<ActionSpec>>>, // Direct use of protocol ActionSpec
    actions_per_outcome: vector<u64>,
    winning_outcome: Option<u64>,
}

/// Core proposal object that owns AMM pools
public struct Proposal<phantom AssetType, phantom StableType> has key, store {
    id: UID,
    state: u8,
    dao_id: ID,
    proposer: address, // The original proposer.
    liquidity_provider: Option<address>,
    withdraw_only_mode: bool, // When true, return liquidity to provider instead of auto-reinvesting
    /// Track if proposal used admin quota/budget (excludes from creator rewards)
    used_quota: bool,
    /// Track the sponsored threshold for each outcome (None = use base threshold, Some = sponsored)
    outcome_sponsor_thresholds: vector<Option<SignedU128>>,
    /// Track if sponsor quota was already used for this proposal (one use sponsors all outcomes)
    sponsor_quota_used_for_proposal: bool,
    /// Track who used the sponsor quota (for refunds on eviction)
    sponsor_quota_user: Option<address>,
    // Market-related fields (pools now live in MarketState)
    escrow_id: Option<ID>,
    market_state_id: Option<ID>,
    // Conditional coin capabilities (stored dynamically per outcome)
    conditional_treasury_caps: Bag, // Stores TreasuryCap<ConditionalCoinType> per outcome
    conditional_metadata: Bag, // Stores CoinMetadata<ConditionalCoinType> per outcome
    // Proposal content
    title: String,
    introduction_details: String,
    details: vector<String>,
    metadata: String,
    // Grouped configurations
    timing: ProposalTiming,
    liquidity_config: LiquidityConfig,
    twap_config: TwapConfig,
    outcome_data: OutcomeData,
    // Fee-related fields
    amm_total_fee_bps: u64,
    conditional_liquidity_ratio_percent: u64, // Ratio of spot liquidity to split to conditional markets (base 100, not bps!)
    fee_escrow: Balance<StableType>, // Proposal fees held for refund to proposer if any accept wins
    total_fee_paid: u64, // Total fee paid by proposer (for refund calculation)
    treasury_address: address,
    // Governance parameters (read from DAO config during creation)
    max_outcomes: u64, // Maximum number of outcomes allowed
}

/// A scoped witness proving that a particular (proposal, outcome) had an IntentSpec.
/// Only mintable by the module that has &mut Proposal and consumes the slot.
/// This prevents cross-proposal cancellation attacks.
///
/// After IntentSpec refactor: This witness proves ownership of a proposal outcome slot,
/// used for cleanup and lifecycle management.
public struct CancelWitness has drop {
    proposal: address,
    outcome_index: u64,
}

// Getter functions for CancelWitness
public fun cancel_witness_proposal(witness: &CancelWitness): address {
    witness.proposal
}

public fun cancel_witness_outcome_index(witness: &CancelWitness): u64 {
    witness.outcome_index
}

// === Events ===

public struct ProposalCreated has copy, drop {
    proposal_id: ID,
    dao_id: ID,
    proposer: address,
    outcome_count: u64,
    outcome_messages: vector<String>,
    created_at: u64,
    asset_type: AsciiString,
    stable_type: AsciiString,
    review_period_ms: u64,
    trading_period_ms: u64,
    title: String,
    metadata: String,
}

public struct ProposalMarketInitialized has copy, drop {
    proposal_id: ID,
    dao_id: ID,
    market_state_id: ID,
    escrow_id: ID,
    timestamp: u64,
}


// Early resolution events moved to early_resolve.move

// === Public Functions ===

/// Create a PREMARKET proposal without market/escrow/liquidity.
/// This reserves the proposal "as next" without consuming DAO/proposer liquidity.
/// ALL trading/governance parameters come from DAO config (governance-controlled).
#[allow(lint(share_owned))]
public fun new_premarket<AssetType, StableType>(
    dao_account: &account::Account, // Read ALL DAO config from this
    treasury_address: address,
    title: String,
    introduction_details: String,
    metadata: String,
    outcome_messages: vector<String>,
    outcome_details: vector<String>,
    proposer: address,
    used_quota: bool, // Track if proposal used admin budget
    fee_payment: Coin<StableType>, // Proposal fee (creation_fee + per_outcome fees)
    intent_spec_for_yes: Option<vector<ActionSpec>>,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    // Capture fee amount before consuming coin
    let total_fee_paid = fee_payment.value();
    let fee_balance = fee_payment.into_balance();
    let id = object::new(ctx);
    let actual_proposal_id = object::uid_to_inner(&id);
    let outcome_count = outcome_messages.length();

    // Read ALL parameters from DAO config (governance-controlled)
    let futarchy_cfg = account::config<futarchy_config::FutarchyConfig>(dao_account);

    // Validate that proposal types match DAO config types (prevent governance bypass)
    let expected_asset_type = futarchy_config::asset_type(futarchy_cfg);
    let expected_stable_type = futarchy_config::stable_type(futarchy_cfg);
    let actual_asset_type = type_name::with_original_ids<AssetType>().into_string().to_string();
    let actual_stable_type = type_name::with_original_ids<StableType>().into_string().to_string();
    assert!(actual_asset_type == *expected_asset_type, EInvalidAssetType);
    assert!(actual_stable_type == *expected_stable_type, EInvalidStableType);

    // Trading parameters
    let review_period_ms = futarchy_config::review_period_ms(futarchy_cfg);
    let trading_period_ms = futarchy_config::trading_period_ms(futarchy_cfg);
    let min_asset_liquidity = futarchy_config::min_asset_amount(futarchy_cfg);
    let min_stable_liquidity = futarchy_config::min_stable_amount(futarchy_cfg);
    let amm_total_fee_bps = futarchy_config::conditional_amm_fee_bps(futarchy_cfg);
    let conditional_liquidity_ratio_percent = futarchy_config::conditional_liquidity_ratio_percent(
        futarchy_cfg,
    );

    // TWAP parameters
    let twap_start_delay = futarchy_config::amm_twap_start_delay(futarchy_cfg);
    let twap_initial_observation = futarchy_config::amm_twap_initial_observation(futarchy_cfg);
    let twap_step_max = futarchy_config::amm_twap_step_max(futarchy_cfg);
    let twap_threshold = *futarchy_config::twap_threshold(futarchy_cfg);

    // Governance parameters
    let max_outcomes = futarchy_config::max_outcomes(futarchy_cfg);

    // Validate outcome count (must have at least Reject + Accept)
    assert!(outcome_count >= 2, EInvalidOutcome);
    assert!(outcome_count <= max_outcomes, ETooManyOutcomes);

    // Validate fee payment
    let creation_fee = futarchy_config::proposal_creation_fee(futarchy_cfg);
    let per_outcome_fee = futarchy_config::proposal_fee_per_outcome(futarchy_cfg);
    let additional_outcome_fee = if (outcome_count <= 2) {
        0
    } else {
        (outcome_count - 2) * per_outcome_fee
    };
    let expected_fee = creation_fee + additional_outcome_fee;
    assert!(total_fee_paid >= expected_fee, EInsufficientFee);

    let proposal = Proposal<AssetType, StableType> {
        id,
        state: STATE_PREMARKET,
        dao_id: object::id(dao_account),
        proposer,
        liquidity_provider: option::none(),
        withdraw_only_mode: false,
        used_quota,
        outcome_sponsor_thresholds: vector::tabulate!(outcome_count, |_| option::none<SignedU128>()),
        sponsor_quota_used_for_proposal: false,
        sponsor_quota_user: option::none(),
        escrow_id: option::none(),
        market_state_id: option::none(),
        conditional_treasury_caps: bag::new(ctx),
        conditional_metadata: bag::new(ctx),
        title,
        introduction_details,
        details: outcome_details,
        metadata,
        timing: ProposalTiming {
            created_at: clock.timestamp_ms(),
            market_initialized_at: option::none(),
            review_period_ms,
            trading_period_ms,
            last_twap_update: 0,
            twap_start_delay,
        },
        liquidity_config: LiquidityConfig {
            min_asset_liquidity,
            min_stable_liquidity,
            asset_amounts: vector::empty(),
            stable_amounts: vector::empty(),
        },
        twap_config: TwapConfig {
            twap_prices: vector::empty(),
            twap_initial_observation,
            twap_step_max,
            twap_threshold,
        },
        outcome_data: OutcomeData {
            outcome_count,
            outcome_messages,
            outcome_creators: vector::tabulate!(outcome_count, |_| proposer),
            intent_specs: vector::tabulate!(outcome_count, |_| option::none<vector<ActionSpec>>()),
            actions_per_outcome: vector::tabulate!(outcome_count, |_| 0),
            winning_outcome: option::none(),
        },
        amm_total_fee_bps,
        conditional_liquidity_ratio_percent,
        fee_escrow: fee_balance, // Proposal fees deposited atomically
        total_fee_paid, // Total fee paid by proposer
        treasury_address,
        max_outcomes,
    };

    transfer::public_share_object(proposal);
    actual_proposal_id
}

/// Initialize market/escrow/AMMs for a PREMARKET proposal.
/// Consumes provided coins, sets state to REVIEW, and readies the market for the review timer.
#[allow(lint(share_owned, self_transfer))]
/// Step 1: Create escrow with market state (called first in PTB)
/// Returns unshared escrow for cap registration
public fun create_escrow_for_market<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    clock: &Clock,
    ctx: &mut TxContext,
): TokenEscrow<AssetType, StableType> {
    assert!(proposal.state == STATE_PREMARKET, EInvalidState);

    // Create market state
    let ms = market_state::new(
        object::id(proposal),
        proposal.dao_id,
        proposal.outcome_data.outcome_count,
        proposal.outcome_data.outcome_messages,
        clock,
        ctx,
    );

    // Create and return escrow (not yet shared)
    coin_escrow::new<AssetType, StableType>(ms, ctx)
}

/// Step 2: Extract conditional coin caps from proposal and register with escrow
/// Must be called once per outcome (PTB calls this N times with different type parameters)
public fun register_outcome_caps_with_escrow<
    AssetType,
    StableType,
    AssetConditionalCoin,
    StableConditionalCoin,
>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
) {
    assert!(proposal.state == STATE_PREMARKET, EInvalidState);

    // Extract TreasuryCaps from proposal bags
    let asset_key = ConditionalCoinKey { outcome_index, is_asset: true };
    let stable_key = ConditionalCoinKey { outcome_index, is_asset: false };

    let asset_cap: TreasuryCap<AssetConditionalCoin> = bag::remove(
        &mut proposal.conditional_treasury_caps,
        asset_key,
    );
    let stable_cap: TreasuryCap<StableConditionalCoin> = bag::remove(
        &mut proposal.conditional_treasury_caps,
        stable_key,
    );

    // Register with escrow
    coin_escrow::register_conditional_caps(escrow, outcome_index, asset_cap, stable_cap);
}

/// Step 2.5: Create conditional AMM pools and store them in MarketState
/// Called after all outcome caps are registered (PTB calls this once after N cap registrations)
/// CRITICAL: This must be called BEFORE advancing to REVIEW state, otherwise quantum split will fail
///
/// BOOTSTRAP LIQUIDITY MODEL:
/// - Creates pools with minimal reserves (1000/1000 per pool) for AMM constraints
/// - These minimal reserves are "bootstrap liquidity" that stays locked in pools permanently
/// - NO escrow backing needed for bootstrap reserves
/// - Quantum split will add the REAL liquidity with proper escrow backing
/// - Recombination only withdraws quantum-split amounts, NOT bootstrap reserves
public fun create_conditional_amm_pools<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    spot_pool: &UnifiedSpotPool<AssetType, StableType>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(proposal.state == STATE_PREMARKET, EInvalidState);

    // Get market state from escrow
    let market_state = coin_escrow::get_market_state_mut(escrow);
    let outcome_count = market_state::outcome_count(market_state);

    // Bootstrap conditional pools at SAME price as spot pool
    // Each conditional pool should have identical ratio to spot pool
    // k = asset * stable >= 1000 (MINIMUM_LIQUIDITY)

    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(spot_pool);

    // PERCENTAGE-BASED APPROACH: Take a direct percentage of spot pool reserves
    // This guarantees EXACT ratio match (within integer division rounding)
    // These bootstrap amounts stay locked forever; real liquidity comes from quantum split
    let bootstrap_divisor = 10000u128; // Take 0.01% of spot pool reserves

    let min_asset_per_pool = ((spot_asset as u128) / bootstrap_divisor) as u64;
    let min_stable_per_pool = ((spot_stable as u128) / bootstrap_divisor) as u64;

    // Verify k meets minimum requirement
    let k = (min_asset_per_pool as u128) * (min_stable_per_pool as u128);
    assert!(k >= 1000, 999);

    // Create vectors for pool initialization
    let mut asset_amounts = vector::empty<u64>();
    let mut stable_amounts = vector::empty<u64>();
    let mut i = 0;
    while (i < outcome_count) {
        asset_amounts.push_back(min_asset_per_pool);
        stable_amounts.push_back(min_stable_per_pool);
        i = i + 1;
    };

    // Create conditional AMM pools with minimal bootstrap reserves
    // Bootstrap reserves (1000/1000 per pool) stay locked in pools permanently
    // Quantum split will add the real liquidity with escrow backing on top
    let amm_pools = liquidity_initialize::create_outcome_markets<AssetType, StableType>(
        escrow,
        outcome_count,
        asset_amounts,
        stable_amounts,
        proposal.timing.twap_start_delay,
        proposal.twap_config.twap_initial_observation,
        proposal.twap_config.twap_step_max,
        proposal.amm_total_fee_bps,
        balance::zero<AssetType>(), // No backing for bootstrap reserves
        balance::zero<StableType>(), // They stay locked forever
        clock,
        ctx,
    );

    // Store the pools in MarketState (CRITICAL - this is the missing piece!)
    let market_state = coin_escrow::get_market_state_mut(escrow);
    market_state::set_amm_pools(market_state, amm_pools);

    // VERIFICATION: Each conditional pool matches spot price within 0.1%
    // Note: We use 0.1% tolerance (1000x) instead of 0.01% (10000x) because
    // integer division when calculating bootstrap amounts inherently introduces
    // small rounding errors. These bootstrap pools are locked forever anyway.
    let pools = market_state::borrow_amm_pools(market_state);
    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(spot_pool);

    let mut i = 0;
    while (i < outcome_count) {
        let (pool_asset, pool_stable) = conditional_amm::get_reserves(&pools[i]);

        // Compare ratios: pool_stable/pool_asset vs spot_stable/spot_asset
        // Cross multiply: pool_stable * spot_asset vs spot_stable * pool_asset
        let left = (pool_stable as u128) * (spot_asset as u128);
        let right = (spot_stable as u128) * (pool_asset as u128);
        let diff = if (left > right) { left - right } else { right - left };

        // 0.1% tolerance (1000x instead of 10000x)
        assert!(diff * 1000 <= right, EPriceVerificationFailed);
        i = i + 1;
    };
}

/// Initializes the market-related fields of the proposal.
/// Pools are now stored in MarketState, not Proposal
public fun initialize_market_fields<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    market_state_id: ID,
    escrow_id: ID,
    initialized_at: u64,
    liquidity_provider: address,
) {
    assert!(proposal.state == STATE_PREMARKET, EInvalidState);

    // Use option::fill to replace None with Some value
    option::fill(&mut proposal.market_state_id, market_state_id);
    option::fill(&mut proposal.escrow_id, escrow_id);
    option::fill(&mut proposal.timing.market_initialized_at, initialized_at);
    option::fill(&mut proposal.liquidity_provider, liquidity_provider);
    proposal.state = STATE_REVIEW; // Advance state to REVIEW
}

/// Emits the ProposalMarketInitialized event
public fun emit_market_initialized(
    proposal_id: ID,
    dao_id: ID,
    market_state_id: ID,
    escrow_id: ID,
    timestamp: u64,
) {
    event::emit(ProposalMarketInitialized {
        proposal_id,
        dao_id,
        market_state_id,
        escrow_id,
        timestamp,
    });
}

/// Takes the escrowed fee balance out of the proposal
/// Used for refunding fees to proposer if any accept wins
public fun take_fee_escrow<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
): Balance<StableType> {
    let fee_balance = &mut proposal.fee_escrow;
    let amount = fee_balance.value();
    sui::balance::split(fee_balance, amount)
}

/// Get TWAPs from all pools via MarketState
/// Returns a reference to that oracle; aborts if not found.
public fun get_twaps_for_proposal<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    clock: &Clock,
): vector<u128> {
    let market_state = coin_escrow::get_market_state_mut(escrow);
    let pools = market_state::borrow_amm_pools_mut(market_state);
    let mut twaps = vector[];
    let mut i = 0;
    while (i < pools.length()) {
        let pool = &mut pools[i];
        let twap = pool.get_twap(clock);
        twaps.push_back(twap);
        i = i + 1;
    };
    twaps
}

/// Calculate current winner by INSTANT PRICE (fast flip detection)
/// Returns (winner_index, winner_price, spread)
/// Used for flip detection - faster than TWAP
public fun calculate_current_winner_by_price<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
): (u64, u128, u128) {
    let market_state = coin_escrow::get_market_state_mut(escrow);
    let pools = market_state::borrow_amm_pools_mut(market_state);
    let outcome_count = pools.length();

    assert!(outcome_count >= 2, EInvalidOutcome);

    // Get instant prices from all pools
    let mut winner_idx = 0u64;
    let mut winner_price = conditional_amm::get_current_price(&pools[0]);
    let mut second_price = 0u128;

    let mut i = 1u64;
    while (i < outcome_count) {
        let current_price = conditional_amm::get_current_price(&pools[i]);

        if (current_price > winner_price) {
            // New winner
            second_price = winner_price;
            winner_price = current_price;
            winner_idx = i;
        } else if (current_price > second_price) {
            // New second place
            second_price = current_price;
        };

        i = i + 1;
    };

    // Calculate spread (winner - second)
    let spread = if (winner_price > second_price) {
        winner_price - second_price
    } else {
        0u128
    };

    (winner_idx, winner_price, spread)
}

/// Calculate current winner by TWAP (for final resolution - manipulation resistant)
/// Returns (winner_index, winner_twap, spread)
/// Used for final resolution - slower but more secure
public fun calculate_current_winner<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    clock: &Clock,
): (u64, u128, u128) {
    // Get TWAPs from all markets
    let twaps = get_twaps_for_proposal(proposal, escrow, clock);
    let outcome_count = twaps.length();

    assert!(outcome_count >= 2, EInvalidOutcome); // Need at least 2 outcomes

    // Find highest and second-highest TWAPs
    let mut winner_idx = 0u64;
    let mut winner_twap = *twaps.borrow(0);
    let mut second_twap = 0u128;

    let mut i = 1u64;
    while (i < outcome_count) {
        let current_twap = *twaps.borrow(i);

        if (current_twap > winner_twap) {
            // New winner found
            second_twap = winner_twap;
            winner_twap = current_twap;
            winner_idx = i;
        } else if (current_twap > second_twap) {
            // New second place
            second_twap = current_twap;
        };

        i = i + 1;
    };

    // Calculate spread (winner - second)
    let spread = if (winner_twap > second_twap) {
        winner_twap - second_twap
    } else {
        0u128
    };

    (winner_idx, winner_twap, spread)
}

// === Private Functions ===

fun get_pool_mut(pools: &mut vector<LiquidityPool>, outcome_idx: u8): &mut LiquidityPool {
    let mut i = 0;
    let len = pools.length();
    while (i < len) {
        let pool = &mut pools[i];
        if (pool.get_outcome_idx() == outcome_idx) {
            return pool
        };
        i = i + 1;
    };
    abort EPoolNotFound
}

// === View Functions ===

public fun is_finalized<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): bool {
    proposal.state == STATE_FINALIZED
}

public fun get_twap_prices<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): &vector<u128> {
    &proposal.twap_config.twap_prices
}

public fun get_last_twap_update<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    proposal.timing.last_twap_update
}

/// Get TWAP for a specific outcome by index
public fun get_twap_by_outcome<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    outcome_index: u64,
): u128 {
    // Add defensive checks
    assert!(proposal.state == STATE_FINALIZED, ENotFinalized);
    let twap_prices = &proposal.twap_config.twap_prices;
    assert!(!twap_prices.is_empty(), ETwapNotSet);
    assert!(outcome_index < twap_prices.length(), EOutcomeOutOfBounds);
    *twap_prices.borrow(outcome_index)
}

/// Get the TWAP of the winning outcome
public fun get_winning_twap<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u128 {
    // Add defensive checks
    assert!(proposal.state == STATE_FINALIZED, ENotFinalized);
    assert!(proposal.outcome_data.winning_outcome.is_some(), EInvalidState);
    assert!(!proposal.twap_config.twap_prices.is_empty(), ETwapNotSet);
    let winning_outcome = *proposal.outcome_data.winning_outcome.borrow();
    get_twap_by_outcome(proposal, winning_outcome)
}

public fun state<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): u8 {
    proposal.state
}

/// Check if proposal is currently live (trading active)
public fun is_live<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): bool {
    proposal.state == STATE_TRADING
}

public fun get_winning_outcome<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    assert!(proposal.outcome_data.winning_outcome.is_some(), EInvalidState);
    *proposal.outcome_data.winning_outcome.borrow()
}

/// Checks if winning outcome has been set
public fun is_winning_outcome_set<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): bool {
    proposal.outcome_data.winning_outcome.is_some()
}

/// Returns the treasury address where fees for failed proposals are sent.
public fun treasury_address<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): address {
    proposal.treasury_address
}

public fun get_id<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): ID {
    proposal.id.to_inner()
}

public fun escrow_id<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): ID {
    assert!(proposal.escrow_id.is_some(), EInvalidState);
    *proposal.escrow_id.borrow()
}

public fun market_state_id<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): ID {
    assert!(proposal.market_state_id.is_some(), EInvalidState);
    *proposal.market_state_id.borrow()
}

public fun get_market_initialized_at<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    assert!(proposal.timing.market_initialized_at.is_some(), EInvalidState);
    *proposal.timing.market_initialized_at.borrow()
}

public fun outcome_count<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): u64 {
    proposal.outcome_data.outcome_count
}

/// Alias for outcome_count for better readability
public fun get_num_outcomes<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    proposal.outcome_data.outcome_count
}

public fun proposer<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): address {
    proposal.proposer
}

public fun created_at<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): u64 {
    proposal.timing.created_at
}

public fun get_metadata<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): &String {
    &proposal.metadata
}

public fun get_introduction_details<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): &String {
    &proposal.introduction_details
}

public fun get_amm_pool_ids<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    escrow: &TokenEscrow<AssetType, StableType>,
): vector<ID> {
    let mut ids = vector[];
    let mut i = 0;
    let market_state = coin_escrow::get_market_state(escrow);
    let pools = market_state::borrow_amm_pools(market_state);
    let len = pools.length();
    while (i < len) {
        let pool = &pools[i];
        ids.push_back(pool.get_id());
        i = i + 1;
    };
    ids
}

public fun get_pool_mut_by_outcome<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_idx: u8,
): &mut LiquidityPool {
    assert!((outcome_idx as u64) < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);
    let market_state = coin_escrow::get_market_state_mut(escrow);
    let pools_mut = market_state::borrow_amm_pools_mut(market_state);
    get_pool_mut(pools_mut, outcome_idx)
}

public fun get_pool_by_outcome<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    escrow: &TokenEscrow<AssetType, StableType>,
    outcome_idx: u8,
): &LiquidityPool {
    assert!((outcome_idx as u64) < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);
    let market_state = coin_escrow::get_market_state(escrow);
    let pools = market_state::borrow_amm_pools(market_state);
    let mut i = 0;
    let len = pools.length();
    while (i < len) {
        let pool = &pools[i];
        if (pool.get_outcome_idx() == outcome_idx) {
            return pool
        };
        i = i + 1;
    };
    abort EPoolNotFound
}

// LP caps no longer needed - using conditional tokens for LP

// Pool and LP cap getter no longer needed - using conditional tokens for LP

public fun get_state<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): u8 {
    proposal.state
}

public fun get_dao_id<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): ID {
    proposal.dao_id
}

public fun proposal_id<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): ID {
    proposal.id.to_inner()
}

public fun get_amm_pools<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    escrow: &TokenEscrow<AssetType, StableType>,
): &vector<LiquidityPool> {
    let market_state = coin_escrow::get_market_state(escrow);
    market_state::borrow_amm_pools(market_state)
}

public fun get_amm_pools_mut<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
): &mut vector<LiquidityPool> {
    let market_state = coin_escrow::get_market_state_mut(escrow);
    market_state::borrow_amm_pools_mut(market_state)
}

public fun get_created_at<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): u64 {
    proposal.timing.created_at
}

public fun get_review_period_ms<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    proposal.timing.review_period_ms
}

public fun get_trading_period_ms<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    proposal.timing.trading_period_ms
}

public fun get_twap_threshold<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): SignedU128 {
    proposal.twap_config.twap_threshold
}

public fun get_twap_start_delay<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    proposal.timing.twap_start_delay
}

public fun get_twap_initial_observation<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u128 {
    proposal.twap_config.twap_initial_observation
}

public fun get_twap_step_max<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    proposal.twap_config.twap_step_max
}

public fun get_amm_total_fee_bps<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    proposal.amm_total_fee_bps
}

/// Returns the parameters needed to initialize the market after the premarket phase.
public fun get_market_init_params<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): (u64, &vector<String>, &vector<u64>, &vector<u64>) {
    (
        proposal.outcome_data.outcome_count,
        &proposal.outcome_data.outcome_messages,
        &proposal.liquidity_config.asset_amounts,
        &proposal.liquidity_config.stable_amounts,
    )
}

// === Package Functions ===

/// Advances the proposal state based on elapsed time
/// Transitions from REVIEW to TRADING when review period ends
/// Returns true if state was changed
public fun advance_state<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    clock: &Clock,
    ctx: &mut TxContext,
): bool {
    let current_time = clock.timestamp_ms();
    // Use market_initialized_at for timing calculations instead of created_at
    // This ensures premarket proposals get proper review/trading periods after initialization
    let base_timestamp = if (proposal.timing.market_initialized_at.is_some()) {
        *proposal.timing.market_initialized_at.borrow()
    } else {
        // Fallback to created_at if market not initialized (shouldn't happen in normal flow)
        proposal.timing.created_at
    };

    // Check if we should transition from REVIEW to TRADING
    if (proposal.state == STATE_REVIEW) {
        let review_end = base_timestamp + proposal.timing.review_period_ms;
        if (current_time >= review_end) {
            proposal.state = STATE_TRADING;

            // Start trading in the market state
            let market = coin_escrow::get_market_state_mut(escrow);
            market_state::start_trading(market, proposal.timing.trading_period_ms, clock);

            // Extract market_id and trading_start_time before borrowing pools
            let market_id = market_state::market_id(market);
            let trading_start_time = market_state::get_trading_start(market);

            // Set oracle start time for all pools when trading begins
            let pools = market_state::borrow_amm_pools_mut(market);
            let mut i = 0;
            while (i < pools.length()) {
                let pool = &mut pools[i];
                conditional_amm::set_oracle_start_time(pool, market_id, trading_start_time);
                i = i + 1;
            };

            // NOTE: Quantum split and registration happens in proposal_lifecycle

            return true
        };
    };

    // Check if we should transition from TRADING to ended
    if (proposal.state == STATE_TRADING) {
        let trading_end =
            base_timestamp + proposal.timing.review_period_ms + proposal.timing.trading_period_ms;
        if (current_time >= trading_end) {
            // End trading in the market state
            let market = coin_escrow::get_market_state_mut(escrow);
            if (market_state::is_trading_active(market)) {
                market_state::end_trading(market, clock);
            };
            // Note: Full finalization requires calculating winner and is done separately
            // NOTE: spot pool registration is cleared in proposal_lifecycle
            return true
        };
    };

    false
}

public fun set_state<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    new_state: u8,
) {
    proposal.state = new_state;
}

public fun set_twap_prices<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    twap_prices: vector<u128>,
) {
    proposal.twap_config.twap_prices = twap_prices;
}

public fun set_last_twap_update<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    timestamp: u64,
) {
    proposal.timing.last_twap_update = timestamp;
}

public fun set_winning_outcome<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    outcome: u64,
) {
    proposal.outcome_data.winning_outcome = option::some(outcome);
}

/// Finalize the proposal with the winning outcome computed on-chain
/// This combines computing the winner from TWAP, setting the winning outcome and updating state atomically
#[test_only]
public fun finalize_proposal<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    clock: &Clock,
) {
    // Ensure we're in a state that can be finalized
    assert!(proposal.state == STATE_TRADING || proposal.state == STATE_REVIEW, EInvalidState);

    // If still in trading, end trading first
    if (proposal.state == STATE_TRADING) {
        let market = coin_escrow::get_market_state_mut(escrow);
        if (market_state::is_trading_active(market)) {
            market_state::end_trading(market, clock);
        };
    };

    // Critical fix: Compute the winning outcome on-chain from TWAP prices
    // Get TWAP prices from all pools
    let twap_prices = get_twaps_for_proposal(proposal, escrow, clock);

    // For a simple YES/NO proposal, compare the YES TWAP to the threshold
    let winning_outcome = if (twap_prices.length() >= 2) {
        let yes_twap = *twap_prices.borrow(OUTCOME_ACCEPTED);
        // Get threshold for outcome 1 (ACCEPTED)
        let threshold = get_effective_twap_threshold_for_outcome(proposal, OUTCOME_ACCEPTED);
        let yes_signed = signed::from_u128(yes_twap);

        // If YES TWAP exceeds threshold, YES wins
        if (signed::compare(&yes_signed, &threshold) == signed::ordering_greater()) {
            OUTCOME_ACCEPTED
        } else {
            OUTCOME_REJECTED
        }
    } else {
        // For single-outcome or other configs, default to first outcome
        // This should be revisited based on your specific requirements
        0
    };

    // Set the winning outcome
    proposal.outcome_data.winning_outcome = option::some(winning_outcome);

    // Update state to finalized
    proposal.state = STATE_FINALIZED;

    // Finalize the market state
    let market = coin_escrow::get_market_state_mut(escrow);
    market_state::finalize(market, winning_outcome, clock);
}

public fun get_outcome_creators<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): &vector<address> {
    &proposal.outcome_data.outcome_creators
}

/// Get the address of the creator for a specific outcome
public fun get_outcome_creator<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    outcome_index: u64,
): address {
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);
    *vector::borrow(&proposal.outcome_data.outcome_creators, outcome_index)
}

/// Get the total fee paid by proposer (for refunds)
public fun get_total_fee_paid<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    proposal.total_fee_paid
}

/// Get proposal start time for early resolve calculations
/// Returns market_initialized_at if available, otherwise created_at
public(package) fun get_start_time_for_early_resolve<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): u64 {
    if (proposal.timing.market_initialized_at.is_some()) {
        *proposal.timing.market_initialized_at.borrow()
    } else {
        proposal.timing.created_at
    }
}

public fun get_liquidity_provider<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): Option<address> {
    proposal.liquidity_provider
}

public fun get_proposer<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): address {
    proposal.proposer
}

/// Check if this proposal used admin quota/budget (excludes from creator rewards)
public fun get_used_quota<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): bool {
    proposal.used_quota
}

/// Check if this proposal's liquidity is in withdraw-only mode
public fun is_withdraw_only<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): bool {
    proposal.withdraw_only_mode
}

/// Set withdraw-only mode - prevents auto-reinvestment in next proposal
/// Only callable by the liquidity provider
public entry fun set_withdraw_only_mode<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    withdraw_only: bool,
    ctx: &TxContext,
) {
    assert!(proposal.liquidity_provider.is_some(), ENotLiquidityProvider);
    let provider = *proposal.liquidity_provider.borrow();
    assert!(tx_context::sender(ctx) == provider, ENotLiquidityProvider);
    proposal.withdraw_only_mode = withdraw_only;
}

public fun get_outcome_messages<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): &vector<String> {
    &proposal.outcome_data.outcome_messages
}

/// Get the intent spec for a specific outcome
public fun get_intent_spec_for_outcome<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    outcome_index: u64,
): &Option<vector<ActionSpec>> {
    vector::borrow(&proposal.outcome_data.intent_specs, outcome_index)
}

/// Take (move out) the intent spec for a specific outcome and clear the slot.
public fun take_intent_spec_for_outcome<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    outcome_index: u64,
): Option<vector<ActionSpec>> {
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);
    let slot = vector::borrow_mut(&mut proposal.outcome_data.intent_specs, outcome_index);
    let old_value = *slot;
    *slot = option::none();
    old_value
}

/// Mint a scoped cancel witness by taking (moving) the spec out of the slot.
/// Returns None if no spec was set for that outcome.
/// This witness can only be created once per (proposal, outcome) pair.
public fun make_cancel_witness<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    outcome_index: u64,
): option::Option<CancelWitness> {
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);
    let addr = object::uid_to_address(&proposal.id);
    let mut spec_opt = take_intent_spec_for_outcome(proposal, outcome_index);
    if (option::is_some(&spec_opt)) {
        let action_count_slot = vector::borrow_mut(
            &mut proposal.outcome_data.actions_per_outcome,
            outcome_index,
        );
        *action_count_slot = 0;
        option::destroy_some(spec_opt);
        option::some(CancelWitness {
            proposal: addr,
            outcome_index,
        })
    } else {
        option::none<CancelWitness>()
    }
}

/// Set the intent spec for a specific outcome and track action count
/// This function:
/// 1. Validates the IntentSpec action count
/// 2. Stores the IntentSpec in the outcome slot
/// NOTE: Outcome 0 (REJECT) cannot have actions - it represents "do nothing" / status quo
public fun set_intent_spec_for_outcome<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    outcome_index: u64,
    intent_spec: vector<ActionSpec>,
    max_actions_per_outcome: u64,
) {
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);

    // Outcome 0 (REJECT) cannot have actions - it represents the status quo / "do nothing"
    assert!(outcome_index > 0, ECannotSetActionsForRejectOutcome);

    let spec_slot = vector::borrow_mut(&mut proposal.outcome_data.intent_specs, outcome_index);
    let action_count = vector::borrow_mut(
        &mut proposal.outcome_data.actions_per_outcome,
        outcome_index,
    );

    // Get action count from the spec
    let num_actions = vector::length(&intent_spec);

    // Check outcome limit only
    assert!(num_actions <= max_actions_per_outcome, ETooManyActions);

    // Set the intent spec and update count
    *spec_slot = option::some(intent_spec);
    *action_count = num_actions;
}

/// Check if an outcome has an intent spec
public fun has_intent_spec<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    outcome_index: u64,
): bool {
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);
    option::is_some(vector::borrow(&proposal.outcome_data.intent_specs, outcome_index))
}

/// Get the number of actions for a specific outcome
public fun get_actions_for_outcome<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    outcome_index: u64,
): u64 {
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);
    *vector::borrow(&proposal.outcome_data.actions_per_outcome, outcome_index)
}

/// Clear the intent spec for an outcome and reset action count
public fun clear_intent_spec_for_outcome<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    outcome_index: u64,
) {
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);

    let spec_slot = vector::borrow_mut(&mut proposal.outcome_data.intent_specs, outcome_index);
    let action_count = vector::borrow_mut(
        &mut proposal.outcome_data.actions_per_outcome,
        outcome_index,
    );

    if (option::is_some(spec_slot)) {
        // Clear the intent spec
        *spec_slot = option::none();

        // Reset this outcome's action count
        *action_count = 0;
    };
}

// === Test Functions ===

#[test_only]
/// Create a minimal proposal for testing
public fun new_for_testing<AssetType, StableType>(
    dao_id: address,
    proposer: address,
    liquidity_provider: Option<address>,
    title: String,
    introduction_details: String,
    metadata: String,
    outcome_messages: vector<String>,
    initial_outcome_details: vector<String>,
    outcome_creators: vector<address>,
    outcome_count: u8,
    review_period_ms: u64,
    trading_period_ms: u64,
    min_asset_liquidity: u64,
    min_stable_liquidity: u64,
    twap_start_delay: u64,
    twap_initial_observation: u128,
    twap_step_max: u64,
    twap_threshold: SignedU128,
    amm_total_fee_bps: u64,
    max_outcomes: u64,
    winning_outcome: Option<u64>,
    treasury_address: address,
    intent_specs: vector<Option<vector<ActionSpec>>>,
    ctx: &mut TxContext,
): Proposal<AssetType, StableType> {
    Proposal {
        id: object::new(ctx),
        dao_id: object::id_from_address(dao_id),
        state: STATE_PREMARKET,
        proposer,
        liquidity_provider,
        withdraw_only_mode: false,
        used_quota: false, // Default to false for testing
        outcome_sponsor_thresholds: vector::tabulate!(outcome_count as u64, |_| option::none<SignedU128>()),
        sponsor_quota_used_for_proposal: false,
        sponsor_quota_user: option::none(),
        escrow_id: option::none(),
        market_state_id: option::none(),
        conditional_treasury_caps: bag::new(ctx),
        conditional_metadata: bag::new(ctx),
        title,
        introduction_details,
        details: initial_outcome_details,
        metadata,
        timing: ProposalTiming {
            created_at: 0,
            market_initialized_at: option::none(),
            review_period_ms,
            trading_period_ms,
            last_twap_update: 0,
            twap_start_delay,
        },
        liquidity_config: LiquidityConfig {
            min_asset_liquidity,
            min_stable_liquidity,
            asset_amounts: vector::empty(),
            stable_amounts: vector::empty(),
        },
        twap_config: TwapConfig {
            twap_prices: vector::empty(),
            twap_initial_observation,
            twap_step_max,
            twap_threshold,
        },
        outcome_data: OutcomeData {
            outcome_count: outcome_count as u64,
            outcome_messages,
            outcome_creators,
            intent_specs,
            actions_per_outcome: vector::tabulate!(outcome_count as u64, |_| 0),
            winning_outcome,
        },
        amm_total_fee_bps,
        conditional_liquidity_ratio_percent: 50, // 50% (base 100, not bps!)
        fee_escrow: balance::zero(), // No fees for test proposals
        total_fee_paid: 0, // No fees for test proposals
        treasury_address,
        max_outcomes,
    }
}

#[test_only]
/// Set the state of a proposal for testing
public fun set_state_for_testing<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    new_state: u8,
) {
    proposal.state = new_state;
}

#[test_only]
/// Set the escrow_id of a proposal for testing
public fun set_escrow_id_for_testing<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow_id: ID,
) {
    proposal.escrow_id = option::some(escrow_id);
}

#[test_only]
/// Set the market_state_id of a proposal for testing
public fun set_market_state_id_for_testing<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    market_state_id: ID,
) {
    proposal.market_state_id = option::some(market_state_id);
}

#[test_only]
/// Gets a mutable reference to the token escrow of the proposal
public fun test_get_coin_escrow<AssetType, StableType>(
    escrow: &mut coin_escrow::TokenEscrow<AssetType, StableType>,
): &mut coin_escrow::TokenEscrow<AssetType, StableType> {
    escrow
}

#[test_only]
/// Gets the market state through the token escrow
public fun test_get_market_state<AssetType, StableType>(
    escrow: &coin_escrow::TokenEscrow<AssetType, StableType>,
): &market_state::MarketState {
    escrow.get_market_state()
}

// === Additional View Functions ===

/// Get proposal ID
public fun id<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): ID {
    object::id(proposal)
}

/// Get proposal address (for testing)
public fun id_address<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): address {
    object::uid_to_address(&proposal.id)
}

// === Conditional Coin Management ===

/// Add a conditional coin treasury cap and metadata to proposal
/// Must be called once per outcome per side (asset/stable)
/// The coin will be validated and its metadata updated according to DAO config
public fun add_conditional_coin<AssetType, StableType, ConditionalCoinType>(
    proposal: &mut Proposal<AssetType, StableType>,
    outcome_index: u64,
    is_asset: bool, // true for asset-conditional, false for stable-conditional
    mut treasury_cap: TreasuryCap<ConditionalCoinType>,
    mut metadata: CoinMetadata<ConditionalCoinType>,
    coin_config: &ConditionalCoinConfig,
    asset_type_name: &String, // Name of AssetType (e.g., "SUI")
    stable_type_name: &String, // Name of StableType (e.g., "USDC")
) {
    assert!(proposal.state == STATE_PREMARKET, EInvalidState);
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);

    // Create key for this conditional coin
    let key = ConditionalCoinKey { outcome_index, is_asset };

    // Check not already set
    assert!(!bag::contains(&proposal.conditional_treasury_caps, key), EConditionalCoinAlreadySet);

    // Validate coin meets requirements: supply must be zero
    assert!(coin::total_supply(&treasury_cap) == 0, ESupplyNotZero);

    // Update metadata with DAO naming pattern: c_<outcome>_<ASSET|STABLE>
    update_conditional_coin_metadata(
        &mut metadata,
        coin_config,
        outcome_index,
        if (is_asset) { asset_type_name } else { stable_type_name },
    );

    // Store in bags
    bag::add(&mut proposal.conditional_treasury_caps, key, treasury_cap);
    bag::add(&mut proposal.conditional_metadata, key, metadata);
}

/// Entry helper that derives the DAO's ConditionalCoinConfig from the account object.
/// Removes the need for clients to manually locate the Futarchy config dynamic field.
public entry fun add_conditional_coin_via_account<AssetType, StableType, ConditionalCoinType>(
    proposal: &mut Proposal<AssetType, StableType>,
    outcome_index: u64,
    is_asset: bool,
    treasury_cap: TreasuryCap<ConditionalCoinType>,
    metadata: CoinMetadata<ConditionalCoinType>,
    dao_account: &account::Account,
    asset_type_name: String,
    stable_type_name: String,
) {
    let futarchy_cfg = account::config<futarchy_config::FutarchyConfig>(dao_account);
    let dao_cfg = futarchy_config::dao_config(futarchy_cfg);
    let coin_cfg = dao_config::conditional_coin_config(dao_cfg);

    add_conditional_coin(
        proposal,
        outcome_index,
        is_asset,
        treasury_cap,
        metadata,
        coin_cfg,
        &asset_type_name,
        &stable_type_name,
    );
}

/// Update conditional coin metadata with DAO naming pattern
/// Pattern: c_<outcome_index>_<ASSET_NAME>
fun update_conditional_coin_metadata<ConditionalCoinType>(
    metadata: &mut CoinMetadata<ConditionalCoinType>,
    coin_config: &ConditionalCoinConfig,
    outcome_index: u64,
    base_coin_name: &String,
) {
    use std::ascii;
    use sui::url;

    // Build name: prefix + outcome_index + _ + base_coin_name
    let mut name_bytes = vector::empty<u8>();

    // Add prefix (e.g., "c_") if configured
    let prefix_opt = dao_config::coin_name_prefix(coin_config);
    if (prefix_opt.is_some()) {
        let prefix = prefix_opt.destroy_some();
        let prefix_bytes = ascii::as_bytes(&prefix);
        let mut i = 0;
        while (i < prefix_bytes.length()) {
            name_bytes.push_back(*prefix_bytes.borrow(i));
            i = i + 1;
        };
    } else {
        prefix_opt.destroy_none();
    };

    // Add outcome index if configured
    if (dao_config::use_outcome_index(coin_config)) {
        // Convert outcome_index to string
        let index_str = u64_to_ascii(outcome_index);
        let index_bytes = ascii::as_bytes(&index_str);
        let mut i = 0;
        while (i < index_bytes.length()) {
            name_bytes.push_back(*index_bytes.borrow(i));
            i = i + 1;
        };
        name_bytes.push_back(95u8); // '_' character
    };

    // Add base coin name
    {
        let base_bytes = string::as_bytes(base_coin_name);
        let mut i = 0;
        while (i < base_bytes.length()) {
            name_bytes.push_back(*base_bytes.borrow(i));
            i = i + 1;
        };
    };

    // Update metadata (need to use coin::update_* functions if available)
    // For now, just validate - actual metadata update requires special capabilities
    // This will be handled when we integrate with coin framework properly
}

/// Helper: Convert u64 to ASCII string
fun u64_to_ascii(mut num: u64): AsciiString {
    use std::ascii;

    if (num == 0) {
        return ascii::string(b"0")
    };

    let mut digits = vector::empty<u8>();
    while (num > 0) {
        let digit = ((num % 10) as u8) + 48; // ASCII '0' = 48
        vector::push_back(&mut digits, digit);
        num = num / 10;
    };

    // Reverse digits
    vector::reverse(&mut digits);
    ascii::string(digits)
}

// === LP Preferences Dynamic Field Management ===

/// Get mutable reference to proposal's UID for dynamic field operations
/// Public to allow other packages (e.g., futarchy_governance) to use dynamic fields
public fun borrow_uid_mut<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
): &mut UID {
    &mut proposal.id
}

/// Get immutable reference to proposal's UID for dynamic field reads
/// Public to allow other packages (e.g., futarchy_governance) to use dynamic fields
public fun borrow_uid<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): &UID {
    &proposal.id
}

// === Sponsorship Functions ===

/// Check if ANY outcome in the proposal is sponsored (for backward compatibility)
public fun is_sponsored<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): bool {
    let mut i = 0u64;
    while (i < proposal.outcome_sponsor_thresholds.length()) {
        if (proposal.outcome_sponsor_thresholds.borrow(i).is_some()) {
            return true
        };
        i = i + 1;
    };
    false
}

/// Check if a specific outcome is sponsored
public fun is_outcome_sponsored<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    outcome_index: u64,
): bool {
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);
    proposal.outcome_sponsor_thresholds.borrow(outcome_index).is_some()
}

/// Set sponsorship threshold for a specific outcome
/// SECURITY: Requires SponsorshipAuth from futarchy_core::sponsorship_auth
/// SECURITY: Cannot sponsor outcome 0 (reject) - reject must always use base threshold
public fun set_outcome_sponsorship<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    outcome_index: u64,
    sponsored_threshold: SignedU128,
    _auth: SponsorshipAuth, // Compile-time type safety - only authorized modules can create this
) {
    // Cannot sponsor finalized proposals
    assert!(proposal.state != STATE_FINALIZED, EInvalidState);
    assert!(outcome_index > 0, ECannotSponsorReject); // Reject cannot be sponsored
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);

    // Check if already sponsored
    let threshold_opt = proposal.outcome_sponsor_thresholds.borrow_mut(outcome_index);
    assert!(threshold_opt.is_none(), EAlreadySponsored);

    // Set the sponsored threshold
    *threshold_opt = option::some(sponsored_threshold);
}

/// Mark that sponsor quota has been used for this proposal and record who used it
/// SECURITY: Requires SponsorshipAuth from futarchy_core::sponsorship_auth
public fun mark_sponsor_quota_used<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    sponsor: address,
    _auth: SponsorshipAuth, // Compile-time type safety - only authorized modules can create this
) {
    proposal.sponsor_quota_used_for_proposal = true;
    proposal.sponsor_quota_user = option::some(sponsor);
}

/// Check if sponsor quota has already been used for this proposal
public fun is_sponsor_quota_used<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): bool {
    proposal.sponsor_quota_used_for_proposal
}

/// Get the sponsor who used quota for this proposal (if any)
public fun get_sponsor_quota_user<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
): Option<address> {
    proposal.sponsor_quota_user
}

/// Clear all sponsorships (for refunds on eviction/cancellation)
/// SECURITY: Requires SponsorshipAuth from futarchy_core::sponsorship_auth
/// Note: Skips outcome 0 (reject) since it can never be sponsored anyway
public fun clear_all_sponsorships<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    _auth: SponsorshipAuth, // Compile-time type safety - only authorized modules can create this
) {
    let mut i = 1u64; // Start at 1 to skip outcome 0 (reject)
    while (i < proposal.outcome_sponsor_thresholds.length()) {
        *proposal.outcome_sponsor_thresholds.borrow_mut(i) = option::none();
        i = i + 1;
    };
    proposal.sponsor_quota_used_for_proposal = false;
    proposal.sponsor_quota_user = option::none();
}

/// Get the effective TWAP threshold for a specific outcome
/// If outcome is sponsored, returns the sponsored threshold
/// Otherwise returns the base threshold from DAO config
public fun get_effective_twap_threshold_for_outcome<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    outcome_index: u64,
): SignedU128 {
    assert!(outcome_index < proposal.outcome_data.outcome_count, EOutcomeOutOfBounds);

    // Check if this outcome is sponsored
    let threshold_opt = proposal.outcome_sponsor_thresholds.borrow(outcome_index);

    if (threshold_opt.is_some()) {
        // Use sponsored threshold
        *threshold_opt.borrow()
    } else {
        // Use base threshold from DAO config
        proposal.twap_config.twap_threshold
    }
}

#[test_only]
/// Simplified test helper: creates a REAL proposal with sensible defaults
/// Can configure state (FINALIZED), outcome_count, and winning_outcome for testing
public fun create_test_proposal<AssetType, StableType>(
    outcome_count: u8,
    winning_outcome: u64,
    is_finalized: bool,
    ctx: &mut TxContext,
): Proposal<AssetType, StableType> {
    use std::string;

    let outcome_messages = vector::tabulate!(outcome_count as u64, |i| {
        string::utf8(b"Outcome")
    });

    let outcome_creators = vector::tabulate!(outcome_count as u64, |_| @0xAAA);

    let intent_specs = vector::tabulate!(
        outcome_count as u64,
        |_| option::none<vector<ActionSpec>>(),
    );

    let mut proposal = new_for_testing<AssetType, StableType>(
        @0x1, // dao_id
        @0x2, // proposer
        option::some(@0x3), // liquidity_provider
        string::utf8(b"Test"), // title
        string::utf8(b"Introduction Details"), // introduction_details
        string::utf8(b"Metadata"), // metadata
        outcome_messages,
        outcome_messages, // initial_outcome_details (reuse outcome_messages)
        outcome_creators,
        outcome_count,
        60000, // review_period_ms (1 min)
        120000, // trading_period_ms (2 min)
        1000, // min_asset_liquidity
        1000, // min_stable_liquidity
        30000, // twap_start_delay
        1000000000000000000u128, // twap_initial_observation
        10000, // twap_step_max
        signed::from_u128(500000000000000000u128), // twap_threshold
        30, // amm_total_fee_bps (0.3%)
        10, // max_outcomes
        option::some(winning_outcome),
        @0x4, // treasury_address
        intent_specs,
        ctx,
    );

    if (is_finalized) {
        set_state(&mut proposal, STATE_FINALIZED);
    };

    proposal
}

#[test_only]
/// Destroy a proposal for testing - handles cleanup of all internal structures
public fun destroy_for_testing<AssetType, StableType>(proposal: Proposal<AssetType, StableType>) {
    let Proposal {
        id,
        state: _,
        dao_id: _,
        proposer: _,
        liquidity_provider: _,
        withdraw_only_mode: _,
        used_quota: _,
        outcome_sponsor_thresholds: _,
        sponsor_quota_used_for_proposal: _,
        sponsor_quota_user: _,
        escrow_id: _,
        market_state_id: _,
        conditional_treasury_caps,
        conditional_metadata,
        title: _,
        introduction_details: _,
        details: _,
        metadata: _,
        timing: ProposalTiming {
            created_at: _,
            market_initialized_at: _,
            review_period_ms: _,
            trading_period_ms: _,
            last_twap_update: _,
            twap_start_delay: _,
        },
        liquidity_config: LiquidityConfig {
            min_asset_liquidity: _,
            min_stable_liquidity: _,
            asset_amounts: _,
            stable_amounts: _,
        },
        twap_config: TwapConfig {
            twap_prices: _,
            twap_initial_observation: _,
            twap_step_max: _,
            twap_threshold: _,
        },
        outcome_data: OutcomeData {
            outcome_count: _,
            outcome_messages: _,
            outcome_creators: _,
            intent_specs: _,
            actions_per_outcome: _,
            winning_outcome: _,
        },
        amm_total_fee_bps: _,
        conditional_liquidity_ratio_percent: _,
        fee_escrow,
        total_fee_paid: _,
        treasury_address: _,
        max_outcomes: _,
    } = proposal;

    // Destroy bags (must be empty for testing)
    bag::destroy_empty(conditional_treasury_caps);
    bag::destroy_empty(conditional_metadata);
    fee_escrow.destroy_zero();

    object::delete(id);
}
