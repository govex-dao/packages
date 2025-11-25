// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Handles the complete lifecycle of proposals from queue activation to intent execution
module futarchy_governance::proposal_lifecycle;

use account_actions::vault;
use account_protocol::account::{Self, Account};
use account_protocol::executable::{Self, Executable};
use account_protocol::intents::{Self, Intent};
use account_protocol::package_registry::{Self, PackageRegistry};
use futarchy_core::futarchy_config::{Self, FutarchyConfig, FutarchyOutcome};
use futarchy_core::version;
use futarchy_governance_actions::governance_intents;
use futarchy_markets_primitives::coin_escrow;
use futarchy_markets_primitives::conditional_amm;
use futarchy_markets_primitives::market_state::{Self, MarketState};
use futarchy_markets_core::proposal::{Self, Proposal};
use futarchy_markets_core::quantum_lp_manager;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_one_shot_utils::strategy;
use futarchy_types::signed::{Self as signed};
use std::option;
use std::string::String;
use std::type_name;
use std::vector;
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object;

// === Errors ===
const EProposalNotActive: u64 = 1;
const EMarketNotFinalized: u64 = 2;
const EProposalNotApproved: u64 = 3;
const ENoIntentKey: u64 = 4;
const EInvalidWinningOutcome: u64 = 5;
const EIntentExpiryTooLong: u64 = 6;
const EProposalCreationBlocked: u64 = 7; // Pool launch fee decay in progress

// === Constants ===
// NOTE: Reject is ALWAYS outcome 0 (baseline/status quo)
// Accept is ALWAYS outcome 1+ (proposed actions)
const OUTCOME_REJECTED: u64 = 0;
const OUTCOME_ACCEPTED: u64 = 1;

// === Events ===

/// Emitted when a proposal is activated from the queue
public struct ProposalActivated has copy, drop {
    proposal_id: ID,
    dao_id: ID,
    has_intent_spec: bool,
    timestamp: u64,
}

/// Emitted when a proposal's market is finalized
public struct ProposalMarketFinalized has copy, drop {
    proposal_id: ID,
    dao_id: ID,
    winning_outcome: u64,
    approved: bool,
    timestamp: u64,
}

/// Emitted when a proposal's intent is executed
public struct ProposalIntentExecuted has copy, drop {
    proposal_id: ID,
    dao_id: ID,
    intent_key: String,
    timestamp: u64,
}

/// Create a ProposalIntentExecuted event
public(package) fun new_proposal_intent_executed(
    proposal_id: ID,
    dao_id: ID,
    intent_key: String,
    timestamp: u64,
): ProposalIntentExecuted {
    ProposalIntentExecuted {
        proposal_id,
        dao_id,
        intent_key,
        timestamp,
    }
}

// === Public Functions ===

/// Finalizes a proposal's market and determines the winning outcome
/// This should be called after trading has ended and TWAP prices are calculated
public fun finalize_proposal_market<AssetType, StableType>(
    account: &mut Account,
    registry: &package_registry::PackageRegistry,
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut futarchy_markets_primitives::coin_escrow::TokenEscrow<AssetType, StableType>,
    market_state: &mut MarketState,
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    finalize_proposal_market_internal(
        account,
        registry,
        proposal,
        escrow,
        market_state,
        spot_pool,
        false,
        clock,
        ctx,
    );
}

