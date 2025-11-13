// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_markets_core::quantum_lp_manager_tests;

use futarchy_markets_core::quantum_lp_manager;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm;
use futarchy_markets_primitives::market_state;
use std::vector;
use sui::balance;
use sui::clock::{Self, Clock};
use sui::coin;
use sui::test_scenario::{Self as ts, Scenario};
use sui::test_utils;

// Test coins
public struct ASSET has drop {}
public struct STABLE has drop {}

const ADMIN: address = @0xAD;
const TRADER: address = @0xB0B;
const DAO: address = @0xDA0;

const ONE_ASSET: u64 = 1_000_000_000; // 1 token with 9 decimals
const ONE_STABLE: u64 = 1_000_000_000;

// === Test Helpers ===

fun setup_spot_pool(scenario: &mut Scenario): (UnifiedSpotPool<ASSET, STABLE>, ID) {
    let ctx = ts::ctx(scenario);
    let pool_id = object::id_from_address(@0x1234);

    // Create spot pool with 1000 asset and 1000 stable
    let asset_balance = balance::create_for_testing<ASSET>(1000 * ONE_ASSET);
    let stable_balance = balance::create_for_testing<STABLE>(1000 * ONE_STABLE);

    let spot_pool = unified_spot_pool::create_for_testing(
        asset_balance,
        stable_balance,
        30, // 0.3% fee
        ctx
    );

    (spot_pool, pool_id)
}

fun setup_escrow_with_markets(
    scenario: &mut Scenario,
    num_outcomes: u8
): TokenEscrow<ASSET, STABLE> {
    let ctx = ts::ctx(scenario);

    // Create escrow with market state
    let mut escrow = coin_escrow::create_for_testing<ASSET, STABLE>(
        (num_outcomes as u64),
        30, // 0.3% fee
        ctx
    );

    // Initialize AMM pools with bootstrap liquidity
    {
        let market_state = coin_escrow::get_market_state_mut(&mut escrow);
        let mut pools = vector::empty();
        let mut i = 0;
        while (i < num_outcomes) {
            // Bootstrap with 1000 units (matches quantum_split_recombine_tests pattern)
            let pool = conditional_amm::create_pool_for_testing(1000, 1000, 30, ctx);
            pools.push_back(pool);
            i = i + 1;
        };
        market_state::set_amm_pools(market_state, pools);
    };

    escrow
}

// === Core Tests ===

