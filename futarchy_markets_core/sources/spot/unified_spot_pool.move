// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// ============================================================================
/// UNIFIED SPOT POOL - Single pool type with Coin-based LP tokens
/// ============================================================================
///
/// LP tokens are now standard Sui Coins for ecosystem composability.
/// Pool holds TreasuryCap and mints/burns LP coins on liquidity operations.
///
/// LP Coin Requirements:
/// - Symbol must be "GOVEX_LP_TOKEN"
/// - Name must be "GOVEX_LP_TOKEN"
/// - Supply must be 0 when passed to pool creation
///
/// ============================================================================

module futarchy_markets_core::unified_spot_pool;

use futarchy_markets_primitives::PCW_TWAP_oracle::{Self, SimpleTWAP};
use futarchy_markets_primitives::fee_scheduler::{Self, FeeSchedule};
use std::ascii;
use std::string;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};

// === Errors ===
const EInsufficientLiquidity: u64 = 1;
const EInsufficientLPSupply: u64 = 3;
const EZeroAmount: u64 = 4;
const ESlippageExceeded: u64 = 5;
const EMinimumLiquidityNotMet: u64 = 6;
const ENoActiveProposal: u64 = 7;
const EAggregatorNotEnabled: u64 = 11;
const EProposalActive: u64 = 15;
const EInsufficientGapBetweenProposals: u64 = 16;
const EInvalidLPCoinSymbol: u64 = 20;
const EInvalidLPCoinName: u64 = 21;
const ELPSupplyNotZero: u64 = 22;

// === Constants ===
const MINIMUM_LIQUIDITY: u64 = 1000;
const PRECISION: u128 = 1_000_000_000_000; // 1e12 for price calculations
const SIX_HOURS_MS: u64 = 21_600_000; // 6 hours in milliseconds
const LP_SYMBOL: vector<u8> = b"GOVEX_LP_TOKEN";
const LP_NAME: vector<u8> = b"GOVEX_LP_TOKEN";

// === Structs ===

/// Unified spot pool with Coin-based LP tokens
/// Now has 3 phantom types: AssetType, StableType, and LPType
public struct UnifiedSpotPool<phantom AssetType, phantom StableType, phantom LPType> has key, store {
    id: UID,
    // Core AMM fields
    asset_reserve: Balance<AssetType>,
    stable_reserve: Balance<StableType>,
    fee_bps: u64,
    minimum_liquidity: u64,
    // LP token management - pool owns the TreasuryCap
    lp_treasury_cap: TreasuryCap<LPType>,
    // Dynamic fee scheduling (optional, for launchpad anti-snipe)
    fee_schedule: Option<FeeSchedule>,
    fee_schedule_activation_time: u64,
    // Proposal tracking - blocks LP operations during proposals, enforces 6hr gap
    active_proposal_id: Option<ID>,
    last_proposal_end_time: Option<u64>,
    // Optional aggregator configuration
    aggregator_config: Option<AggregatorConfig<AssetType, StableType>>,
}

/// Aggregator-specific configuration (only present when enabled)
public struct AggregatorConfig<phantom AssetType, phantom StableType> has store {
    active_escrow: Option<ID>,
    simple_twap: SimpleTWAP,
    last_proposal_usage: Option<u64>,
    conditional_liquidity_ratio_percent: u64,
    oracle_conditional_threshold_bps: u64,
    spot_cumulative_at_lock: Option<u256>,
    protocol_fees_asset: Balance<AssetType>,
    protocol_fees_stable: Balance<StableType>,
}

// === Creation Functions ===

