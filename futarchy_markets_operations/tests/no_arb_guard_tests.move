#[test_only]
module futarchy_markets_operations::no_arb_guard_tests;

use account_protocol::intents::ActionSpec;
use futarchy_markets_core::proposal::{Self, Proposal};
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_operations::no_arb_guard;
use futarchy_markets_operations::swap_entry;
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm::{Self, LiquidityPool};
use futarchy_markets_primitives::conditional_balance;
use futarchy_markets_primitives::market_state;
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use futarchy_types::signed;
use std::option;
use std::string;
use std::vector;
use sui::clock::{Self, Clock};
use sui::coin;
use sui::object;
use sui::test_scenario as ts;

// Test LP type
public struct LP has drop {}

// === Constants ===
const INITIAL_SPOT_RESERVE: u64 = 10_000_000_000; // 10,000 tokens (9 decimals)
const INITIAL_CONDITIONAL_RESERVE: u64 = 1_000_000_000; // 1,000 tokens per outcome
const DEFAULT_FEE_BPS: u16 = 30; // 0.3%
const PRICE_SCALE: u128 = 1_000_000_000_000; // 1e12

// === Test Helpers ===

/// Create a test clock
#[test_only]
fun create_test_clock(timestamp_ms: u64, ctx: &mut TxContext): Clock {
    let mut clock = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clock, timestamp_ms);
    clock
}

#[test_only]
fun create_lp_treasury(ctx: &mut TxContext): coin::TreasuryCap<LP> {
    coin::create_treasury_cap_for_testing<LP>(ctx)
}

/// Create spot pool with initial liquidity
#[test_only]
fun create_test_spot_pool(
    asset_reserve: u64,
    stable_reserve: u64,
    fee_bps: u64,
    _clock: &Clock,
    ctx: &mut TxContext,
): UnifiedSpotPool<TEST_COIN_A, TEST_COIN_B, LP> {
    let lp_treasury = create_lp_treasury(ctx);
    unified_spot_pool::create_pool_for_testing(
        lp_treasury,
        asset_reserve,
        stable_reserve,
        fee_bps,
        ctx,
    )
}

/// Create token escrow with market state
#[test_only]
fun create_test_escrow_with_markets(
    outcome_count: u64,
    _conditional_reserve_per_outcome: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): TokenEscrow<TEST_COIN_A, TEST_COIN_B> {
    let proposal_id = object::id_from_address(@0xABC);
    let dao_id = object::id_from_address(@0xDEF);

    // Create market state with pools
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

    // Create escrow with market state
    coin_escrow::create_test_escrow_with_market_state(
        outcome_count,
        market_state,
        ctx,
    )
}

/// Initialize AMM pools in market state
#[test_only]
fun initialize_amm_pools(escrow: &mut TokenEscrow<TEST_COIN_A, TEST_COIN_B>, ctx: &mut TxContext) {
    let market_state = coin_escrow::get_market_state_mut(escrow);

    // Check if pools already initialized
    if (market_state::has_amm_pools(market_state)) {
        return
    };

    // Get the market_id to ensure pools match
    let market_id = market_state::market_id(market_state);

    let outcome_count = market_state::outcome_count(market_state);
    let mut pools = vector::empty();
    let mut i = 0;
    let clock = create_test_clock(1000000, ctx);
    while (i < outcome_count) {
        // Create pool with correct market_id
        let pool = conditional_amm::create_test_pool(
            market_id,
            (i as u8), // outcome_idx
            (DEFAULT_FEE_BPS as u64), // fee_percent
            1000, // minimal asset_reserve
            1000, // minimal stable_reserve
            &clock,
            ctx,
        );
        vector::push_back(&mut pools, pool);
        i = i + 1;
    };
    clock::destroy_for_testing(clock);

    market_state::set_amm_pools(market_state, pools);

    // Initialize trading for tests
    market_state::init_trading_for_testing(market_state);
}

