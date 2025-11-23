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
const ETradingAlreadyStarted: u64 = 102; // Cannot use single-outcome mint during active trading

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
    // Invariant (during active proposal): escrow_balance == supply[i] + wrapped[i] for ALL outcomes i
    // Invariant (after finalization): escrow_balance >= supply[winning] + wrapped[winning] only
    // This is redundant with TreasuryCap.total_supply() but avoids type explosion
    // when validating the invariant at runtime.
    asset_supplies: vector<u64>,  // [outcome_0_asset_supply, outcome_1_asset_supply, ...]
    stable_supplies: vector<u64>, // [outcome_0_stable_supply, outcome_1_stable_supply, ...]

    // === Wrapped Balance Tracking ===
    // Track total wrapped balances across all ConditionalMarketBalance objects.
    // When users wrap coins, supply decreases but wrapped increases.
    // Invariant: escrow == supply + wrapped for each outcome.
    wrapped_asset_balances: vector<u64>,  // [outcome_0_wrapped_asset, outcome_1_wrapped_asset, ...]
    wrapped_stable_balances: vector<u64>, // [outcome_0_wrapped_stable, outcome_1_wrapped_stable, ...]

    // === Protocol Fee Tracking ===
    // Track protocol fees that have been collected from escrow.
    // This is needed to maintain the quantum invariant after fee collection.
    // When fees are collected, escrow decreases but supply doesn't.
    // Invariant adjustment: escrow + collected_fees == supply + wrapped
    collected_protocol_fees_asset: u64,
    collected_protocol_fees_stable: u64,
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
        // Initialize wrapped balance tracking
        wrapped_asset_balances: vector[],
        wrapped_stable_balances: vector[],
        // Initialize protocol fee tracking
        collected_protocol_fees_asset: 0,
        collected_protocol_fees_stable: 0,
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

    // Initialize wrapped balance tracking for this outcome (starts at 0)
    escrow.wrapped_asset_balances.push_back(0);
    escrow.wrapped_stable_balances.push_back(0);

    // Increment count (like vector length)
    escrow.outcome_count = escrow.outcome_count + 1;
}

// === NEW: TreasuryCap-based Mint/Burn Helpers ===

/// Mint conditional coins for a specific outcome using its TreasuryCap
/// Borrows the cap, mints, and returns it (maintains vector-like storage)
///
/// RESTRICTED: Package-only to enforce atomic operations via Progress pattern.
/// Single-outcome minting would violate quantum invariant (escrow == supply for ALL outcomes).
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
///
/// RESTRICTED: Package-only to enforce atomic operations via Progress pattern.
/// Single-outcome minting would violate quantum invariant (escrow == supply for ALL outcomes).
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
///
/// RESTRICTED: Package-only to enforce atomic operations via Progress pattern.
/// Single-outcome burning would violate quantum invariant (escrow == supply for ALL outcomes).
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
///
/// RESTRICTED: Package-only to enforce atomic operations via Progress pattern.
/// Single-outcome burning would violate quantum invariant (escrow == supply for ALL outcomes).
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
public fun mint_conditional<AssetType, StableType, ConditionalCoinType>(
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
public fun burn_conditional<AssetType, StableType, ConditionalCoinType>(
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
///
/// RESTRICTED: Package-only to enforce atomic deposit+mint via Progress pattern.
/// Direct deposits without minting would violate the quantum invariant (escrow == supply).
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
///
/// RESTRICTED: Package-only to enforce atomic burn+withdraw via Progress pattern.
/// Direct withdrawal without burning would violate quantum invariant.
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
///
/// RESTRICTED: Package-only to prevent unauthorized market state manipulation.
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
///
/// RESTRICTED: Package-only to enforce atomic deposit+mint via quantum_lp_manager.
/// Direct LP deposits without minting would violate the quantum invariant (escrow == supply).
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

/// Deposit spot stable coin for balance-based operations
/// Tracks as user backing (not LP backing)
///
/// RESTRICTED: Package-only for atomic balance operations.
public fun deposit_spot_stable_for_balance<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    stable_coin: Coin<StableType>,
) {
    let amount = stable_coin.value();
    escrow.escrowed_stable.join(stable_coin.into_balance());
    escrow.user_deposited_total = escrow.user_deposited_total + amount;
}

/// Deposit spot asset coin for balance-based operations
/// Tracks as user backing (not LP backing)
///
/// RESTRICTED: Package-only for atomic balance operations.
public fun deposit_spot_asset_for_balance<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset_coin: Coin<AssetType>,
) {
    let amount = asset_coin.value();
    escrow.escrowed_asset.join(asset_coin.into_balance());
    escrow.user_deposited_total = escrow.user_deposited_total + amount;
}