/// Create a futarchy spot pool with Coin-based LP tokens
///
/// REQUIREMENTS for lp_treasury_cap:
/// - Symbol must be "GOVEX_LP_TOKEN"
/// - Name must be "GOVEX_LP_TOKEN"
/// - Total supply must be 0
public fun new<AssetType, StableType, LPType>(
    lp_treasury_cap: TreasuryCap<LPType>,
    lp_metadata: &CoinMetadata<LPType>,
    fee_bps: u64,
    fee_schedule: Option<FeeSchedule>,
    oracle_conditional_threshold_bps: u64,
    conditional_liquidity_ratio_percent: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): UnifiedSpotPool<AssetType, StableType, LPType> {
    // Validate LP coin metadata
    let symbol = coin::get_symbol(lp_metadata);
    let name = coin::get_name(lp_metadata);

    let expected_symbol = LP_SYMBOL;
    let expected_name = LP_NAME;
    assert!(ascii::as_bytes(&symbol) == &expected_symbol, EInvalidLPCoinSymbol);
    assert!(string::as_bytes(&name) == &expected_name, EInvalidLPCoinName);

    // Validate supply is zero
    assert!(coin::total_supply(&lp_treasury_cap) == 0, ELPSupplyNotZero);

    // Initialize TWAP oracle
    let simple_twap = PCW_TWAP_oracle::new_default(0, clock);

    let aggregator_config = AggregatorConfig {
        active_escrow: option::none(),
        simple_twap,
        last_proposal_usage: option::none(),
        conditional_liquidity_ratio_percent,
        oracle_conditional_threshold_bps,
        spot_cumulative_at_lock: option::none(),
        protocol_fees_asset: balance::zero(),
        protocol_fees_stable: balance::zero(),
    };

    UnifiedSpotPool {
        id: object::new(ctx),
        asset_reserve: balance::zero(),
        stable_reserve: balance::zero(),
        fee_bps,
        minimum_liquidity: MINIMUM_LIQUIDITY,
        lp_treasury_cap,
        fee_schedule,
        fee_schedule_activation_time: clock.timestamp_ms(),
        active_proposal_id: option::none(),
        last_proposal_end_time: option::none(),
        aggregator_config: option::some(aggregator_config),
    }
}

// === Escrow Management Functions ===

public fun store_active_escrow<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    escrow_id: ID,
) {
    assert!(pool.aggregator_config.is_some(), EAggregatorNotEnabled);
    let config = pool.aggregator_config.borrow_mut();
    assert!(config.active_escrow.is_none(), ENoActiveProposal);
    option::fill(&mut config.active_escrow, escrow_id);
}

public fun extract_active_escrow<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
): ID {
    assert!(pool.aggregator_config.is_some(), EAggregatorNotEnabled);
    let config = pool.aggregator_config.borrow_mut();
    assert!(config.active_escrow.is_some(), ENoActiveProposal);
    option::extract(&mut config.active_escrow)
}

public fun get_active_escrow_id<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): Option<ID> {
    if (pool.aggregator_config.is_none()) {
        return option::none()
    };
    let config = pool.aggregator_config.borrow();
    config.active_escrow
}

// === Core AMM Functions ===

/// Add liquidity to the pool and return LP coin with excess coins
/// Returns: (Coin<LPType>, excess_asset_coin, excess_stable_coin)
public fun add_liquidity<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    asset_coin: Coin<AssetType>,
    stable_coin: Coin<StableType>,
    min_lp_out: u64,
    ctx: &mut TxContext,
): (Coin<LPType>, Coin<AssetType>, Coin<StableType>) {
    let asset_amount = coin::value(&asset_coin);
    let stable_amount = coin::value(&stable_coin);

    assert!(asset_amount > 0 && stable_amount > 0, EZeroAmount);
    assert!(pool.active_proposal_id.is_none(), EProposalActive);

    let current_supply = coin::total_supply(&pool.lp_treasury_cap);

    let (lp_amount, optimal_asset_amount, optimal_stable_amount) = if (current_supply == 0) {
        // Initial liquidity
        let product = (asset_amount as u128) * (stable_amount as u128);
        let initial_lp = (product.sqrt() as u64);
        assert!(initial_lp >= pool.minimum_liquidity, EMinimumLiquidityNotMet);

        // Mint and burn minimum liquidity (locked forever)
        let min_lp_coin = coin::mint(&mut pool.lp_treasury_cap, pool.minimum_liquidity, ctx);
        transfer::public_freeze_object(min_lp_coin);

        (initial_lp - pool.minimum_liquidity, asset_amount, stable_amount)
    } else {
        // Proportional liquidity
        let asset_reserve = balance::value(&pool.asset_reserve);
        let stable_reserve = balance::value(&pool.stable_reserve);

        let lp_from_asset =
            (asset_amount as u128) * (current_supply as u128) / (asset_reserve as u128);
        let lp_from_stable =
            (stable_amount as u128) * (current_supply as u128) / (stable_reserve as u128);

        let lp_to_mint = lp_from_asset.min(lp_from_stable);

        let optimal_asset =
            (lp_to_mint * (asset_reserve as u128) / (current_supply as u128)) as u64;
        let optimal_stable =
            (lp_to_mint * (stable_reserve as u128) / (current_supply as u128)) as u64;

        ((lp_to_mint as u64), optimal_asset, optimal_stable)
    };

    assert!(lp_amount >= min_lp_out, ESlippageExceeded);

    // Split coins
    let mut asset_coin_to_deposit = asset_coin;
    let mut stable_coin_to_deposit = stable_coin;

    let excess_asset = if (asset_amount > optimal_asset_amount) {
        coin::split(&mut asset_coin_to_deposit, asset_amount - optimal_asset_amount, ctx)
    } else {
        coin::zero<AssetType>(ctx)
    };

    let excess_stable = if (stable_amount > optimal_stable_amount) {
        coin::split(&mut stable_coin_to_deposit, stable_amount - optimal_stable_amount, ctx)
    } else {
        coin::zero<StableType>(ctx)
    };

    // Add to reserves
    balance::join(&mut pool.asset_reserve, coin::into_balance(asset_coin_to_deposit));
    balance::join(&mut pool.stable_reserve, coin::into_balance(stable_coin_to_deposit));

    // Mint LP coins
    let lp_coin = coin::mint(&mut pool.lp_treasury_cap, lp_amount, ctx);

    (lp_coin, excess_asset, excess_stable)
}