/// Add initial liquidity to all conditional pools in escrow
#[test_only]
fun add_liquidity_to_conditional_pools(
    escrow: &mut TokenEscrow<TEST_COIN_A, TEST_COIN_B>,
    reserve_per_outcome: u64,
    ctx: &mut TxContext,
) {
    // Initialize pools first if not already done
    initialize_amm_pools(escrow, ctx);

    let market_state = coin_escrow::get_market_state_mut(escrow);
    let outcome_count = market_state::outcome_count(market_state);

    let mut i = 0;
    while (i < outcome_count) {
        let pool = market_state::borrow_amm_pool_mut(market_state, (i as u64));

        // Mint test coins for liquidity
        let asset_coin = coin::mint_for_testing<TEST_COIN_A>(reserve_per_outcome, ctx);
        let stable_coin = coin::mint_for_testing<TEST_COIN_B>(reserve_per_outcome, ctx);

        // Add liquidity
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

/// Add imbalanced liquidity to create price differences
#[test_only]
fun add_imbalanced_liquidity_to_conditional_pools(
    escrow: &mut TokenEscrow<TEST_COIN_A, TEST_COIN_B>,
    asset_reserves: vector<u64>,
    stable_reserves: vector<u64>,
    ctx: &mut TxContext,
) {
    // Initialize pools first if not already done
    initialize_amm_pools(escrow, ctx);

    let market_state = coin_escrow::get_market_state_mut(escrow);
    let outcome_count = market_state::outcome_count(market_state);

    assert!(vector::length(&asset_reserves) == outcome_count, 0);
    assert!(vector::length(&stable_reserves) == outcome_count, 0);

    let mut i = 0;
    while (i < outcome_count) {
        let pool = market_state::borrow_amm_pool_mut(market_state, (i as u64));

        // Mint test coins for liquidity
        let asset_amt = *vector::borrow(&asset_reserves, i);
        let stable_amt = *vector::borrow(&stable_reserves, i);
        let asset_coin = coin::mint_for_testing<TEST_COIN_A>(asset_amt, ctx);
        let stable_coin = coin::mint_for_testing<TEST_COIN_B>(stable_amt, ctx);

        // Add liquidity
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

// === Stage 1: Basic compute_noarb_band Tests ===

#[test]
fun test_compute_noarb_band_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Create spot pool with balanced liquidity
    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Create escrow with 2 outcomes, balanced pools
    let mut escrow = create_test_escrow_with_markets(2, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    // Get conditional pools from escrow
    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    // Compute no-arb band
    let (floor, ceiling) = no_arb_guard::compute_noarb_band(&spot_pool, conditionals);

    // Verify floor and ceiling are positive and floor < ceiling
    assert!(floor > 0, 0);
    assert!(ceiling > 0, 1);
    assert!(floor < ceiling, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_compute_noarb_band_with_single_pool() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Create escrow with 1 outcome
    let mut escrow = create_test_escrow_with_markets(1, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    let (floor, ceiling) = no_arb_guard::compute_noarb_band(&spot_pool, conditionals);

    // Should still work with single pool
    assert!(floor > 0, 0);
    assert!(ceiling > 0, 1);
    assert!(floor < ceiling, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_compute_noarb_band_with_multiple_outcomes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Create escrow with 5 outcomes
    let mut escrow = create_test_escrow_with_markets(5, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    let (floor, ceiling) = no_arb_guard::compute_noarb_band(&spot_pool, conditionals);

    // Should work with multiple outcomes
    assert!(floor > 0, 0);
    assert!(ceiling > 0, 1);
    assert!(floor < ceiling, 2);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_compute_noarb_band_with_imbalanced_pools() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Create escrow with 2 outcomes, imbalanced pools
    let mut escrow = create_test_escrow_with_markets(2, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);

    // Pool 0: Low price (more stable, less asset)
    // Pool 1: High price (less stable, more asset)
    let asset_reserves = vector[2_000_000_000, 500_000_000];
    let stable_reserves = vector[500_000_000, 2_000_000_000];
    add_imbalanced_liquidity_to_conditional_pools(
        &mut escrow,
        asset_reserves,
        stable_reserves,
        ctx,
    );

    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    let (floor, ceiling) = no_arb_guard::compute_noarb_band(&spot_pool, conditionals);

    // With imbalanced pools, band should be wider
    assert!(floor > 0, 0);
    assert!(ceiling > 0, 1);
    assert!(floor < ceiling, 2);

    // Ceiling should be significantly higher than floor with price dispersion
    let band_width = ceiling - floor;
    assert!(band_width > floor / 2, 3); // Band width > 50% of floor

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = 1)] // ENoPoolsProvided
fun test_compute_noarb_band_empty_pools_fails() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Create empty vector of pools
    let empty_pools = vector::empty<LiquidityPool>();

    // Should fail with ENoPoolsProvided
    let (_floor, _ceiling) = no_arb_guard::compute_noarb_band(&spot_pool, &empty_pools);

    // Cleanup (won't reach here due to expected failure, but need to keep empty_pools valid)
    empty_pools.destroy_empty();
    unified_spot_pool::destroy_for_testing(spot_pool);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// === Stage 2: ensure_spot_in_band Tests ===

#[test]
fun test_ensure_spot_in_band_balanced_pools() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    let mut escrow = create_test_escrow_with_markets(2, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    // Should not panic - balanced pools should be within band
    no_arb_guard::ensure_spot_in_band(&spot_pool, conditionals);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_ensure_spot_in_band_with_fees() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        100, // 1% fee
        &clock,
        ctx,
    );

    let mut escrow = create_test_escrow_with_markets(2, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    // Should still be within band with higher fees
    no_arb_guard::ensure_spot_in_band(&spot_pool, conditionals);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_ensure_spot_in_band_single_outcome() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    let mut escrow = create_test_escrow_with_markets(1, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    no_arb_guard::ensure_spot_in_band(&spot_pool, conditionals);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_ensure_spot_in_band_multiple_outcomes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    let mut escrow = create_test_escrow_with_markets(5, INITIAL_CONDITIONAL_RESERVE, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, INITIAL_CONDITIONAL_RESERVE, ctx);

    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    no_arb_guard::ensure_spot_in_band(&spot_pool, conditionals);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = 1)] // ENoPoolsProvided
fun test_ensure_spot_in_band_empty_pools_fails() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_pool = create_test_spot_pool(
        INITIAL_SPOT_RESERVE,
        INITIAL_SPOT_RESERVE,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    let empty_pools = vector::empty<LiquidityPool>();

    no_arb_guard::ensure_spot_in_band(&spot_pool, &empty_pools);

    // Cleanup (won't reach here due to expected failure, but need to keep empty_pools valid)
    empty_pools.destroy_empty();
    unified_spot_pool::destroy_for_testing(spot_pool);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_reproduce_e2e_scenario_same_price_pools() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Reproduce exact E2E scenario:
    // Spot: 200B asset, 200M stable (price = 0.001)
    let spot_asset = 200_000_000_000u64;
    let spot_stable = 200_000_000u64;

    let spot_pool = create_test_spot_pool(
        spot_asset,
        spot_stable,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Create 2 conditional pools with SAME price as spot
    // Spot: 200B asset / 200M stable = 1000:1 ratio = price 0.001
    // Conditionals should match: use 1% of spot liquidity per pool
    let mut escrow = create_test_escrow_with_markets(2, 1000, &clock, ctx);

    let conditional_ratio = 1; // 1% minimum
    let outcome_count = 2u64;
    let cond_asset = (spot_asset * conditional_ratio) / (100 * outcome_count); // 1B each
    let cond_stable = (spot_stable * conditional_ratio) / (100 * outcome_count); // 1M each

    // Manually create pools with matching price ratio
    let mut pools = vector::empty<LiquidityPool>();
    let market_id = object::id_from_address(@0x123);
    let mut i = 0;
    while (i < 2) {
        let pool = conditional_amm::create_test_pool(
            market_id,
            (i as u8),
            (DEFAULT_FEE_BPS as u64),
            cond_asset,
            cond_stable,
            &clock,
            ctx,
        );
        pools.push_back(pool);
        i = i + 1;
    };

    let market_state = coin_escrow::get_market_state_mut(&mut escrow);
    market_state::set_amm_pools(market_state, pools);

    let market_state2 = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state2);

    // Check the band - this should tell us if the no-arb guard logic is correct
    no_arb_guard::ensure_spot_in_band(&spot_pool, conditionals);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_debug_noarb_band_values() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Spot: 200B asset, 200M stable (price = 0.001)
    let spot_asset = 200_000_000_000u64;
    let spot_stable = 200_000_000u64;

    let spot_pool = create_test_spot_pool(
        spot_asset,
        spot_stable,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Create 2 conditional pools with SAME price as spot
    let mut escrow = create_test_escrow_with_markets(2, spot_asset, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, spot_asset, ctx);

    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    // Get the band values
    let (floor, ceiling) = no_arb_guard::compute_noarb_band(&spot_pool, conditionals);
    let spot_price = unified_spot_pool::get_spot_price(&spot_pool);

    // Print them
    std::debug::print(&b"Spot price:");
    std::debug::print(&spot_price);
    std::debug::print(&b"Floor:");
    std::debug::print(&floor);
    std::debug::print(&b"Ceiling:");
    std::debug::print(&ceiling);
    std::debug::print(&b"In band?");
    std::debug::print(&(spot_price >= floor && spot_price <= ceiling));

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_debug_pool_reserves() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_asset = 200_000_000_000u64;
    let spot_stable = 200_000_000u64;

    let spot_pool = create_test_spot_pool(
        spot_asset,
        spot_stable,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    let mut escrow = create_test_escrow_with_markets(2, spot_asset, &clock, ctx);
    add_liquidity_to_conditional_pools(&mut escrow, spot_asset, ctx);

    let market_state = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state);

    // Print spot reserves
    let (s_asset, s_stable) = unified_spot_pool::get_reserves(&spot_pool);
    std::debug::print(&b"Spot asset:");
    std::debug::print(&s_asset);
    std::debug::print(&b"Spot stable:");
    std::debug::print(&s_stable);

    // Print conditional reserves
    let (c0_asset, c0_stable) = conditional_amm::get_reserves(&conditionals[0]);
    std::debug::print(&b"Cond0 asset:");
    std::debug::print(&c0_asset);
    std::debug::print(&b"Cond0 stable:");
    std::debug::print(&c0_stable);

    let (c1_asset, c1_stable) = conditional_amm::get_reserves(&conditionals[1]);
    std::debug::print(&b"Cond1 asset:");
    std::debug::print(&c1_asset);
    std::debug::print(&b"Cond1 stable:");
    std::debug::print(&c1_stable);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_correct_bootstrap_ratio() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    let spot_asset = 200_000_000_000u64;
    let spot_stable = 200_000_000u64;

    let mut spot_pool = create_test_spot_pool(
        spot_asset,
        spot_stable,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Use 1% minimum ratio (system enforces 1-99% range)
    // Bootstrap calculation produces tiny pools that violate no-arb band even with small swaps
    // So use 1% of spot liquidity split across outcomes
    let conditional_ratio = 1; // 1% minimum
    let outcome_count = 2u64;
    let cond_asset = (spot_asset * conditional_ratio) / (100 * outcome_count); // 1B each
    let cond_stable = (spot_stable * conditional_ratio) / (100 * outcome_count); // 1M each

    std::debug::print(&b"1% minimum calculation:");
    std::debug::print(&b"Cond asset:");
    std::debug::print(&cond_asset);
    std::debug::print(&b"Cond stable:");
    std::debug::print(&cond_stable);

    // Create conditional pools with CORRECT ratio - matching spot exactly
    // DON'T call initialize_amm_pools as it creates 1:1 ratio pools!
    let mut escrow = create_test_escrow_with_markets(2, 1000, &clock, ctx);

    // Manually create pools with the production bootstrap amounts
    let mut pools = vector::empty<LiquidityPool>();
    let market_id = object::id_from_address(@0x123);
    let mut i = 0;
    while (i < 2) {
        let pool = conditional_amm::create_test_pool(
            market_id,
            (i as u8),
            (DEFAULT_FEE_BPS as u64),
            cond_asset,
            cond_stable,
            &clock,
            ctx,
        );
        pools.push_back(pool);
        i = i + 1;
    };

    // Store the pools in the escrow
    let market_state = coin_escrow::get_market_state_mut(&mut escrow);
    market_state::set_amm_pools(market_state, pools);

    let market_state2 = coin_escrow::get_market_state(&escrow);
    let conditionals = market_state::borrow_amm_pools(market_state2);

    // Check initial reserves
    let (c0_asset, c0_stable) = conditional_amm::get_reserves(&conditionals[0]);
    std::debug::print(&b"BEFORE SWAP - cond0 asset:");
    std::debug::print(&c0_asset);
    std::debug::print(&b"BEFORE SWAP - cond0 stable:");
    std::debug::print(&c0_stable);

    // Check no-arb BEFORE swap
    std::debug::print(&b"\n=== BEFORE SWAP ===");
    let (s_asset, s_stable) = unified_spot_pool::get_reserves(&spot_pool);
    let spot_price = ((s_stable as u128) * 1_000_000_000_000u128) / (s_asset as u128);
    std::debug::print(&b"Spot price:");
    std::debug::print(&spot_price);
    let (floor, ceiling) = no_arb_guard::compute_noarb_band(&spot_pool, conditionals);
    std::debug::print(&b"Floor:");
    std::debug::print(&floor);
    std::debug::print(&b"In band?:");
    std::debug::print(&(spot_price >= floor && spot_price <= ceiling));

    // Test passes: Verify conditional pools have correct ratio matching spot
    // and that initial state respects no-arb band
    no_arb_guard::ensure_spot_in_band(&spot_pool, conditionals);

    // Verify the ratio matches: conditional price should equal spot price
    let (cond_price_stable_per_asset) =
        ((c0_stable as u128) * 1_000_000_000_000u128) / (c0_asset as u128);
    std::debug::print(&b"\nConditional pool price (should match spot):");
    std::debug::print(&cond_price_stable_per_asset);

    // Prices should be very close (within rounding)
    let price_diff = if (spot_price > cond_price_stable_per_asset) {
        spot_price - cond_price_stable_per_asset
    } else {
        cond_price_stable_per_asset - spot_price
    };
    assert!(price_diff < 1000, 999); // Prices should match within 0.000001 (1e-6)

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

/// Test using ACTUAL swap_entry function like E2E test does
/// Verifies that auto-arb keeps spot price within no-arb band
#[test]
fun test_swap_with_auto_arb_using_entry_function() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Setup spot pool
    let spot_asset = 200_000_000_000u64;
    let spot_stable = 200_000_000u64;
    let mut spot_pool = create_test_spot_pool(
        spot_asset,
        spot_stable,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // System enforces min 1% of TOTAL liquidity in conditionals (1-99% range)
    // For 2 outcomes with 1% conditional ratio:
    // - Total liquidity = 100 units
    // - 99% in spot = 99 units
    // - 1% split across conditionals = 0.5 units each
    // To get these ratios: cond_per_outcome = spot * 0.01 / outcome_count
    let conditional_ratio = 1; // 1% minimum
    let outcome_count = 2u64;
    let cond_asset = (spot_asset * conditional_ratio) / (100 * outcome_count); // 1B each
    let cond_stable = (spot_stable * conditional_ratio) / (100 * outcome_count); // 1M each

    // Create escrow with properly bootstrapped conditional pools
    let mut escrow = create_test_escrow_with_markets(2, 1000, &clock, ctx);

    // CRITICAL: Fund the escrow to back the conditional pools
    // QUANTUM MODEL: escrow must equal the supply for EACH outcome independently
    // All outcomes share the same backing (quantum superposition)
    // So escrow = supply_per_outcome, NOT sum of all outcomes
    let escrow_asset_backing = cond_asset;  // 1B (same as each outcome's supply)
    let escrow_stable_backing = cond_stable; // 1M (same as each outcome's supply)
    coin_escrow::deposit_spot_coins(
        &mut escrow,
        coin::mint_for_testing<TEST_COIN_A>(escrow_asset_backing, ctx),
        coin::mint_for_testing<TEST_COIN_B>(escrow_stable_backing, ctx),
    );

    // CRITICAL: Initialize supplies to match conditional pool reserves
    // The arbitrage decrement_supplies_for_all_outcomes requires supplies to be set
    // Each outcome gets supply == escrow (quantum invariant)
    coin_escrow::increment_supplies_for_all_outcomes(
        &mut escrow,
        cond_asset,   // asset supply per outcome (matches AMM reserves)
        cond_stable,  // stable supply per outcome (matches AMM reserves)
    );

    let market_state = coin_escrow::get_market_state_mut(&mut escrow);
    let market_id = market_state::market_id(market_state);

    // Create conditional pools with correct bootstrap ratio
    let mut pools = vector::empty<LiquidityPool>();
    let mut i = 0;
    while (i < 2) {
        let pool = conditional_amm::create_test_pool(
            market_id,
            (i as u8),
            (DEFAULT_FEE_BPS as u64),
            cond_asset,
            cond_stable,
            &clock,
            ctx,
        );
        pools.push_back(pool);
        i = i + 1;
    };
    market_state::set_amm_pools(market_state, pools);
    market_state::init_trading_for_testing(market_state);

    // Create a Proposal in STATE_TRADING
    let mut proposal = proposal::new_for_testing<TEST_COIN_A, TEST_COIN_B>(
        @0xDA0, // dao_id
        @0xABC, // proposer
        option::none(), // liquidity_provider
        string::utf8(b"Test Proposal"),
        string::utf8(b"Test intro"),
        string::utf8(b"Test metadata"),
        vector[string::utf8(b"Accept"), string::utf8(b"Reject")],
        vector[string::utf8(b"Accept"), string::utf8(b"Reject")],
        vector[@0x1, @0x2],
        2, // outcome_count
        60000, // review_period_ms
        600000, // trading_period_ms
        1000, // min_asset_liquidity
        1000, // min_stable_liquidity
        0, // twap_start_delay
        1_000_000_000_000_000_000u128, // twap_initial_observation
        100, // twap_step_max
        signed::from_u128(500_000_000_000_000_000u128), // twap_threshold
        30, // amm_total_fee_bps
        10, // max_outcomes
        option::none<u64>(), // winning_outcome
        @0xFEE, // treasury_address
        vector::empty<option::Option<vector<ActionSpec>>>(), // intent_specs
        ctx,
    );

    // Set proposal to STATE_TRADING (value 2)
    proposal::set_state_for_testing(&mut proposal, 2);

    // Link proposal and escrow
    proposal::set_escrow_id_for_testing(&mut proposal, object::id(&escrow));
    proposal::set_market_state_id_for_testing(&mut proposal, market_id);

    std::debug::print(&b"\n=== BEFORE SWAP (using swap_entry) ===");

    // Spot pool state
    let (spot_asset_before, spot_stable_before) = unified_spot_pool::get_reserves(&spot_pool);
    std::debug::print(&b"Spot reserves:");
    std::debug::print(&spot_asset_before);
    std::debug::print(&spot_stable_before);
    let spot_price_before = unified_spot_pool::get_spot_price(&spot_pool);
    std::debug::print(&b"Spot price (1e12):");
    std::debug::print(&spot_price_before);

    // Conditional pool state
    let conditionals_before = market_state::borrow_amm_pools(
        coin_escrow::get_market_state(&escrow),
    );
    let (c0_asset_before, c0_stable_before) = conditional_amm::get_reserves(
        &conditionals_before[0],
    );
    let (c1_asset_before, c1_stable_before) = conditional_amm::get_reserves(
        &conditionals_before[1],
    );
    std::debug::print(&b"Cond0 reserves:");
    std::debug::print(&c0_asset_before);
    std::debug::print(&c0_stable_before);
    let c0_price_before = conditional_amm::get_current_price(&conditionals_before[0]);
    std::debug::print(&b"Cond0 price (1e12):");
    std::debug::print(&c0_price_before);

    std::debug::print(&b"Cond1 reserves:");
    std::debug::print(&c1_asset_before);
    std::debug::print(&c1_stable_before);
    let c1_price_before = conditional_amm::get_current_price(&conditionals_before[1]);
    std::debug::print(&b"Cond1 price (1e12):");
    std::debug::print(&c1_price_before);

    // Calculate no-arb band
    let (floor_before, ceiling_before) = no_arb_guard::compute_noarb_band(
        &spot_pool,
        conditionals_before,
    );
    std::debug::print(&b"No-arb floor (1e12):");
    std::debug::print(&floor_before);
    std::debug::print(&b"No-arb ceiling (1e12):");
    std::debug::print(&ceiling_before);
    let in_band_before = spot_price_before >= floor_before && spot_price_before <= ceiling_before;
    std::debug::print(&b"Spot in band BEFORE:");
    std::debug::print(&in_band_before);

    // NOW DO SWAP USING swap_entry::swap_spot_stable_to_asset (like E2E test)
    std::debug::print(&b"\n=== DOING SWAP via swap_entry::swap_spot_stable_to_asset ===");
    let swap_amount = 1_000_000u64; // 1M units (~0.5% of spot pool)
    let stable_in = coin::mint_for_testing<TEST_COIN_B>(swap_amount, ctx);

    let (mut asset_out_opt, mut balance_opt) = swap_entry::swap_spot_stable_to_asset(
        &mut spot_pool,
        &mut proposal,
        &mut escrow,
        stable_in,
        0, // min_asset_out
        @0x1, // recipient
        option::none(), // existing_balance_opt
        true, // return_balance (return to caller, don't transfer)
        &clock,
        ctx,
    );

    // Clean up returned values
    let asset_out = option::extract(&mut asset_out_opt);
    coin::burn_for_testing(asset_out);
    option::destroy_none(asset_out_opt);
    if (option::is_some(&balance_opt)) {
        let balance = option::extract(&mut balance_opt);
        conditional_balance::destroy_for_testing(balance);
    };
    option::destroy_none(balance_opt);

    std::debug::print(&b"\n=== AFTER SWAP (with auto-arb) ===");

    // Spot pool state
    let (spot_asset_after, spot_stable_after) = unified_spot_pool::get_reserves(&spot_pool);
    std::debug::print(&b"Spot reserves:");
    std::debug::print(&spot_asset_after);
    std::debug::print(&spot_stable_after);
    let spot_price_after = unified_spot_pool::get_spot_price(&spot_pool);
    std::debug::print(&b"Spot price (1e12):");
    std::debug::print(&spot_price_after);

    // Conditional pool state
    let conditionals_after = market_state::borrow_amm_pools(coin_escrow::get_market_state(&escrow));
    let (c0_asset_after, c0_stable_after) = conditional_amm::get_reserves(&conditionals_after[0]);
    let (c1_asset_after, c1_stable_after) = conditional_amm::get_reserves(&conditionals_after[1]);
    std::debug::print(&b"Cond0 reserves:");
    std::debug::print(&c0_asset_after);
    std::debug::print(&c0_stable_after);
    let c0_price_after = conditional_amm::get_current_price(&conditionals_after[0]);
    std::debug::print(&b"Cond0 price (1e12):");
    std::debug::print(&c0_price_after);

    std::debug::print(&b"Cond1 reserves:");
    std::debug::print(&c1_asset_after);
    std::debug::print(&c1_stable_after);
    let c1_price_after = conditional_amm::get_current_price(&conditionals_after[1]);
    std::debug::print(&b"Cond1 price (1e12):");
    std::debug::print(&c1_price_after);

    // Calculate no-arb band
    let (floor_after, ceiling_after) = no_arb_guard::compute_noarb_band(
        &spot_pool,
        conditionals_after,
    );
    std::debug::print(&b"No-arb floor (1e12):");
    std::debug::print(&floor_after);
    std::debug::print(&b"No-arb ceiling (1e12):");
    std::debug::print(&ceiling_after);
    let in_band_after = spot_price_after >= floor_after && spot_price_after <= ceiling_after;
    std::debug::print(&b"Spot in band AFTER:");
    std::debug::print(&in_band_after);

    // Show changes
    std::debug::print(&b"\n=== CHANGES ===");
    std::debug::print(&b"Spot price BEFORE:");
    std::debug::print(&spot_price_before);
    std::debug::print(&b"Spot price AFTER:");
    std::debug::print(&spot_price_after);
    std::debug::print(&b"C0 reserves changed:");
    std::debug::print(&(c0_asset_after != c0_asset_before || c0_stable_after != c0_stable_before));
    std::debug::print(&b"C1 reserves changed:");
    std::debug::print(&(c1_asset_after != c1_asset_before || c1_stable_after != c1_stable_before));

    std::debug::print(&b"\n✓ Test complete - checking no-arb guard...");

    // Assert that auto-arb successfully kept spot price within the no-arb band
    assert!(in_band_after, 0);

    // Verify conditional pools were updated by auto-arb
    assert!(c0_asset_after != c0_asset_before || c0_stable_after != c0_stable_before, 1);
    assert!(c1_asset_after != c1_asset_before || c1_stable_after != c1_stable_before, 2);

    // Cleanup
    proposal::destroy_for_testing(proposal);
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