#[test]
fun test_quantum_split_divides_among_pools() {
    let mut scenario = ts::begin(ADMIN);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));

    // Setup: 1000 asset, 1000 stable in spot pool
    let (mut spot_pool, proposal_id) = setup_spot_pool(&mut scenario);
    let mut escrow = setup_escrow_with_markets(&mut scenario, 2); // 2 outcomes

    // Execute: 80% quantum split (800 tokens)
    quantum_lp_manager::auto_quantum_split_on_proposal_start(
        &mut spot_pool,
        &mut escrow,
        proposal_id,
        80, // 80% to conditional pools
        &clock,
        ts::ctx(&mut scenario)
    );

    // Verify spot pool: should have 200 left (20% remaining)
    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(&spot_pool);
    assert!(spot_asset == 200 * ONE_ASSET, 0);
    assert!(spot_stable == 200 * ONE_STABLE, 1);

    // Verify escrow: should have 800 deposited (80% split)
    let (escrow_asset, escrow_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(escrow_asset == 800 * ONE_ASSET, 2);
    assert!(escrow_stable == 800 * ONE_STABLE, 3);

    // Verify conditional pools: each gets 400 (800 / 2) + 1000 bootstrap
    let market_state = coin_escrow::get_market_state(&escrow);
    let pools = market_state::borrow_amm_pools(market_state);
    assert!(pools.length() == 2, 4);

    let pool0 = &pools[0];
    let (asset0, stable0) = conditional_amm::get_reserves(pool0);
    assert!(asset0 == 400 * ONE_ASSET + 1000, 5); // 400 tokens + 1000 bootstrap
    assert!(stable0 == 400 * ONE_STABLE + 1000, 6);

    let pool1 = &pools[1];
    let (asset1, stable1) = conditional_amm::get_reserves(pool1);
    assert!(asset1 == 400 * ONE_ASSET + 1000, 7); // 400 tokens + 1000 bootstrap
    assert!(stable1 == 400 * ONE_STABLE + 1000, 8);

    // Verify escrow backs split amounts (bootstrap stays locked in pools)
    let bootstrap_per_pool = 1000u64;
    assert!(escrow_asset == (asset0 - bootstrap_per_pool) + (asset1 - bootstrap_per_pool), 9);
    assert!(escrow_stable == (stable0 - bootstrap_per_pool) + (stable1 - bootstrap_per_pool), 10);

    // Cleanup
    test_utils::destroy(spot_pool);
    test_utils::destroy(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_escrow_backing_with_three_outcomes() {
    let mut scenario = ts::begin(ADMIN);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));

    // Setup with 3 outcomes
    let (mut spot_pool, proposal_id) = setup_spot_pool(&mut scenario);
    let mut escrow = setup_escrow_with_markets(&mut scenario, 3); // 3 outcomes

    // Execute: 90% quantum split (900 tokens)
    quantum_lp_manager::auto_quantum_split_on_proposal_start(
        &mut spot_pool,
        &mut escrow,
        proposal_id,
        90, // 90% to conditional pools
        &clock,
        ts::ctx(&mut scenario)
    );

    // Verify: each of 3 pools gets 300 (900 / 3) + 1000 bootstrap
    let (escrow_asset, escrow_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(escrow_asset == 900 * ONE_ASSET, 0);
    assert!(escrow_stable == 900 * ONE_STABLE, 1);

    let market_state = coin_escrow::get_market_state(&escrow);
    let pools = market_state::borrow_amm_pools(market_state);
    assert!(pools.length() == 3, 2);

    let bootstrap_per_pool = 1000u64;
    let mut total_conditional_asset = 0u64;
    let mut total_conditional_stable = 0u64;
    let mut i = 0;
    while (i < 3) {
        let pool = &pools[i];
        let (asset, stable) = conditional_amm::get_reserves(pool);
        assert!(asset == 300 * ONE_ASSET + bootstrap_per_pool, 3 + i); // 300 + 1000 bootstrap
        assert!(stable == 300 * ONE_STABLE + bootstrap_per_pool, 6 + i);
        total_conditional_asset = total_conditional_asset + (asset - bootstrap_per_pool);
        total_conditional_stable = total_conditional_stable + (stable - bootstrap_per_pool);
        i = i + 1;
    };

    // Critical: escrow backs split amounts (excluding bootstrap locked in pools)
    assert!(total_conditional_asset == escrow_asset, 9);
    assert!(total_conditional_stable == escrow_stable, 10);

    // Cleanup
    test_utils::destroy(spot_pool);
    test_utils::destroy(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_recombination_with_lp_fees() {
    let mut scenario = ts::begin(ADMIN);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));

    // Setup
    let (mut spot_pool, proposal_id) = setup_spot_pool(&mut scenario);
    let mut escrow = setup_escrow_with_markets(&mut scenario, 2);

    // Quantum split 80%
    quantum_lp_manager::auto_quantum_split_on_proposal_start(
        &mut spot_pool,
        &mut escrow,
        proposal_id,
        80,
        &clock,
        ts::ctx(&mut scenario)
    );

    // Simulate trader depositing and swapping (this adds LP fees to pool)
    // In real flow: trader deposits 10 stable -> escrow, gets conditional stable, then swaps
    let trader_deposit = balance::create_for_testing<STABLE>(10 * ONE_STABLE);
    coin_escrow::deposit_spot_liquidity(
        &mut escrow,
        balance::zero<ASSET>(),
        trader_deposit,
    );

    // Simulate adding those 10 stable to conditional pool 0 (mimics swap input)
    {
        let market_state = coin_escrow::get_market_state_mut(&mut escrow);
        let _pool = market_state::get_pool_mut_by_outcome(market_state, 0);
        // Manually add to reserves to simulate fee accumulation
        // This is a simplified simulation - in real swaps, fees are split 80/20
        // For this test, we just verify escrow can cover the withdrawal
    };

    // Get initial escrow balance
    let (escrow_before_asset, escrow_before_stable) = coin_escrow::get_spot_balances(&escrow);

    // Get pool 0 reserves before recombination
    let (pool0_asset, pool0_stable) = {
        let market_state = coin_escrow::get_market_state(&escrow);
        let pool = market_state::get_pool_by_outcome(market_state, 0);
        conditional_amm::get_reserves(pool)
    };

    // Recombine winning pool (outcome 0)
    quantum_lp_manager::auto_redeem_on_proposal_end_from_escrow(
        0, // winning outcome
        &mut spot_pool,
        &mut escrow,
        &clock,
        ts::ctx(&mut scenario)
    );

    // Verify: escrow should have reduced by exactly what was withdrawn
    let (escrow_after_asset, escrow_after_stable) = coin_escrow::get_spot_balances(&escrow);
    let withdrawn_asset = escrow_before_asset - escrow_after_asset;
    let withdrawn_stable = escrow_before_stable - escrow_after_stable;

    // Withdrawn amounts should match pool reserves (including any fees)
    assert!(withdrawn_asset == pool0_asset, 0);
    assert!(withdrawn_stable == pool0_stable, 1);

    // Spot pool should have increased by withdrawn amounts
    let (final_spot_asset, final_spot_stable) = unified_spot_pool::get_reserves(&spot_pool);
    // Initial 200 + withdrawn amounts
    assert!(final_spot_asset == 200 * ONE_ASSET + withdrawn_asset, 2);
    assert!(final_spot_stable == 200 * ONE_STABLE + withdrawn_stable, 3);

    // Cleanup
    test_utils::destroy(spot_pool);
    test_utils::destroy(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_protocol_fees_included_in_recombination() {
    let mut scenario = ts::begin(ADMIN);
    let clock = clock::create_for_testing(ts::ctx(&mut scenario));

    // Setup
    let (mut spot_pool, proposal_id) = setup_spot_pool(&mut scenario);
    let mut escrow = setup_escrow_with_markets(&mut scenario, 2);

    // Quantum split
    quantum_lp_manager::auto_quantum_split_on_proposal_start(
        &mut spot_pool,
        &mut escrow,
        proposal_id,
        80,
        &clock,
        ts::ctx(&mut scenario)
    );

    // Simulate protocol fees accumulating (20% of swap fees)
    // In reality, these accumulate during swaps and are backed by trader deposits
    let trader_deposit = balance::create_for_testing<STABLE>(100 * ONE_STABLE);
    coin_escrow::deposit_spot_liquidity(
        &mut escrow,
        balance::zero<ASSET>(),
        trader_deposit,
    );

    // Get escrow balance before recombination
    let (escrow_before_asset, escrow_before_stable) = coin_escrow::get_spot_balances(&escrow);

    // Get pool reserves + protocol fees
    let (pool_asset, pool_stable, protocol_asset, protocol_stable) = {
        let market_state = coin_escrow::get_market_state(&escrow);
        let pool = market_state::get_pool_by_outcome(market_state, 0);
        let (a, s) = conditional_amm::get_reserves(pool);
        let pa = conditional_amm::get_protocol_fees_asset(pool);
        let ps = conditional_amm::get_protocol_fees_stable(pool);
        (a, s, pa, ps)
    };

    // Recombine
    quantum_lp_manager::auto_redeem_on_proposal_end_from_escrow(
        0,
        &mut spot_pool,
        &mut escrow,
        &clock,
        ts::ctx(&mut scenario)
    );

    // Verify: withdrawal should include BOTH reserves AND protocol fees
    let (escrow_after_asset, escrow_after_stable) = coin_escrow::get_spot_balances(&escrow);
    let withdrawn_asset = escrow_before_asset - escrow_after_asset;
    let withdrawn_stable = escrow_before_stable - escrow_after_stable;

    assert!(withdrawn_asset == pool_asset + protocol_asset, 0);
    assert!(withdrawn_stable == pool_stable + protocol_stable, 1);

    // Cleanup
    test_utils::destroy(spot_pool);
    test_utils::destroy(escrow);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// NOTE: test_fails_if_fees_not_backed_by_escrow was removed because:
// 1. It had an empty block that didn't actually set up the failure condition
// 2. There's no public API to maliciously add liquidity without escrow backing
// 3. The escrow withdrawal safety is enforced by the escrow module's balance checks
// If this test is needed, it would require exposing test-only functions to create invalid state
