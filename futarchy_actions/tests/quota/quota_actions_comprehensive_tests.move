// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_actions::quota_actions_comprehensive_tests;

use futarchy_actions::quota_actions;
use sui::test_utils::destroy;

// === Constants ===

const USER1: address = @0xBEEF;
const USER2: address = @0xDEAD;
const USER3: address = @0xCAFE;
const USER4: address = @0xFACE;

// === Constructor Tests ===

#[test]
/// Test creating a SetQuotas action with single user
fun test_new_set_quotas_single_user() {
    let users = vector[USER1];
    let action = quota_actions::new_set_quotas(
        users,
        5u64,                      // quota_amount
        2592000000u64,             // quota_period_ms (30 days)
        100u64,                    // reduced_fee
        3u64,                      // sponsor_quota_amount
    );

    assert!(quota_actions::users(&action).length() == 1, 0);
    assert!(quota_actions::quota_amount(&action) == 5, 1);
    assert!(quota_actions::quota_period_ms(&action) == 2592000000, 2);
    assert!(quota_actions::reduced_fee(&action) == 100, 3);
    assert!(quota_actions::sponsor_quota_amount(&action) == 3, 4);

    destroy(action);
}

#[test]
/// Test creating action with multiple users
fun test_new_set_quotas_multiple_users() {
    let users = vector[USER1, USER2, USER3, USER4];
    let action = quota_actions::new_set_quotas(
        users,
        10u64,                     // quota_amount
        2592000000u64,             // quota_period_ms
        50u64,                     // reduced_fee
        5u64,                      // sponsor_quota_amount
    );

    assert!(quota_actions::users(&action).length() == 4, 0);
    assert!(*quota_actions::users(&action).borrow(0) == USER1, 1);
    assert!(*quota_actions::users(&action).borrow(1) == USER2, 2);
    assert!(*quota_actions::users(&action).borrow(2) == USER3, 3);
    assert!(*quota_actions::users(&action).borrow(3) == USER4, 4);

    destroy(action);
}

#[test]
/// Test quota removal (quota_amount = 0)
fun test_new_set_quotas_removal() {
    let users = vector[USER1, USER2];
    let action = quota_actions::new_set_quotas(
        users,
        0u64,                      // quota_amount = 0 means removal
        0u64,                      // period ignored when removing
        0u64,                      // fee ignored when removing
        0u64,                      // sponsor quota ignored when removing
    );

    assert!(quota_actions::quota_amount(&action) == 0, 0);
    assert!(quota_actions::users(&action).length() == 2, 1);

    destroy(action);
}

#[test]
/// Test with empty user list
fun test_new_set_quotas_empty_users() {
    let action = quota_actions::new_set_quotas(
        vector[],                  // empty users list
        5u64,
        2592000000u64,
        100u64,
        3u64,
    );

    assert!(quota_actions::users(&action).length() == 0, 0);

    destroy(action);
}

#[test]
/// Test with zero reduced_fee (free tier)
fun test_new_set_quotas_free_tier() {
    let users = vector[USER1];
    let action = quota_actions::new_set_quotas(
        users,
        5u64,
        2592000000u64,
        0u64,                      // free tier
        0u64,                      // no sponsor quota
    );

    assert!(quota_actions::reduced_fee(&action) == 0, 0);
    assert!(quota_actions::sponsor_quota_amount(&action) == 0, 1);

    destroy(action);
}

#[test]
/// Test with zero sponsor_quota_amount
fun test_new_set_quotas_no_sponsorship() {
    let users = vector[USER1];
    let action = quota_actions::new_set_quotas(
        users,
        5u64,
        2592000000u64,
        100u64,
        0u64,                      // no sponsor quota
    );

    assert!(quota_actions::sponsor_quota_amount(&action) == 0, 0);

    destroy(action);
}

// === Getter Tests ===

#[test]
/// Test all getters return correct values
fun test_getters_comprehensive() {
    let users = vector[USER1, USER2];
    let action = quota_actions::new_set_quotas(
        users,
        10u64,
        2592000000u64,
        200u64,
        5u64,
    );

    // Test all getters
    let users_ref = quota_actions::users(&action);
    assert!(users_ref.length() == 2, 0);
    assert!(*users_ref.borrow(0) == USER1, 1);
    assert!(*users_ref.borrow(1) == USER2, 2);

    assert!(quota_actions::quota_amount(&action) == 10, 3);
    assert!(quota_actions::quota_period_ms(&action) == 2592000000, 4);
    assert!(quota_actions::reduced_fee(&action) == 200, 5);
    assert!(quota_actions::sponsor_quota_amount(&action) == 5, 6);

    destroy(action);
}

// === Various Quota Configurations ===

#[test]
/// Test with short quota period (1 day)
fun test_new_set_quotas_short_period() {
    let users = vector[USER1];
    let action = quota_actions::new_set_quotas(
        users,
        3u64,
        86400000u64,               // 1 day
        50u64,
        1u64,
    );

    assert!(quota_actions::quota_period_ms(&action) == 86400000, 0);

    destroy(action);
}

#[test]
/// Test with long quota period (90 days)
fun test_new_set_quotas_long_period() {
    let users = vector[USER1];
    let action = quota_actions::new_set_quotas(
        users,
        20u64,
        7776000000u64,             // 90 days
        500u64,
        10u64,
    );

    assert!(quota_actions::quota_period_ms(&action) == 7776000000, 0);
    assert!(quota_actions::quota_amount(&action) == 20, 1);

    destroy(action);
}

#[test]
/// Test with high quota amount
fun test_new_set_quotas_high_quota() {
    let users = vector[USER1];
    let action = quota_actions::new_set_quotas(
        users,
        1000u64,                   // very high quota
        2592000000u64,
        50u64,
        500u64,                    // high sponsor quota
    );

    assert!(quota_actions::quota_amount(&action) == 1000, 0);
    assert!(quota_actions::sponsor_quota_amount(&action) == 500, 1);

    destroy(action);
}

