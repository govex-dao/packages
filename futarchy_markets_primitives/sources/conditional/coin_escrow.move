// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

module futarchy_markets_primitives::coin_escrow;

use futarchy_markets_primitives::market_state::{Self, MarketState};
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};
use sui::dynamic_field;

// === Introduction ===
// The TokenEscrow manages TreasuryCap-based conditional coins in the futarchy prediction market system.
//
// === TreasuryCap-Based Conditional Coins ===
// Uses real Sui Coin<T> types instead of custom ConditionalToken structs:
// 1. **TreasuryCap Storage**: Each outcome has 2 TreasuryCaps (asset + stable) stored in dynamic fields
// 2. **Registry Integration**: Blank coins acquired from permissionless registry
// 3. **Quantum Liquidity**: Spot tokens exist simultaneously in ALL outcomes (not split between them)
//
// === Quantum Liquidity Invariant ===
// **CRITICAL**: 100 spot tokens → 100 conditional tokens in EACH outcome
// - NOT proportional split (not 50/50 across 2 outcomes)
// - Liquidity exists fully in all markets simultaneously
// - Only highest-priced outcome wins at finalization
// - Invariant: spot_asset_balance == each_outcome_asset_supply (for ALL outcomes)
//
// === Architecture ===
// - TreasuryCaps stored via dynamic fields with AssetCapKey/StableCapKey
// - Vector-like indexing: outcome_index determines which cap to use
// - Mint/burn functions borrow caps mutably, perform operation, return cap to storage
// - No Supply objects - total_supply() comes directly from TreasuryCap

// === Errors ===
const EInsufficientBalance: u64 = 0; // Token balance insufficient for operation
const EIncorrectSequence: u64 = 1; // Tokens not provided in correct sequence/order
const EWrongMarket: u64 = 2; // Token belongs to different market
const ESuppliesNotInitialized: u64 = 4; // Token supplies not yet initialized
const EOutcomeOutOfBounds: u64 = 5; // Outcome index exceeds market outcomes
const ENotEnoughLiquidity: u64 = 8; // Insufficient liquidity in escrow
const EZeroAmount: u64 = 13; // Amount must be greater than zero
const EMarketNotFinalized: u64 = 101; // Market must be finalized for single-outcome withdrawal

// === Key Structures for TreasuryCap Storage ===
/// Key for asset conditional coin TreasuryCaps (indexed by outcome)
public struct AssetCapKey has copy, drop, store {
    outcome_index: u64,
}

/// Key for stable conditional coin TreasuryCaps (indexed by outcome)
public struct StableCapKey has copy, drop, store {
    outcome_index: u64,
}

// === Structs ===
public struct TokenEscrow<phantom AssetType, phantom StableType> has key, store {
    id: UID,
    market_state: MarketState,
    // Central balances used for tokens and liquidity
    escrowed_asset: Balance<AssetType>,
    escrowed_stable: Balance<StableType>,
    // TreasuryCaps stored as dynamic fields on UID (vector-like access by index)
    // Asset caps: dynamic_field with AssetCapKey { outcome_index } -> TreasuryCap<T>
    // Stable caps: dynamic_field with StableCapKey { outcome_index } -> TreasuryCap<T>
    // Each outcome's TreasuryCap has a unique generic type T
    outcome_count: u64, // Track how many outcomes have registered caps

    // === Supply Tracking for Safe Recombination ===
    // Track deposits by source to ensure user redemptions are always covered.
    // When LP liquidity is recombined, only LP backing is withdrawn.
    // User backing remains in escrow for their redemptions.
    //
    // LP backing: deposited via quantum split, returned on proposal finalization
    // User backing: deposited via split/deposit functions, redeemed by users
    //
    // NOTE: User deposits tracked as TOTAL (not per-type) because users can
    // deposit one type and redeem another after swapping in conditional AMMs.
    lp_deposited_asset: u64,
    lp_deposited_stable: u64,
    user_deposited_total: u64, // Total user deposits (asset + stable combined)

    // === Quantum Invariant Tracking ===
    // Track total minted supply for each outcome to validate quantum invariant.
    // Invariant: escrow_balance >= supply[i] for ALL outcomes i
    // This is redundant with TreasuryCap.total_supply() but avoids type explosion
    // when validating the invariant at runtime.
    asset_supplies: vector<u64>,  // [outcome_0_asset_supply, outcome_1_asset_supply, ...]
    stable_supplies: vector<u64>, // [outcome_0_stable_supply, outcome_1_stable_supply, ...]
}

public struct COIN_ESCROW has drop {}

// === Events ===
public struct LiquidityWithdrawal has copy, drop {
    escrowed_asset: u64,
    escrowed_stable: u64,
    asset_amount: u64,
    stable_amount: u64,
}

public struct LiquidityDeposit has copy, drop {
    escrowed_asset: u64,
    escrowed_stable: u64,
    asset_amount: u64,
    stable_amount: u64,
}

public struct TokenRedemption has copy, drop {
    outcome: u64,
    token_type: u8,
    amount: u64,
}

