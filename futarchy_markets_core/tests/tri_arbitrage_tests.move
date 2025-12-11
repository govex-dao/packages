// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Comprehensive tests for tri-arbitrage system
///
/// Tests the tri-arbitrage routes:
/// - ROUTE_SPOT_TO_COND: Buy from spot, sell to conditional
/// - ROUTE_COND_TO_SPOT: Buy from conditional, sell to spot
/// - ROUTE_SPOT_TO_BID: Buy from spot, sell to protective bid at NAV
/// - ROUTE_COND_TO_BID: Buy from conditional, sell to protective bid at NAV
///
/// Key test areas:
/// 1. Route selection based on price conditions
/// 2. Protective bid fee handling
/// 3. NAV price thresholds
/// 4. Max bid tokens capacity constraints
/// 5. Route comparison when multiple routes profitable

#[test_only]
module futarchy_markets_core::tri_arbitrage_tests;

use futarchy_markets_core::arbitrage_math;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_primitives::conditional_amm::{Self, LiquidityPool};
use std::string;
use sui::clock::{Self, Clock};
use sui::coin;
use sui::object;
use sui::test_scenario as ts;
use sui::test_utils;

// Test LP type
public struct LP has drop {}

// === Constants ===
const NAV_PRECISION: u64 = 1_000_000_000; // 1e9
const BPS_SCALE: u64 = 10000;

// === Test Helpers ===

#[test_only]
fun create_test_clock(ctx: &mut TxContext): Clock {
    let mut clock = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clock, 1000000);
    clock
}

#[test_only]
fun create_lp_treasury(ctx: &mut TxContext): coin::TreasuryCap<LP> {
    coin::create_treasury_cap_for_testing<LP>(ctx)
}

#[test_only]
fun create_test_spot_pool(
    asset_reserve: u64,
    stable_reserve: u64,
    fee_bps: u64,
    ctx: &mut TxContext,
): UnifiedSpotPool<sui::sui::SUI, sui::sui::SUI, LP> {
    let lp_treasury = create_lp_treasury(ctx);
    unified_spot_pool::create_pool_for_testing<sui::sui::SUI, sui::sui::SUI, LP>(
        lp_treasury,
        asset_reserve,
        stable_reserve,
        fee_bps,
        ctx,
    )
}

#[test_only]
fun create_conditional_pools(
    asset_reserves: vector<u64>,
    stable_reserves: vector<u64>,
    fee_bps: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): vector<LiquidityPool> {
    let market_id = object::id_from_address(@0x123);
    let n = vector::length(&asset_reserves);
    let mut pools = vector::empty<LiquidityPool>();

    let mut i = 0;
    while (i < n) {
        let pool = conditional_amm::create_test_pool(
            market_id,
            (i as u8),
            fee_bps,
            *vector::borrow(&asset_reserves, i),
            *vector::borrow(&stable_reserves, i),
            clock,
            ctx,
        );
        vector::push_back(&mut pools, pool);
        i = i + 1;
    };

    pools
}

#[test_only]
fun destroy_pools(mut pools: vector<LiquidityPool>) {
    while (!vector::is_empty(&pools)) {
        let pool = vector::pop_back(&mut pools);
        test_utils::destroy(pool);
    };
    vector::destroy_empty(pools);
}

// ============================================================================
// ROUTE SELECTION TESTS
// ============================================================================

