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
public struct LP has drop {}

const ADMIN: address = @0xAD;
const TRADER: address = @0xB0B;
const DAO: address = @0xDA0;

const ONE_ASSET: u64 = 1_000_000_000; // 1 token with 9 decimals
const ONE_STABLE: u64 = 1_000_000_000;

// === Test Helpers ===

fun create_lp_treasury(ctx: &mut TxContext): coin::TreasuryCap<LP> {
    coin::create_treasury_cap_for_testing<LP>(ctx)
}

fun setup_spot_pool(scenario: &mut Scenario): (UnifiedSpotPool<ASSET, STABLE, LP>, ID) {
    let ctx = ts::ctx(scenario);
    let pool_id = object::id_from_address(@0x1234);
    let lp_treasury = create_lp_treasury(ctx);

    // Create spot pool with 1000 asset and 1000 stable
    let spot_pool = unified_spot_pool::create_pool_for_testing<ASSET, STABLE, LP>(
        lp_treasury,
        1000 * ONE_ASSET,
        1000 * ONE_STABLE,
        30, // 0.3% fee
        ctx,
    );

    (spot_pool, pool_id)
}

fun setup_escrow_with_markets(
    scenario: &mut Scenario,
    num_outcomes: u8,
): TokenEscrow<ASSET, STABLE> {
    let ctx = ts::ctx(scenario);

    // Create escrow with market state
    let mut escrow = coin_escrow::create_for_testing<ASSET, STABLE>(
        (num_outcomes as u64),
        30, // 0.3% fee
        ctx,
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

// NOTE: test_fails_if_fees_not_backed_by_escrow was removed because:
// 1. It had an empty block that didn't actually set up the failure condition
// 2. There's no public API to maliciously add liquidity without escrow backing
// 3. The escrow withdrawal safety is enforced by the escrow module's balance checks
// If this test is needed, it would require exposing test-only functions to create invalid state
