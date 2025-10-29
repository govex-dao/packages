// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_actions::dissolution_intents_tests;

use futarchy_actions::dissolution_intents;
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
/// Test creating DissolutionIntent witness
fun test_witness_creation() {
    let witness = dissolution_intents::witness();
    let _ = witness; // witness has drop
}

// === Helper Function Tests ===

#[test]
/// Test creating dissolution key
fun test_create_dissolution_key() {
    let mut scenario = start();
    let clock = clock::create_for_testing(scenario.ctx());

    let key = dissolution_intents::create_dissolution_key(
        string::utf8(b"create_capability"),
        &clock,
    );

    // Key should contain "dissolution_create_capability_" followed by timestamp
    assert!(key.length() > 0, 0);

    clock.destroy_for_testing();
    end(scenario);
}

#[test]
/// Test creating dissolution key with different operations
fun test_create_dissolution_key_different_operations() {
    let mut scenario = start();
    let clock = clock::create_for_testing(scenario.ctx());

    let key1 = dissolution_intents::create_dissolution_key(
        string::utf8(b"create"),
        &clock,
    );
    let key2 = dissolution_intents::create_dissolution_key(
        string::utf8(b"redeem"),
        &clock,
    );

    // Keys should be different for different operations
    assert!(key1 != key2, 0);

    clock.destroy_for_testing();
    end(scenario);
}

// === Integration Notes ===

// Full intent creation tests would require:
// 1. Account with FutarchyConfig
// 2. PackageRegistry
// 3. Proper intent setup with Params and Outcome
//
// Example test structure (requires full infrastructure):
//
// #[test]
// fun test_create_dissolution_capability_in_intent() {
//     let (scenario, account, registry, clock) = setup_test_environment();
//
//     let mut intent = /* create intent */;
//
//     dissolution_intents::create_dissolution_capability_in_intent<Outcome, AssetType, _>(
//         &mut intent,
//         witness(),
//     );
//
//     // Verify intent has the action
//     // ...
//
//     cleanup(scenario, account, registry, clock);
// }