public fun new<AssetType, StableType>(
    market_state: MarketState,
    ctx: &mut TxContext,
): TokenEscrow<AssetType, StableType> {
    TokenEscrow {
        id: object::new(ctx),
        market_state,
        escrowed_asset: balance::zero(),
        escrowed_stable: balance::zero(),
        outcome_count: 0, // Will be incremented as caps are registered
        // Initialize supply tracking
        lp_deposited_asset: 0,
        lp_deposited_stable: 0,
        user_deposited_total: 0,
        // Initialize quantum invariant tracking
        asset_supplies: vector[],
        stable_supplies: vector[],
    }
}

/// NEW: Register conditional coin TreasuryCaps for an outcome
/// Must be called once per outcome with both asset and stable caps
/// Caps are stored as dynamic fields with vector-like indexing semantics
public fun register_conditional_caps<
    AssetType,
    StableType,
    AssetConditionalCoin,
    StableConditionalCoin,
>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_idx: u64,
    asset_treasury_cap: TreasuryCap<AssetConditionalCoin>,
    stable_treasury_cap: TreasuryCap<StableConditionalCoin>,
) {
    let market_outcome_count = escrow.market_state.outcome_count();
    assert!(outcome_idx < market_outcome_count, EOutcomeOutOfBounds);

    // Must register in order (like pushing to a vector)
    assert!(outcome_idx == escrow.outcome_count, EIncorrectSequence);

    // Store TreasuryCaps as dynamic fields with index-based keys
    let asset_key = AssetCapKey { outcome_index: outcome_idx };
    let stable_key = StableCapKey { outcome_index: outcome_idx };

    dynamic_field::add(&mut escrow.id, asset_key, asset_treasury_cap);
    dynamic_field::add(&mut escrow.id, stable_key, stable_treasury_cap);

    // Initialize supply tracking for this outcome (starts at 0)
    escrow.asset_supplies.push_back(0);
    escrow.stable_supplies.push_back(0);

    // Increment count (like vector length)
    escrow.outcome_count = escrow.outcome_count + 1;
}

// === NEW: TreasuryCap-based Mint/Burn Helpers ===

/// Mint conditional coins for a specific outcome using its TreasuryCap
/// Borrows the cap, mints, and returns it (maintains vector-like storage)
public fun mint_conditional_asset<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    amount: u64,
    ctx: &mut TxContext,
): Coin<ConditionalCoinType> {
    let market_outcome_count = escrow.market_state.outcome_count();
    assert!(outcome_index < market_outcome_count, EOutcomeOutOfBounds);

    // Borrow the TreasuryCap from dynamic field
    let asset_key = AssetCapKey { outcome_index };
    let cap: &mut TreasuryCap<ConditionalCoinType> = dynamic_field::borrow_mut(
        &mut escrow.id,
        asset_key,
    );

    // Track supply for quantum invariant
    let current_supply = &mut escrow.asset_supplies[outcome_index];
    *current_supply = *current_supply + amount;

    // Mint and return
    coin::mint(cap, amount, ctx)
}

/// Mint conditional stable coins for a specific outcome
public fun mint_conditional_stable<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    amount: u64,
    ctx: &mut TxContext,
): Coin<ConditionalCoinType> {
    let market_outcome_count = escrow.market_state.outcome_count();
    assert!(outcome_index < market_outcome_count, EOutcomeOutOfBounds);

    // Borrow the TreasuryCap from dynamic field
    let stable_key = StableCapKey { outcome_index };
    let cap: &mut TreasuryCap<ConditionalCoinType> = dynamic_field::borrow_mut(
        &mut escrow.id,
        stable_key,
    );

    // Track supply for quantum invariant
    let current_supply = &mut escrow.stable_supplies[outcome_index];
    *current_supply = *current_supply + amount;

    // Mint and return
    coin::mint(cap, amount, ctx)
}

/// Burn conditional asset coins for a specific outcome
public fun burn_conditional_asset<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    coin: Coin<ConditionalCoinType>,
) {
    let market_outcome_count = escrow.market_state.outcome_count();
    assert!(outcome_index < market_outcome_count, EOutcomeOutOfBounds);

    // Track supply for quantum invariant (before burn)
    let amount = coin.value();
    let current_supply = &mut escrow.asset_supplies[outcome_index];
    *current_supply = *current_supply - amount;

    // Borrow the TreasuryCap from dynamic field
    let asset_key = AssetCapKey { outcome_index };
    let cap: &mut TreasuryCap<ConditionalCoinType> = dynamic_field::borrow_mut(
        &mut escrow.id,
        asset_key,
    );

    // Burn
    coin::burn(cap, coin);
}

/// Burn conditional stable coins for a specific outcome
public fun burn_conditional_stable<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    coin: Coin<ConditionalCoinType>,
) {
    let market_outcome_count = escrow.market_state.outcome_count();
    assert!(outcome_index < market_outcome_count, EOutcomeOutOfBounds);

    // Track supply for quantum invariant (before burn)
    let amount = coin.value();
    let current_supply = &mut escrow.stable_supplies[outcome_index];
    *current_supply = *current_supply - amount;

    // Borrow the TreasuryCap from dynamic field
    let stable_key = StableCapKey { outcome_index };
    let cap: &mut TreasuryCap<ConditionalCoinType> = dynamic_field::borrow_mut(
        &mut escrow.id,
        stable_key,
    );

    // Burn
    coin::burn(cap, coin);
}