/// Remove liquidity from the pool
public fun remove_liquidity<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    lp_coin: Coin<LPType>,
    min_asset_out: u64,
    min_stable_out: u64,
    ctx: &mut TxContext,
): (Coin<AssetType>, Coin<StableType>) {
    let lp_amount = coin::value(&lp_coin);
    let current_supply = coin::total_supply(&pool.lp_treasury_cap);

    assert!(lp_amount > 0, EZeroAmount);
    assert!(current_supply >= lp_amount, EInsufficientLPSupply);
    assert!(pool.active_proposal_id.is_none(), EProposalActive);

    let asset_reserve = balance::value(&pool.asset_reserve);
    let stable_reserve = balance::value(&pool.stable_reserve);

    let asset_out = (asset_reserve as u128) * (lp_amount as u128) / (current_supply as u128);
    let stable_out = (stable_reserve as u128) * (lp_amount as u128) / (current_supply as u128);

    assert!((asset_out as u64) >= min_asset_out, ESlippageExceeded);
    assert!((stable_out as u64) >= min_stable_out, ESlippageExceeded);

    // Burn LP coins
    coin::burn(&mut pool.lp_treasury_cap, lp_coin);

    // Return assets
    let asset_coin = coin::from_balance(
        balance::split(&mut pool.asset_reserve, (asset_out as u64)),
        ctx,
    );
    let stable_coin = coin::from_balance(
        balance::split(&mut pool.stable_reserve, (stable_out as u64)),
        ctx,
    );

    // Check minimum liquidity
    let remaining_asset = balance::value(&pool.asset_reserve);
    let remaining_stable = balance::value(&pool.stable_reserve);
    let remaining_k = (remaining_asset as u128) * (remaining_stable as u128);
    assert!(remaining_k >= (MINIMUM_LIQUIDITY as u128), EMinimumLiquidityNotMet);

    if (pool.aggregator_config.is_some()) {
        let config = pool.aggregator_config.borrow();
        let active_ratio = config.conditional_liquidity_ratio_percent;

        if (active_ratio > 0) {
            let spot_ratio = 100 - active_ratio;
            let projected_spot_asset = (remaining_asset as u128) * (spot_ratio as u128) / 100u128;
            let projected_spot_stable = (remaining_stable as u128) * (spot_ratio as u128) / 100u128;
            let projected_k = projected_spot_asset * projected_spot_stable;
            assert!(projected_k >= (MINIMUM_LIQUIDITY as u128), EMinimumLiquidityNotMet);
        };
    };

    (asset_coin, stable_coin)
}

// === Fee Calculation ===

fun get_current_fee_bps<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
): u64 {
    if (pool.fee_schedule.is_some()) {
        fee_scheduler::get_current_fee(
            pool.fee_schedule.borrow(),
            pool.fee_bps,
            pool.fee_schedule_activation_time,
            clock.timestamp_ms(),
        )
    } else {
        pool.fee_bps
    }
}

public(package) fun update_cached_fee_if_needed<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
) {
    if (pool.fee_schedule.is_some()) {
        let current_fee = get_current_fee_bps(pool, clock);
        pool.fee_bps = current_fee;
    }
}

