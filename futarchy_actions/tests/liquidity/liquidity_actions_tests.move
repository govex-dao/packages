// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_actions::liquidity_actions_tests;

use futarchy_actions::liquidity_actions;
use sui::test_utils::destroy;
use sui::object;
use sui::test_scenario::{Self as ts, Scenario};

// === Constants ===

const OWNER: address = @0xCAFE;

// Test IDs
const POOL_ID_BYTES: address = @0x1111111111111111111111111111111111111111111111111111111111111111;
const TOKEN_ID_BYTES: address = @0x2222222222222222222222222222222222222222222222222222222222222222;

// === Test Structs ===

public struct TestAsset has drop {}
public struct TestStable has drop {}

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

fun token_id(): object::ID {
    object::id_from_address(TOKEN_ID_BYTES)
}

// === CreatePool Action Tests ===

#[test]
/// Test creating a valid pool action
fun test_new_create_pool_action() {
    let action = liquidity_actions::new_create_pool_action<TestAsset, TestStable>(
        1000u64,       // initial_asset_amount
        2000u64,       // initial_stable_amount
        30u64,         // fee_bps (0.3%)
        1000u64,       // minimum_liquidity
        50u64,         // conditional_liquidity_ratio_percent
    );

    // Verify getters
    assert!(liquidity_actions::get_initial_asset_amount(&action) == 1000, 0);
    assert!(liquidity_actions::get_initial_stable_amount(&action) == 2000, 1);
    assert!(liquidity_actions::get_fee_bps(&action) == 30, 2);
    assert!(liquidity_actions::get_minimum_liquidity(&action) == 1000, 3);

    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero asset amount
fun test_new_create_pool_zero_asset_fails() {
    let action = liquidity_actions::new_create_pool_action<TestAsset, TestStable>(
        0u64,          // zero asset amount
        2000u64,
        30u64,
        1000u64,
        50u64,         // conditional_liquidity_ratio_percent
    );
    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero stable amount
fun test_new_create_pool_zero_stable_fails() {
    let action = liquidity_actions::new_create_pool_action<TestAsset, TestStable>(
        1000u64,
        0u64,          // zero stable amount
        30u64,
        1000u64,
        50u64,         // conditional_liquidity_ratio_percent
    );
    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidRatio)]
/// Test fails with invalid fee_bps (> 10000)
fun test_new_create_pool_invalid_fee_fails() {
    let action = liquidity_actions::new_create_pool_action<TestAsset, TestStable>(
        1000u64,
        2000u64,
        10001u64,      // > 100%
        1000u64,
        50u64,         // conditional_liquidity_ratio_percent
    );
    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero minimum_liquidity
fun test_new_create_pool_zero_min_liquidity_fails() {
    let action = liquidity_actions::new_create_pool_action<TestAsset, TestStable>(
        1000u64,
        2000u64,
        30u64,
        0u64,          // zero minimum_liquidity
        50u64,         // conditional_liquidity_ratio_percent
    );
    destroy(action);
}

#[test]
/// Test with extreme values
fun test_new_create_pool_extreme_values() {
    let action = liquidity_actions::new_create_pool_action<TestAsset, TestStable>(
        18446744073709551615u64,  // max u64
        18446744073709551615u64,  // max u64
        10000u64,                  // max fee (100%)
        1u64,                      // min liquidity
        50u64,                     // conditional_liquidity_ratio_percent
    );

    destroy(action);
}

// === UpdatePoolParams Action Tests ===

#[test]
/// Test creating valid update pool params action
fun test_new_update_pool_params_action() {
    let action = liquidity_actions::new_update_pool_params_action(
        pool_id(),
        50u64,         // new_fee_bps (0.5%)
        2000u64,       // new_minimum_liquidity
    );

    // Verify getters
    assert!(liquidity_actions::get_update_pool_id(&action) == pool_id(), 0);
    assert!(liquidity_actions::get_new_fee_bps(&action) == 50, 1);
    assert!(liquidity_actions::get_new_minimum_liquidity(&action) == 2000, 2);

    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidRatio)]
/// Test fails with invalid fee_bps
fun test_new_update_pool_params_invalid_fee_fails() {
    let action = liquidity_actions::new_update_pool_params_action(
        pool_id(),
        10001u64,      // > 100%
        2000u64,
    );
    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero minimum_liquidity
fun test_new_update_pool_params_zero_min_liquidity_fails() {
    let action = liquidity_actions::new_update_pool_params_action(
        pool_id(),
        50u64,
        0u64,          // zero minimum_liquidity
    );
    destroy(action);
}

// === AddLiquidity Action Tests ===

#[test]
/// Test creating valid add liquidity action
fun test_new_add_liquidity_action() {
    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable>(
        pool_id(),
        1000u64,       // asset_amount
        2000u64,       // stable_amount
        500u64,        // min_lp_out
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
    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable>(
        pool_id(),
        0u64,          // zero asset
        2000u64,
        500u64,
    );
    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero stable amount
fun test_new_add_liquidity_zero_stable_fails() {
    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable>(
        pool_id(),
        1000u64,
        0u64,          // zero stable
        500u64,
    );
    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero min_lp_out
fun test_new_add_liquidity_zero_min_lp_fails() {
    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable>(
        pool_id(),
        1000u64,
        2000u64,
        0u64,          // zero min_lp_out
    );
    destroy(action);
}

// === WithdrawLpToken Action Tests ===

#[test]
/// Test creating valid withdraw LP token action
fun test_new_withdraw_lp_token_action() {
    let action = liquidity_actions::new_withdraw_lp_token_action<TestAsset, TestStable>(
        pool_id(),
        token_id(),
    );

    // Verify getters
    assert!(liquidity_actions::get_withdraw_pool_id(&action) == pool_id(), 0);
    assert!(liquidity_actions::get_withdraw_token_id(&action) == token_id(), 1);

    destroy(action);
}

// === RemoveLiquidity Action Tests ===

#[test]
/// Test creating valid remove liquidity action
fun test_new_remove_liquidity_action() {
    let action = liquidity_actions::new_remove_liquidity_action<TestAsset, TestStable>(
        pool_id(),
        token_id(),
        1000u64,       // lp_amount
        500u64,        // min_asset_amount
        600u64,        // min_stable_amount
    );

    // Verify getters
    assert!(liquidity_actions::get_remove_pool_id(&action) == pool_id(), 0);
    assert!(liquidity_actions::get_remove_token_id(&action) == token_id(), 1);
    assert!(liquidity_actions::get_lp_amount(&action) == 1000, 2);
    assert!(liquidity_actions::get_min_asset_amount(&action) == 500, 3);
    assert!(liquidity_actions::get_min_stable_amount(&action) == 600, 4);
    assert!(!liquidity_actions::get_bypass_minimum(&action), 5);

    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero lp_amount
fun test_new_remove_liquidity_zero_lp_fails() {
    let action = liquidity_actions::new_remove_liquidity_action<TestAsset, TestStable>(
        pool_id(),
        token_id(),
        0u64,          // zero lp_amount
        500u64,
        600u64,
    );
    destroy(action);
}

#[test]
/// Test remove liquidity with zero minimums (valid for slippage tolerance)
fun test_new_remove_liquidity_zero_minimums() {
    let action = liquidity_actions::new_remove_liquidity_action<TestAsset, TestStable>(
        pool_id(),
        token_id(),
        1000u64,
        0u64,          // zero min_asset (high slippage tolerance)
        0u64,          // zero min_stable (high slippage tolerance)
    );

    assert!(liquidity_actions::get_min_asset_amount(&action) == 0, 0);
    assert!(liquidity_actions::get_min_stable_amount(&action) == 0, 1);

    destroy(action);
}

// === Swap Action Tests ===

#[test]
/// Test creating valid swap action (asset for stable)
fun test_new_swap_action_asset_to_stable() {
    let action = liquidity_actions::new_swap_action<TestAsset, TestStable>(
        pool_id(),
        true,          // swap_asset = true (asset → stable)
        1000u64,       // amount_in
        900u64,        // min_amount_out
    );

    destroy(action);
}

#[test]
/// Test creating valid swap action (stable for asset)
fun test_new_swap_action_stable_to_asset() {
    let action = liquidity_actions::new_swap_action<TestAsset, TestStable>(
        pool_id(),
        false,         // swap_asset = false (stable → asset)
        2000u64,       // amount_in
        1800u64,       // min_amount_out
    );

    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero amount_in
fun test_new_swap_action_zero_amount_in_fails() {
    let action = liquidity_actions::new_swap_action<TestAsset, TestStable>(
        pool_id(),
        true,
        0u64,          // zero amount_in
        900u64,
    );
    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with zero min_amount_out
fun test_new_swap_action_zero_min_out_fails() {
    let action = liquidity_actions::new_swap_action<TestAsset, TestStable>(
        pool_id(),
        true,
        1000u64,
        0u64,          // zero min_amount_out
    );
    destroy(action);
}

// === CollectFees Action Tests ===

#[test]
/// Test creating valid collect fees action
fun test_new_collect_fees_action() {
    let action = liquidity_actions::new_collect_fees_action<TestAsset, TestStable>(
        pool_id(),
    );

    destroy(action);
}

// === WithdrawFees Action Tests ===

#[test]
/// Test creating valid withdraw fees action (both amounts)
fun test_new_withdraw_fees_action_both() {
    let action = liquidity_actions::new_withdraw_fees_action<TestAsset, TestStable>(
        pool_id(),
        100u64,        // asset_amount
        200u64,        // stable_amount
    );

    destroy(action);
}

#[test]
/// Test withdraw fees with only asset amount
fun test_new_withdraw_fees_action_asset_only() {
    let action = liquidity_actions::new_withdraw_fees_action<TestAsset, TestStable>(
        pool_id(),
        100u64,        // asset_amount
        0u64,          // no stable
    );

    destroy(action);
}

#[test]
/// Test withdraw fees with only stable amount
fun test_new_withdraw_fees_action_stable_only() {
    let action = liquidity_actions::new_withdraw_fees_action<TestAsset, TestStable>(
        pool_id(),
        0u64,          // no asset
        200u64,        // stable_amount
    );

    destroy(action);
}

#[test]
#[expected_failure(abort_code = liquidity_actions::EInvalidAmount)]
/// Test fails with both amounts zero
fun test_new_withdraw_fees_action_both_zero_fails() {
    let action = liquidity_actions::new_withdraw_fees_action<TestAsset, TestStable>(
        pool_id(),
        0u64,          // zero asset
        0u64,          // zero stable
    );
    destroy(action);
}

// === Destruction Function Tests ===

#[test]
/// Test destroy functions work correctly
fun test_destruction_functions() {
    let create_pool = liquidity_actions::new_create_pool_action<TestAsset, TestStable>(
        1000u64, 2000u64, 30u64, 1000u64, 50u64
    );
    liquidity_actions::destroy_create_pool_action(create_pool);

    let update_params = liquidity_actions::new_update_pool_params_action(
        pool_id(), 50u64, 2000u64
    );
    liquidity_actions::destroy_update_pool_params_action(update_params);

    let add_liq = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable>(
        pool_id(), 1000u64, 2000u64, 500u64
    );
    liquidity_actions::destroy_add_liquidity_action(add_liq);

    let remove_liq = liquidity_actions::new_remove_liquidity_action<TestAsset, TestStable>(
        pool_id(), token_id(), 1000u64, 500u64, 600u64
    );
    liquidity_actions::destroy_remove_liquidity_action(remove_liq);

    let withdraw_lp = liquidity_actions::new_withdraw_lp_token_action<TestAsset, TestStable>(
        pool_id(), token_id()
    );
    liquidity_actions::destroy_withdraw_lp_token_action(withdraw_lp);

    let swap = liquidity_actions::new_swap_action<TestAsset, TestStable>(
        pool_id(), true, 1000u64, 900u64
    );
    liquidity_actions::destroy_swap_action(swap);

    let collect = liquidity_actions::new_collect_fees_action<TestAsset, TestStable>(
        pool_id()
    );
    liquidity_actions::destroy_collect_fees_action(collect);

    let withdraw = liquidity_actions::new_withdraw_fees_action<TestAsset, TestStable>(
        pool_id(), 100u64, 200u64
    );
    liquidity_actions::destroy_withdraw_fees_action(withdraw);
}

// === Edge Cases ===

#[test]
/// Test with maximum u64 values
fun test_extreme_values() {
    let max_u64 = 18446744073709551615u64;

    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable>(
        pool_id(),
        max_u64,
        max_u64,
        max_u64,
    );

    assert!(liquidity_actions::get_asset_amount(&action) == max_u64, 0);
    assert!(liquidity_actions::get_stable_amount(&action) == max_u64, 1);

    destroy(action);
}

#[test]
/// Test with minimum valid values
fun test_minimum_values() {
    let action = liquidity_actions::new_add_liquidity_action<TestAsset, TestStable>(
        pool_id(),
        1u64,          // minimum asset
        1u64,          // minimum stable
        1u64,          // minimum lp
    );

    assert!(liquidity_actions::get_asset_amount(&action) == 1, 0);
    assert!(liquidity_actions::get_stable_amount(&action) == 1, 1);
    assert!(liquidity_actions::get_min_lp_amount(&action) == 1, 2);

    destroy(action);
}