/// LP quantum deposit: deposit spot and virtually mint for ALL outcomes
/// This maintains the quantum invariant by incrementing supply for each outcome.
/// No actual Coin objects are created - supplies are tracked numerically.
/// Used during market creation to seed initial liquidity.
///
/// Returns (asset_amount, stable_amount) for distribution to AMM pools.
public fun lp_deposit_quantum<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset: Balance<AssetType>,
    stable: Balance<StableType>,
): (u64, u64) {
    let asset_amt = asset.value();
    let stable_amt = stable.value();

    // Deposit spot to escrow
    escrow.escrowed_asset.join(asset);
    escrow.escrowed_stable.join(stable);

    // Track as LP backing
    escrow.lp_deposited_asset = escrow.lp_deposited_asset + asset_amt;
    escrow.lp_deposited_stable = escrow.lp_deposited_stable + stable_amt;

    // Virtual mint: increment supply for ALL outcomes (quantum model)
    let mut i = 0;
    while (i < escrow.outcome_count) {
        let asset_supply = &mut escrow.asset_supplies[i];
        *asset_supply = *asset_supply + asset_amt;

        let stable_supply = &mut escrow.stable_supplies[i];
        *stable_supply = *stable_supply + stable_amt;

        i = i + 1;
    };

    // Enforce quantum invariant
    assert_quantum_invariant(escrow);

    (asset_amt, stable_amt)
}

/// Increment supplies for ALL outcomes (quantum model)
/// Used by arbitrage when depositing to escrow to maintain the invariant.
/// MUST be called atomically with deposit_spot_liquidity to preserve invariant.
public fun increment_supplies_for_all_outcomes<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset_amount: u64,
    stable_amount: u64,
) {
    let mut i = 0;
    while (i < escrow.outcome_count) {
        if (asset_amount > 0) {
            let asset_supply = &mut escrow.asset_supplies[i];
            *asset_supply = *asset_supply + asset_amount;
        };
        if (stable_amount > 0) {
            let stable_supply = &mut escrow.stable_supplies[i];
            *stable_supply = *stable_supply + stable_amount;
        };
        i = i + 1;
    };
}

/// Decrement supplies for ALL outcomes (quantum model)
/// Used by arbitrage when withdrawing from escrow to maintain the invariant.
/// MUST be called atomically with withdraw_*_balance to preserve invariant.
public fun decrement_supplies_for_all_outcomes<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset_amount: u64,
    stable_amount: u64,
) {
    let mut i = 0;
    while (i < escrow.outcome_count) {
        if (asset_amount > 0) {
            let asset_supply = &mut escrow.asset_supplies[i];
            *asset_supply = *asset_supply - asset_amount;
        };
        if (stable_amount > 0) {
            let stable_supply = &mut escrow.stable_supplies[i];
            *stable_supply = *stable_supply - stable_amount;
        };
        i = i + 1;
    };
}

/// Increment wrapped balance for ALL outcomes and check invariant in single loop
/// More efficient than separate increment loop + invariant check
/// Used by split operations in conditional_balance
public fun increment_wrapped_for_all_and_check_invariant<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    is_asset: bool,
    amount: u64,
) {
    let escrow_value = if (is_asset) {
        escrow.escrowed_asset.value()
    } else {
        escrow.escrowed_stable.value()
    };

    let mut i = 0;
    while (i < escrow.outcome_count) {
        // Increment wrapped
        if (is_asset) {
            let wrapped = &mut escrow.wrapped_asset_balances[i];
            *wrapped = *wrapped + amount;
            // Check invariant for this outcome
            let supply = escrow.asset_supplies[i];
            let total = supply + *wrapped;
            assert!(escrow_value == total, EQuantumInvariantViolation);
        } else {
            let wrapped = &mut escrow.wrapped_stable_balances[i];
            *wrapped = *wrapped + amount;
            // Check invariant for this outcome
            let supply = escrow.stable_supplies[i];
            let total = supply + *wrapped;
            assert!(escrow_value == total, EQuantumInvariantViolation);
        };
        i = i + 1;
    };
}

