// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_governance_actions::protocol_admin_actions_tests;

use account_protocol::{
    account::{Self, Account},
    deps,
    intents::{Self, Intent},
    package_registry::{Self, PackageRegistry, PackageAdminCap},
    version_witness::{Self, VersionWitness},
};
use futarchy_factory::factory::{Self, Factory, FactoryOwnerCap};
use futarchy_governance_actions::{
    protocol_admin_actions,
    protocol_admin_intents,
};
use futarchy_markets_core::fee::{Self, FeeManager, FeeAdminCap};
use std::string::{Self, String};
use std::type_name;
use sui::{
    clock::{Self, Clock},
    sui::SUI,
    test_scenario::{Self as ts, Scenario},
    test_utils::destroy,
};

// === Constants ===

const OWNER: address = @0xCAFE;

// === Test Witnesses ===

public struct Witness has drop {}
public struct IntentWitness has drop {}
public struct Config has copy, drop, store {}
public struct Outcome has copy, drop, store {}

// === Test Coin Types ===

public struct TestStableCoin has drop {}

// === Helper Functions ===

fun test_version_witness(): VersionWitness {
    version_witness::new_for_testing(@futarchy_governance_actions)
}

fun start(): (Scenario, PackageRegistry, Account, Factory, FeeManager, Clock) {
    let mut scenario = ts::begin(OWNER);

    // Initialize factory
    factory::create_factory(scenario.ctx());

    // Initialize fee manager
    fee::create_fee_manager_for_testing(scenario.ctx());

    // Initialize protocol
    package_registry::init_for_testing(scenario.ctx());
    account::init_for_testing(scenario.ctx());

    scenario.next_tx(OWNER);

    // Get objects
    let mut registry = scenario.take_shared<PackageRegistry>();
    let admin_cap = scenario.take_from_sender<PackageAdminCap>();
    let factory = scenario.take_shared<Factory>();
    let fee_manager = scenario.take_shared<FeeManager>();
    let factory_owner_cap = scenario.take_from_sender<FactoryOwnerCap>();
    let fee_admin_cap = scenario.take_from_sender<FeeAdminCap>();

    // Add core dependencies
    package_registry::add_for_testing(
        &mut registry,
        b"AccountProtocol".to_string(),
        @account_protocol,
        1,
    );
    package_registry::add_for_testing(
        &mut registry,
        b"AccountActions".to_string(),
        @account_actions,
        1,
    );
    package_registry::add_for_testing(
        &mut registry,
        b"GovernanceActions".to_string(),
        @futarchy_governance_actions,
        1,
    );

    // Create account with proper deps
    let deps = deps::new_latest_extensions(
        &registry,
        vector[
            b"AccountProtocol".to_string(),
            b"AccountActions".to_string(),
        ],
    );
    let mut account = account::new(
        Config {},
        deps,
        &registry,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    // Store admin caps in account with string keys
    account.add_managed_asset(
        &registry,
        b"protocol:factory_owner_cap".to_string(),
        factory_owner_cap,
        test_version_witness(),
    );

    account.add_managed_asset(
        &registry,
        b"protocol:fee_admin_cap".to_string(),
        fee_admin_cap,
        test_version_witness(),
    );

    let clock = clock::create_for_testing(scenario.ctx());

    destroy(admin_cap);
    (scenario, registry, account, factory, fee_manager, clock)
}

fun end(
    scenario: Scenario,
    registry: PackageRegistry,
    account: Account,
    factory: Factory,
    fee_manager: FeeManager,
    clock: Clock,
) {
    destroy(registry);
    destroy(account);
    destroy(factory);
    destroy(fee_manager);
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
        b"Test protocol admin action".to_string(),
        vector[0],
        1000,
        clock,
        scenario.ctx(),
    );

    account.create_intent(
        registry,
        params,
        Outcome {},
        b"ProtocolAdminTest".to_string(),
        test_version_witness(),
        IntentWitness {},
        scenario.ctx(),
    )
}

// === Tests ===

#[test]
fun test_set_factory_paused() {
    let (mut scenario, registry, mut account, mut factory, fee_manager, clock) = start();
    let key = b"pause_factory".to_string();

    // Verify factory starts unpaused
    assert!(!factory::is_paused(&factory), 0);

    // Create intent to pause factory
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    protocol_admin_intents::add_set_factory_paused_to_intent(
        &mut intent,
        true,
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute the action
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    protocol_admin_actions::do_set_factory_paused<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut factory,
        scenario.ctx(),
    );

    account.confirm_execution(executable);

    // Verify factory is now paused
    assert!(factory::is_paused(&factory), 1);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, factory, fee_manager, clock);
}