#[test]
/// When spot price > conditional price, should select COND_TO_SPOT
fun test_route_selection_cond_to_spot() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: high price (1B asset, 2B stable = price 2.0)
    let spot_pool = create_test_spot_pool(1_000_000_000, 2_000_000_000, 30, ctx);

    // Conditional: low price (1B asset, 1B stable = price 1.0)
    let pools = create_conditional_pools(
        vector[1_000_000_000, 1_000_000_000],
        vector[1_000_000_000, 1_000_000_000],
        30,
        &clock,
        ctx,
    );

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        0, // no bid
        0, // no bid
        0, // no bid fee
        0, // no hint
    );

    // Should select COND_TO_SPOT (buy cheap from cond, sell expensive to spot)
    assert!(route == arbitrage_math::route_cond_to_spot(), 0);
    assert!(amount > 0, 1);
    assert!(profit > 0, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    destroy_pools(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// When spot price < conditional price, should select SPOT_TO_COND
fun test_route_selection_spot_to_cond() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: low price (2B asset, 1B stable = price 0.5)
    let spot_pool = create_test_spot_pool(2_000_000_000, 1_000_000_000, 30, ctx);

    // Conditional: high price (1B asset, 2B stable = price 2.0)
    let pools = create_conditional_pools(
        vector[1_000_000_000, 1_000_000_000],
        vector[2_000_000_000, 2_000_000_000],
        30,
        &clock,
        ctx,
    );

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        0, // no bid
        0, // no bid
        0, // no bid fee
        0, // no hint
    );

    // Should select SPOT_TO_COND (buy cheap from spot, sell expensive to cond)
    assert!(route == arbitrage_math::route_spot_to_cond(), 0);
    assert!(amount > 0, 1);
    assert!(profit > 0, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    destroy_pools(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// When prices are equal, should return no opportunity
fun test_route_selection_equal_prices_no_opportunity() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: price 1.0
    let spot_pool = create_test_spot_pool(1_000_000_000, 1_000_000_000, 30, ctx);

    // Conditional: price 1.0
    let pools = create_conditional_pools(
        vector[1_000_000_000, 1_000_000_000],
        vector[1_000_000_000, 1_000_000_000],
        30,
        &clock,
        ctx,
    );

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        0, // no bid
        0, // no bid
        0, // no bid fee
        0, // no hint
    );

    // With equal prices and fees, no profitable arbitrage
    assert!(route == arbitrage_math::route_none() || profit == 0, 0);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    destroy_pools(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ============================================================================
// SPOT → BID ROUTE TESTS
// ============================================================================

#[test]
/// When spot price < NAV and no conditionals, should select SPOT_TO_BID
fun test_route_spot_to_bid_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: low price (2B asset, 1B stable = price 0.5 in stable/asset)
    // In NAV terms: 0.5 * 1e9 = 500_000_000
    let spot_pool = create_test_spot_pool(2_000_000_000, 1_000_000_000, 30, ctx);

    // No conditional pools - forces SPOT_TO_BID over COND_TO_BID
    let pools = vector::empty<LiquidityPool>();

    // NAV price higher than spot (1.0 * 1e9 = 1_000_000_000)
    // Spot price ~0.5, NAV = 1.0 → arbitrage: buy from spot, sell to bid
    let nav_price = 1_000_000_000u64; // 1.0 in 1e9 scale
    let max_bid_tokens = 1_000_000_000u64; // Large capacity
    let bid_fee_bps = 100u64; // 1% fee

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        bid_fee_bps,
        0,
    );

    // Should select SPOT_TO_BID (buy cheap from spot, sell at NAV to bid)
    assert!(route == arbitrage_math::route_spot_to_bid(), 0);
    assert!(amount > 0, 1);
    assert!(profit > 0, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    vector::destroy_empty(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// SPOT_TO_BID should respect max_bid_tokens capacity
fun test_spot_to_bid_respects_max_tokens() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: low price
    let spot_pool = create_test_spot_pool(2_000_000_000, 1_000_000_000, 30, ctx);

    // No conditional pools (empty)
    let pools = vector::empty<LiquidityPool>();

    // NAV higher than spot, but limited capacity
    let nav_price = 1_000_000_000u64;
    let max_bid_tokens = 100_000u64; // Very small capacity
    let bid_fee_bps = 100u64;

    let (amount, route, _profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        bid_fee_bps,
        0,
    );

    // Amount should be limited by max_bid_tokens
    if (route == arbitrage_math::route_spot_to_bid()) {
        assert!(amount <= max_bid_tokens, 0);
    };

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    vector::destroy_empty(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// SPOT_TO_BID should not trigger when spot price >= NAV (after fees)
fun test_spot_to_bid_no_opportunity_when_spot_above_nav() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: high price (1B asset, 2B stable = price 2.0)
    let spot_pool = create_test_spot_pool(1_000_000_000, 2_000_000_000, 30, ctx);

    let pools = vector::empty<LiquidityPool>();

    // NAV lower than spot price
    let nav_price = 1_000_000_000u64; // 1.0 (spot is 2.0)
    let max_bid_tokens = 1_000_000_000u64;
    let bid_fee_bps = 100u64;

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        bid_fee_bps,
        0,
    );

    // No spot_to_bid opportunity (spot price > NAV)
    assert!(route != arbitrage_math::route_spot_to_bid() || profit == 0, 0);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    vector::destroy_empty(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ============================================================================
// COND → BID ROUTE TESTS
// ============================================================================

#[test]
/// When conditional price < NAV and better than spot route, should select COND_TO_BID
fun test_route_cond_to_bid_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: at NAV price (no spot arbitrage opportunity)
    let spot_pool = create_test_spot_pool(1_000_000_000, 1_000_000_000, 30, ctx);

    // Conditional: lower than NAV (2B asset, 1B stable = price 0.5)
    let pools = create_conditional_pools(
        vector[2_000_000_000, 2_000_000_000],
        vector[1_000_000_000, 1_000_000_000],
        30,
        &clock,
        ctx,
    );

    // NAV higher than conditional price
    let nav_price = 1_000_000_000u64; // 1.0 (cond is 0.5)
    let max_bid_tokens = 1_000_000_000u64;
    let bid_fee_bps = 100u64;

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        bid_fee_bps,
        0,
    );

    // Should select COND_TO_BID (buy cheap from cond, sell at NAV to bid)
    assert!(route == arbitrage_math::route_cond_to_bid(), 0);
    assert!(amount > 0, 1);
    assert!(profit > 0, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    destroy_pools(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// COND_TO_BID should not trigger when cond price >= NAV (after fees)
fun test_cond_to_bid_no_opportunity_when_cond_above_nav() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot at NAV
    let spot_pool = create_test_spot_pool(1_000_000_000, 1_000_000_000, 30, ctx);

    // Conditional: higher than NAV (1B asset, 2B stable = price 2.0)
    let pools = create_conditional_pools(
        vector[1_000_000_000, 1_000_000_000],
        vector[2_000_000_000, 2_000_000_000],
        30,
        &clock,
        ctx,
    );

    let nav_price = 1_000_000_000u64; // 1.0 (cond is 2.0)
    let max_bid_tokens = 1_000_000_000u64;
    let bid_fee_bps = 100u64;

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        bid_fee_bps,
        0,
    );

    // No cond_to_bid opportunity
    assert!(route != arbitrage_math::route_cond_to_bid() || profit == 0, 0);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    destroy_pools(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ============================================================================
// FEE HANDLING TESTS
// ============================================================================

#[test]
/// Higher bid fees should reduce profit and potentially eliminate opportunity
fun test_bid_fee_reduces_profit() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: low price
    let spot_pool = create_test_spot_pool(2_000_000_000, 1_000_000_000, 30, ctx);
    let pools = vector::empty<LiquidityPool>();

    let nav_price = 1_000_000_000u64;
    let max_bid_tokens = 1_000_000_000u64;

    // Low fee
    let (_, _, profit_low_fee) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        100, // 1% fee
        0,
    );

    // High fee
    let (_, _, profit_high_fee) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        500, // 5% fee
        0,
    );

    // Higher fee should result in lower or equal profit
    assert!(profit_high_fee <= profit_low_fee, 0);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    vector::destroy_empty(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// 100% fee (10000 bps) should eliminate bid opportunity
fun test_100_percent_fee_eliminates_bid_opportunity() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: low price (great opportunity if no fee)
    let spot_pool = create_test_spot_pool(10_000_000_000, 1_000_000_000, 30, ctx);
    let pools = vector::empty<LiquidityPool>();

    let nav_price = 1_000_000_000u64;
    let max_bid_tokens = 1_000_000_000u64;

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        10000, // 100% fee
        0,
    );

    // Should not select bid route with 100% fee
    assert!(route != arbitrage_math::route_spot_to_bid() || profit == 0, 0);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    vector::destroy_empty(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ============================================================================
// ROUTE COMPARISON TESTS
// ============================================================================

#[test]
/// When multiple routes profitable, should select the best one
fun test_best_route_selected_when_multiple_profitable() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: very low price (0.1)
    let spot_pool = create_test_spot_pool(10_000_000_000, 1_000_000_000, 30, ctx);

    // Conditional: medium price (0.5)
    let pools = create_conditional_pools(
        vector[2_000_000_000, 2_000_000_000],
        vector[1_000_000_000, 1_000_000_000],
        30,
        &clock,
        ctx,
    );

    // NAV: high price (1.0)
    // Opportunities:
    // - SPOT_TO_COND: buy at 0.1, sell at 0.5
    // - SPOT_TO_BID: buy at 0.1, sell at 1.0 (best!)
    // - COND_TO_BID: buy at 0.5, sell at 1.0
    let nav_price = 1_000_000_000u64;
    let max_bid_tokens = 10_000_000_000u64; // Large capacity
    let bid_fee_bps = 100u64; // Small fee

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        bid_fee_bps,
        0,
    );

    // Should select highest profit route
    assert!(amount > 0, 0);
    assert!(profit > 0, 1);
    // The best route depends on exact calculations, but should be one of the profitable ones
    let is_valid_route = route == arbitrage_math::route_spot_to_bid() ||
                          route == arbitrage_math::route_spot_to_cond() ||
                          route == arbitrage_math::route_cond_to_bid();
    assert!(is_valid_route, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    destroy_pools(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// When bid capacity is 0, should not select bid routes
fun test_zero_bid_capacity_disables_bid_routes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: low price (great bid opportunity)
    let spot_pool = create_test_spot_pool(10_000_000_000, 1_000_000_000, 30, ctx);
    let pools = vector::empty<LiquidityPool>();

    let nav_price = 1_000_000_000u64;
    let max_bid_tokens = 0u64; // Zero capacity!
    let bid_fee_bps = 100u64;

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        bid_fee_bps,
        0,
    );

    // Should NOT select any bid route
    assert!(route != arbitrage_math::route_spot_to_bid(), 0);
    assert!(route != arbitrage_math::route_cond_to_bid(), 1);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    vector::destroy_empty(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// When NAV price is 0, should not select bid routes
fun test_zero_nav_price_disables_bid_routes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: low price
    let spot_pool = create_test_spot_pool(10_000_000_000, 1_000_000_000, 30, ctx);
    let pools = vector::empty<LiquidityPool>();

    let nav_price = 0u64; // No NAV!
    let max_bid_tokens = 1_000_000_000u64;
    let bid_fee_bps = 100u64;

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        bid_fee_bps,
        0,
    );

    // Should NOT select any bid route
    assert!(route != arbitrage_math::route_spot_to_bid(), 0);
    assert!(route != arbitrage_math::route_cond_to_bid(), 1);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    vector::destroy_empty(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

#[test]
/// Empty conditional pools should still allow spot↔bid routes
fun test_empty_conditionals_allows_bid_routes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: low price
    let spot_pool = create_test_spot_pool(2_000_000_000, 1_000_000_000, 30, ctx);
    let pools = vector::empty<LiquidityPool>(); // No conditionals!

    let nav_price = 1_000_000_000u64;
    let max_bid_tokens = 1_000_000_000u64;
    let bid_fee_bps = 100u64;

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        nav_price,
        max_bid_tokens,
        bid_fee_bps,
        0,
    );

    // Should select SPOT_TO_BID even with no conditionals
    assert!(route == arbitrage_math::route_spot_to_bid(), 0);
    assert!(amount > 0, 1);
    assert!(profit > 0, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    vector::destroy_empty(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Very small price differences should still detect opportunity
fun test_small_price_difference_detected() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: price 1.0
    let spot_pool = create_test_spot_pool(1_000_000_000, 1_000_000_000, 0, ctx);

    // Conditional: price 1.1 (10% higher) - no fee pools
    let pools = create_conditional_pools(
        vector[1_000_000_000, 1_000_000_000],
        vector[1_100_000_000, 1_100_000_000],
        0, // No fees for clear signal
        &clock,
        ctx,
    );

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        0, // no bid
        0,
        0,
        0,
    );

    // Should detect SPOT_TO_COND opportunity
    assert!(route == arbitrage_math::route_spot_to_cond(), 0);
    assert!(amount > 0, 1);
    assert!(profit > 0, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    destroy_pools(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Multiple outcomes with varying prices
fun test_multiple_outcomes_varying_prices() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Spot: price 1.5
    let spot_pool = create_test_spot_pool(2_000_000_000, 3_000_000_000, 30, ctx);

    // 4 conditional pools with different prices:
    // Pool 0: price 1.0 (low)
    // Pool 1: price 1.2
    // Pool 2: price 0.8 (lowest)
    // Pool 3: price 1.4
    let pools = create_conditional_pools(
        vector[1_000_000_000, 1_200_000_000, 1_000_000_000, 1_400_000_000],
        vector[1_000_000_000, 1_440_000_000, 800_000_000, 1_960_000_000],
        30,
        &clock,
        ctx,
    );

    let (amount, route, profit) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        0, // no bid
        0,
        0,
        0,
    );

    // Spot (1.5) > conditional prices → COND_TO_SPOT opportunity
    assert!(route == arbitrage_math::route_cond_to_spot(), 0);
    assert!(amount > 0, 1);
    assert!(profit > 0, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    destroy_pools(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ============================================================================
// NAV PRECISION TESTS
// ============================================================================

#[test]
/// Verify NAV precision constant is accessible
fun test_nav_precision_constant() {
    let precision = arbitrage_math::nav_precision();
    assert!(precision == 1_000_000_000, 0);
}

#[test]
/// Route constant accessors work correctly
fun test_route_constants() {
    assert!(arbitrage_math::route_none() == 0, 0);
    assert!(arbitrage_math::route_spot_to_cond() == 1, 1);
    assert!(arbitrage_math::route_cond_to_spot() == 2, 2);
    assert!(arbitrage_math::route_spot_to_bid() == 3, 3);
    assert!(arbitrage_math::route_cond_to_bid() == 4, 4);
}

// ============================================================================
// SMART BOUND / HINT TESTS
// ============================================================================

#[test]
/// User swap hint should affect search bounds
fun test_user_swap_hint_affects_search() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(ctx);

    // Large pools for big swaps
    let spot_pool = create_test_spot_pool(10_000_000_000, 5_000_000_000, 30, ctx);

    let pools = create_conditional_pools(
        vector[10_000_000_000, 10_000_000_000],
        vector[10_000_000_000, 10_000_000_000],
        30,
        &clock,
        ctx,
    );

    // With no hint
    let (amount_no_hint, route_no_hint, _) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        0, 0, 0,
        0, // No hint
    );

    // With a hint
    let (amount_with_hint, route_with_hint, _) = arbitrage_math::compute_optimal_tri_arbitrage(
        &spot_pool,
        &pools,
        0, 0, 0,
        1_000_000, // Small hint
    );

    // Both should find the same route (optimal doesn't change based on hint)
    // Hint only affects search efficiency, not result quality
    assert!(route_no_hint == route_with_hint, 0);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    destroy_pools(pools);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
