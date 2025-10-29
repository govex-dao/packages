// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_actions::quota_actions_tests;

use futarchy_actions::quota_actions;
use sui::test_utils::destroy;

// === Constants ===

const USER1: address = @0xBEEF;
const USER2: address = @0xDEAD;

// === Tests ===

#[test]
/// Test creating a SetQuotas action with multiple users
fun test_new_set_quotas() {
    let users = vector[USER1, USER2];
    let quota_amount = 5u64;
    let quota_period_ms = 2592000000u64; // 30 days
    let reduced_fee = 100u64;
    let sponsor_quota_amount = 3u64;

    let action = quota_actions::new_set_quotas(
        users,
        quota_amount,
        quota_period_ms,
        reduced_fee,
        sponsor_quota_amount,
    );

    // Verify getters
    assert!(quota_actions::users(&action).length() == 2, 0);
    assert!(quota_actions::quota_amount(&action) == quota_amount, 1);
    assert!(quota_actions::quota_period_ms(&action) == quota_period_ms, 2);
    assert!(quota_actions::reduced_fee(&action) == reduced_fee, 3);
    assert!(quota_actions::sponsor_quota_amount(&action) == sponsor_quota_amount, 4);

    destroy(action);
}

#[test]
/// Test creating a quota removal action (quota_amount = 0)
fun test_new_set_quotas_removal() {
    let users = vector[USER1];

    let action = quota_actions::new_set_quotas(
        users,
        0u64, // quota_amount = 0 means removal
        2592000000u64,
        0u64,
        0u64,
    );

    assert!(quota_actions::quota_amount(&action) == 0, 0);
    assert!(quota_actions::users(&action).length() == 1, 1);

    destroy(action);
}

#[test]
/// Test creating action with empty user list
fun test_new_set_quotas_empty_list() {
    let action = quota_actions::new_set_quotas(
        vector[], // empty users
        5u64,
        2592000000u64,
        100u64,
        3u64,
    );

    assert!(quota_actions::users(&action).length() == 0, 0);

    destroy(action);
}

#[test]
/// Test creating action with single user
fun test_new_set_quotas_single_user() {
    let users = vector[USER1];

    let action = quota_actions::new_set_quotas(
        users,
        10u64,
        2592000000u64,
        200u64,
        5u64,
    );

    assert!(quota_actions::users(&action).length() == 1, 0);
    assert!(*quota_actions::users(&action).borrow(0) == USER1, 1);

    destroy(action);
}

#[test]
/// Test creating action with different quota parameters
fun test_new_set_quotas_various_params() {
    // Test with free tier (reduced_fee = 0)
    let action1 = quota_actions::new_set_quotas(
        vector[USER1],
        5u64,
        2592000000u64,
        0u64, // free
        0u64, // no sponsor quota
    );
    assert!(quota_actions::reduced_fee(&action1) == 0, 0);
    assert!(quota_actions::sponsor_quota_amount(&action1) == 0, 1);
    destroy(action1);

    // Test with large quota period (90 days)
    let action2 = quota_actions::new_set_quotas(
        vector[USER1],
        20u64,
        7776000000u64, // 90 days
        500u64,
        10u64,
    );
    assert!(quota_actions::quota_period_ms(&action2) == 7776000000, 2);
    destroy(action2);

    // Test with high quota amount
    let action3 = quota_actions::new_set_quotas(
        vector[USER1],
        1000u64, // high quota
        2592000000u64,
        50u64,
        500u64,
    );
    assert!(quota_actions::quota_amount(&action3) == 1000, 3);
    destroy(action3);
}