/// Internal implementation shared by both finalization functions
fun finalize_proposal_market_internal<AssetType, StableType>(
    account: &mut Account,
    registry: &PackageRegistry,
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut futarchy_markets_primitives::coin_escrow::TokenEscrow<AssetType, StableType>,
    market_state: &mut MarketState,
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType>,
    _is_early_resolution: bool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Calculate winning outcome and get TWAPs in single computation
    let (winning_outcome, twap_prices) = calculate_winning_outcome_with_twaps(
        proposal,
        escrow,
        clock,
    );

    // Store the final TWAPs for third-party access
    proposal::set_twap_prices(proposal, twap_prices);

    // Set the winning outcome on the proposal
    proposal::set_winning_outcome(proposal, winning_outcome);

    // Finalize the market state
    market_state::finalize(market_state, winning_outcome, clock);

    // Return quantum-split liquidity back to the spot pool
    quantum_lp_manager::auto_redeem_on_proposal_end_from_escrow(
        winning_outcome,
        spot_pool,
        escrow,
        clock,
        ctx,
    );

    // CRITICAL FIX (Issue 3): Extract and clear escrow ID from spot pool
    // This clears the active escrow flag so has_active_escrow() returns false
    let _escrow_id = unified_spot_pool::extract_active_escrow(spot_pool);

    // Spot TWAP continues running throughout proposal (no backfill needed)
    // Auto-arbitrage keeps spot and conditional prices synced

    // Crank removed - no bucket transitions needed with simplified model

    // NEW: Cancel losing outcome intents in the hot path using a scoped witness.
    // This ensures per-proposal isolation and prevents cross-proposal cancellation
    let num_outcomes = proposal::get_num_outcomes(proposal);
    let mut i = 0u64;
    while (i < num_outcomes) {
        if (i != winning_outcome) {
            // Mint a scoped cancel witness for this specific proposal/outcome
            let mut cw_opt = proposal::make_cancel_witness(proposal, i);
            if (option::is_some(&cw_opt)) {
                let _cw = option::extract(&mut cw_opt);
                // No additional work required: make_cancel_witness removes the spec
                // and resets the action count for this outcome in the new InitActionSpecs model.
            };
            // Properly destroy the empty option
            option::destroy_none(cw_opt);
        };
        i = i + 1;
    };

    // --- BEGIN PROPOSER FEE REFUNDS & REWARDS ---
    // Economic model:
    // - Outcome 0 wins (Reject): DAO keeps all fees
    // - Any outcome 1+ wins (Accept): Proposer gets full refund + bonus reward
    //
    // All outcomes are created by the proposer at proposal creation time.
    // No mutation allowed - simpler and prevents gaming.
    if (winning_outcome > 0) {
        let config: &FutarchyConfig = account::config(account);

        // 1. Refund all fees to proposer
        let fee_escrow_balance = proposal::take_fee_escrow(proposal);
        let fee_escrow_coin = coin::from_balance(fee_escrow_balance, ctx);
        let proposer = proposal::get_proposer(proposal);

        if (fee_escrow_coin.value() > 0) {
            transfer::public_transfer(fee_escrow_coin, proposer);
        } else {
            fee_escrow_coin.destroy_zero();
        };

        // 2. Pay bonus reward to proposer (if configured)
        // Note: Reward is paid in StableType from DAO's "stable" vault
        //
        // IMPORTANT: Skip reward if ANY of these conditions are true:
        // - Proposal used admin quota (got free/discounted proposal creation)
        // - Proposal was EXPLICITLY sponsored (team member called sponsor function)
        let win_reward = futarchy_config::outcome_win_reward(config);
        let used_quota = proposal::get_used_quota(proposal);
        let was_sponsored = proposal::is_sponsored(proposal);

        if (win_reward > 0 && !used_quota && !was_sponsored) {
            // Access DAO's "stable" vault to check balance and withdraw reward
            let vault_name = b"stable".to_string();
            let dao_address = account.addr();

            // Check if vault exists
            if (vault::has_vault(account, vault_name)) {
                let dao_vault = vault::borrow_vault(account, registry, vault_name);

                // Check if the vault has StableType balance
                if (vault::coin_type_exists<StableType>(dao_vault)) {
                    let available_balance = vault::coin_type_value<StableType>(dao_vault);

                    // Only pay if vault has funds
                    if (available_balance > 0) {
                        let actual_reward_amount = if (available_balance >= win_reward) {
                            win_reward
                        } else {
                            available_balance
                        };

                        let reward_coin = vault::withdraw_permissionless<FutarchyConfig, StableType>(
                            account,
                            registry,
                            dao_address,
                            vault_name,
                            actual_reward_amount,
                            ctx,
                        );

                        transfer::public_transfer(reward_coin, proposer);
                    };
                };
            };
        };
    };
    // If outcome 0 wins, DAO keeps all fees - no refunds or rewards
    // --- END PROPOSER FEE REFUNDS & REWARDS ---

    // Emit finalization event
    event::emit(ProposalMarketFinalized {
        proposal_id: proposal::get_id(proposal),
        dao_id: proposal::get_dao_id(proposal),
        winning_outcome,
        approved: winning_outcome > 0, // Any accept outcome (1+) means approved
        timestamp: clock.timestamp_ms(),
    });
}


// === Proposal State Transitions with Quantum Split ===

