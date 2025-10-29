#[test_only]
module futarchy_oracle::oracle_intents_tests;

use futarchy_oracle::oracle_actions;
use futarchy_oracle::oracle_intents;
use sui::clock;
use sui::test_scenario as ts;
use sui::test_utils::destroy;
use std::string;

// === Test Constants ===

const OWNER: address = @0xCAFE;
const RECIPIENT1: address = @0xBEEF;
const RECIPIENT2: address = @0xDEAD;

// === Tests ===

#[test]
/// Test create_oracle_key utility function
fun test_create_oracle_key() {
    let mut scenario = ts::begin(OWNER);
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock.set_for_testing(123456);

    let key1 = oracle_intents::create_oracle_key(
        b"create".to_string(),
        &clock
    );

    // Key should contain operation and timestamp
    assert!(key1.length() > 0, 0);

    // Advance clock and create another key with same operation
    clock.increment_for_testing(1000);

    let key2 = oracle_intents::create_oracle_key(
        b"create".to_string(),
        &clock
    );

    // Keys should be different due to timestamp
    assert!(key1 != key2, 1);

    // Create key with different operation
    let key3 = oracle_intents::create_oracle_key(
        b"cancel".to_string(),
        &clock
    );

    // Should differ from key2 due to operation name
    assert!(key2 != key3, 2);

    destroy(clock);
    ts::end(scenario);
}

#[test]
/// Test new_tier_spec construction
fun test_new_tier_spec() {
    let recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 1000),
        oracle_actions::new_recipient_mint(RECIPIENT2, 500),
    ];

    let tier_spec = oracle_actions::new_tier_spec(
        2_000_000_000_000u128, // 2.0 price threshold
        true, // unlock above
        recipients,
        string::utf8(b"First Tier")
    );

    // Just verify construction works
    destroy(tier_spec);
}

#[test]
/// Test new_recipient_mint construction
fun test_new_recipient_mint() {
    let recipient1 = oracle_actions::new_recipient_mint(RECIPIENT1, 1000);
    let recipient2 = oracle_actions::new_recipient_mint(RECIPIENT2, 500);

    // Verify construction works
    destroy(recipient1);
    destroy(recipient2);
}

#[test]
/// Test new_cancel_grant action construction
fun test_new_cancel_grant_action() {
    let grant_id = object::id_from_address(@0x1234);
    let action = oracle_actions::new_cancel_grant(grant_id);

    // Verify construction works
    destroy(action);
}

#[test]
/// Test creating multiple tier specs with varying configurations
fun test_multiple_tier_specs() {
    // Low threshold tier
    let tier1 = oracle_actions::new_tier_spec(
        1_000_000_000_000u128,
        true,
        vector[oracle_actions::new_recipient_mint(RECIPIENT1, 100)],
        string::utf8(b"Low Tier")
    );

    // Mid threshold tier
    let tier2 = oracle_actions::new_tier_spec(
        5_000_000_000_000u128,
        true,
        vector[oracle_actions::new_recipient_mint(RECIPIENT2, 200)],
        string::utf8(b"Mid Tier")
    );

    // High threshold tier with multiple recipients
    let tier3 = oracle_actions::new_tier_spec(
        10_000_000_000_000u128,
        false, // unlock below (inverse condition)
        vector[
            oracle_actions::new_recipient_mint(RECIPIENT1, 300),
            oracle_actions::new_recipient_mint(RECIPIENT2, 400),
        ],
        string::utf8(b"High Tier")
    );

    destroy(tier1);
    destroy(tier2);
    destroy(tier3);
}
