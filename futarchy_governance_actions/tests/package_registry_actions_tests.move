// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_governance_actions::package_registry_actions_tests;

use account_protocol::{
    account::{Self, Account},
    deps,
    intents::{Self, Intent},
    package_registry::{Self, PackageRegistry, PackageAdminCap},
    version_witness::{Self, VersionWitness},
};
use futarchy_governance_actions::{
    package_registry_actions,
    package_registry_intents,
};
use std::string::{Self, String};
use sui::{
    clock::{Self, Clock},
    test_scenario::{Self as ts, Scenario},
    test_utils::destroy,
};

// === Constants ===

const OWNER: address = @0xCAFE;
const TEST_PACKAGE_ADDR: address = @0xABCDEF;

// === Test Witnesses ===

public struct Witness has drop {}
public struct IntentWitness has drop {}
public struct Config has copy, drop, store {}
public struct Outcome has copy, drop, store {}

// === Helper Functions ===

fun test_version_witness(): VersionWitness {
    version_witness::new_for_testing(@futarchy_governance_actions)
}

fun start(): (Scenario, PackageRegistry, Account, Clock) {
    let mut scenario = ts::begin(OWNER);

    // Initialize protocol
    package_registry::init_for_testing(scenario.ctx());
    account::init_for_testing(scenario.ctx());

    // Get shared objects
    scenario.next_tx(OWNER);
    let mut registry = scenario.take_shared<PackageRegistry>();
    let cap = scenario.take_from_sender<PackageAdminCap>();

    // Add core dependencies
    package_registry::add_for_testing(
        &mut registry,
        b"AccountProtocol".to_string(),
        @account_protocol,
        1,
    );
    package_registry::add_for_testing(
        &mut registry,
        b"GovernanceActions".to_string(),
        @futarchy_governance_actions,
        1,
    );

    // Create account
    let deps = deps::new(&registry)],
    );
    let account = account::new(
        Config {},
        deps,
        &registry,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    let clock = clock::create_for_testing(scenario.ctx());

    destroy(cap);
    (scenario, registry, account, clock)
}

fun end(scenario: Scenario, registry: PackageRegistry, account: Account, clock: Clock) {
    destroy(registry);
    destroy(account);
    destroy(clock);
    ts::end(scenario);
}

fun create_intent(
    scenario: &mut Scenario,
    account: &Account,
    registry: &PackageRegistry,
    clock: &Clock,
    key: String,
): Intent<Outcome> {
    let params = intents::new_params(
        key,
        b"Test package registry action".to_string(),
        vector[0],
        1000,
        clock,
        scenario.ctx(),
    );

    account.create_intent(
        registry,
        params,
        Outcome {},
        b"PackageRegistryTest".to_string(),
        test_version_witness(),
        IntentWitness {},
        scenario.ctx(),
    )
}

// === Tests ===

#[test]
fun test_add_package_flow() {
    let (mut scenario, mut registry, mut account, clock) = start();
    let key = b"add_package".to_string();

    // Create intent with add package action
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    package_registry_intents::add_package_to_intent(
        &mut intent,
        b"TestPackage".to_string(),
        TEST_PACKAGE_ADDR,
        1,
        vector[b"TestPackage::TestAction".to_string()],
        b"Testing".to_string(),
        b"A test package".to_string(),
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute the intent
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    package_registry_actions::do_add_package<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        test_version_witness(),
        IntentWitness {},
        &mut registry,
    );

    account.confirm_execution(executable);

    // Verify package was added
    assert!(registry.has_package(b"TestPackage".to_string()), 0);
    let (addr, version) = package_registry::get_latest_version(&registry, b"TestPackage".to_string());
    assert!(addr == TEST_PACKAGE_ADDR, 1);
    assert!(version == 1, 2);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    package_registry_actions::delete_package_registry_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, clock);
}

#[test]
fun test_remove_package_flow() {
    let (mut scenario, mut registry, mut account, clock) = start();

    // First add a package directly to registry
    package_registry::add_for_testing(
        &mut registry,
        b"ToRemove".to_string(),
        @0x123,
        1,
    );
    assert!(registry.has_package(b"ToRemove".to_string()), 0);

    // Create intent to remove it
    let key = b"remove_package".to_string();
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    package_registry_intents::remove_package_from_intent(
        &mut intent,
        b"ToRemove".to_string(),
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute removal
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    package_registry_actions::do_remove_package<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        test_version_witness(),
        IntentWitness {},
        &mut registry,
    );

    account.confirm_execution(executable);

    // Verify package was removed
    assert!(!registry.has_package(b"ToRemove".to_string()), 1);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    package_registry_actions::delete_package_registry_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, clock);
}