public fun can_create_proposals<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
): bool {
    if (pool.fee_schedule.is_some()) {
        let schedule = pool.fee_schedule.borrow();
        let current_time = clock.timestamp_ms();
        let activation_time = pool.fee_schedule_activation_time;

        let is_active = if (current_time <= activation_time) {
            true
        } else {
            let elapsed = current_time - activation_time;
            elapsed < fee_scheduler::duration_ms(schedule)
        };

        !is_active
    } else {
        true
    }
}

/// Swap stable for asset
public fun swap_stable_for_asset<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    mut stable_in: Coin<StableType>,
    min_asset_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<AssetType> {
    let stable_amount = coin::value(&stable_in);
    assert!(stable_amount > 0, EZeroAmount);

    let asset_reserve = balance::value(&pool.asset_reserve);
    let stable_reserve = balance::value(&pool.stable_reserve);

    let current_fee_bps = get_current_fee_bps(pool, clock);
    let total_fee = stable_amount * current_fee_bps / 10000;

    let protocol_share = if (pool.aggregator_config.is_some()) {
        use futarchy_one_shot_utils::constants;
        use futarchy_one_shot_utils::math;
        let lp_fee = math::mul_div_to_64(
            total_fee,
            constants::spot_lp_fee_share_bps(),
            constants::total_fee_bps(),
        );
        total_fee - lp_fee
    } else {
        0
    };

    let stable_after_fee = stable_amount - total_fee;
    let asset_out =
        (asset_reserve as u128) * (stable_after_fee as u128) /
                    ((stable_reserve as u128) + (stable_after_fee as u128));

    assert!((asset_out as u64) >= min_asset_out, ESlippageExceeded);
    assert!((asset_out as u64) < asset_reserve, EInsufficientLiquidity);

    if (pool.aggregator_config.is_some()) {
        let price_before = get_spot_price(pool);
        let config = pool.aggregator_config.borrow_mut();
        PCW_TWAP_oracle::update(&mut config.simple_twap, price_before, clock);

        if (protocol_share > 0) {
            let protocol_fee_balance = balance::split(
                coin::balance_mut(&mut stable_in),
                protocol_share,
            );
            balance::join(&mut config.protocol_fees_stable, protocol_fee_balance);
        };
    };

    balance::join(&mut pool.stable_reserve, coin::into_balance(stable_in));
    let asset_coin = coin::from_balance(
        balance::split(&mut pool.asset_reserve, (asset_out as u64)),
        ctx,
    );

    asset_coin
}

/// Swap asset for stable
public fun swap_asset_for_stable<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    mut asset_in: Coin<AssetType>,
    min_stable_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<StableType> {
    let asset_amount = coin::value(&asset_in);
    assert!(asset_amount > 0, EZeroAmount);

    let asset_reserve = balance::value(&pool.asset_reserve);
    let stable_reserve = balance::value(&pool.stable_reserve);

    let current_fee_bps = get_current_fee_bps(pool, clock);
    let total_fee = asset_amount * current_fee_bps / 10000;

    let protocol_share = if (pool.aggregator_config.is_some()) {
        use futarchy_one_shot_utils::constants;
        use futarchy_one_shot_utils::math;
        let lp_fee = math::mul_div_to_64(
            total_fee,
            constants::spot_lp_fee_share_bps(),
            constants::total_fee_bps(),
        );
        total_fee - lp_fee
    } else {
        0
    };

    let asset_after_fee = asset_amount - total_fee;
    let stable_out =
        (stable_reserve as u128) * (asset_after_fee as u128) /
                     ((asset_reserve as u128) + (asset_after_fee as u128));

    assert!((stable_out as u64) >= min_stable_out, ESlippageExceeded);
    assert!((stable_out as u64) < stable_reserve, EInsufficientLiquidity);

    if (pool.aggregator_config.is_some()) {
        let price_before = get_spot_price(pool);
        let config = pool.aggregator_config.borrow_mut();
        PCW_TWAP_oracle::update(&mut config.simple_twap, price_before, clock);

        if (protocol_share > 0) {
            let protocol_fee_balance = balance::split(
                coin::balance_mut(&mut asset_in),
                protocol_share,
            );
            balance::join(&mut config.protocol_fees_asset, protocol_fee_balance);
        };
    };

    balance::join(&mut pool.asset_reserve, coin::into_balance(asset_in));
    let stable_coin = coin::from_balance(
        balance::split(&mut pool.stable_reserve, (stable_out as u64)),
        ctx,
    );

    stable_coin
}