/// Advances proposal state and handles quantum liquidity operations
/// Call this periodically to transition proposals through their lifecycle
///
/// CRITICAL: Respects withdraw_only_mode flag to prevent auto-reinvestment
/// If previous proposal has withdraw_only_mode=true, its liquidity will NOT be quantum-split
public entry fun advance_proposal_state<AssetType, StableType>(
    account: &mut Account,
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut futarchy_markets_primitives::coin_escrow::TokenEscrow<AssetType, StableType>,
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType>,
    clock: &Clock,
    ctx: &mut TxContext,
): bool {
    // Try to advance the proposal state
    let state_changed = proposal::advance_state(proposal, escrow, clock, ctx);

    // If state just changed to TRADING, store escrow and perform quantum split
    if (state_changed && proposal::is_live(proposal)) {
        // CRITICAL: Store escrow ID in spot pool FIRST (before quantum split)
        // This enables has_active_escrow() to return true, which routes LPs to TRANSITIONING bucket
        // All futarchy pools have full features (TWAP, escrow tracking, etc.)
        let escrow_id = object::id(escrow);
        unified_spot_pool::store_active_escrow(spot_pool, escrow_id);

        // CRITICAL: Check withdraw_only_mode flag before quantum split
        // If liquidity provider wants to withdraw after this proposal ends,
        // we should NOT quantum-split their liquidity for trading
        if (!proposal::is_withdraw_only(proposal)) {
            // Get conditional liquidity ratio from DAO config
            let config = account::config(account);
            let conditional_liquidity_ratio_percent = futarchy_config::conditional_liquidity_ratio_percent(
                config,
            );

            // CRITICAL: Mark liquidity as moving to proposal in spot pool's aggregator config
            // This stores the conditional_liquidity_ratio_percent for oracle logic
            unified_spot_pool::mark_liquidity_to_proposal(
                spot_pool,
                conditional_liquidity_ratio_percent,
                clock,
            );

            // Perform quantum split: move liquidity from spot to conditional markets
            quantum_lp_manager::auto_quantum_split_on_proposal_start(
                spot_pool,
                escrow,
                object::id(proposal), // proposal_id parameter
                conditional_liquidity_ratio_percent,
                clock,
                ctx,
            );
        };
        // If withdraw_only_mode = true, skip quantum split but still track escrow
        // Liquidity will be returned to provider when proposal finalizes
    };

    state_changed
}

/// Entry function to finalize a proposal with quantum liquidity recombination
/// This is THE proper way to finalize proposals that use DAO spot pool liquidity
/// Determines winner via TWAP and returns quantum-split liquidity back to spot pool
public entry fun finalize_proposal_with_spot_pool<AssetType, StableType>(
    account: &mut Account,
    registry: &PackageRegistry,
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut futarchy_markets_primitives::coin_escrow::TokenEscrow<AssetType, StableType>,
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Calculate winning outcome and get TWAPs in single computation
    let (winning_outcome, twap_prices) = calculate_winning_outcome_with_twaps(
        proposal,
        escrow,
        clock,
    );

    // Store the final TWAPs for third-party access
    proposal::set_twap_prices(proposal, twap_prices);

    // Set the winning outcome on the proposal
    proposal::set_winning_outcome(proposal, winning_outcome);

    // Get mutable reference to market_state from escrow and finalize it
    {
        let market_state = coin_escrow::get_market_state_mut(escrow);
        market_state::end_trading(market_state, clock); // Must end trading before finalizing
        market_state::finalize(market_state, winning_outcome, clock);
    }; // Borrow ends here

    // Return quantum-split liquidity back to the spot pool
    // This function extracts market_state from escrow internally to avoid borrow conflicts
    futarchy_markets_core::quantum_lp_manager::auto_redeem_on_proposal_end_from_escrow(
        winning_outcome,
        spot_pool,
        escrow,
        clock,
        ctx,
    );

    // CRITICAL FIX (Issue 3): Extract and clear escrow ID from spot pool
    // All futarchy pools have full features, so this always succeeds
    let _escrow_id = unified_spot_pool::extract_active_escrow(spot_pool);

    // Crank removed - no bucket transitions needed with simplified model

    // Cancel losing outcome intents
    let num_outcomes = proposal::get_num_outcomes(proposal);
    let mut i = 0u64;
    while (i < num_outcomes) {
        if (i != winning_outcome) {
            let mut cw_opt = proposal::make_cancel_witness(proposal, i);
            if (option::is_some(&cw_opt)) {
                let _cw = option::extract(&mut cw_opt);
            };
            option::destroy_none(cw_opt);
        };
        i = i + 1;
    };

    // Update proposal state to FINALIZED (state 3)
    proposal::set_state(proposal, 3);

    // Emit finalization event
    event::emit(ProposalMarketFinalized {
        proposal_id: proposal::get_id(proposal),
        dao_id: proposal::get_dao_id(proposal),
        winning_outcome,
        approved: winning_outcome > 0, // Any accept outcome (1+) means approved
        timestamp: clock.timestamp_ms(),
    });
}