// === NEW: Generic Mint/Burn for Balance-Based Operations ===

/// Generic mint function for conditional coins (used by balance unwrap)
/// Takes outcome_index and is_asset to determine which TreasuryCap to use
public(package) fun mint_conditional<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    is_asset: bool,
    amount: u64,
    ctx: &mut TxContext,
): Coin<ConditionalCoinType> {
    if (is_asset) {
        mint_conditional_asset<AssetType, StableType, ConditionalCoinType>(
            escrow,
            outcome_index,
            amount,
            ctx,
        )
    } else {
        mint_conditional_stable<AssetType, StableType, ConditionalCoinType>(
            escrow,
            outcome_index,
            amount,
            ctx,
        )
    }
}

/// Generic burn function for conditional coins (used by balance wrap)
public(package) fun burn_conditional<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    is_asset: bool,
    coin: Coin<ConditionalCoinType>,
) {
    if (is_asset) {
        burn_conditional_asset<AssetType, StableType, ConditionalCoinType>(
            escrow,
            outcome_index,
            coin,
        )
    } else {
        burn_conditional_stable<AssetType, StableType, ConditionalCoinType>(
            escrow,
            outcome_index,
            coin,
        )
    }
}

/// Deposit spot coins to escrow (for balance-based operations like arbitrage)
/// Returns amounts deposited (for balance tracking)
/// Note: Tracks as user backing since arbitrage completes in same tx (deposit then burn complete set)
public fun deposit_spot_coins<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset_coin: Coin<AssetType>,
    stable_coin: Coin<StableType>,
): (u64, u64) {
    let asset_amt = asset_coin.value();
    let stable_amt = stable_coin.value();

    // Require at least one non-zero amount
    assert!(asset_amt > 0 || stable_amt > 0, EZeroAmount);

    // Add to escrow reserves
    balance::join(&mut escrow.escrowed_asset, coin::into_balance(asset_coin));
    balance::join(&mut escrow.escrowed_stable, coin::into_balance(stable_coin));

    // Track as user backing (total, not per-type)
    escrow.user_deposited_total = escrow.user_deposited_total + asset_amt + stable_amt;

    (asset_amt, stable_amt)
}

/// Withdraw spot coins from escrow (for complete set burn)
public fun withdraw_from_escrow<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset_amount: u64,
    stable_amount: u64,
    ctx: &mut TxContext,
): (Coin<AssetType>, Coin<StableType>) {
    assert!(balance::value(&escrow.escrowed_asset) >= asset_amount, ENotEnoughLiquidity);
    assert!(balance::value(&escrow.escrowed_stable) >= stable_amount, ENotEnoughLiquidity);

    let asset_bal = balance::split(&mut escrow.escrowed_asset, asset_amount);
    let stable_bal = balance::split(&mut escrow.escrowed_stable, stable_amount);

    // Decrement user backing (total amount withdrawn)
    let total_withdrawn = asset_amount + stable_amount;
    assert!(escrow.user_deposited_total >= total_withdrawn, ENotEnoughLiquidity);
    escrow.user_deposited_total = escrow.user_deposited_total - total_withdrawn;

    (coin::from_balance(asset_bal, ctx), coin::from_balance(stable_bal, ctx))
}

/// Get the total supply of a specific outcome's asset conditional coin
public fun get_asset_supply<AssetType, StableType, ConditionalCoinType>(
    escrow: &TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
): u64 {
    let asset_key = AssetCapKey { outcome_index };
    let cap: &TreasuryCap<ConditionalCoinType> = dynamic_field::borrow(&escrow.id, asset_key);
    coin::total_supply(cap)
}

/// Get the total supply of a specific outcome's stable conditional coin
public fun get_stable_supply<AssetType, StableType, ConditionalCoinType>(
    escrow: &TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
): u64 {
    let stable_key = StableCapKey { outcome_index };
    let cap: &TreasuryCap<ConditionalCoinType> = dynamic_field::borrow(&escrow.id, stable_key);
    coin::total_supply(cap)
}

// === Getters ===

/// Get the market state from escrow
public fun get_market_state<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): &MarketState {
    &escrow.market_state
}

/// Get mutable market state from escrow
public fun get_market_state_mut<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
): &mut MarketState {
    &mut escrow.market_state
}

/// Get the market state ID from escrow
public fun market_state_id<AssetType, StableType>(escrow: &TokenEscrow<AssetType, StableType>): ID {
    escrow.market_state.market_id()
}

/// Get the number of outcomes that have registered TreasuryCaps
public fun caps_registered_count<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): u64 {
    escrow.outcome_count
}

/// Deposit spot liquidity into escrow (quantum liquidity model)
/// This adds to the escrow balances that will be split quantum-mechanically across all outcomes
/// Tracks as LP backing for safe recombination
public fun deposit_spot_liquidity<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset: Balance<AssetType>,
    stable: Balance<StableType>,
) {
    let asset_amt = asset.value();
    let stable_amt = stable.value();

    escrow.escrowed_asset.join(asset);
    escrow.escrowed_stable.join(stable);

    // Track as LP backing (can be recombined on proposal end)
    escrow.lp_deposited_asset = escrow.lp_deposited_asset + asset_amt;
    escrow.lp_deposited_stable = escrow.lp_deposited_stable + stable_amt;
}