// === View Functions ===

public fun get_reserves<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): (u64, u64) {
    (balance::value(&pool.asset_reserve), balance::value(&pool.stable_reserve))
}

public fun lp_supply<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): u64 {
    coin::total_supply(&pool.lp_treasury_cap)
}

public fun get_spot_price<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): u128 {
    let asset_reserve = balance::value(&pool.asset_reserve);
    let stable_reserve = balance::value(&pool.stable_reserve);

    if (asset_reserve == 0 || stable_reserve == 0) {
        return 0
    };

    (stable_reserve as u128) * PRECISION / (asset_reserve as u128)
}

public fun is_aggregator_enabled<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): bool {
    pool.aggregator_config.is_some()
}

public fun has_active_escrow<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): bool {
    if (pool.aggregator_config.is_none()) {
        return false
    };
    let config = pool.aggregator_config.borrow();
    config.active_escrow.is_some()
}

public fun is_locked_for_proposal<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): bool {
    if (pool.aggregator_config.is_none()) {
        return false
    };
    let config = pool.aggregator_config.borrow();
    config.last_proposal_usage.is_some()
}

public fun get_conditional_liquidity_ratio_percent<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): u64 {
    if (pool.aggregator_config.is_none()) {
        return 0
    };
    let config = pool.aggregator_config.borrow();
    config.conditional_liquidity_ratio_percent
}

public fun get_oracle_conditional_threshold_bps<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): u64 {
    if (pool.aggregator_config.is_none()) {
        return 10000
    };
    let config = pool.aggregator_config.borrow();
    config.oracle_conditional_threshold_bps
}

public fun get_fee_bps<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): u64 {
    pool.fee_bps
}

public fun get_pool_id<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): ID {
    object::uid_to_inner(&pool.id)
}

// === Quantum Liquidity Functions ===

public(package) fun split_reserves_for_quantum<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    asset_amount: u64,
    stable_amount: u64,
): (Balance<AssetType>, Balance<StableType>) {
    assert!(asset_amount > 0 && stable_amount > 0, EZeroAmount);

    let current_asset = balance::value(&pool.asset_reserve);
    let current_stable = balance::value(&pool.stable_reserve);
    assert!(asset_amount <= current_asset, EZeroAmount);
    assert!(stable_amount <= current_stable, EZeroAmount);

    let asset_balance = balance::split(&mut pool.asset_reserve, asset_amount);
    let stable_balance = balance::split(&mut pool.stable_reserve, stable_amount);

    (asset_balance, stable_balance)
}

public(package) fun add_liquidity_from_quantum_redeem<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    asset: Balance<AssetType>,
    stable: Balance<StableType>,
) {
    balance::join(&mut pool.asset_reserve, asset);
    balance::join(&mut pool.stable_reserve, stable);
}

// === Arbitrage Reserve Operations ===

public(package) fun take_stable_for_arbitrage<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    amount: u64,
): Balance<StableType> {
    assert!(amount > 0, EZeroAmount);
    assert!(balance::value(&pool.stable_reserve) >= amount, EZeroAmount);
    balance::split(&mut pool.stable_reserve, amount)
}

public(package) fun take_asset_for_arbitrage<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    amount: u64,
): Balance<AssetType> {
    assert!(amount > 0, EZeroAmount);
    assert!(balance::value(&pool.asset_reserve) >= amount, EZeroAmount);
    balance::split(&mut pool.asset_reserve, amount)
}

public(package) fun return_stable_from_arbitrage<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    stable: Balance<StableType>,
) {
    balance::join(&mut pool.stable_reserve, stable);
}

public(package) fun return_asset_from_arbitrage<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    asset: Balance<AssetType>,
) {
    balance::join(&mut pool.asset_reserve, asset);
}

// === Proposal State Management ===

public(package) fun set_active_proposal<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    proposal_id: ID,
) {
    pool.active_proposal_id = option::some(proposal_id);
}

public(package) fun clear_active_proposal<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
) {
    pool.active_proposal_id = option::none();
    pool.last_proposal_end_time = option::some(clock.timestamp_ms());
}