#[test]
fun test_update_package_version_flow() {
    let (mut scenario, mut registry, mut account, clock) = start();

    // Add initial package version
    package_registry::add_for_testing(
        &mut registry,
        b"VersionTest".to_string(),
        @0x456,
        1,
    );

    // Create intent to update version
    let key = b"update_version".to_string();
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    package_registry_intents::update_package_version_to_intent(
        &mut intent,
        b"VersionTest".to_string(),
        @0x789,
        2,
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute update
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    package_registry_actions::do_update_package_version<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        test_version_witness(),
        IntentWitness {},
        &mut registry,
    );

    account.confirm_execution(executable);

    // Verify version was updated
    let (addr, version) = package_registry::get_latest_version(&registry, b"VersionTest".to_string());
    assert!(addr == @0x789, 0);
    assert!(version == 2, 1);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    package_registry_actions::delete_package_registry_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, clock);
}

#[test]
fun test_update_package_metadata_flow() {
    let (mut scenario, mut registry, mut account, clock) = start();

    // Add package with initial metadata
    package_registry::add_for_testing(
        &mut registry,
        b"MetadataTest".to_string(),
        @0xABC,
        1,
    );

    // Create intent to update metadata
    let key = b"update_metadata".to_string();
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    package_registry_intents::update_package_metadata_to_intent(
        &mut intent,
        b"MetadataTest".to_string(),
        vector[
            b"MetadataTest::NewAction1".to_string(),
            b"MetadataTest::NewAction2".to_string(),
        ],
        b"NewCategory".to_string(),
        b"Updated description".to_string(),
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute update
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    package_registry_actions::do_update_package_metadata<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        test_version_witness(),
        IntentWitness {},
        &mut registry,
    );

    account.confirm_execution(executable);

    // Verify metadata was updated
    let (addr, version) = package_registry::get_latest_version(&registry, b"MetadataTest".to_string());
    assert!(addr == @0xABC, 0);
    assert!(version == 1, 1);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    package_registry_actions::delete_package_registry_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, clock);
}

#[test]
fun test_multiple_actions_in_intent() {
    let (mut scenario, mut registry, mut account, clock) = start();
    let key = b"multi_actions".to_string();

    // Create intent with multiple actions
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);

    // Action 1: Add package
    package_registry_intents::add_package_to_intent(
        &mut intent,
        b"Package1".to_string(),
        @0x111,
        1,
        vector[b"Package1::Action1".to_string()],
        b"Category1".to_string(),
        b"First package".to_string(),
        IntentWitness {},
    );

    // Action 2: Add another package
    package_registry_intents::add_package_to_intent(
        &mut intent,
        b"Package2".to_string(),
        @0x222,
        1,
        vector[b"Package2::Action2".to_string()],
        b"Category2".to_string(),
        b"Second package".to_string(),
        IntentWitness {},
    );

    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute all actions
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    // Execute first action
    package_registry_actions::do_add_package<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        test_version_witness(),
        IntentWitness {},
        &mut registry,
    );

    // Execute second action
    package_registry_actions::do_add_package<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        test_version_witness(),
        IntentWitness {},
        &mut registry,
    );

    account.confirm_execution(executable);

    // Verify both packages were added
    assert!(registry.has_package(b"Package1".to_string()), 0);
    assert!(registry.has_package(b"Package2".to_string()), 1);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    package_registry_actions::delete_package_registry_action(&mut expired);
    package_registry_actions::delete_package_registry_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, clock);
}

#[test]
fun test_expired_intent_cleanup() {
    let (mut scenario, registry, mut account, mut clock) = start();

    // Advance clock to make intent expire
    clock.increment_for_testing(2000);

    let key = b"expired".to_string();
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    package_registry_intents::add_package_to_intent(
        &mut intent,
        b"ExpiredPackage".to_string(),
        @0xDEAD,
        1,
        vector[],
        b"Expired".to_string(),
        b"This will expire".to_string(),
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Delete expired intent
    let mut expired = account.delete_expired_intent<Outcome>(key, &clock, scenario.ctx());
    package_registry_actions::delete_package_registry_action(&mut expired);
    expired.destroy_empty();

    // Verify package was not added
    assert!(!registry.has_package(b"ExpiredPackage".to_string()), 0);

    end(scenario, registry, account, clock);
}