/// Decrement wrapped balance for ALL outcomes and check invariant in single loop
/// More efficient than separate decrement loop + invariant check
/// Used by recombine/burn operations in conditional_balance
public fun decrement_wrapped_for_all_and_check_invariant<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    is_asset: bool,
    amount: u64,
) {
    let escrow_value = if (is_asset) {
        escrow.escrowed_asset.value()
    } else {
        escrow.escrowed_stable.value()
    };

    let mut i = 0;
    while (i < escrow.outcome_count) {
        // Decrement wrapped
        if (is_asset) {
            let wrapped = &mut escrow.wrapped_asset_balances[i];
            *wrapped = *wrapped - amount;
            // Check invariant for this outcome
            let supply = escrow.asset_supplies[i];
            let total = supply + *wrapped;
            assert!(escrow_value == total, EQuantumInvariantViolation);
        } else {
            let wrapped = &mut escrow.wrapped_stable_balances[i];
            *wrapped = *wrapped - amount;
            // Check invariant for this outcome
            let supply = escrow.stable_supplies[i];
            let total = supply + *wrapped;
            assert!(escrow_value == total, EQuantumInvariantViolation);
        };
        i = i + 1;
    };
}

/// Decrement supply for a SINGLE outcome (for per-outcome arbitrage adjustments)
/// Used when different outcomes have different output amounts.
/// With sum-based invariant, per-outcome differences are allowed.
public fun decrement_supply_for_outcome<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    is_asset: bool,
    amount: u64,
) {
    if (is_asset) {
        let supply = &mut escrow.asset_supplies[outcome_index];
        *supply = *supply - amount;
    } else {
        let supply = &mut escrow.stable_supplies[outcome_index];
        *supply = *supply - amount;
    };
}

/// LP quantum withdraw: virtually burn from ALL outcomes and withdraw spot
/// This maintains the quantum invariant by decrementing supply for each outcome.
/// Used after market finalization for LP to reclaim backing.
///
/// RESTRICTED: Only callable after market finalization.
public fun lp_withdraw_quantum<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset_amount: u64,
    stable_amount: u64,
    ctx: &mut TxContext,
): (Coin<AssetType>, Coin<StableType>) {
    // Only allow after finalization
    assert!(market_state::is_finalized(&escrow.market_state), EMarketNotFinalized);

    // Virtual burn: decrement supply for ALL outcomes
    let mut i = 0;
    while (i < escrow.outcome_count) {
        let asset_supply = &mut escrow.asset_supplies[i];
        *asset_supply = *asset_supply - asset_amount;

        let stable_supply = &mut escrow.stable_supplies[i];
        *stable_supply = *stable_supply - stable_amount;

        i = i + 1;
    };

    // Decrement LP backing
    decrement_lp_backing(escrow, asset_amount, stable_amount);

    // Withdraw from escrow
    let asset_coin = withdraw_asset_balance(escrow, asset_amount, ctx);
    let stable_coin = withdraw_stable_balance(escrow, stable_amount, ctx);

    // Enforce quantum invariant (post-finalization: winning outcome only)
    assert_quantum_invariant(escrow);

    (asset_coin, stable_coin)
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

    // Enforce quantum invariant (post-finalization: only winning outcome checked)
    assert_quantum_invariant(escrow);

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

    // Enforce quantum invariant (post-finalization: only winning outcome checked)
    assert_quantum_invariant(escrow);

    coin::from_balance(stable_balance, ctx)
}

// Note: burn_complete_set_and_withdraw_from_balance moved to conditional_balance.move
// to avoid cyclic dependency between coin_escrow and conditional_balance

// === Deposit and Mint Helpers (For Creating Conditional Coins) ===