public(package) fun check_proposal_gap<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
) {
    if (pool.last_proposal_end_time.is_some()) {
        let last_end = *option::borrow(&pool.last_proposal_end_time);
        let current_time = clock.timestamp_ms();
        assert!(current_time >= last_end + SIX_HOURS_MS, EInsufficientGapBetweenProposals);
    }
}

#[test_only]
public fun reset_proposal_gap_for_testing<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
) {
    pool.last_proposal_end_time = option::none();
}

// === Aggregator Functions ===

public fun mark_liquidity_to_proposal<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    conditional_liquidity_ratio_percent: u64,
    clock: &Clock,
) {
    if (pool.aggregator_config.is_none()) {
        return
    };

    let current_price = get_spot_price(pool);
    let config = pool.aggregator_config.borrow_mut();

    PCW_TWAP_oracle::update(&mut config.simple_twap, current_price, clock);

    let proposal_start = clock.timestamp_ms();
    config.last_proposal_usage = option::some(proposal_start);

    let cumulative_at_lock = PCW_TWAP_oracle::cumulative_total(&config.simple_twap);
    config.spot_cumulative_at_lock = option::some(cumulative_at_lock);

    config.conditional_liquidity_ratio_percent = conditional_liquidity_ratio_percent;
}

public fun is_twap_ready<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
): bool {
    if (pool.aggregator_config.is_none()) {
        return false
    };
    let config = pool.aggregator_config.borrow();
    PCW_TWAP_oracle::is_ready(&config.simple_twap, clock)
}

public fun get_geometric_twap<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
): u128 {
    assert!(pool.aggregator_config.is_some(), EAggregatorNotEnabled);
    let config = pool.aggregator_config.borrow();
    let base_twap = PCW_TWAP_oracle::get_twap(&config.simple_twap);
    let long_opt = PCW_TWAP_oracle::get_ninety_day_twap(&config.simple_twap, clock);
    unwrap_option_with_default(long_opt, base_twap)
}

public fun get_twap_with_conditional<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    winning_conditional_oracle: &SimpleTWAP,
    clock: &Clock,
): u128 {
    assert!(pool.aggregator_config.is_some(), EAggregatorNotEnabled);
    let config = pool.aggregator_config.borrow();

    let spot_base_twap = PCW_TWAP_oracle::get_twap(&config.simple_twap);
    let spot_long_opt = PCW_TWAP_oracle::get_ninety_day_twap(&config.simple_twap, clock);
    let spot_long_twap = unwrap_option_with_default(spot_long_opt, spot_base_twap);

    if (config.last_proposal_usage.is_none()) {
        return spot_long_twap
    };

    let threshold_percent = config.oracle_conditional_threshold_bps / 100;
    if (config.conditional_liquidity_ratio_percent < threshold_percent) {
        return spot_long_twap
    };

    let conditional_base = PCW_TWAP_oracle::get_twap(winning_conditional_oracle);
    let conditional_opt = PCW_TWAP_oracle::get_ninety_day_twap(winning_conditional_oracle, clock);
    unwrap_option_with_default(conditional_opt, conditional_base)
}

fun unwrap_option_with_default(opt: option::Option<u128>, fallback: u128): u128 {
    if (option::is_some(&opt)) {
        option::destroy_some(opt)
    } else {
        option::destroy_none(opt);
        fallback
    }
}

public fun get_simple_twap<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): &SimpleTWAP {
    assert!(pool.aggregator_config.is_some(), EAggregatorNotEnabled);
    let config = pool.aggregator_config.borrow();
    &config.simple_twap
}

// === Simulate Functions ===

public fun simulate_swap_asset_to_stable<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    asset_in: u64,
): u64 {
    if (asset_in == 0) {
        return 0
    };

    let asset_reserve = balance::value(&pool.asset_reserve);
    let stable_reserve = balance::value(&pool.stable_reserve);

    if (asset_reserve == 0 || stable_reserve == 0) {
        return 0
    };

    let asset_after_fee = asset_in - (asset_in * pool.fee_bps / 10000);
    let stable_out =
        (stable_reserve as u128) * (asset_after_fee as u128) /
                     ((asset_reserve as u128) + (asset_after_fee as u128));

    if ((stable_out as u64) >= stable_reserve) {
        return 0
    };

    (stable_out as u64)
}

