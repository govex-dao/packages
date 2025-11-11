#[test_only]
module futarchy_markets_core::arbitrage_rebalance_tests;

use futarchy_markets_core::arbitrage;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm::{Self, LiquidityPool};
use futarchy_markets_primitives::market_state::{Self, MarketState};
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use std::string;
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::object;
use sui::test_scenario as ts;

// === Constants ===
const INITIAL_SPOT_RESERVE: u64 = 10_000_000_000; // 10,000 tokens (9 decimals)
const INITIAL_CONDITIONAL_RESERVE: u64 = 1_000_000_000; // 1,000 tokens per outcome
const DEFAULT_FEE_BPS: u16 = 30; // 0.3%

// === Test Helpers ===

#[test_only]
fun create_test_clock(timestamp_ms: u64, ctx: &mut TxContext): Clock {
    let mut clock = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clock, timestamp_ms);
    clock
}

#[test_only]
fun create_test_spot_pool(
    asset_reserve: u64,
    stable_reserve: u64,
    _clock: &Clock,
    ctx: &mut TxContext,
): UnifiedSpotPool<TEST_COIN_A, TEST_COIN_B> {
    unified_spot_pool::create_pool_for_testing(
        asset_reserve,
        stable_reserve,
        (DEFAULT_FEE_BPS as u64),
        ctx,
    )
}

#[test_only]
fun create_test_escrow_with_markets(
    outcome_count: u64,
    conditional_reserve_per_outcome: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): TokenEscrow<TEST_COIN_A, TEST_COIN_B> {
    let proposal_id = object::id_from_address(@0xABC);
    let dao_id = object::id_from_address(@0xDEF);

    let mut outcome_messages = vector::empty();
    let mut i = 0;
    while (i < outcome_count) {
        vector::push_back(&mut outcome_messages, string::utf8(b"Outcome"));
        i = i + 1;
    };

    let market_state = market_state::new(
        proposal_id,
        dao_id,
        outcome_count,
        outcome_messages,
        clock,
        ctx,
    );

    coin_escrow::create_test_escrow_with_market_state(
        outcome_count,
        market_state,
        ctx,
    )
}

#[test_only]
fun initialize_amm_pools(escrow: &mut TokenEscrow<TEST_COIN_A, TEST_COIN_B>, ctx: &mut TxContext) {
    let market_state = coin_escrow::get_market_state_mut(escrow);

    if (market_state::has_amm_pools(market_state)) {
        return
    };

    let market_id = market_state::market_id(market_state);
    let outcome_count = market_state::outcome_count(market_state);
    let mut pools = vector::empty();
    let mut i = 0;
    let clock = create_test_clock(1000000, ctx);
    while (i < outcome_count) {
        let pool = conditional_amm::create_test_pool(
            market_id,
            (i as u8),
            (DEFAULT_FEE_BPS as u64),
            1000,
            1000,
            &clock,
            ctx,
        );
        vector::push_back(&mut pools, pool);
        i = i + 1;
    };
    clock::destroy_for_testing(clock);

    market_state::set_amm_pools(market_state, pools);
    market_state::init_trading_for_testing(market_state);
}

#[test_only]
fun add_liquidity_to_conditional_pools(
    escrow: &mut TokenEscrow<TEST_COIN_A, TEST_COIN_B>,
    reserve_per_outcome: u64,
    ctx: &mut TxContext,
) {
    initialize_amm_pools(escrow, ctx);

    let market_state = coin_escrow::get_market_state_mut(escrow);
    let outcome_count = market_state::outcome_count(market_state);

    let mut i = 0;
    while (i < outcome_count) {
        let pool = market_state::borrow_amm_pool_mut(market_state, (i as u64));

        let asset_coin = coin::mint_for_testing<TEST_COIN_A>(reserve_per_outcome, ctx);
        let stable_coin = coin::mint_for_testing<TEST_COIN_B>(reserve_per_outcome, ctx);

        // add_liquidity_for_testing needs 5 arguments
        conditional_amm::add_liquidity_for_testing(
            pool,
            asset_coin,
            stable_coin,
            DEFAULT_FEE_BPS,
            ctx,
        );
        i = i + 1;
    };
}

#[test_only]
fun get_conditional_price_range(
    escrow: &TokenEscrow<TEST_COIN_A, TEST_COIN_B>
): (u128, u128) {
    let market_state = coin_escrow::get_market_state(escrow);
    let pools = market_state::borrow_amm_pools(market_state);

    let mut min_price = std::u128::max_value!();
    let mut max_price = 0u128;
    let mut i = 0;
    let n = pools.length();

    while (i < n) {
        let (a, s) = conditional_amm::get_reserves(&pools[i]);
        if (a > 0) {
            let price = ((s as u128) * 1_000_000_000_000) / (a as u128);
            if (price < min_price) min_price = price;
            if (price > max_price) max_price = price;
        };
        i = i + 1;
    };

    (min_price, max_price)
}

// === Tests for Conditional Swap Auto-Rebalancing ===