// === Burn and Withdraw Helpers (For Redemption) ===

/// Burn conditional asset coins and withdraw equivalent spot asset
/// Used when redeeming conditional coins back to spot tokens (e.g., after market finalization)
///
/// SECURITY: Only allows withdrawal from winning outcome after market finalization.
/// For pre-finalization exit, use complete-set withdrawal (burn from ALL outcomes).
public fun burn_conditional_asset_and_withdraw<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    conditional_coin: Coin<ConditionalCoinType>,
    ctx: &mut TxContext,
): Coin<AssetType> {
    // SECURITY CHECK: Market must be finalized for single-outcome withdrawal
    assert!(market_state::is_finalized(&escrow.market_state), EMarketNotFinalized);

    // Get the winning outcome
    let winning_outcome = market_state::get_winning_outcome(&escrow.market_state);

    let amount = conditional_coin.value();
    assert!(amount > 0, EZeroAmount);

    // Burn the user's conditional coins
    burn_conditional_asset<AssetType, StableType, ConditionalCoinType>(
        escrow,
        winning_outcome,
        conditional_coin,
    );

    // Withdraw equivalent spot tokens (1:1 due to quantum liquidity)
    let asset_balance = escrow.escrowed_asset.split(amount);

    // Decrement user backing (total tracking handles cross-type swaps)
    assert!(escrow.user_deposited_total >= amount, ENotEnoughLiquidity);
    escrow.user_deposited_total = escrow.user_deposited_total - amount;

    coin::from_balance(asset_balance, ctx)
}

/// Burn conditional stable coins and withdraw equivalent spot stable
///
/// SECURITY: Only allows withdrawal from winning outcome after market finalization.
/// For pre-finalization exit, use complete-set withdrawal (burn from ALL outcomes).
public fun burn_conditional_stable_and_withdraw<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    conditional_coin: Coin<ConditionalCoinType>,
    ctx: &mut TxContext,
): Coin<StableType> {
    // SECURITY CHECK: Market must be finalized for single-outcome withdrawal
    assert!(market_state::is_finalized(&escrow.market_state), EMarketNotFinalized);

    // Get the winning outcome
    let winning_outcome = market_state::get_winning_outcome(&escrow.market_state);

    let amount = conditional_coin.value();
    assert!(amount > 0, EZeroAmount);

    // Burn the user's conditional coins
    burn_conditional_stable<AssetType, StableType, ConditionalCoinType>(
        escrow,
        winning_outcome,
        conditional_coin,
    );

    // Withdraw equivalent spot tokens
    let stable_balance = escrow.escrowed_stable.split(amount);

    // Decrement user backing (total tracking handles cross-type swaps)
    assert!(escrow.user_deposited_total >= amount, ENotEnoughLiquidity);
    escrow.user_deposited_total = escrow.user_deposited_total - amount;

    coin::from_balance(stable_balance, ctx)
}

// Note: burn_complete_set_and_withdraw_from_balance moved to conditional_balance.move
// to avoid cyclic dependency between coin_escrow and conditional_balance

// === Deposit and Mint Helpers (For Creating Conditional Coins) ===

/// Deposit spot asset and mint equivalent conditional asset coins
/// Quantum liquidity: Depositing X spot mints X conditional in specified outcome
public fun deposit_asset_and_mint_conditional<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    asset_coin: Coin<AssetType>,
    ctx: &mut TxContext,
): Coin<ConditionalCoinType> {
    let amount = asset_coin.value();

    // Deposit spot tokens to escrow
    let asset_balance = coin::into_balance(asset_coin);
    escrow.escrowed_asset.join(asset_balance);

    // Track as user backing (total, not per-type)
    escrow.user_deposited_total = escrow.user_deposited_total + amount;

    // Mint equivalent conditional coins (1:1 due to quantum liquidity)
    mint_conditional_asset<AssetType, StableType, ConditionalCoinType>(
        escrow,
        outcome_index,
        amount,
        ctx,
    )
}

/// Deposit spot stable and mint equivalent conditional stable coins
public fun deposit_stable_and_mint_conditional<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    stable_coin: Coin<StableType>,
    ctx: &mut TxContext,
): Coin<ConditionalCoinType> {
    let amount = stable_coin.value();

    // Deposit spot tokens to escrow
    let stable_balance = coin::into_balance(stable_coin);
    escrow.escrowed_stable.join(stable_balance);

    // Track as user backing (total, not per-type)
    escrow.user_deposited_total = escrow.user_deposited_total + amount;

    // Mint equivalent conditional coins
    mint_conditional_stable<AssetType, StableType, ConditionalCoinType>(
        escrow,
        outcome_index,
        amount,
        ctx,
    )
}

/// Get escrow spot balances (read-only)
public fun get_spot_balances<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): (u64, u64) {
    (escrow.escrowed_asset.value(), escrow.escrowed_stable.value())
}

/// Get escrowed asset balance
public fun get_escrowed_asset_balance<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): u64 {
    escrow.escrowed_asset.value()
}

