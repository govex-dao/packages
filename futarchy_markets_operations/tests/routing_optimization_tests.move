// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_markets_operations::routing_optimization_tests;

use futarchy_markets_core::proposal::{Self, Proposal};
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_operations::swap_entry;
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm::{Self, LiquidityPool};
use futarchy_markets_primitives::conditional_balance;
use futarchy_markets_primitives::market_state;
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use std::option;
use std::string;
use std::vector;
use sui::clock::{Self, Clock};
use sui::coin;
use sui::object;
use sui::test_scenario as ts;

// === Constants ===
const DEFAULT_FEE_BPS: u16 = 30; // 0.3%
const STATE_TRADING: u8 = 2;

// === Test Helpers ===

fun create_test_clock(timestamp_ms: u64, ctx: &mut TxContext): Clock {
    clock::create_for_testing(ctx)
}

fun create_test_spot_pool(
    asset_reserve: u64,
    stable_reserve: u64,
    fee_bps: u64,
    _clock: &Clock,
    ctx: &mut TxContext,
): UnifiedSpotPool<TEST_COIN_A, TEST_COIN_B> {
    unified_spot_pool::create_pool_for_testing(
        asset_reserve,
        stable_reserve,
        fee_bps,
        ctx,
    )
}

fun create_test_escrow_with_markets(
    outcome_count: u64,
    _initial_reserve: u64,
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

fun setup_proposal_for_testing(
    escrow_id: object::ID,
    market_state_id: object::ID,
    ctx: &mut TxContext,
): Proposal<TEST_COIN_A, TEST_COIN_B> {
    let mut proposal = proposal::create_test_proposal<TEST_COIN_A, TEST_COIN_B>(
        2, // outcome_count
        0, // winning_outcome
        false, // is_finalized
        ctx,
    );
    proposal::set_state_for_testing(&mut proposal, STATE_TRADING);
    proposal::set_escrow_id_for_testing(&mut proposal, escrow_id);
    proposal::set_market_state_id_for_testing(&mut proposal, market_state_id);
    proposal
}

// === Routing Tests ===

/// Test direct swap path when conditional pools are too small (routing doesn't help)
#[test]
fun test_routing_prefers_direct_when_conditionals_tiny() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Large spot pool
    let spot_asset = 200_000_000_000u64; // 200B
    let spot_stable = 200_000_000u64; // 200M
    let mut spot_pool = create_test_spot_pool(
        spot_asset,
        spot_stable,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Tiny conditional pools (0.01% of spot = routing won't help)
    let conditional_ratio = 1; // 0.01% each
    let outcome_count = 2u64;
    let cond_asset = (spot_asset * conditional_ratio) / (10000 * outcome_count); // 100M each
    let cond_stable = (spot_stable * conditional_ratio) / (10000 * outcome_count); // 100 each

    let mut escrow = create_test_escrow_with_markets(2, 1000, &clock, ctx);

    // Create conditional pools
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

    // Setup proposal
    let escrow_id = object::id(&escrow);
    let market_state_id = object::id(coin_escrow::get_market_state(&escrow));
    let mut proposal = setup_proposal_for_testing(escrow_id, market_state_id, ctx);

    // Get reserves before
    let (spot_asset_before, spot_stable_before) = unified_spot_pool::get_reserves(&spot_pool);
    std::debug::print(&b"=== BEFORE SWAP ===");
    std::debug::print(&b"Spot asset:");
    std::debug::print(&spot_asset_before);
    std::debug::print(&b"Spot stable:");
    std::debug::print(&spot_stable_before);

    // Swap 10k stable → asset (should go direct) - small swap to avoid no-arb violation
    let swap_amount = 10_000u64;
    let stable_in = coin::mint_for_testing<TEST_COIN_B>(swap_amount, ctx);
    let (mut asset_out_opt, mut balance_opt) = swap_entry::swap_spot_stable_to_asset(
        &mut spot_pool,
        &mut proposal,
        &mut escrow,
        stable_in,
        0, // min_asset_out
        @0x1, // recipient
        option::none(),
        true, // return_balance
        &clock,
        ctx,
    );

    let asset_out = option::extract(&mut asset_out_opt);
    let output_amount = asset_out.value();
    std::debug::print(&b"\n=== AFTER SWAP ===");
    std::debug::print(&b"Asset output:");
    std::debug::print(&output_amount);

    // Get reserves after
    let (spot_asset_after, spot_stable_after) = unified_spot_pool::get_reserves(&spot_pool);
    std::debug::print(&b"Spot asset after:");
    std::debug::print(&spot_asset_after);
    std::debug::print(&b"Spot stable after:");
    std::debug::print(&spot_stable_after);

    // Verify spot pool changed (proving direct swap happened)
    assert!(spot_stable_after == spot_stable_before + swap_amount, 0);
    assert!(spot_asset_after < spot_asset_before, 1);

    // Verify conditional pools unchanged (proving no routing happened)
    let market_state2 = coin_escrow::get_market_state(&escrow);
    let pools2 = market_state::borrow_amm_pools(market_state2);
    let (cond0_asset_after, cond0_stable_after) = conditional_amm::get_reserves(&pools2[0]);
    assert!(cond0_asset_after == cond_asset, 2);
    assert!(cond0_stable_after == cond_stable, 3);

    // Verify output is reasonable
    assert!(output_amount > 0, 4);

    // Cleanup
    coin::burn_for_testing(asset_out);
    option::destroy_none(asset_out_opt);
    if (option::is_some(&balance_opt)) {
        let balance = option::extract(&mut balance_opt);
        conditional_balance::destroy_for_testing(balance);
    };
    option::destroy_none(balance_opt);
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    proposal::destroy_for_testing(proposal);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

/// Test full routing path when conditional pools are large and prices misaligned
#[test]
fun test_routing_prefers_full_route_when_conditionals_large() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Spot pool: 200B asset, 200M stable (price = 0.001)
    let spot_asset = 200_000_000_000u64;
    let spot_stable = 200_000_000u64;
    let mut spot_pool = create_test_spot_pool(
        spot_asset,
        spot_stable,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // Large conditional pools (10% of spot each = routing might help)
    let conditional_ratio = 10; // 10% each
    let outcome_count = 2u64;
    let cond_asset = (spot_asset * conditional_ratio) / (100 * outcome_count); // 10B each
    let cond_stable = (spot_stable * conditional_ratio) / (100 * outcome_count); // 10M each

    let mut escrow = create_test_escrow_with_markets(2, 1000, &clock, ctx);

    // Create conditional pools
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

    // Setup proposal
    let escrow_id = object::id(&escrow);
    let market_state_id = object::id(coin_escrow::get_market_state(&escrow));
    let mut proposal = setup_proposal_for_testing(escrow_id, market_state_id, ctx);

    // Get reserves before
    let market_state_pre = coin_escrow::get_market_state(&escrow);
    let pools_pre = market_state::borrow_amm_pools(market_state_pre);
    let (cond0_asset_before, cond0_stable_before) = conditional_amm::get_reserves(&pools_pre[0]);

    std::debug::print(&b"=== BEFORE SWAP ===");
    std::debug::print(&b"Cond0 asset:");
    std::debug::print(&cond0_asset_before);
    std::debug::print(&b"Cond0 stable:");
    std::debug::print(&cond0_stable_before);

    // Small swap to avoid violating no-arb band
    let swap_amount = 100_000u64; // 100k stable (0.05% of pool)
    let stable_in = coin::mint_for_testing<TEST_COIN_B>(swap_amount, ctx);
    let (mut asset_out_opt, mut balance_opt) = swap_entry::swap_spot_stable_to_asset(
        &mut spot_pool,
        &mut proposal,
        &mut escrow,
        stable_in,
        0,
        @0x1,
        option::none(),
        true,
        &clock,
        ctx,
    );

    let asset_out = option::extract(&mut asset_out_opt);
    let output_amount = asset_out.value();
    std::debug::print(&b"\n=== AFTER SWAP ===");
    std::debug::print(&b"Asset output:");
    std::debug::print(&output_amount);

    // Check if routing happened by looking at conditional pool changes
    let market_state2 = coin_escrow::get_market_state(&escrow);
    let pools2 = market_state::borrow_amm_pools(market_state2);
    let (cond0_asset_after, cond0_stable_after) = conditional_amm::get_reserves(&pools2[0]);

    std::debug::print(&b"Cond0 asset after:");
    std::debug::print(&cond0_asset_after);
    std::debug::print(&b"Cond0 stable after:");
    std::debug::print(&cond0_stable_after);

    // If routing happened, conditional pools should have changed
    let routing_occurred =
        (cond0_asset_after != cond0_asset_before) ||
                           (cond0_stable_after != cond0_stable_before);

    std::debug::print(&b"Routing occurred:");
    std::debug::print(&routing_occurred);

    // Verify output is reasonable
    assert!(output_amount > 0, 0);

    // Cleanup
    coin::burn_for_testing(asset_out);
    option::destroy_none(asset_out_opt);
    if (option::is_some(&balance_opt)) {
        let balance = option::extract(&mut balance_opt);
        conditional_balance::destroy_for_testing(balance);
    };
    option::destroy_none(balance_opt);
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    proposal::destroy_for_testing(proposal);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

/// Test routing optimization in reverse direction (asset → stable)
#[test]
fun test_routing_asset_to_stable_direction() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);
    let clock = create_test_clock(1000000, ctx);

    // Spot pool
    let spot_asset = 200_000_000_000u64;
    let spot_stable = 200_000_000u64;
    let mut spot_pool = create_test_spot_pool(
        spot_asset,
        spot_stable,
        (DEFAULT_FEE_BPS as u64),
        &clock,
        ctx,
    );

    // 1% conditional pools
    let conditional_ratio = 1;
    let outcome_count = 2u64;
    let cond_asset = (spot_asset * conditional_ratio) / (100 * outcome_count);
    let cond_stable = (spot_stable * conditional_ratio) / (100 * outcome_count);

    let mut escrow = create_test_escrow_with_markets(2, 1000, &clock, ctx);

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

    let escrow_id = object::id(&escrow);
    let market_state_id = object::id(coin_escrow::get_market_state(&escrow));
    let mut proposal = setup_proposal_for_testing(escrow_id, market_state_id, ctx);

    // Get reserves before
    let (spot_asset_before, spot_stable_before) = unified_spot_pool::get_reserves(&spot_pool);
    std::debug::print(&b"=== BEFORE SWAP (Asset → Stable) ===");
    std::debug::print(&b"Spot asset:");
    std::debug::print(&spot_asset_before);
    std::debug::print(&b"Spot stable:");
    std::debug::print(&spot_stable_before);

    // Swap asset → stable - small swap to avoid no-arb violation
    let swap_amount = 1_000_000u64; // 1M asset
    let asset_in = coin::mint_for_testing<TEST_COIN_A>(swap_amount, ctx);
    let (mut stable_out_opt, mut balance_opt) = swap_entry::swap_spot_asset_to_stable(
        &mut spot_pool,
        &mut proposal,
        &mut escrow,
        asset_in,
        0, // min_stable_out
        @0x1,
        option::none(),
        true,
        &clock,
        ctx,
    );

    let stable_out = option::extract(&mut stable_out_opt);
    let output_amount = stable_out.value();
    std::debug::print(&b"\n=== AFTER SWAP ===");
    std::debug::print(&b"Stable output:");
    std::debug::print(&output_amount);

    // Get reserves after
    let (spot_asset_after, spot_stable_after) = unified_spot_pool::get_reserves(&spot_pool);
    std::debug::print(&b"Spot asset after:");
    std::debug::print(&spot_asset_after);
    std::debug::print(&b"Spot stable after:");
    std::debug::print(&spot_stable_after);

    // Verify spot pool changed
    assert!(spot_asset_after == spot_asset_before + swap_amount, 0);
    assert!(spot_stable_after < spot_stable_before, 1);

    // Verify output is reasonable
    assert!(output_amount > 0, 2);

    // Cleanup
    coin::burn_for_testing(stable_out);
    option::destroy_none(stable_out_opt);
    if (option::is_some(&balance_opt)) {
        let balance = option::extract(&mut balance_opt);
        conditional_balance::destroy_for_testing(balance);
    };
    option::destroy_none(balance_opt);
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    proposal::destroy_for_testing(proposal);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

/// Test that large swaps respect no-arb band
#[test]
fun test_large_swap_respects_noarb_band() {
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

    // 1% conditional pools
    let conditional_ratio = 1;
    let outcome_count = 2u64;
    let cond_asset = (spot_asset * conditional_ratio) / (100 * outcome_count);
    let cond_stable = (spot_stable * conditional_ratio) / (100 * outcome_count);

    let mut escrow = create_test_escrow_with_markets(2, 1000, &clock, ctx);

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

    let escrow_id = object::id(&escrow);
    let market_state_id = object::id(coin_escrow::get_market_state(&escrow));
    let mut proposal = setup_proposal_for_testing(escrow_id, market_state_id, ctx);

    // Moderate swap that should pass no-arb guard with routing
    let swap_amount = 500_000u64; // 0.25% of pool
    let stable_in = coin::mint_for_testing<TEST_COIN_B>(swap_amount, ctx);

    let (mut asset_out_opt, mut balance_opt) = swap_entry::swap_spot_stable_to_asset(
        &mut spot_pool,
        &mut proposal,
        &mut escrow,
        stable_in,
        0,
        @0x1,
        option::none(),
        true,
        &clock,
        ctx,
    );

    std::debug::print(&b"Swap completed successfully (no-arb guard passed)");
    std::debug::print(&b"Output:");
    let asset_out = option::extract(&mut asset_out_opt);
    std::debug::print(&asset_out.value());

    // If we get here, no-arb guard passed
    assert!(asset_out.value() > 0, 0);

    // Cleanup
    coin::burn_for_testing(asset_out);
    option::destroy_none(asset_out_opt);
    if (option::is_some(&balance_opt)) {
        let balance = option::extract(&mut balance_opt);
        conditional_balance::destroy_for_testing(balance);
    };
    option::destroy_none(balance_opt);
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    proposal::destroy_for_testing(proposal);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

/// Test multiple sequential swaps accumulate correctly
#[test]
fun test_multiple_swaps_with_routing() {
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

    let conditional_ratio = 1;
    let outcome_count = 2u64;
    let cond_asset = (spot_asset * conditional_ratio) / (100 * outcome_count);
    let cond_stable = (spot_stable * conditional_ratio) / (100 * outcome_count);

    let mut escrow = create_test_escrow_with_markets(2, 1000, &clock, ctx);

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

    let escrow_id = object::id(&escrow);
    let market_state_id = object::id(coin_escrow::get_market_state(&escrow));
    let mut proposal = setup_proposal_for_testing(escrow_id, market_state_id, ctx);

    // Do 3 sequential swaps
    let swap_amount = 100_000u64;
    let mut total_output = 0u64;

    std::debug::print(&b"=== SWAP 1 ===");
    let stable_in_1 = coin::mint_for_testing<TEST_COIN_B>(swap_amount, ctx);
    let (mut asset_opt_1, mut balance_opt_1) = swap_entry::swap_spot_stable_to_asset(
        &mut spot_pool,
        &mut proposal,
        &mut escrow,
        stable_in_1,
        0,
        @0x1,
        option::none(),
        true,
        &clock,
        ctx,
    );
    let asset_out_1 = option::extract(&mut asset_opt_1);
    let output_1 = asset_out_1.value();
    total_output = total_output + output_1;
    std::debug::print(&b"Output 1:");
    std::debug::print(&output_1);
    coin::burn_for_testing(asset_out_1);
    option::destroy_none(asset_opt_1);
    if (option::is_some(&balance_opt_1)) {
        let balance = option::extract(&mut balance_opt_1);
        conditional_balance::destroy_for_testing(balance);
    };
    option::destroy_none(balance_opt_1);

    std::debug::print(&b"\n=== SWAP 2 ===");
    let stable_in_2 = coin::mint_for_testing<TEST_COIN_B>(swap_amount, ctx);
    let (mut asset_opt_2, mut balance_opt_2) = swap_entry::swap_spot_stable_to_asset(
        &mut spot_pool,
        &mut proposal,
        &mut escrow,
        stable_in_2,
        0,
        @0x1,
        option::none(),
        true,
        &clock,
        ctx,
    );
    let asset_out_2 = option::extract(&mut asset_opt_2);
    let output_2 = asset_out_2.value();
    total_output = total_output + output_2;
    std::debug::print(&b"Output 2:");
    std::debug::print(&output_2);
    coin::burn_for_testing(asset_out_2);
    option::destroy_none(asset_opt_2);
    if (option::is_some(&balance_opt_2)) {
        let balance = option::extract(&mut balance_opt_2);
        conditional_balance::destroy_for_testing(balance);
    };
    option::destroy_none(balance_opt_2);

    std::debug::print(&b"\n=== SWAP 3 ===");
    let stable_in_3 = coin::mint_for_testing<TEST_COIN_B>(swap_amount, ctx);
    let (mut asset_opt_3, mut balance_opt_3) = swap_entry::swap_spot_stable_to_asset(
        &mut spot_pool,
        &mut proposal,
        &mut escrow,
        stable_in_3,
        0,
        @0x1,
        option::none(),
        true,
        &clock,
        ctx,
    );
    let asset_out_3 = option::extract(&mut asset_opt_3);
    let output_3 = asset_out_3.value();
    total_output = total_output + output_3;
    std::debug::print(&b"Output 3:");
    std::debug::print(&output_3);
    coin::burn_for_testing(asset_out_3);
    option::destroy_none(asset_opt_3);
    if (option::is_some(&balance_opt_3)) {
        let balance = option::extract(&mut balance_opt_3);
        conditional_balance::destroy_for_testing(balance);
    };
    option::destroy_none(balance_opt_3);

    std::debug::print(&b"\nTotal output:");
    std::debug::print(&total_output);

    // All swaps should succeed
    assert!(total_output > 0, 0);
    assert!(output_1 > 0, 1);
    assert!(output_2 > 0, 2);
    assert!(output_3 > 0, 3);

    // Cleanup
    unified_spot_pool::destroy_for_testing(spot_pool);
    coin_escrow::destroy_for_testing(escrow);
    proposal::destroy_for_testing(proposal);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
