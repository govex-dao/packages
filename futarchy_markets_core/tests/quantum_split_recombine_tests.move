// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Tests for quantum split and recombine flow with fee tracking
#[test_only]
module futarchy_markets_core::quantum_split_recombine_tests;

use futarchy_markets_core::quantum_lp_manager;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm;
use futarchy_markets_primitives::market_state;
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use std::vector;
use sui::balance;
use sui::clock;
use sui::coin;
use sui::test_scenario as ts;

// === Constants ===
const ADMIN: address = @0xAD;
const INITIAL_LIQUIDITY: u64 = 1000_000_000_000; // 1000 tokens with 9 decimals
const FEE_BPS: u64 = 30; // 0.3%

// === Test: Quantum Split Divides Liquidity Among Pools ===

#[test]
fun test_quantum_split_divides_among_two_pools() {
    let mut scenario = ts::begin(ADMIN);
    let ctx = ts::ctx(&mut scenario);
    let clock = clock::create_for_testing(ctx);

    // Create spot pool with 1000 asset, 1000 stable
    let asset_balance = balance::create_for_testing<TEST_COIN_A>(INITIAL_LIQUIDITY);
    let stable_balance = balance::create_for_testing<TEST_COIN_B>(INITIAL_LIQUIDITY);
    let mut spot_pool = unified_spot_pool::create_for_testing(
        asset_balance,
        stable_balance,
        FEE_BPS,
        ctx,
    );

    // Create escrow with 2 outcomes
    let mut escrow = coin_escrow::create_for_testing<TEST_COIN_A, TEST_COIN_B>(
        2, // num_outcomes
        FEE_BPS,
        ctx,
    );

    // Initialize empty AMM pools for quantum split to populate
    {
        let market_state = coin_escrow::get_market_state_mut(&mut escrow);
        let mut pools = vector::empty();
        let mut i = 0;
        while (i < 2) {
            let pool = conditional_amm::create_pool_for_testing(1000, 1000, FEE_BPS, ctx);
            pools.push_back(pool);
            i = i + 1;
        };
        market_state::set_amm_pools(market_state, pools);
    };

    let proposal_id = sui::object::id_from_address(@0x1234);

    // Execute quantum split: 80% of 1000 = 800 tokens to split
    quantum_lp_manager::auto_quantum_split_on_proposal_start(
        &mut spot_pool,
        &mut escrow,
        proposal_id,
        80, // 80% ratio
        &clock,
        ctx,
    );

    // Verify spot pool: 200 remaining (20%)
    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(&spot_pool);
    assert!(spot_asset == 200_000_000_000, 0); // 200 tokens
    assert!(spot_stable == 200_000_000_000, 1);

    // Verify escrow: 800 deposited (80%)
    let (escrow_asset, escrow_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(escrow_asset == 800_000_000_000, 2); // 800 tokens
    assert!(escrow_stable == 800_000_000_000, 3);

    // Verify conditional pools: each gets 400 (800 / 2 outcomes) + 1000 bootstrap
    let market_state = coin_escrow::get_market_state(&escrow);
    let pools = market_state::borrow_amm_pools(market_state);
    assert!(pools.length() == 2, 4);

    let pool0 = &pools[0];
    let (asset0, stable0) = conditional_amm::get_reserves(pool0);
    assert!(asset0 == 400_000_001_000, 5); // 400 tokens + 1000 bootstrap
    assert!(stable0 == 400_000_001_000, 6);

    let pool1 = &pools[1];
    let (asset1, stable1) = conditional_amm::get_reserves(pool1);
    assert!(asset1 == 400_000_001_000, 7); // 400 tokens + 1000 bootstrap
    assert!(stable1 == 400_000_001_000, 8);

    // CRITICAL: Verify escrow backs split amounts (bootstrap stays locked in pools)
    let bootstrap_per_pool = 1000u64;
    assert!(escrow_asset == (asset0 - bootstrap_per_pool) + (asset1 - bootstrap_per_pool), 9);
    assert!(escrow_stable == (stable0 - bootstrap_per_pool) + (stable1 - bootstrap_per_pool), 10);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_quantum_split_with_three_outcomes() {
    let mut scenario = ts::begin(ADMIN);
    let ctx = ts::ctx(&mut scenario);
    let clock = clock::create_for_testing(ctx);

    let asset_balance = balance::create_for_testing<TEST_COIN_A>(INITIAL_LIQUIDITY);
    let stable_balance = balance::create_for_testing<TEST_COIN_B>(INITIAL_LIQUIDITY);
    let mut spot_pool = unified_spot_pool::create_for_testing(
        asset_balance,
        stable_balance,
        FEE_BPS,
        ctx,
    );

    // 3 outcomes
    let mut escrow = coin_escrow::create_for_testing<TEST_COIN_A, TEST_COIN_B>(3, FEE_BPS, ctx);

    // Initialize empty AMM pools for quantum split to populate
    {
        let market_state = coin_escrow::get_market_state_mut(&mut escrow);
        let mut pools = vector::empty();
        let mut i = 0;
        while (i < 3) {
            let pool = conditional_amm::create_pool_for_testing(1000, 1000, FEE_BPS, ctx);
            pools.push_back(pool);
            i = i + 1;
        };
        market_state::set_amm_pools(market_state, pools);
    };

    let proposal_id = sui::object::id_from_address(@0x5678);

    // 90% of 1000 = 900 to split among 3 pools = 300 each
    quantum_lp_manager::auto_quantum_split_on_proposal_start(
        &mut spot_pool,
        &mut escrow,
        proposal_id,
        90,
        &clock,
        ctx,
    );

    // Verify each pool gets 300
    let market_state = coin_escrow::get_market_state(&escrow);
    let pools = market_state::borrow_amm_pools(market_state);
    assert!(pools.length() == 3, 0);

    let bootstrap_per_pool = 1000u64;
    let mut total_asset = 0u64;
    let mut total_stable = 0u64;
    let mut i = 0;
    while (i < 3) {
        let pool = &pools[i];
        let (asset, stable) = conditional_amm::get_reserves(pool);
        assert!(asset == 300_000_001_000, 1 + i); // 300 tokens + 1000 bootstrap
        assert!(stable == 300_000_001_000, 4 + i);
        total_asset = total_asset + asset;
        total_stable = total_stable + stable;
        i = i + 1;
    };

    // Verify escrow backs split amounts (bootstrap stays locked in pools)
    let (escrow_asset, escrow_stable) = coin_escrow::get_spot_balances(&escrow);
    let total_bootstrap = bootstrap_per_pool * 3;
    assert!(total_asset - total_bootstrap == escrow_asset, 7);
    assert!(total_stable - total_bootstrap == escrow_stable, 8);
    assert!(escrow_asset == 900_000_000_000, 9);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// === Test: Recombination Withdraws Reserves + Protocol Fees ===

#[test]
fun test_recombine_includes_protocol_fees() {
    let mut scenario = ts::begin(ADMIN);
    let ctx = ts::ctx(&mut scenario);
    let mut clock = clock::create_for_testing(ctx);

    let asset_balance = balance::create_for_testing<TEST_COIN_A>(INITIAL_LIQUIDITY);
    let stable_balance = balance::create_for_testing<TEST_COIN_B>(INITIAL_LIQUIDITY);
    let mut spot_pool = unified_spot_pool::create_for_testing(
        asset_balance,
        stable_balance,
        FEE_BPS,
        ctx,
    );

    let mut escrow = coin_escrow::create_for_testing<TEST_COIN_A, TEST_COIN_B>(2, FEE_BPS, ctx);

    // Initialize empty AMM pools for quantum split to populate
    {
        let market_state = coin_escrow::get_market_state_mut(&mut escrow);
        let mut pools = vector::empty();
        let mut i = 0;
        while (i < 2) {
            let pool = conditional_amm::create_pool_for_testing(1000, 1000, FEE_BPS, ctx);
            pools.push_back(pool);
            i = i + 1;
        };
        market_state::set_amm_pools(market_state, pools);
    };

    let proposal_id = sui::object::id_from_address(@0xABCD);

    // Quantum split
    quantum_lp_manager::auto_quantum_split_on_proposal_start(
        &mut spot_pool,
        &mut escrow,
        proposal_id,
        80,
        &clock,
        ctx,
    );

    // Simulate protocol fees accumulating in winning pool (outcome 0)
    // In real scenario, these come from swaps where traders deposited to escrow first
    {
        let market_state = coin_escrow::get_market_state_mut(&mut escrow);
        let pool = market_state::get_pool_mut_by_outcome(market_state, 0);
        // Manually set protocol fees to simulate swap fee accumulation
        conditional_amm::set_protocol_fees_for_testing(pool, 1_000_000_000, 500_000_000);
    };

    // Also deposit backing for those fees to escrow (simulating trader deposits)
    coin_escrow::deposit_spot_liquidity(
        &mut escrow,
        balance::create_for_testing<TEST_COIN_A>(1_000_000_000),
        balance::create_for_testing<TEST_COIN_B>(500_000_000),
    );

    // Get pool reserves before recombination
    let (pool0_reserves_asset, pool0_reserves_stable) = {
        let market_state = coin_escrow::get_market_state(&escrow);
        let pool = market_state::get_pool_by_outcome(market_state, 0);
        conditional_amm::get_reserves(pool)
    };

    // Get protocol fees
    let (protocol_fee_asset, protocol_fee_stable) = {
        let market_state = coin_escrow::get_market_state(&escrow);
        let pool = market_state::get_pool_by_outcome(market_state, 0);
        (conditional_amm::get_protocol_fees_asset(pool), conditional_amm::get_protocol_fees_stable(pool))
    };

    let (escrow_before_asset, escrow_before_stable) = coin_escrow::get_spot_balances(&escrow);

    // Advance time to pass 6-hour gap
    clock::increment_for_testing(&mut clock, 7 * 60 * 60 * 1000);

    // Recombine winning pool (outcome 0)
    quantum_lp_manager::auto_redeem_on_proposal_end_from_escrow(
        0, // winning outcome
        &mut spot_pool,
        &mut escrow,
        &clock,
        ctx,
    );

    // Verify withdrawal = reserves + protocol fees
    let (escrow_after_asset, escrow_after_stable) = coin_escrow::get_spot_balances(&escrow);
    let withdrawn_asset = escrow_before_asset - escrow_after_asset;
    let withdrawn_stable = escrow_before_stable - escrow_after_stable;

    // CRITICAL: Withdrawn should include BOTH reserves AND protocol fees
    assert!(withdrawn_asset == pool0_reserves_asset + protocol_fee_asset, 0);
    assert!(withdrawn_stable == pool0_reserves_stable + protocol_fee_stable, 1);

    // Verify spot pool received all withdrawn liquidity
    let (final_spot_asset, final_spot_stable) = unified_spot_pool::get_reserves(&spot_pool);
    // Initial 200 (remained in spot) + withdrawn amounts
    assert!(final_spot_asset == 200_000_000_000 + withdrawn_asset, 2);
    assert!(final_spot_stable == 200_000_000_000 + withdrawn_stable, 3);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// === Test: Complete Flow with Simulated Swap Fees ===

#[test]
fun test_complete_quantum_cycle_with_fees() {
    let mut scenario = ts::begin(ADMIN);
    let ctx = ts::ctx(&mut scenario);
    let mut clock = clock::create_for_testing(ctx);

    let asset_balance = balance::create_for_testing<TEST_COIN_A>(INITIAL_LIQUIDITY);
    let stable_balance = balance::create_for_testing<TEST_COIN_B>(INITIAL_LIQUIDITY);
    let mut spot_pool = unified_spot_pool::create_for_testing(
        asset_balance,
        stable_balance,
        FEE_BPS,
        ctx,
    );

    let mut escrow = coin_escrow::create_for_testing<TEST_COIN_A, TEST_COIN_B>(2, FEE_BPS, ctx);

    // Initialize empty AMM pools for quantum split to populate
    {
        let market_state = coin_escrow::get_market_state_mut(&mut escrow);
        let mut pools = vector::empty();
        let mut i = 0;
        while (i < 2) {
            let pool = conditional_amm::create_pool_for_testing(1000, 1000, FEE_BPS, ctx);
            pools.push_back(pool);
            i = i + 1;
        };
        market_state::set_amm_pools(market_state, pools);
    };

    let proposal_id = sui::object::id_from_address(@0xDEAD);

    // 1. Quantum split: 75% of 1000 = 750 to split
    quantum_lp_manager::auto_quantum_split_on_proposal_start(
        &mut spot_pool,
        &mut escrow,
        proposal_id,
        75,
        &clock,
        ctx,
    );

    // 2. Simulate trader swaps that generate fees
    // Trader deposits 50 stable to escrow, gets conditional tokens, swaps
    coin_escrow::deposit_spot_liquidity(
        &mut escrow,
        balance::zero<TEST_COIN_A>(),
        balance::create_for_testing<TEST_COIN_B>(50_000_000_000), // 50 stable
    );

    // Simulate swap fees: 0.3% fee = 0.15 stable
    // 80% to LP (0.12 stable) goes to reserves
    // 20% to protocol (0.03 stable) tracked separately
    {
        let market_state = coin_escrow::get_market_state_mut(&mut escrow);
        let pool = market_state::get_pool_mut_by_outcome(market_state, 0);
        // Add LP fee to reserves
        conditional_amm::add_reserves_for_testing(pool, 0, 120_000_000); // 0.12 stable
        // Set protocol fee
        conditional_amm::set_protocol_fees_for_testing(pool, 0, 30_000_000); // 0.03 stable
    };

    // 3. Advance time past 6-hour gap
    clock::increment_for_testing(&mut clock, 7 * 60 * 60 * 1000);

    // 4. Recombine
    quantum_lp_manager::auto_redeem_on_proposal_end_from_escrow(
        0,
        &mut spot_pool,
        &mut escrow,
        &clock,
        ctx,
    );

    // 5. Verify all fees were recombined
    let (final_spot_asset, final_spot_stable) = unified_spot_pool::get_reserves(&spot_pool);

    // Asset: 250 (remained) + 375 (pool0 reserves) + 0.000001 (bootstrap) = 625.000001 tokens
    // Stable: 250 (remained) + 375 (pool0) + 0.000001 (bootstrap) + 50 (trader) + fees
    let bootstrap = 1000u64;
    assert!(final_spot_asset == 250_000_000_000 + 375_000_000_000 + bootstrap, 0);
    assert!(final_spot_stable > 250_000_000_000 + 375_000_000_000, 1); // Stable increased by trader deposit + fees

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