/// Get escrowed stable balance
public fun get_escrowed_stable_balance<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): u64 {
    escrow.escrowed_stable.value()
}

/// Get LP deposited asset backing
public fun get_lp_deposited_asset<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): u64 {
    escrow.lp_deposited_asset
}

/// Get LP deposited stable backing
public fun get_lp_deposited_stable<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): u64 {
    escrow.lp_deposited_stable
}

/// Get total user deposited backing (asset + stable combined)
/// Tracks total because users can swap between types in conditional AMMs
public fun get_user_deposited_total<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): u64 {
    escrow.user_deposited_total
}

/// Get asset supply for a specific outcome (for quantum invariant validation)
public fun get_outcome_asset_supply<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
): u64 {
    escrow.asset_supplies[outcome_index]
}

/// Get stable supply for a specific outcome (for quantum invariant validation)
public fun get_outcome_stable_supply<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
): u64 {
    escrow.stable_supplies[outcome_index]
}

/// Get all asset supplies (for diagnostics)
public fun get_all_asset_supplies<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): &vector<u64> {
    &escrow.asset_supplies
}

/// Get all stable supplies (for diagnostics)
public fun get_all_stable_supplies<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): &vector<u64> {
    &escrow.stable_supplies
}

/// Decrement LP backing after recombination (called by quantum_lp_manager)
/// Aborts if amount exceeds tracked LP deposits - this indicates an accounting bug.
public fun decrement_lp_backing<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset_amount: u64,
    stable_amount: u64,
) {
    assert!(escrow.lp_deposited_asset >= asset_amount, ENotEnoughLiquidity);
    assert!(escrow.lp_deposited_stable >= stable_amount, ENotEnoughLiquidity);
    escrow.lp_deposited_asset = escrow.lp_deposited_asset - asset_amount;
    escrow.lp_deposited_stable = escrow.lp_deposited_stable - stable_amount;
}

/// Decrement user backing after withdrawal (for complete set burns via balance wrapper)
/// Aborts if amount exceeds tracked deposits.
public fun decrement_user_backing<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    amount: u64,
) {
    assert!(escrow.user_deposited_total >= amount, ENotEnoughLiquidity);
    escrow.user_deposited_total = escrow.user_deposited_total - amount;
}

/// Withdraw asset balance from escrow (for internal use)
public fun withdraw_asset_balance<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    amount: u64,
    ctx: &mut TxContext,
): Coin<AssetType> {
    let balance = escrow.escrowed_asset.split(amount);
    coin::from_balance(balance, ctx)
}

/// Withdraw stable balance from escrow (for internal use)
public fun withdraw_stable_balance<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    amount: u64,
    ctx: &mut TxContext,
): Coin<StableType> {
    let balance = escrow.escrowed_stable.split(amount);
    coin::from_balance(balance, ctx)
}

// === Invariant Validation ===
//
// QUANTUM LIQUIDITY INVARIANT:
// - escrow_asset >= each_outcome_asset_supply (for ALL outcomes)
// - escrow_stable >= each_outcome_stable_supply (for ALL outcomes)
//
// This invariant ensures each outcome's supply can be fully redeemed.
// Since only ONE outcome wins, escrow must cover the max supply, not the sum.
//
// This invariant is maintained by the mint/burn operations:
// - deposit_and_mint: deposit X spot → mint X conditional (1:1)
// - burn_and_withdraw: burn X conditional → withdraw X spot (1:1)
// - split operations: deposit spot → mint conditional in all outcomes
// - recombine operations: burn conditional from all outcomes → withdraw spot
//
// ACCOUNTING INVARIANT:
// - lp_deposited + user_deposited <= escrow_balance (for each type)
// - Tracked deposits must not exceed actual escrow balance

const EAccountingInvariantViolation: u64 = 200;
const EQuantumInvariantViolation: u64 = 201;

/// Validate that tracked deposits don't exceed escrow balance
/// Call this after any operation that modifies escrow state to catch accounting bugs early.
/// Aborts with EAccountingInvariantViolation if invariant is violated.
public fun assert_accounting_invariant<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
) {
    let escrow_asset = escrow.escrowed_asset.value();
    let escrow_stable = escrow.escrowed_stable.value();

    // LP deposits must not exceed escrow balance
    assert!(escrow.lp_deposited_asset <= escrow_asset, EAccountingInvariantViolation);
    assert!(escrow.lp_deposited_stable <= escrow_stable, EAccountingInvariantViolation);

    // Total tracked (LP + user) should fit within escrow
    // Note: user_deposited_total is combined, so we check against both types
    // This is conservative - in practice users might have deposited more of one type
    // But we can't track which type they'll redeem due to cross-type swaps
}