#[test]
/// Test with high reduced fee
fun test_new_set_quotas_high_fee() {
    let users = vector[USER1];
    let action = quota_actions::new_set_quotas(
        users,
        5u64,
        2592000000u64,
        10000u64,                  // high fee
        3u64,
    );

    assert!(quota_actions::reduced_fee(&action) == 10000, 0);

    destroy(action);
}

// === Edge Cases ===

#[test]
/// Test with maximum u64 values
fun test_new_set_quotas_extreme_values() {
    let users = vector[USER1];
    let max_u64 = 18446744073709551615u64;

    let action = quota_actions::new_set_quotas(
        users,
        max_u64,                   // max quota
        max_u64,                   // max period
        max_u64,                   // max fee
        max_u64,                   // max sponsor quota
    );

    assert!(quota_actions::quota_amount(&action) == max_u64, 0);
    assert!(quota_actions::quota_period_ms(&action) == max_u64, 1);
    assert!(quota_actions::reduced_fee(&action) == max_u64, 2);
    assert!(quota_actions::sponsor_quota_amount(&action) == max_u64, 3);

    destroy(action);
}

#[test]
/// Test with minimum valid values
fun test_new_set_quotas_minimum_values() {
    let users = vector[USER1];

    let action = quota_actions::new_set_quotas(
        users,
        1u64,                      // minimum quota
        1u64,                      // minimum period
        0u64,                      // free
        0u64,                      // no sponsor quota
    );

    assert!(quota_actions::quota_amount(&action) == 1, 0);
    assert!(quota_actions::quota_period_ms(&action) == 1, 1);

    destroy(action);
}

#[test]
/// Test with many users
fun test_new_set_quotas_many_users() {
    let mut users = vector[];
    // Add various predefined addresses
    users.push_back(@0x1); users.push_back(@0x2); users.push_back(@0x3);
    users.push_back(@0x4); users.push_back(@0x5); users.push_back(@0x6);
    users.push_back(@0x7); users.push_back(@0x8); users.push_back(@0x9);
    users.push_back(@0xa); users.push_back(@0xb); users.push_back(@0xc);
    users.push_back(@0xd); users.push_back(@0xe); users.push_back(@0xf);
    users.push_back(@0x10); users.push_back(@0x11); users.push_back(@0x12);
    users.push_back(@0x13); users.push_back(@0x14); users.push_back(@0x15);
    users.push_back(@0x16); users.push_back(@0x17); users.push_back(@0x18);
    users.push_back(@0x19); users.push_back(@0x1a); users.push_back(@0x1b);

    let action = quota_actions::new_set_quotas(
        users,
        5u64,
        2592000000u64,
        100u64,
        3u64,
    );

    assert!(quota_actions::users(&action).length() == 27, 0);

    destroy(action);
}

// === Realistic Scenarios ===

#[test]
/// Scenario 1: Set up a VIP tier with high quota and low fee
fun test_scenario_vip_tier() {
    let users = vector[USER1, USER2];
    let action = quota_actions::new_set_quotas(
        users,
        20u64,                     // 20 proposals per month
        2592000000u64,             // 30 days
        10u64,                     // very low fee
        10u64,                     // high sponsor quota
    );

    assert!(quota_actions::quota_amount(&action) == 20, 0);
    assert!(quota_actions::reduced_fee(&action) == 10, 1);
    assert!(quota_actions::sponsor_quota_amount(&action) == 10, 2);

    destroy(action);
}

#[test]
/// Scenario 2: Set up a regular tier
fun test_scenario_regular_tier() {
    let users = vector[USER1, USER2, USER3];
    let action = quota_actions::new_set_quotas(
        users,
        5u64,                      // 5 proposals per month
        2592000000u64,             // 30 days
        100u64,                    // moderate fee
        3u64,                      // moderate sponsor quota
    );

    assert!(quota_actions::quota_amount(&action) == 5, 0);
    assert!(quota_actions::reduced_fee(&action) == 100, 1);

    destroy(action);
}

#[test]
/// Scenario 3: Set up a trial tier (short period)
fun test_scenario_trial_tier() {
    let users = vector[USER1];
    let action = quota_actions::new_set_quotas(
        users,
        3u64,                      // 3 proposals during trial
        604800000u64,              // 7 days (trial period)
        0u64,                      // free during trial
        1u64,                      // limited sponsor quota
    );

    assert!(quota_actions::quota_amount(&action) == 3, 0);
    assert!(quota_actions::quota_period_ms(&action) == 604800000, 1);
    assert!(quota_actions::reduced_fee(&action) == 0, 2);

    destroy(action);
}

#[test]
/// Scenario 4: Remove quotas for users
fun test_scenario_remove_quotas() {
    let users = vector[USER1, USER2, USER3];
    let action = quota_actions::new_set_quotas(
        users,
        0u64,                      // remove quota
        0u64,                      // ignored
        0u64,                      // ignored
        0u64,                      // ignored
    );

    assert!(quota_actions::quota_amount(&action) == 0, 0);
    assert!(quota_actions::users(&action).length() == 3, 1);

    destroy(action);
}

#[test]
/// Scenario 5: Adjust quotas for existing users (increase)
fun test_scenario_increase_quotas() {
    let users = vector[USER1];
    let action = quota_actions::new_set_quotas(
        users,
        15u64,                     // increased from 5 to 15
        2592000000u64,             // same period
        50u64,                     // reduced fee
        8u64,                      // increased sponsor quota
    );

    assert!(quota_actions::quota_amount(&action) == 15, 0);

    destroy(action);
}