#[test]
fun test_add_stable_type() {
    let (mut scenario, registry, mut account, mut factory, fee_manager, clock) = start();
    let key = b"add_stable".to_string();

    // Create intent to add stable type
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    let stable_type = type_name::with_defining_ids<TestStableCoin>();
    protocol_admin_intents::add_stable_type_to_intent(
        &mut intent,
        stable_type,
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute the action
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    protocol_admin_actions::do_add_stable_type<Outcome, IntentWitness, TestStableCoin>(
        &mut executable,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut factory,
        &clock,
        scenario.ctx(),
    );

    account.confirm_execution(executable);

    // Verify stable type was added
    assert!(factory::is_stable_type_allowed<TestStableCoin>(&factory), 0);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, factory, fee_manager, clock);
}

#[test]
fun test_remove_stable_type() {
    let (mut scenario, registry, mut account, mut factory, fee_manager, mut clock) = start();

    // First add a stable type via governance action
    let add_key = b"add_stable_first".to_string();
    let mut add_intent = create_intent(&mut scenario, &account, &registry, &clock, add_key);
    let stable_type = type_name::with_defining_ids<TestStableCoin>();
    protocol_admin_intents::add_stable_type_to_intent(
        &mut add_intent,
        stable_type,
        IntentWitness {},
    );
    account.insert_intent(&registry, add_intent, test_version_witness(), IntentWitness {});

    let (_, mut add_exec) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        add_key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    protocol_admin_actions::do_add_stable_type<Outcome, IntentWitness, TestStableCoin>(
        &mut add_exec,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut factory,
        &clock,
        scenario.ctx(),
    );

    account.confirm_execution(add_exec);
    let mut expired_add = account.destroy_empty_intent<Outcome>(add_key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired_add);
    expired_add.destroy_empty();

    assert!(factory::is_stable_type_allowed<TestStableCoin>(&factory), 0);

    // Now remove it via governance action
    let key = b"remove_stable".to_string();
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    let stable_type = type_name::with_defining_ids<TestStableCoin>();
    protocol_admin_intents::remove_stable_type_from_intent(
        &mut intent,
        stable_type,
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute the action
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    protocol_admin_actions::do_remove_stable_type<Outcome, IntentWitness, TestStableCoin>(
        &mut executable,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut factory,
        &clock,
        scenario.ctx(),
    );

    account.confirm_execution(executable);

    // Verify stable type was removed
    assert!(!factory::is_stable_type_allowed<TestStableCoin>(&factory), 1);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, factory, fee_manager, clock);
}

#[test]
fun test_update_dao_creation_fee() {
    let (mut scenario, registry, mut account, factory, mut fee_manager, clock) = start();
    let key = b"update_dao_fee".to_string();

    let new_fee = 50_000u64;

    // Create intent to update DAO creation fee
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    protocol_admin_intents::add_update_dao_creation_fee_to_intent(
        &mut intent,
        new_fee,
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute the action
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    protocol_admin_actions::do_update_dao_creation_fee<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut fee_manager,
        &clock,
        scenario.ctx(),
    );

    account.confirm_execution(executable);

    // Verify fee was updated
    assert!(fee::get_dao_creation_fee(&fee_manager) == new_fee, 0);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, factory, fee_manager, clock);
}

#[test]
fun test_update_proposal_fee() {
    let (mut scenario, registry, mut account, factory, mut fee_manager, clock) = start();
    let key = b"update_proposal_fee".to_string();

    let new_fee = 25_000u64;

    // Create intent to update proposal fee
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    protocol_admin_intents::add_update_proposal_fee_to_intent(
        &mut intent,
        new_fee,
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute the action
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    protocol_admin_actions::do_update_proposal_fee<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut fee_manager,
        &clock,
        scenario.ctx(),
    );

    account.confirm_execution(executable);

    // Verify fee was updated
    assert!(fee::get_proposal_creation_fee_per_outcome(&fee_manager) == new_fee, 0);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, factory, fee_manager, clock);
}