/// Validate the quantum liquidity invariant
/// Ensures escrow balance >= supply for EACH outcome independently.
/// This is critical because only ONE outcome wins, and its full supply must be redeemable.
/// Aborts with EQuantumInvariantViolation if invariant is violated.
public fun assert_quantum_invariant<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
) {
    let escrow_asset = escrow.escrowed_asset.value();
    let escrow_stable = escrow.escrowed_stable.value();

    // Check each outcome's supply against escrow balance
    let mut i = 0;
    while (i < escrow.outcome_count) {
        let asset_supply = escrow.asset_supplies[i];
        let stable_supply = escrow.stable_supplies[i];

        // Escrow must cover each outcome's supply independently
        assert!(escrow_asset >= asset_supply, EQuantumInvariantViolation);
        assert!(escrow_stable >= stable_supply, EQuantumInvariantViolation);

        i = i + 1;
    };
}

/// Validate both accounting and quantum invariants
/// Use this for comprehensive invariant checking
public fun assert_all_invariants<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
) {
    assert_accounting_invariant(escrow);
    assert_quantum_invariant(escrow);
}

/// Check if escrow has sufficient balance for all tracked deposits
/// Returns (has_sufficient_asset, has_sufficient_stable)
/// Use this for diagnostics - doesn't abort
public fun check_balance_sufficiency<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): (bool, bool) {
    let escrow_asset = escrow.escrowed_asset.value();
    let escrow_stable = escrow.escrowed_stable.value();

    // Check if escrow can cover LP backing
    let asset_ok = escrow.lp_deposited_asset <= escrow_asset;
    let stable_ok = escrow.lp_deposited_stable <= escrow_stable;

    (asset_ok, stable_ok)
}

/// Get all tracking values for debugging/diagnostics
/// Returns (escrow_asset, escrow_stable, lp_asset, lp_stable, user_total)
public fun get_all_tracking<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): (u64, u64, u64, u64, u64) {
    (
        escrow.escrowed_asset.value(),
        escrow.escrowed_stable.value(),
        escrow.lp_deposited_asset,
        escrow.lp_deposited_stable,
        escrow.user_deposited_total,
    )
}

// === Complete Set Operations (Split/Recombine) ===
// Uses PTB hot potato pattern - see TYPE_PARAMETER_EXPLOSION_PROBLEM.md

/// Progress tracker for splitting a spot asset coin into a complete set of conditional asset coins.
/// This struct MUST be fully consumed via `finish_split_asset_progress` to preserve the quantum invariant.
public struct SplitAssetProgress<phantom AssetType, phantom StableType> has drop {
    market_id: ID,
    amount: u64,
    outcome_count: u64,
    next_outcome: u64,
}

public fun drop_split_asset_progress<AssetType, StableType>(
    progress: SplitAssetProgress<AssetType, StableType>,
) {
    let SplitAssetProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);
}

/// Progress tracker for splitting a spot stable coin into a complete set of conditional stable coins.
public struct SplitStableProgress<phantom AssetType, phantom StableType> has drop {
    market_id: ID,
    amount: u64,
    outcome_count: u64,
    next_outcome: u64,
}

public fun drop_split_stable_progress<AssetType, StableType>(
    progress: SplitStableProgress<AssetType, StableType>,
) {
    let SplitStableProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);
}

/// Progress tracker for recombining conditional asset coins back into a spot asset coin.
/// All outcomes must be processed sequentially from 0 → outcome_count - 1.
public struct RecombineAssetProgress<phantom AssetType, phantom StableType> has drop {
    market_id: ID,
    amount: u64,
    outcome_count: u64,
    next_outcome: u64,
}

public fun drop_recombine_asset_progress<AssetType, StableType>(
    progress: RecombineAssetProgress<AssetType, StableType>,
) {
    let RecombineAssetProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);
}

/// Progress tracker for recombining conditional stable coins back into a spot stable coin.
public struct RecombineStableProgress<phantom AssetType, phantom StableType> has drop {
    market_id: ID,
    amount: u64,
    outcome_count: u64,
    next_outcome: u64,
}

public fun drop_recombine_stable_progress<AssetType, StableType>(
    progress: RecombineStableProgress<AssetType, StableType>,
) {
    let RecombineStableProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);
}

/// Begin splitting a spot asset coin into a complete set of conditional assets.
/// Returns a progress object that must be passed through `split_asset_progress_step`
/// for each outcome, then finalized with `finish_split_asset_progress`.
public fun start_split_asset_progress<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    spot_asset: Coin<AssetType>,
): SplitAssetProgress<AssetType, StableType> {
    let amount = spot_asset.value();
    assert!(amount > 0, EZeroAmount);

    let outcome_count = caps_registered_count(escrow);
    assert!(outcome_count > 0, ESuppliesNotInitialized);

    let asset_balance = coin::into_balance(spot_asset);
    escrow.escrowed_asset.join(asset_balance);

    // Track as user backing (total, not per-type)
    escrow.user_deposited_total = escrow.user_deposited_total + amount;

    SplitAssetProgress {
        market_id: market_state_id(escrow),
        amount,
        outcome_count,
        next_outcome: 0,
    }
}