/// Deposit spot asset and mint equivalent conditional asset coins
/// Quantum liquidity: Depositing X spot mints X conditional in specified outcome
///
/// RESTRICTED: Package-only to enforce atomic operations via Progress pattern.
/// Single-outcome deposit+mint would violate quantum invariant (escrow == supply for ALL outcomes).
///
/// GUARD: Only allowed before trading starts (initial setup) or after finalization.
/// During active trading, use the Progress pattern (start_split/split_step/finish_split).
public fun deposit_asset_and_mint_conditional<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    asset_coin: Coin<AssetType>,
    ctx: &mut TxContext,
): Coin<ConditionalCoinType> {
    // Guard: Prevent use during active trading (would break quantum invariant)
    let trading_started = market_state::is_trading_started(&escrow.market_state);
    let finalized = market_state::is_finalized(&escrow.market_state);
    assert!(!trading_started || finalized, ETradingAlreadyStarted);

    let amount = asset_coin.value();

    // Deposit spot tokens to escrow
    let asset_balance = coin::into_balance(asset_coin);
    escrow.escrowed_asset.join(asset_balance);

    // Track as user backing (total, not per-type)
    escrow.user_deposited_total = escrow.user_deposited_total + amount;

    // Mint equivalent conditional coins (1:1 due to quantum liquidity)
    let coin = mint_conditional_asset<AssetType, StableType, ConditionalCoinType>(
        escrow,
        outcome_index,
        amount,
        ctx,
    );

    // Note: No invariant check here - during setup, sequential deposits to different
    // outcomes naturally create temporary unequal supplies. The quantum invariant
    // is enforced by the Progress pattern during active trading.

    coin
}

/// Deposit spot stable and mint equivalent conditional stable coins
///
/// RESTRICTED: Package-only to enforce atomic operations via Progress pattern.
/// Single-outcome deposit+mint would violate quantum invariant (escrow == supply for ALL outcomes).
///
/// GUARD: Only allowed before trading starts (initial setup) or after finalization.
/// During active trading, use the Progress pattern (start_split/split_step/finish_split).
public fun deposit_stable_and_mint_conditional<AssetType, StableType, ConditionalCoinType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    stable_coin: Coin<StableType>,
    ctx: &mut TxContext,
): Coin<ConditionalCoinType> {
    // Guard: Prevent use during active trading (would break quantum invariant)
    let trading_started = market_state::is_trading_started(&escrow.market_state);
    let finalized = market_state::is_finalized(&escrow.market_state);
    assert!(!trading_started || finalized, ETradingAlreadyStarted);

    let amount = stable_coin.value();

    // Deposit spot tokens to escrow
    let stable_balance = coin::into_balance(stable_coin);
    escrow.escrowed_stable.join(stable_balance);

    // Track as user backing (total, not per-type)
    escrow.user_deposited_total = escrow.user_deposited_total + amount;

    // Mint equivalent conditional coins
    let coin = mint_conditional_stable<AssetType, StableType, ConditionalCoinType>(
        escrow,
        outcome_index,
        amount,
        ctx,
    );

    // Note: No invariant check here - during setup, sequential deposits to different
    // outcomes naturally create temporary unequal supplies. The quantum invariant
    // is enforced by the Progress pattern during active trading.

    coin
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

/// Get wrapped asset balance for a specific outcome
public fun get_outcome_wrapped_asset<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
): u64 {
    escrow.wrapped_asset_balances[outcome_index]
}

/// Get wrapped stable balance for a specific outcome
public fun get_outcome_wrapped_stable<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
): u64 {
    escrow.wrapped_stable_balances[outcome_index]
}

/// Get error code for quantum invariant violation (for use in inlined checks)
public fun quantum_invariant_error(): u64 {
    EQuantumInvariantViolation
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

/// Get all supplies (both asset and stable) for diagnostics
public fun get_all_supplies<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): (vector<u64>, vector<u64>) {
    (escrow.asset_supplies, escrow.stable_supplies)
}

/// Get all wrapped balances (both asset and stable) for diagnostics
public fun get_wrapped_balances<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): (vector<u64>, vector<u64>) {
    (escrow.wrapped_asset_balances, escrow.wrapped_stable_balances)
}

/// Decrement LP backing after recombination (called by quantum_lp_manager)
/// Aborts if amount exceeds tracked LP deposits - this indicates an accounting bug.
///
/// RESTRICTED: Package-only to prevent accounting corruption.
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
///
/// RESTRICTED: Package-only to prevent accounting corruption.
public fun decrement_user_backing<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    amount: u64,
) {
    assert!(escrow.user_deposited_total >= amount, ENotEnoughLiquidity);
    escrow.user_deposited_total = escrow.user_deposited_total - amount;
}

