// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_actions::liquidity_intents_tests;

use futarchy_actions::liquidity_intents;
use sui::clock;
use sui::test_scenario::{Self as ts, Scenario};
use std::string;

// === Constants ===

const OWNER: address = @0xCAFE;

// === Helper Functions ===

fun start(): Scenario {
    ts::begin(OWNER)
}

fun end(scenario: Scenario) {
    ts::end(scenario);
}

// === Witness Tests ===

#[test]
/// Test creating LiquidityIntent witness
fun test_witness_creation() {
    let witness = liquidity_intents::witness();
    let _ = witness; // witness has drop
}

// === Helper Function Tests ===

#[test]
/// Test creating liquidity key
fun test_create_liquidity_key() {
    let mut scenario = start();
    let clock = clock::create_for_testing(scenario.ctx());

    let key = liquidity_intents::create_liquidity_key(
        string::utf8(b"add_liquidity"),
        &clock,
    );

    // Key should contain "liquidity_add_liquidity_" followed by timestamp
    assert!(key.length() > 0, 0);

    clock.destroy_for_testing();
    end(scenario);
}

#[test]
/// Test creating liquidity key with different operations
fun test_create_liquidity_key_different_operations() {
    let mut scenario = start();
    let clock = clock::create_for_testing(scenario.ctx());

    let key1 = liquidity_intents::create_liquidity_key(
        string::utf8(b"add"),
        &clock,
    );
    let key2 = liquidity_intents::create_liquidity_key(
        string::utf8(b"remove"),
        &clock,
    );
    let key3 = liquidity_intents::create_liquidity_key(
        string::utf8(b"swap"),
        &clock,
    );

    // Keys should be different for different operations
    assert!(key1 != key2, 0);
    assert!(key2 != key3, 1);
    assert!(key1 != key3, 2);

    clock.destroy_for_testing();
    end(scenario);
}

#[test]
/// Test creating multiple keys with same operation
fun test_create_liquidity_key_multiple_calls() {
    let mut scenario = start();
    let mut clock = clock::create_for_testing(scenario.ctx());

    let key1 = liquidity_intents::create_liquidity_key(
        string::utf8(b"add"),
        &clock,
    );

    // Advance time
    clock.increment_for_testing(1000);

    let key2 = liquidity_intents::create_liquidity_key(
        string::utf8(b"add"),
        &clock,
    );

    // Keys should be different due to different timestamps
    assert!(key1 != key2, 0);

    clock.destroy_for_testing();
    end(scenario);
}

// === Integration Notes ===

// Full intent creation tests would require:
// 1. Account with FutarchyConfig
// 2. PackageRegistry
// 3. Proper intent setup with Params and Outcome
// 4. Mock pool and LP tokens
//
// Example test structures (require full infrastructure):
//
// #[test]
// fun test_add_liquidity_to_intent() {
//     let (scenario, account, registry, clock, intent) = setup_test_environment();
//
//     liquidity_intents::add_liquidity_to_intent<_, AssetType, StableType, _>(
//         &mut intent,
//         pool_id,
//         1000,
//         2000,
//         500,
//         witness(),
//     );
//
//     // Verify intent has the action
//     // ...
// }
//
// #[test]
// fun test_create_pool_to_intent() { /* ... */ }
//
// #[test]
// fun test_remove_liquidity_from_intent() { /* ... */ }