#[test]
fun test_add_verification_level() {
    let (mut scenario, registry, mut account, factory, mut fee_manager, clock) = start();
    let key = b"add_verification".to_string();

    let level = 5u8;
    let fee_amount = 100_000u64;

    // Create intent to add verification level
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    protocol_admin_intents::add_verification_level_to_intent(
        &mut intent,
        level,
        fee_amount,
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute the action
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    protocol_admin_actions::do_add_verification_level<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut fee_manager,
        &clock,
        scenario.ctx(),
    );

    account.confirm_execution(executable);

    // Verify verification level was added
    assert!(fee::has_verification_level(&fee_manager, level), 0);
    assert!(fee::get_verification_fee_for_level(&fee_manager, level) == fee_amount, 1);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, factory, fee_manager, clock);
}

#[test]
fun test_remove_verification_level() {
    let (mut scenario, registry, mut account, factory, mut fee_manager, mut clock) = start();

    let level = 3u8;

    // First add a verification level via governance action
    let add_key = b"add_verification_first".to_string();
    let mut add_intent = create_intent(&mut scenario, &account, &registry, &clock, add_key);
    protocol_admin_intents::add_verification_level_to_intent(
        &mut add_intent,
        level,
        50_000,
        IntentWitness {},
    );
    account.insert_intent(&registry, add_intent, test_version_witness(), IntentWitness {});

    let (_, mut add_exec) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        add_key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    protocol_admin_actions::do_add_verification_level<Outcome, IntentWitness>(
        &mut add_exec,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut fee_manager,
        &clock,
        scenario.ctx(),
    );

    account.confirm_execution(add_exec);
    let mut expired_add = account.destroy_empty_intent<Outcome>(add_key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired_add);
    expired_add.destroy_empty();

    assert!(fee::has_verification_level(&fee_manager, level), 0);

    // Now remove it via governance action
    let key = b"remove_verification".to_string();
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    protocol_admin_intents::remove_verification_level_from_intent(
        &mut intent,
        level,
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Execute the action
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &registry,
        key,
        &clock,
        test_version_witness(),
        Witness {},
        scenario.ctx(),
    );

    protocol_admin_actions::do_remove_verification_level<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut fee_manager,
        &clock,
        scenario.ctx(),
    );

    account.confirm_execution(executable);

    // Verify verification level was removed
    assert!(!fee::has_verification_level(&fee_manager, level), 1);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, factory, fee_manager, clock);
}

#[test]
fun test_multiple_admin_actions_in_intent() {
    let (mut scenario, registry, mut account, mut factory, mut fee_manager, clock) = start();
    let key = b"multi_admin".to_string();

    // Create intent with multiple actions
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);

    // Action 1: Pause factory
    protocol_admin_intents::add_set_factory_paused_to_intent(
        &mut intent,
        true,
        IntentWitness {},
    );

    // Action 2: Update DAO creation fee
    protocol_admin_intents::add_update_dao_creation_fee_to_intent(
        &mut intent,
        75_000,
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
    protocol_admin_actions::do_set_factory_paused<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut factory,
        scenario.ctx(),
    );

    // Execute second action
    protocol_admin_actions::do_update_dao_creation_fee<Outcome, IntentWitness>(
        &mut executable,
        &mut account,
        &registry,
        test_version_witness(),
        IntentWitness {},
        &mut fee_manager,
        &clock,
        scenario.ctx(),
    );

    account.confirm_execution(executable);

    // Verify both actions were executed
    assert!(factory::is_paused(&factory), 0);
    assert!(fee::get_dao_creation_fee(&fee_manager) == 75_000, 1);

    // Cleanup
    let mut expired = account.destroy_empty_intent<Outcome>(key, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    expired.destroy_empty();

    end(scenario, registry, account, factory, fee_manager, clock);
}

#[test]
fun test_expired_admin_intent_cleanup() {
    let (mut scenario, registry, mut account, factory, fee_manager, mut clock) = start();

    // Advance clock to make intent expire
    clock.increment_for_testing(2000);

    let key = b"expired_admin".to_string();
    let mut intent = create_intent(&mut scenario, &account, &registry, &clock, key);
    protocol_admin_intents::add_update_dao_creation_fee_to_intent(
        &mut intent,
        999_999,
        IntentWitness {},
    );
    account.insert_intent(&registry, intent, test_version_witness(), IntentWitness {});

    // Delete expired intent
    let mut expired = account.delete_expired_intent<Outcome>(key, &clock, scenario.ctx());
    protocol_admin_actions::delete_protocol_admin_action(&mut expired);
    expired.destroy_empty();

    // Verify fee was not changed
    assert!(fee::get_dao_creation_fee(&fee_manager) != 999_999, 0);

    end(scenario, registry, account, factory, fee_manager, clock);
}