/// Increment wrapped balance tracking when a coin is wrapped into a ConditionalMarketBalance.
/// Called by conditional_balance::wrap_coin after burning the actual coin.
///
/// RESTRICTED: Package-only to maintain invariant: escrow == supply + wrapped
public fun increment_wrapped_balance<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    is_asset: bool,
    amount: u64,
) {
    if (is_asset) {
        let current = &mut escrow.wrapped_asset_balances[outcome_index];
        *current = *current + amount;
    } else {
        let current = &mut escrow.wrapped_stable_balances[outcome_index];
        *current = *current + amount;
    };
}

/// Decrement wrapped balance tracking when a coin is unwrapped or withdrawn.
/// Called by conditional_balance::unwrap_to_coin and burn_complete_set_and_withdraw_from_balance.
///
/// RESTRICTED: Package-only to maintain invariant: escrow == supply + wrapped
public fun decrement_wrapped_balance<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    is_asset: bool,
    amount: u64,
) {
    if (is_asset) {
        let current = &mut escrow.wrapped_asset_balances[outcome_index];
        assert!(*current >= amount, ENotEnoughLiquidity);
        *current = *current - amount;
    } else {
        let current = &mut escrow.wrapped_stable_balances[outcome_index];
        assert!(*current >= amount, ENotEnoughLiquidity);
        *current = *current - amount;
    };
}

/// Track protocol fees that have been collected from escrow.
/// Called by liquidity_interact::collect_protocol_fees after withdrawing from escrow.
/// This maintains the quantum invariant: escrow + collected_fees == supply + wrapped
///
/// RESTRICTED: Package-only to prevent accounting corruption.
public fun track_collected_protocol_fees<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset_fees: u64,
    stable_fees: u64,
) {
    escrow.collected_protocol_fees_asset = escrow.collected_protocol_fees_asset + asset_fees;
    escrow.collected_protocol_fees_stable = escrow.collected_protocol_fees_stable + stable_fees;
}

/// Get collected protocol fees (for diagnostics)
public fun get_collected_protocol_fees<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
): (u64, u64) {
    (escrow.collected_protocol_fees_asset, escrow.collected_protocol_fees_stable)
}

/// Withdraw asset balance from escrow (for internal use)
///
/// RESTRICTED: Package-only to enforce atomic burn+withdraw.
/// Direct withdrawal without burning would violate quantum invariant.
public fun withdraw_asset_balance<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    amount: u64,
    ctx: &mut TxContext,
): Coin<AssetType> {
    let balance = escrow.escrowed_asset.split(amount);
    coin::from_balance(balance, ctx)
}