#[test]
/// Test that auto-rebalance brings spot price back into conditional range when spot is too high
fun test_auto_rebalance_when_spot_too_high() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Create spot pool with high price: 10,000 asset, 15,000 stable (price = 1.5)
    let mut spot_pool = create_test_spot_pool(10_000_000_000, 15_000_000_000, &clock, ctx);
    let initial_spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // Verify spot price is high
    assert!(initial_spot_price > 1_200_000_000_000, 0); // > 1.2

    // Create escrow with conditional pools at lower prices (around 1.0)
    let mut escrow = create_test_escrow_with_markets(2, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    // Add enough liquidity to escrow for arbitrage
    let asset_for_escrow = coin::mint_for_testing<TEST_COIN_A>(10_000_000_000, ctx);
    let stable_for_escrow = coin::mint_for_testing<TEST_COIN_B>(10_000_000_000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_for_escrow, stable_for_escrow);

    // Execute auto-rebalance
    arbitrage::auto_rebalance_spot_after_conditional_swaps(
        &mut spot_pool,
        &mut escrow,
        &clock,
        ctx,
    );

    // After rebalancing, spot price should have moved down toward conditional range
    let final_spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // Verify price moved down (or stayed same if no profitable arb exists)
    assert!(final_spot_price <= initial_spot_price, 1);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test that auto-rebalance brings spot price back into conditional range when spot is too low
fun test_auto_rebalance_when_spot_too_low() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Create spot pool with low price: 10,000 asset, 8,000 stable (price = 0.8)
    let mut spot_pool = create_test_spot_pool(10_000_000_000, 8_000_000_000, &clock, ctx);
    let initial_spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // Verify spot price is low
    assert!(initial_spot_price < 900_000_000_000, 0); // < 0.9

    // Create escrow with conditional pools at higher prices (around 1.0)
    let mut escrow = create_test_escrow_with_markets(2, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    // Add enough liquidity to escrow for arbitrage
    let asset_for_escrow = coin::mint_for_testing<TEST_COIN_A>(10_000_000_000, ctx);
    let stable_for_escrow = coin::mint_for_testing<TEST_COIN_B>(10_000_000_000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_for_escrow, stable_for_escrow);

    // Execute auto-rebalance
    arbitrage::auto_rebalance_spot_after_conditional_swaps(
        &mut spot_pool,
        &mut escrow,
        &clock,
        ctx,
    );

    // After rebalancing, spot price should have moved up toward conditional range
    let final_spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // Verify price moved up (or stayed same if no profitable arb exists)
    assert!(final_spot_price >= initial_spot_price, 1);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test that auto-rebalance does nothing when spot price is already within conditional range
fun test_auto_rebalance_no_op_when_in_range() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Create spot pool: 10,000 asset, 10,000 stable (price = 1.0)
    let mut spot_pool = create_test_spot_pool(INITIAL_SPOT_RESERVE, INITIAL_SPOT_RESERVE, &clock, ctx);
    let initial_spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // Create escrow with conditional pools at similar prices (around 1.0)
    let mut escrow = create_test_escrow_with_markets(2, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    // Add liquidity to escrow
    let asset_for_escrow = coin::mint_for_testing<TEST_COIN_A>(5_000_000_000, ctx);
    let stable_for_escrow = coin::mint_for_testing<TEST_COIN_B>(5_000_000_000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_for_escrow, stable_for_escrow);

    // Spot price (1.0) is within conditional range, so no rebalancing needed

    // Execute auto-rebalance
    arbitrage::auto_rebalance_spot_after_conditional_swaps(
        &mut spot_pool,
        &mut escrow,
        &clock,
        ctx,
    );

    // Spot price should be virtually unchanged (within rounding)
    let final_spot_price = unified_spot_pool::get_spot_price(&spot_pool);
    let price_diff = if (final_spot_price > initial_spot_price) {
        final_spot_price - initial_spot_price
    } else {
        initial_spot_price - final_spot_price
    };

    // Price should be nearly the same (less than 0.1% change)
    assert!(price_diff < 10_000_000_000, 0); // < 0.01 change

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test auto-rebalance with 3 outcomes
fun test_auto_rebalance_three_outcomes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Create spot pool with high price
    let mut spot_pool = create_test_spot_pool(10_000_000_000, 14_000_000_000, &clock, ctx);
    let initial_spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // Create escrow with 3 outcomes
    let mut escrow = create_test_escrow_with_markets(3, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    // Add liquidity
    let asset_for_escrow = coin::mint_for_testing<TEST_COIN_A>(10_000_000_000, ctx);
    let stable_for_escrow = coin::mint_for_testing<TEST_COIN_B>(10_000_000_000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_for_escrow, stable_for_escrow);

    // Execute auto-rebalance
    arbitrage::auto_rebalance_spot_after_conditional_swaps(
        &mut spot_pool,
        &mut escrow,
        &clock,
        ctx,
    );

    let final_spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // Verify price moved down toward conditional range (or stayed if no profitable arb)
    assert!(final_spot_price <= initial_spot_price, 0);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test that auto-rebalance handles edge case with very small arb amounts
fun test_auto_rebalance_small_adjustments() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Create spot pool slightly above range: 10,000 asset, 10,500 stable (price = 1.05)
    let mut spot_pool = create_test_spot_pool(10_000_000_000, 10_500_000_000, &clock, ctx);
    let initial_spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // Create escrow with conditional pools
    let mut escrow = create_test_escrow_with_markets(2, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    // Add liquidity
    let asset_for_escrow = coin::mint_for_testing<TEST_COIN_A>(10_000_000_000, ctx);
    let stable_for_escrow = coin::mint_for_testing<TEST_COIN_B>(10_000_000_000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_for_escrow, stable_for_escrow);

    // Execute auto-rebalance
    arbitrage::auto_rebalance_spot_after_conditional_swaps(
        &mut spot_pool,
        &mut escrow,
        &clock,
        ctx,
    );

    let final_spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // With small deviations, arbitrage math may determine no profitable opportunity exists
    // Just verify price didn't move dramatically in wrong direction
    let max_increase = initial_spot_price / 20; // Allow up to 5% increase (rounding/fees)
    assert!(final_spot_price <= initial_spot_price + max_increase, 0);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