public fun simulate_swap_stable_to_asset<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    stable_in: u64,
): u64 {
    if (stable_in == 0) {
        return 0
    };

    let asset_reserve = balance::value(&pool.asset_reserve);
    let stable_reserve = balance::value(&pool.stable_reserve);

    if (asset_reserve == 0 || stable_reserve == 0) {
        return 0
    };

    let stable_after_fee = stable_in - (stable_in * pool.fee_bps / 10000);
    let asset_out =
        (asset_reserve as u128) * (stable_after_fee as u128) /
                    ((stable_reserve as u128) + (stable_after_fee as u128));

    if ((asset_out as u64) >= asset_reserve) {
        return 0
    };

    (asset_out as u64)
}

// === Dissolution Functions ===

public fun remove_liquidity_for_dissolution<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    lp_coin: Coin<LPType>,
    bypass_minimum: bool,
    ctx: &mut TxContext,
): (Coin<AssetType>, Coin<StableType>) {
    let lp_amount = coin::value(&lp_coin);
    let current_supply = coin::total_supply(&pool.lp_treasury_cap);

    assert!(lp_amount > 0, EZeroAmount);
    assert!(current_supply >= lp_amount, EInsufficientLPSupply);

    let asset_reserve = balance::value(&pool.asset_reserve);
    let stable_reserve = balance::value(&pool.stable_reserve);

    let asset_out = (asset_reserve as u128) * (lp_amount as u128) / (current_supply as u128);
    let stable_out = (stable_reserve as u128) * (lp_amount as u128) / (current_supply as u128);

    // Burn LP coins
    coin::burn(&mut pool.lp_treasury_cap, lp_coin);

    let asset_coin = coin::from_balance(
        balance::split(&mut pool.asset_reserve, (asset_out as u64)),
        ctx,
    );
    let stable_coin = coin::from_balance(
        balance::split(&mut pool.stable_reserve, (stable_out as u64)),
        ctx,
    );

    if (!bypass_minimum) {
        let remaining_asset = balance::value(&pool.asset_reserve);
        let remaining_stable = balance::value(&pool.stable_reserve);
        let remaining_k = (remaining_asset as u128) * (remaining_stable as u128);
        assert!(remaining_k >= (MINIMUM_LIQUIDITY as u128), EMinimumLiquidityNotMet);
    } else {
        pool.fee_bps = 10000; // Disable trading
    };

    (asset_coin, stable_coin)
}

public fun get_dao_lp_value<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    dao_owned_lp_amount: u64,
): (u64, u64) {
    let total_lp = coin::total_supply(&pool.lp_treasury_cap);
    if (total_lp == 0) {
        return (0, 0)
    };

    let asset_reserve = balance::value(&pool.asset_reserve);
    let stable_reserve = balance::value(&pool.stable_reserve);

    let asset_value = (asset_reserve as u128) * (dao_owned_lp_amount as u128) / (total_lp as u128);
    let stable_value = (stable_reserve as u128) * (dao_owned_lp_amount as u128) / (total_lp as u128);

    ((asset_value as u64), (stable_value as u64))
}

// === Protocol Fee Management ===

public(package) fun withdraw_protocol_fees_asset<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
): Balance<AssetType> {
    assert!(pool.aggregator_config.is_some(), EAggregatorNotEnabled);
    let config = pool.aggregator_config.borrow_mut();
    let amount = config.protocol_fees_asset.value();
    config.protocol_fees_asset.split(amount)
}

public(package) fun withdraw_protocol_fees_stable<AssetType, StableType, LPType>(
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
): Balance<StableType> {
    assert!(pool.aggregator_config.is_some(), EAggregatorNotEnabled);
    let config = pool.aggregator_config.borrow_mut();
    let amount = config.protocol_fees_stable.value();
    config.protocol_fees_stable.split(amount)
}

public fun get_protocol_fee_amounts<AssetType, StableType, LPType>(
    pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
): (u64, u64) {
    if (pool.aggregator_config.is_none()) {
        return (0, 0)
    };
    let config = pool.aggregator_config.borrow();
    (config.protocol_fees_asset.value(), config.protocol_fees_stable.value())
}

// === Sharing Function ===

public fun share<AssetType, StableType, LPType>(
    pool: UnifiedSpotPool<AssetType, StableType, LPType>,
) {
    transfer::public_share_object(pool);
}

// === Test Functions ===