/// Withdraw stable balance from escrow (for internal use)
///
/// RESTRICTED: Package-only to enforce atomic burn+withdraw.
/// Direct withdrawal without burning would violate quantum invariant.
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
// During active proposal (not finalized):
// - escrow_asset == each_outcome_asset_supply (for ALL outcomes)
// - escrow_stable == each_outcome_stable_supply (for ALL outcomes)
// After finalization:
// - escrow_asset >= winning_outcome_asset_supply (winning only)
// - escrow_stable >= winning_outcome_stable_supply (winning only)
// - Losing outcomes will have supply > escrow after redemptions (expected)
//
// This invariant ensures the winning outcome's supply can be fully redeemed.
// Since only ONE outcome wins, we only need to check that outcome post-finalization.
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
///
/// QUANTUM MODEL: The spot pool's reserves are "quantum superposed" across all conditional
/// outcomes. Each outcome independently represents the SAME underlying liquidity because
/// only ONE outcome will win and become reality.
///
/// - During active proposal: escrow == supply[i] + wrapped[i] for EACH outcome i
///   This ensures each outcome is independently fully backed (strict per-outcome equality).
/// - After finalization: escrow + collected_fees >= supply + wrapped for WINNING outcome only
///   (losing outcomes will have supply + wrapped > escrow after redemptions, which is fine)
///
/// NOTE: Protocol fees collected from escrow are tracked separately. The invariant accounts
/// for these by adding collected_fees to the escrow side of the equation.
///
/// Aborts with EQuantumInvariantViolation if invariant is violated.
public fun assert_quantum_invariant<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
) {
    let escrow_asset = escrow.escrowed_asset.value();
    let escrow_stable = escrow.escrowed_stable.value();

    if (market_state::is_finalized(&escrow.market_state)) {
        // After finalization: only check winning outcome
        // Losing outcomes will have supply + wrapped > escrow after redemptions
        // Account for collected protocol fees (they were withdrawn from escrow)
        let winning_outcome = market_state::get_winning_outcome(&escrow.market_state);
        let asset_supply = escrow.asset_supplies[winning_outcome];
        let stable_supply = escrow.stable_supplies[winning_outcome];
        let wrapped_asset = escrow.wrapped_asset_balances[winning_outcome];
        let wrapped_stable = escrow.wrapped_stable_balances[winning_outcome];

        // Effective escrow = actual escrow + collected fees
        let effective_escrow_asset = escrow_asset + escrow.collected_protocol_fees_asset;
        let effective_escrow_stable = escrow_stable + escrow.collected_protocol_fees_stable;

        assert!(effective_escrow_asset >= asset_supply + wrapped_asset, EQuantumInvariantViolation);
        assert!(effective_escrow_stable >= stable_supply + wrapped_stable, EQuantumInvariantViolation);
    } else {
        // During active proposal: strict per-outcome equality
        // Each outcome must be independently backed by the full escrow amount
        // This is the quantum model - same backing for all superposed states
        // Note: During active proposal, no fees should be collected yet
        let mut i = 0;
        while (i < escrow.outcome_count) {
            let asset_supply = escrow.asset_supplies[i];
            let stable_supply = escrow.stable_supplies[i];
            let wrapped_asset = escrow.wrapped_asset_balances[i];
            let wrapped_stable = escrow.wrapped_stable_balances[i];

            let total_asset = asset_supply + wrapped_asset;
            let total_stable = stable_supply + wrapped_stable;

            // Each outcome must equal escrow (not just sum across outcomes)
            assert!(escrow_asset == total_asset, EQuantumInvariantViolation);
            assert!(escrow_stable == total_stable, EQuantumInvariantViolation);

            i = i + 1;
        };
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
/// NO DROP ABILITY: Enforces hot potato pattern - caller must complete all steps.
public struct SplitAssetProgress<phantom AssetType, phantom StableType> {
    market_id: ID,
    amount: u64,
    outcome_count: u64,
    next_outcome: u64,
}

/// Drop split asset progress without invariant check.
/// RESTRICTED: Package-only to prevent external callers from bypassing invariant enforcement.
/// Use finish_split_asset_progress for normal flows.
public fun drop_split_asset_progress<AssetType, StableType>(
    progress: SplitAssetProgress<AssetType, StableType>,
) {
    let SplitAssetProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);
}

/// Progress tracker for splitting a spot stable coin into a complete set of conditional stable coins.
/// NO DROP ABILITY: Enforces hot potato pattern - caller must complete all steps.
public struct SplitStableProgress<phantom AssetType, phantom StableType> {
    market_id: ID,
    amount: u64,
    outcome_count: u64,
    next_outcome: u64,
}

/// Drop split stable progress without invariant check.
/// RESTRICTED: Package-only to prevent external callers from bypassing invariant enforcement.
/// Use finish_split_stable_progress for normal flows.
public fun drop_split_stable_progress<AssetType, StableType>(
    progress: SplitStableProgress<AssetType, StableType>,
) {
    let SplitStableProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);
}

/// Progress tracker for recombining conditional asset coins back into a spot asset coin.
/// All outcomes must be processed sequentially from 0 → outcome_count - 1.
/// NO DROP ABILITY: Enforces hot potato pattern - caller must complete all steps.
public struct RecombineAssetProgress<phantom AssetType, phantom StableType> {
    market_id: ID,
    amount: u64,
    outcome_count: u64,
    next_outcome: u64,
}

/// Drop recombine asset progress without invariant check.
/// RESTRICTED: Package-only to prevent external callers from bypassing invariant enforcement.
/// Use finish_recombine_asset_progress for normal flows.
public fun drop_recombine_asset_progress<AssetType, StableType>(
    progress: RecombineAssetProgress<AssetType, StableType>,
) {
    let RecombineAssetProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);
}

/// Progress tracker for recombining conditional stable coins back into a spot stable coin.
/// NO DROP ABILITY: Enforces hot potato pattern - caller must complete all steps.
public struct RecombineStableProgress<phantom AssetType, phantom StableType> {
    market_id: ID,
    amount: u64,
    outcome_count: u64,
    next_outcome: u64,
}