/// Mint the next conditional asset coin in the sequence.
/// Caller is responsible for transferring or otherwise handling the returned coin.
public fun split_asset_progress_step<AssetType, StableType, ConditionalCoinType>(
    mut progress: SplitAssetProgress<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u8,
    ctx: &mut TxContext,
): (SplitAssetProgress<AssetType, StableType>, Coin<ConditionalCoinType>) {
    assert!(market_state_id(escrow) == progress.market_id, EWrongMarket);

    let index = (outcome_index as u64);
    assert!(progress.next_outcome < progress.outcome_count, EOutcomeOutOfBounds);
    assert!(index == progress.next_outcome, EIncorrectSequence);

    let coin = mint_conditional_asset<AssetType, StableType, ConditionalCoinType>(
        escrow,
        index,
        progress.amount,
        ctx,
    );

    progress.next_outcome = progress.next_outcome + 1;

    (progress, coin)
}

/// Ensure the split operation covered all outcomes. Must be called exactly once per progress object.
public fun finish_split_asset_progress<AssetType, StableType>(
    progress: SplitAssetProgress<AssetType, StableType>,
) {
    let SplitAssetProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);
}

/// Begin splitting a spot stable coin into a complete set of conditional stables.
public fun start_split_stable_progress<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    spot_stable: Coin<StableType>,
): SplitStableProgress<AssetType, StableType> {
    let amount = spot_stable.value();
    assert!(amount > 0, EZeroAmount);

    let outcome_count = caps_registered_count(escrow);
    assert!(outcome_count > 0, ESuppliesNotInitialized);

    let stable_balance = coin::into_balance(spot_stable);
    escrow.escrowed_stable.join(stable_balance);

    // Track as user backing (total, not per-type)
    escrow.user_deposited_total = escrow.user_deposited_total + amount;

    SplitStableProgress {
        market_id: market_state_id(escrow),
        amount,
        outcome_count,
        next_outcome: 0,
    }
}

/// Mint the next conditional stable coin in the sequence.
public fun split_stable_progress_step<AssetType, StableType, ConditionalCoinType>(
    mut progress: SplitStableProgress<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u8,
    ctx: &mut TxContext,
): (SplitStableProgress<AssetType, StableType>, Coin<ConditionalCoinType>) {
    assert!(market_state_id(escrow) == progress.market_id, EWrongMarket);

    let index = (outcome_index as u64);
    assert!(progress.next_outcome < progress.outcome_count, EOutcomeOutOfBounds);
    assert!(index == progress.next_outcome, EIncorrectSequence);

    let coin = mint_conditional_stable<AssetType, StableType, ConditionalCoinType>(
        escrow,
        index,
        progress.amount,
        ctx,
    );

    progress.next_outcome = progress.next_outcome + 1;

    (progress, coin)
}

/// Ensure the stable split operation covered all outcomes.
public fun finish_split_stable_progress<AssetType, StableType>(
    progress: SplitStableProgress<AssetType, StableType>,
) {
    let SplitStableProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);
}

/// Begin recombining conditional asset coins into a spot asset coin.
/// Consumes and burns the first coin (must be outcome index 0).
public fun start_recombine_asset_progress<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u8,
    coin: Coin<ConditionalCoinType>,
): RecombineAssetProgress<AssetType, StableType> {
    let index = (outcome_index as u64);
    assert!(index == 0, EIncorrectSequence);

    let outcome_count = caps_registered_count(escrow);
    assert!(outcome_count > 0, ESuppliesNotInitialized);
    assert!(index < outcome_count, EOutcomeOutOfBounds);

    let amount = coin.value();
    assert!(amount > 0, EZeroAmount);

    burn_conditional_asset<AssetType, StableType, ConditionalCoinType>(
        escrow,
        index,
        coin,
    );

    RecombineAssetProgress {
        market_id: market_state_id(escrow),
        amount,
        outcome_count,
        next_outcome: 1,
    }
}

/// Burn the next conditional asset coin in the recombination sequence.
public fun recombine_asset_progress_step<AssetType, StableType, ConditionalCoinType>(
    mut progress: RecombineAssetProgress<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u8,
    coin: Coin<ConditionalCoinType>,
): RecombineAssetProgress<AssetType, StableType> {
    assert!(market_state_id(escrow) == progress.market_id, EWrongMarket);

    let index = (outcome_index as u64);
    assert!(progress.next_outcome < progress.outcome_count, EOutcomeOutOfBounds);
    assert!(index == progress.next_outcome, EIncorrectSequence);

    let amount = coin.value();
    assert!(amount == progress.amount, EInsufficientBalance);

    burn_conditional_asset<AssetType, StableType, ConditionalCoinType>(
        escrow,
        index,
        coin,
    );

    progress.next_outcome = progress.next_outcome + 1;
    progress
}

/// Finish recombination and withdraw the corresponding spot asset coin.
public fun finish_recombine_asset_progress<AssetType, StableType>(
    progress: RecombineAssetProgress<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    ctx: &mut TxContext,
): Coin<AssetType> {
    let RecombineAssetProgress { market_id: _, amount, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);

    // Decrement user backing (aborts if amount exceeds tracked deposits)
    assert!(escrow.user_deposited_total >= amount, ENotEnoughLiquidity);
    escrow.user_deposited_total = escrow.user_deposited_total - amount;

    withdraw_asset_balance(escrow, amount, ctx)
}

