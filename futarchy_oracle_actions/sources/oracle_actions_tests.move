#[test_only]
module futarchy_oracle::oracle_actions_tests;

use futarchy_oracle::oracle_actions;
use std::string;
use sui::test_utils::destroy;

// === Test Constants ===

const RECIPIENT1: address = @0xBEEF;
const RECIPIENT2: address = @0xDEAD;

// === Tests ===

#[test]
/// Test helper function for relative to absolute price conversion
fun test_relative_to_absolute_threshold() {
    // Launchpad price: 1.5 (in 1e12 scale)
    let launchpad_price = 1_500_000_000_000u128;

    // 2x multiplier (in 1e9 scale)
    let multiplier_2x = 2_000_000_000u64;

    let result = oracle_actions::relative_to_absolute_threshold(
        launchpad_price,
        multiplier_2x
    );

    // Expected: 1.5 * 2.0 = 3.0
    assert!(result == 3_000_000_000_000u128, 0);

    // Test 0.5x multiplier
    let multiplier_half = 500_000_000u64;
    let result2 = oracle_actions::relative_to_absolute_threshold(
        launchpad_price,
        multiplier_half
    );

    // Expected: 1.5 * 0.5 = 0.75
    assert!(result2 == 750_000_000_000u128, 1);
}

#[test]
/// Test creating price conditions
fun test_create_price_conditions() {
    // Above condition
    let above = oracle_actions::absolute_price_condition(
        1_000_000_000_000,
        true
    );

    // Below condition
    let below = oracle_actions::absolute_price_condition(
        500_000_000_000,
        false
    );

    // Just verify they can be created
    destroy(above);
    destroy(below);
}

#[test]
/// Test creating recipient mint structs
fun test_create_recipient_mint() {
    let recipient1 = oracle_actions::new_recipient_mint(RECIPIENT1, 1000);
    let recipient2 = oracle_actions::new_recipient_mint(RECIPIENT2, 500);

    // Verify they can be created
    destroy(recipient1);
    destroy(recipient2);
}

#[test]
/// Test new_tier_spec construction with single recipient
fun test_new_tier_spec_single_recipient() {
    let recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 1000),
    ];

    let tier_spec = oracle_actions::new_tier_spec(
        2_000_000_000_000u128, // 2.0 price threshold
        true, // unlock above
        recipients,
        string::utf8(b"Single Recipient Tier")
    );

    destroy(tier_spec);
}

#[test]
/// Test new_tier_spec construction with multiple recipients
fun test_new_tier_spec_multi_recipient() {
    let recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 1000),
        oracle_actions::new_recipient_mint(RECIPIENT2, 500),
    ];

    let tier_spec = oracle_actions::new_tier_spec(
        5_000_000_000_000u128, // 5.0 price threshold
        false, // unlock below
        recipients,
        string::utf8(b"Multi Recipient Tier")
    );

    destroy(tier_spec);
}

#[test]
/// Test new_cancel_grant action construction
fun test_new_cancel_grant_action() {
    let grant_id = object::id_from_address(@0x1234);
    let action = oracle_actions::new_cancel_grant(grant_id);

    destroy(action);
}

#[test]
/// Test relative threshold with edge cases
fun test_relative_threshold_edge_cases() {
    // Test 1x multiplier (should return same price)
    let price = 2_000_000_000_000u128;
    let multiplier_1x = 1_000_000_000u64;
    let result = oracle_actions::relative_to_absolute_threshold(price, multiplier_1x);
    assert!(result == 2_000_000_000_000u128, 0);

    // Test 0x multiplier (should return 0)
    let multiplier_0x = 0u64;
    let result2 = oracle_actions::relative_to_absolute_threshold(price, multiplier_0x);
    assert!(result2 == 0u128, 1);

    // Test 10x multiplier
    let multiplier_10x = 10_000_000_000u64;
    let result3 = oracle_actions::relative_to_absolute_threshold(price, multiplier_10x);
    assert!(result3 == 20_000_000_000_000u128, 2);
}

#[test]
/// Test new_create_oracle_grant action construction
fun test_new_create_oracle_grant_action() {
    let recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 100),
    ];

    let tier_spec = oracle_actions::new_tier_spec(
        1_000_000_000_000u128,
        true,
        recipients,
        string::utf8(b"Test Tier")
    );

    let action = oracle_actions::new_create_oracle_grant<u64, u64>(
        vector[tier_spec],
        1_500_000_000, // launchpad multiplier
        0, // earliest execution
        1, // expiry years
        true, // cancelable
        string::utf8(b"Test Grant")
    );

    destroy(action);
}