#[test_only]
public fun new_for_testing<AssetType, StableType, LPType>(
    lp_treasury_cap: TreasuryCap<LPType>,
    fee_bps: u64,
    ctx: &mut TxContext,
): UnifiedSpotPool<AssetType, StableType, LPType> {
    use sui::clock;

    let clock = clock::create_for_testing(ctx);
    let simple_twap = PCW_TWAP_oracle::new_default(0, &clock);

    let aggregator_config = AggregatorConfig {
        active_escrow: option::none(),
        simple_twap,
        last_proposal_usage: option::none(),
        conditional_liquidity_ratio_percent: 50,
        oracle_conditional_threshold_bps: 5000,
        spot_cumulative_at_lock: option::none(),
        protocol_fees_asset: balance::zero(),
        protocol_fees_stable: balance::zero(),
    };

    clock::destroy_for_testing(clock);

    UnifiedSpotPool {
        id: object::new(ctx),
        asset_reserve: balance::zero(),
        stable_reserve: balance::zero(),
        fee_bps,
        minimum_liquidity: MINIMUM_LIQUIDITY,
        lp_treasury_cap,
        fee_schedule: option::none(),
        fee_schedule_activation_time: 0,
        active_proposal_id: option::none(),
        last_proposal_end_time: option::none(),
        aggregator_config: option::some(aggregator_config),
    }
}

#[test_only]
public fun create_pool_for_testing<AssetType, StableType, LPType>(
    lp_treasury_cap: TreasuryCap<LPType>,
    asset_amount: u64,
    stable_amount: u64,
    fee_bps: u64,
    ctx: &mut TxContext,
): UnifiedSpotPool<AssetType, StableType, LPType> {
    let asset_balance = balance::create_for_testing<AssetType>(asset_amount);
    let stable_balance = balance::create_for_testing<StableType>(stable_amount);

    UnifiedSpotPool {
        id: object::new(ctx),
        asset_reserve: asset_balance,
        stable_reserve: stable_balance,
        fee_bps,
        minimum_liquidity: MINIMUM_LIQUIDITY,
        lp_treasury_cap,
        fee_schedule: option::none(),
        fee_schedule_activation_time: 0,
        active_proposal_id: option::none(),
        last_proposal_end_time: option::none(),
        aggregator_config: option::none(),
    }
}

#[test_only]
public fun destroy_for_testing<AssetType, StableType, LPType>(
    pool: UnifiedSpotPool<AssetType, StableType, LPType>,
) {
    let UnifiedSpotPool {
        id,
        asset_reserve,
        stable_reserve,
        fee_bps: _,
        minimum_liquidity: _,
        lp_treasury_cap,
        fee_schedule: _,
        fee_schedule_activation_time: _,
        active_proposal_id: _,
        last_proposal_end_time: _,
        aggregator_config,
    } = pool;

    object::delete(id);
    balance::destroy_for_testing(asset_reserve);
    balance::destroy_for_testing(stable_reserve);
    sui::test_utils::destroy(lp_treasury_cap);

    if (aggregator_config.is_some()) {
        let config = option::destroy_some(aggregator_config);
        let AggregatorConfig {
            active_escrow,
            simple_twap,
            last_proposal_usage: _,
            conditional_liquidity_ratio_percent: _,
            oracle_conditional_threshold_bps: _,
            spot_cumulative_at_lock: _,
            protocol_fees_asset,
            protocol_fees_stable,
        } = config;

        if (active_escrow.is_some()) {
            option::destroy_some(active_escrow);
        } else {
            option::destroy_none(active_escrow);
        };

        PCW_TWAP_oracle::destroy_for_testing(simple_twap);
        balance::destroy_for_testing(protocol_fees_asset);
        balance::destroy_for_testing(protocol_fees_stable);
    } else {
        option::destroy_none(aggregator_config);
    };
}

#[test_only]
public fun create_for_testing<AssetType, StableType, LPType>(
    lp_treasury_cap: TreasuryCap<LPType>,
    asset_balance: Balance<AssetType>,
    stable_balance: Balance<StableType>,
    fee_bps: u64,
    ctx: &mut TxContext,
): UnifiedSpotPool<AssetType, StableType, LPType> {
    UnifiedSpotPool {
        id: object::new(ctx),
        asset_reserve: asset_balance,
        stable_reserve: stable_balance,
        fee_bps,
        minimum_liquidity: MINIMUM_LIQUIDITY,
        lp_treasury_cap,
        fee_schedule: option::none(),
        fee_schedule_activation_time: 0,
        active_proposal_id: option::none(),
        last_proposal_end_time: option::none(),
        aggregator_config: option::none(),
    }
}