/// Drop recombine stable progress without invariant check.
/// RESTRICTED: Package-only to prevent external callers from bypassing invariant enforcement.
/// Use finish_recombine_stable_progress for normal flows.
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
/// Enforces quantum invariant after completion.
public fun finish_split_asset_progress<AssetType, StableType>(
    progress: SplitAssetProgress<AssetType, StableType>,
    escrow: &TokenEscrow<AssetType, StableType>,
) {
    let SplitAssetProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);

    // Enforce quantum invariant after complete split
    assert_quantum_invariant(escrow);
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
/// Enforces quantum invariant after completion.
public fun finish_split_stable_progress<AssetType, StableType>(
    progress: SplitStableProgress<AssetType, StableType>,
    escrow: &TokenEscrow<AssetType, StableType>,
) {
    let SplitStableProgress { market_id: _, amount: _, outcome_count, next_outcome } = progress;
    assert!(next_outcome == outcome_count, EIncorrectSequence);

    // Enforce quantum invariant after complete split
    assert_quantum_invariant(escrow);
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
/// Enforces quantum invariant after completion.
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

    let coin = withdraw_asset_balance(escrow, amount, ctx);

    // Enforce quantum invariant after complete recombination
    assert_quantum_invariant(escrow);

    coin
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
/// Enforces quantum invariant after completion.
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

    let coin = withdraw_stable_balance(escrow, amount, ctx);

    // Enforce quantum invariant after complete recombination
    assert_quantum_invariant(escrow);

    coin
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
/// Also initializes supply and wrapped vectors for each outcome
public fun create_test_escrow_with_market_state<AssetType, StableType>(
    outcome_count: u64,
    market_state: MarketState,
    ctx: &mut TxContext,
): TokenEscrow<AssetType, StableType> {
    let mut escrow = new<AssetType, StableType>(market_state, ctx);

    // Initialize supply and wrapped vectors for each outcome
    let mut i = 0;
    while (i < outcome_count) {
        escrow.asset_supplies.push_back(0);
        escrow.stable_supplies.push_back(0);
        escrow.wrapped_asset_balances.push_back(0);
        escrow.wrapped_stable_balances.push_back(0);
        escrow.outcome_count = escrow.outcome_count + 1;
        i = i + 1;
    };

    escrow
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
        wrapped_asset_balances: _,
        wrapped_stable_balances: _,
        collected_protocol_fees_asset: _,
        collected_protocol_fees_stable: _,
    } = escrow;

    // Destroy balances
    balance::destroy_for_testing(escrowed_asset);
    balance::destroy_for_testing(escrowed_stable);

    // Destroy market state
    futarchy_markets_primitives::market_state::destroy_for_testing(market_state);

    // Delete UID (TreasuryCaps in dynamic fields will be destroyed automatically)
    object::delete(id);
}

#[test_only]
/// Set wrapped balance for testing (to simulate wrapped coins without going through wrap flow)
/// Useful for unit testing unwrap functionality
public fun set_wrapped_balance_for_testing<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    is_asset: bool,
    amount: u64,
) {
    if (is_asset) {
        let current = &mut escrow.wrapped_asset_balances[outcome_index];
        *current = amount;
    } else {
        let current = &mut escrow.wrapped_stable_balances[outcome_index];
        *current = amount;
    };
}

#[test_only]
/// Increment supply for a specific outcome (for testing setup)
public fun increment_supply_for_outcome<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u64,
    is_asset: bool,
    amount: u64,
) {
    if (is_asset) {
        let supply = &mut escrow.asset_supplies[outcome_index];
        *supply = *supply + amount;
    } else {
        let supply = &mut escrow.stable_supplies[outcome_index];
        *supply = *supply + amount;
    };
}

#[test_only]
/// Deposit spot liquidity for testing (directly adds to escrow balances)
public fun deposit_spot_liquidity_for_testing<AssetType, StableType>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    asset_amount: u64,
    stable_amount: u64,
) {
    let asset_coin = balance::create_for_testing<AssetType>(asset_amount);
    let stable_coin = balance::create_for_testing<StableType>(stable_amount);
    escrow.escrowed_asset.join(asset_coin);
    escrow.escrowed_stable.join(stable_coin);
}