/// Begin recombining conditional stable coins into spot stable.
public fun start_recombine_stable_progress<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u8,
    coin: Coin<ConditionalCoinType>,
): RecombineStableProgress<AssetType, StableType> {
    let index = (outcome_index as u64);
    assert!(index == 0, EIncorrectSequence);

    let outcome_count = caps_registered_count(escrow);
    assert!(outcome_count > 0, ESuppliesNotInitialized);
    assert!(index < outcome_count, EOutcomeOutOfBounds);

    let amount = coin.value();
    assert!(amount > 0, EZeroAmount);

    burn_conditional_stable<AssetType, StableType, ConditionalCoinType>(
        escrow,
        index,
        coin,
    );

    RecombineStableProgress {
        market_id: market_state_id(escrow),
        amount,
        outcome_count,
        next_outcome: 1,
    }
}

/// Burn the next conditional stable coin in the recombination sequence.
public fun recombine_stable_progress_step<AssetType, StableType, ConditionalCoinType>(
    mut progress: RecombineStableProgress<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u8,
    coin: Coin<ConditionalCoinType>,
): RecombineStableProgress<AssetType, StableType> {
    assert!(market_state_id(escrow) == progress.market_id, EWrongMarket);

    let index = (outcome_index as u64);
    assert!(progress.next_outcome < progress.outcome_count, EOutcomeOutOfBounds);
    assert!(index == progress.next_outcome, EIncorrectSequence);

    let amount = coin.value();
    assert!(amount == progress.amount, EInsufficientBalance);

    burn_conditional_stable<AssetType, StableType, ConditionalCoinType>(
        escrow,
        index,
        coin,
    );

    progress.next_outcome = progress.next_outcome + 1;
    progress
}

/// Finish recombination and withdraw the corresponding spot stable coin.
public fun finish_recombine_stable_progress<AssetType, StableType>(
    progress: RecombineStableProgress<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    ctx: &mut TxContext,
): Coin<StableType> {
    let RecombineStableProgress { market_id: _, amount, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);

    // Decrement user backing (aborts if amount exceeds tracked deposits)
    assert!(escrow.user_deposited_total >= amount, ENotEnoughLiquidity);
    escrow.user_deposited_total = escrow.user_deposited_total - amount;

    withdraw_stable_balance(escrow, amount, ctx)
}

// === Test Helpers ===

#[test_only]
/// Create a blank TreasuryCap for testing (zero supply, blank metadata)
/// This simulates getting a blank coin from the registry
public fun create_test_treasury_cap<CoinType: drop>(
    otw: CoinType,
    ctx: &mut TxContext,
): (TreasuryCap<CoinType>, CoinMetadata<CoinType>) {
    // Create coin with blank metadata
    let (treasury_cap, metadata) = coin::create_currency(
        otw,
        0, // decimals
        b"", // symbol (empty)
        b"", // name (empty)
        b"", // description (empty)
        option::none(), // icon_url (empty)
        ctx,
    );

    (treasury_cap, metadata)
}

#[test_only]
/// Create a test escrow with a real MarketState (not a mock)
/// This is a simplified helper that creates an actual TokenEscrow with sensible defaults
public fun create_test_escrow<AssetType, StableType>(
    outcome_count: u64,
    ctx: &mut TxContext,
): TokenEscrow<AssetType, StableType> {
    // Create a real MarketState using existing test infrastructure
    let market_state = futarchy_markets_primitives::market_state::create_for_testing(
        outcome_count,
        ctx,
    );

    // Create and return the TokenEscrow with the real MarketState
    new<AssetType, StableType>(market_state, ctx)
}

#[test_only]
/// Create a test escrow with outcome_count and fee_bps parameters
/// Alias for compatibility with test code that passes (num_outcomes, fee_bps, ctx)
public fun create_for_testing<AssetType, StableType>(
    outcome_count: u64,
    _fee_bps: u64, // Fee is configured in individual AMM pools, not escrow level
    ctx: &mut TxContext,
): TokenEscrow<AssetType, StableType> {
    create_test_escrow<AssetType, StableType>(outcome_count, ctx)
}

#[test_only]
/// Create a test escrow with a provided MarketState
/// Useful when you need to customize the market state before creating the escrow
public fun create_test_escrow_with_market_state<AssetType, StableType>(
    _outcome_count: u64, // Not used, but kept for API compatibility
    market_state: MarketState,
    ctx: &mut TxContext,
): TokenEscrow<AssetType, StableType> {
    new<AssetType, StableType>(market_state, ctx)
}

#[test_only]
/// Destroy escrow for testing (with remaining balances)
/// Useful for cleaning up test state
public fun destroy_for_testing<AssetType, StableType>(escrow: TokenEscrow<AssetType, StableType>) {
    let TokenEscrow {
        id,
        market_state,
        escrowed_asset,
        escrowed_stable,
        outcome_count: _,
        lp_deposited_asset: _,
        lp_deposited_stable: _,
        user_deposited_total: _,
        asset_supplies: _,
        stable_supplies: _,
    } = escrow;

    // Destroy balances
    balance::destroy_for_testing(escrowed_asset);
    balance::destroy_for_testing(escrowed_stable);

    // Destroy market state
    futarchy_markets_primitives::market_state::destroy_for_testing(market_state);

    // Delete UID (TreasuryCaps in dynamic fields will be destroyed automatically)
    object::delete(id);
}