/// Entry function to execute proposal actions after finalization
/// Executes the staged InitActionSpecs if the Accept outcome won
public entry fun execute_proposal_actions<AssetType, StableType>(
    account: &mut Account,
    registry: &PackageRegistry,
    proposal: &mut Proposal<AssetType, StableType>,
    market_state: &MarketState,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Verify proposal can be executed
    assert!(can_execute_proposal(proposal, market_state), EProposalNotApproved);

    // Extract IDs before mutable borrow
    let proposal_id = proposal::get_id(proposal);
    let dao_id = proposal::get_dao_id(proposal);
    let market_state_id = proposal::market_state_id(proposal);

    // Build intent key hint
    let mut key = b"execution_".to_string();
    key.append(proposal_id.id_to_address().to_string());
    key.append(b"_".to_string());
    key.append(clock.timestamp_ms().to_string());

    // Begin execution - creates Executable hot potato
    let executable = governance_intents::execute_proposal_intent(
        account,
        registry,
        proposal,
        market_state,
        OUTCOME_ACCEPTED, // 1 = Accept (0 = Reject)
        futarchy_config::new_futarchy_outcome_full(
            key,
            option::some(proposal_id),
            option::some(market_state_id),
            true,
            clock.timestamp_ms(),
        ),
        clock,
        ctx,
    );

    // Extract intent key from executable for event emission
    let intent_key = intents::key(executable::intent(&executable));

    // Confirm execution (finalize)
    account::confirm_execution(account, executable);

    // Emit event
    event::emit(new_proposal_intent_executed(
        proposal_id,
        dao_id,
        intent_key,
        clock.timestamp_ms(),
    ));
}

// === Helper Functions ===

/// Checks if a proposal can be executed
public fun can_execute_proposal<AssetType, StableType>(
    proposal: &Proposal<AssetType, StableType>,
    market: &MarketState,
): bool {
    // Market must be finalized
    if (!market_state::is_finalized(market)) {
        return false
    };

    // Proposal must have been approved (YES outcome)
    let winning_outcome = market_state::get_winning_outcome(market);
    if (winning_outcome != OUTCOME_ACCEPTED) {
        return false
    };

    // InitActionSpecs are now stored directly in proposals (no separate intent key system)
    // No additional check needed - if proposal is finalized with ACCEPTED outcome, it can execute
    true
}

/// Calculates the winning outcome and returns TWAP prices to avoid double computation
/// Returns (outcome, twap_prices)
/// IMPORTANT: Uses per-outcome sponsorship thresholds
/// Winner = outcome with highest TWAP among those that pass their threshold
/// If no outcome passes, OUTCOME_REJECTED (0) wins by default
public fun calculate_winning_outcome_with_twaps<AssetType, StableType>(
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut futarchy_markets_primitives::coin_escrow::TokenEscrow<AssetType, StableType>,
    clock: &Clock,
): (u64, vector<u128>) {
    // Get TWAP prices from all pools (only computed once now)
    let twap_prices = proposal::get_twaps_for_proposal(proposal, escrow, clock);
    let num_outcomes = twap_prices.length();

    // Check each outcome against its own effective threshold
    let mut winning_outcome = OUTCOME_REJECTED; // Default to reject
    let mut highest_twap = 0u128;

    let mut i = 0u64;
    while (i < num_outcomes) {
        let outcome_twap = *twap_prices.borrow(i);

        // Get the effective threshold for this specific outcome
        let outcome_threshold = proposal::get_effective_twap_threshold_for_outcome(proposal, i);
        let outcome_signed = signed::from_u128(outcome_twap);

        // Check if this outcome passes its threshold
        if (signed::compare(&outcome_signed, &outcome_threshold) == signed::ordering_greater()) {
            // This outcome passes - check if it has the highest TWAP
            if (outcome_twap > highest_twap) {
                highest_twap = outcome_twap;
                winning_outcome = i;
            }
        };

        i = i + 1;
    };

    (winning_outcome, twap_prices)
}

// === Helper Functions for PTB Execution ===

public fun is_passed<AssetType, StableType>(proposal: &Proposal<AssetType, StableType>): bool {
    use futarchy_markets_core::proposal as proposal_mod;
    proposal_mod::is_finalized(proposal) && proposal_mod::get_winning_outcome(proposal) == OUTCOME_ACCEPTED
}
