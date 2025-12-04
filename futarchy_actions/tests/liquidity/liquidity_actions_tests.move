// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_actions::liquidity_actions_tests;

use futarchy_actions::liquidity_actions;
use sui::object;
use sui::test_scenario::{Self as ts, Scenario};
use sui::test_utils::destroy;

// === Constants ===

const OWNER: address = @0xCAFE;

// Test IDs
const POOL_ID_BYTES: address = @0x1111111111111111111111111111111111111111111111111111111111111111;

// === Test Structs ===

public struct TestAsset has drop {}
public struct TestStable has drop {}
public struct TestLP has drop {}

// === Helper Functions ===

fun start(): Scenario {
    ts::begin(OWNER)
}

fun end(scenario: Scenario) {
    ts::end(scenario);
}

fun pool_id(): object::ID {
    object::id_from_address(POOL_ID_BYTES)
}

// === AddLiquidity Action Tests ===

#[test]
/// Test creating valid add liquidity action
fun test_new_add_liquidity_action() {
    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        1000u64, // asset_amount
        2000u64, // stable_amount
        500u64, // min_lp_out
    );

    // Verify getters
    assert!(liquidity_actions::get_pool_id(&action) == pool_id(), 0);
    assert!(liquidity_actions::get_asset_amount(&action) == 1000, 1);
    assert!(liquidity_actions::get_stable_amount(&action) == 2000, 2);
    assert!(liquidity_actions::get_min_lp_amount(&action) == 500, 3);

    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero asset amount
fun test_new_add_liquidity_zero_asset_fails() {
    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        0u64, // zero asset
        2000u64,
        500u64,
    );
    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero stable amount
fun test_new_add_liquidity_zero_stable_fails() {
    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        1000u64,
        0u64, // zero stable
        500u64,
    );
    destroy(action);
}

#[test]
/// Test add liquidity with extreme values
fun test_new_add_liquidity_extreme_values() {
    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        18446744073709551615u64, // max u64
        18446744073709551615u64, // max u64
        0u64, // min_lp_out can be 0
    );

    destroy(action);
}

// === RemoveLiquidity Action Tests ===

#[test]
/// Test creating valid remove liquidity action
fun test_new_remove_liquidity_action() {
    let action = liquidity_actions::new_remove_liquidity_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        1000u64, // lp_amount
        500u64, // min_asset_amount
        500u64, // min_stable_amount
    );

    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero lp amount
fun test_new_remove_liquidity_zero_lp_fails() {
    let action = liquidity_actions::new_remove_liquidity_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        0u64, // zero lp_amount
        500u64,
        500u64,
    );
    destroy(action);
}

#[test]
/// Test remove liquidity with zero minimums (no slippage protection)
fun test_new_remove_liquidity_zero_minimums() {
    let action = liquidity_actions::new_remove_liquidity_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        1000u64,
        0u64, // zero min_asset_amount is allowed
        0u64, // zero min_stable_amount is allowed
    );

    destroy(action);
}

// === Swap Action Tests ===

#[test]
/// Test creating valid swap action (asset to stable)
fun test_new_swap_action_asset_to_stable() {
    let action = liquidity_actions::new_swap_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        true, // swap_asset = true means asset -> stable
        1000u64, // amount_in
        500u64, // min_amount_out
    );

    destroy(action);
}

#[test]
/// Test creating valid swap action (stable to asset)
fun test_new_swap_action_stable_to_asset() {
    let action = liquidity_actions::new_swap_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        false, // swap_asset = false means stable -> asset
        2000u64, // amount_in
        1000u64, // min_amount_out
    );

    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero amount_in
fun test_new_swap_action_zero_amount_fails() {
    let action = liquidity_actions::new_swap_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        true,
        0u64, // zero amount_in
        500u64,
    );
    destroy(action);
}

#[test]
/// Test swap with zero min_amount_out (no slippage protection)
fun test_new_swap_action_zero_min_out() {
    let action = liquidity_actions::new_swap_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        true,
        1000u64,
        0u64, // zero min_amount_out is allowed
    );

    destroy(action);
}

#[test]
/// Test swap with extreme values
fun test_new_swap_action_extreme_values() {
    let action = liquidity_actions::new_swap_action<TestAsset, TestStable, TestLP>(
        pool_id(),
        true,
        18446744073709551615u64, // max u64
        18446744073709551615u64, // max u64
    );

    destroy(action);
}

// === Marker Function Tests ===

#[test]
/// Test marker functions
fun test_marker_functions() {
    let _add = liquidity_actions::add_liquidity_marker();
    let _remove = liquidity_actions::remove_liquidity_marker();
    let _swap = liquidity_actions::swap_marker();
}
