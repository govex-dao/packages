#[test_only]
module account_protocol::config_intents_tests;

use account_protocol::account::{Self, Account};
use account_protocol::config;
use account_protocol::deps;
use account_protocol::intents::{Self, Intent};
use account_protocol::package_registry::{
    Self as package_registry,
    PackageRegistry,
    PackageAdminCap
};
use account_protocol::version;
use account_protocol::version_witness;
use sui::bcs;
use sui::clock::{Self, Clock};
use sui::test_scenario::{Self as ts, Scenario};
use sui::test_utils::destroy;
use std::type_name;

// === Imports ===

// === Constants ===

const OWNER: address = @0xCAFE;
const CUSTOM_PKG: address = @0xDEAD;

// === Structs ===

public struct Witness() has copy, drop;
public struct DummyIntent() has drop;

public struct Config has copy, drop, store {}
public struct Outcome has copy, drop, store {}

// === Helpers ===

fun start(): (Scenario, PackageRegistry, Account, Clock, PackageAdminCap) {
    let mut scenario = ts::begin(OWNER);
    // publish package
    package_registry::init_for_testing(scenario.ctx());
    account::init_for_testing(scenario.ctx());
    // retrieve objects
    scenario.next_tx(OWNER);
    let mut extensions = scenario.take_shared<PackageRegistry>();
    let cap = scenario.take_from_sender<PackageAdminCap>();
    // add core deps
    package_registry::add_for_testing(
        &mut extensions,
        b"AccountProtocol".to_string(),
        @account_protocol,
        1,
    );
    package_registry::add_for_testing(&mut extensions, b"AccountConfig".to_string(), @0x1, 1);
    package_registry::update_for_testing(&mut extensions, b"AccountConfig".to_string(), @0x11, 2);
    package_registry::add_for_testing(&mut extensions, b"AccountActions".to_string(), @0x2, 1);
    // add external dep
    package_registry::add_for_testing(&mut extensions, b"External".to_string(), @0xABC, 1);

    let deps = deps::new(&extensions, false);
    let account = account::new(
        Config {},
        deps,
        &extensions,
        version::current(),
        Witness(),
        scenario.ctx(),
    );
    let clock = clock::create_for_testing(scenario.ctx());
    // create world
    (scenario, extensions, account, clock, cap)
}

fun end(
    scenario: Scenario,
    extensions: PackageRegistry,
    account: Account,
    clock: Clock,
    cap: PackageAdminCap,
) {
    destroy(extensions);
    destroy(account);
    destroy(clock);
    destroy(cap);
    ts::end(scenario);
}

/// Create a dummy intent for testing
fun create_dummy_intent(
    scenario: &mut Scenario,
    account: &Account,
    registry: &PackageRegistry,
    clock: &Clock,
): Intent<Outcome> {
    let params = intents::new_params(
        b"dummy".to_string(),
        b"description".to_string(),
        vector[0],
        1,
        clock,
        scenario.ctx(),
    );
    account.create_intent(
        registry,
        params,
        Outcome {},
        b"Degen".to_string(),
        version::current(),
        DummyIntent(),
        scenario.ctx(),
    )
}

/// Helper to add toggle unverified spec to intent
fun add_toggle_unverified_spec(intent: &mut Intent<Outcome>) {
    // ToggleUnverifiedAllowedAction is an empty struct
    let action_data = vector::empty<u8>();
    intents::add_action_spec(
        intent,
        config::config_toggle_unverified(),
        action_data,
        DummyIntent(),
    );
}

/// Helper to add add_dep spec to intent
fun add_add_dep_spec(
    intent: &mut Intent<Outcome>,
    addr: address,
    name: std::string::String,
    dep_version: u64,
) {
    // AddDepAction { addr, name, version }
    let mut action_data = bcs::to_bytes(&addr);
    vector::append(&mut action_data, bcs::to_bytes(&name));
    vector::append(&mut action_data, bcs::to_bytes(&dep_version));
    intents::add_action_spec(
        intent,
        config::config_add_dep(),
        action_data,
        DummyIntent(),
    );
}

/// Helper to add remove_dep spec to intent
fun add_remove_dep_spec(
    intent: &mut Intent<Outcome>,
    addr: address,
) {
    // RemoveDepAction { addr }
    let action_data = bcs::to_bytes(&addr);
    intents::add_action_spec(
        intent,
        config::config_remove_dep(),
        action_data,
        DummyIntent(),
    );
}

// === Tests ===

#[test]
fun test_edit_config_metadata() {
    let (scenario, extensions, mut account, clock, cap) = start();
    assert!(account.metadata().size() == 0);

    let auth = account.new_auth<Config, Witness>(&extensions, version::current(), Witness());
    config::edit_metadata<Config>(
        auth,
        &mut account,
        &extensions,
        vector[b"name".to_string()],
        vector[b"New Name".to_string()],
    );

    assert!(account.metadata().get(b"name".to_string()) == b"New Name".to_string());
    end(scenario, extensions, account, clock, cap);
}

// Removed test_update_extensions_to_latest - deps are now immutable and managed globally

// TODO: This test needs to be rewritten since Deps no longer has drop ability
// and cannot be directly replaced. The test should use the proper config actions
// to add unverified dependencies.
// #[test]
// fun test_update_extensions_to_latest_with_unverified() {
//     let (scenario, mut extensions, mut account, clock, cap) = start();
//     assert!(account.deps().get_by_name(b"AccountProtocol".to_string()).version() == 1);
//     extensions.update_for_testing( b"AccountProtocol".to_string(), @0x3, 2);

//     account.deps_mut(version::current()).toggle_unverified_allowed_for_testing();
//     // Need to use proper config actions to add unverified deps
//     let auth = account.new_auth<Config, Witness>(&extensions, version::current(), Witness());
//     config::update_extensions_to_latest(
//         auth,
//         &mut account,
//         &extensions,
//     );

//     assert!(account.deps().get_by_name(b"AccountConfig".to_string()).version() == 2);
//     assert!(account.deps().get_by_name(b"AccountProtocol".to_string()).version() == 2);

//     end(scenario, extensions, account, clock, cap);
// }

// === Per-Account Deps Tests (3-Layer Pattern) ===

#[test]
fun test_toggle_unverified_allowed() {
    let (mut scenario, extensions, mut account, clock, cap) = start();
    let key = b"dummy".to_string();

    // Initially unverified_allowed is false
    assert!(!account.deps().unverified_allowed());

    // Create intent with toggle action
    let mut intent = create_dummy_intent(&mut scenario, &account, &extensions, &clock);
    add_toggle_unverified_spec(&mut intent);
    account.insert_intent(&extensions, intent, version::current(), DummyIntent());

    // Execute the intent
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &extensions,
        key,
        &clock,
        version::current(),
        Witness(),
        scenario.ctx(),
    );

    config::do_toggle_unverified_allowed<Config, Outcome, DummyIntent>(
        &mut executable,
        &mut account,
        &extensions,
        version_witness::new_for_testing(@account_protocol),
        DummyIntent(),
    );

    account.confirm_execution(executable);

    // Now unverified_allowed should be true
    assert!(account.deps().unverified_allowed());

    end(scenario, extensions, account, clock, cap);
}

#[test]
fun test_add_dep_from_global_registry() {
    let (mut scenario, extensions, mut account, clock, cap) = start();
    let key = b"dummy".to_string();

    // External package @0xABC is already in global registry from start()
    let external_addr = @0xABC;

    // Create intent with add_dep action
    let mut intent = create_dummy_intent(&mut scenario, &account, &extensions, &clock);
    add_add_dep_spec(&mut intent, external_addr, b"External".to_string(), 1);
    account.insert_intent(&extensions, intent, version::current(), DummyIntent());

    // Execute the intent
    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &extensions,
        key,
        &clock,
        version::current(),
        Witness(),
        scenario.ctx(),
    );

    config::do_add_dep<Config, Outcome, DummyIntent>(
        &mut executable,
        &mut account,
        &extensions,
        version_witness::new_for_testing(@account_protocol),
        DummyIntent(),
    );

    account.confirm_execution(executable);

    // Verify the dep was added to per-account table
    assert!(deps::contains_dep(account.account_deps(), external_addr));
    let info = deps::get_dep(account.account_deps(), external_addr);
    assert!(deps::dep_name(info) == b"External".to_string());
    assert!(deps::dep_version(info) == 1);

    end(scenario, extensions, account, clock, cap);
}

#[test]
fun test_add_unverified_dep_after_toggle() {
    let (mut scenario, extensions, mut account, clock, cap) = start();

    // First, toggle unverified_allowed to true
    let key1 = b"toggle".to_string();
    let params1 = intents::new_params(
        key1,
        b"Toggle unverified".to_string(),
        vector[0],
        1,
        &clock,
        scenario.ctx(),
    );
    let mut intent1 = account.create_intent(
        &extensions,
        params1,
        Outcome {},
        b"Degen".to_string(),
        version::current(),
        DummyIntent(),
        scenario.ctx(),
    );
    add_toggle_unverified_spec(&mut intent1);
    account.insert_intent(&extensions, intent1, version::current(), DummyIntent());

    let (_, mut exec1) = account.create_executable<Config, Outcome, Witness>(
        &extensions,
        key1,
        &clock,
        version::current(),
        Witness(),
        scenario.ctx(),
    );
    config::do_toggle_unverified_allowed<Config, Outcome, DummyIntent>(
        &mut exec1,
        &mut account,
        &extensions,
        version_witness::new_for_testing(@account_protocol),
        DummyIntent(),
    );
    account.confirm_execution(exec1);

    assert!(account.deps().unverified_allowed());

    // Now add an unverified package (not in global registry)
    let key2 = b"add_unverified".to_string();
    let params2 = intents::new_params(
        key2,
        b"Add unverified dep".to_string(),
        vector[0],
        1,
        &clock,
        scenario.ctx(),
    );
    let mut intent2 = account.create_intent(
        &extensions,
        params2,
        Outcome {},
        b"Degen".to_string(),
        version::current(),
        DummyIntent(),
        scenario.ctx(),
    );
    add_add_dep_spec(&mut intent2, CUSTOM_PKG, b"CustomPkg".to_string(), 1);
    account.insert_intent(&extensions, intent2, version::current(), DummyIntent());

    let (_, mut exec2) = account.create_executable<Config, Outcome, Witness>(
        &extensions,
        key2,
        &clock,
        version::current(),
        Witness(),
        scenario.ctx(),
    );
    config::do_add_dep<Config, Outcome, DummyIntent>(
        &mut exec2,
        &mut account,
        &extensions,
        version_witness::new_for_testing(@account_protocol),
        DummyIntent(),
    );
    account.confirm_execution(exec2);

    // Verify unverified dep was added
    assert!(deps::contains_dep(account.account_deps(), CUSTOM_PKG));

    end(scenario, extensions, account, clock, cap);
}

#[test]
fun test_remove_dep() {
    let (mut scenario, extensions, mut account, clock, cap) = start();

    // First, add a dep from global registry
    let external_addr = @0xABC;
    let key1 = b"add".to_string();
    let params1 = intents::new_params(
        key1,
        b"Add dep".to_string(),
        vector[0],
        1,
        &clock,
        scenario.ctx(),
    );
    let mut intent1 = account.create_intent(
        &extensions,
        params1,
        Outcome {},
        b"Degen".to_string(),
        version::current(),
        DummyIntent(),
        scenario.ctx(),
    );
    add_add_dep_spec(&mut intent1, external_addr, b"External".to_string(), 1);
    account.insert_intent(&extensions, intent1, version::current(), DummyIntent());

    let (_, mut exec1) = account.create_executable<Config, Outcome, Witness>(
        &extensions,
        key1,
        &clock,
        version::current(),
        Witness(),
        scenario.ctx(),
    );
    config::do_add_dep<Config, Outcome, DummyIntent>(
        &mut exec1,
        &mut account,
        &extensions,
        version_witness::new_for_testing(@account_protocol),
        DummyIntent(),
    );
    account.confirm_execution(exec1);

    // Verify it was added
    assert!(deps::contains_dep(account.account_deps(), external_addr));

    // Now remove it
    let key2 = b"remove".to_string();
    let params2 = intents::new_params(
        key2,
        b"Remove dep".to_string(),
        vector[0],
        1,
        &clock,
        scenario.ctx(),
    );
    let mut intent2 = account.create_intent(
        &extensions,
        params2,
        Outcome {},
        b"Degen".to_string(),
        version::current(),
        DummyIntent(),
        scenario.ctx(),
    );
    add_remove_dep_spec(&mut intent2, external_addr);
    account.insert_intent(&extensions, intent2, version::current(), DummyIntent());

    let (_, mut exec2) = account.create_executable<Config, Outcome, Witness>(
        &extensions,
        key2,
        &clock,
        version::current(),
        Witness(),
        scenario.ctx(),
    );
    config::do_remove_dep<Config, Outcome, DummyIntent>(
        &mut exec2,
        &mut account,
        &extensions,
        version_witness::new_for_testing(@account_protocol),
        DummyIntent(),
    );
    account.confirm_execution(exec2);

    // Verify it was removed
    assert!(!deps::contains_dep(account.account_deps(), external_addr));

    end(scenario, extensions, account, clock, cap);
}

#[test]
fun test_delete_toggle_unverified_expired() {
    let (mut scenario, extensions, mut account, mut clock, cap) = start();
    clock.increment_for_testing(1);
    let key = b"dummy".to_string();

    // Create intent with toggle action
    let mut intent = create_dummy_intent(&mut scenario, &account, &extensions, &clock);
    add_toggle_unverified_spec(&mut intent);
    account.insert_intent(&extensions, intent, version::current(), DummyIntent());

    // Delete as expired
    let mut expired = account.delete_expired_intent<Outcome>(key, &clock, scenario.ctx());
    config::delete_toggle_unverified_allowed(&mut expired);
    expired.destroy_empty();

    end(scenario, extensions, account, clock, cap);
}

#[test]
fun test_delete_add_dep_expired() {
    let (mut scenario, extensions, mut account, mut clock, cap) = start();
    clock.increment_for_testing(1);
    let key = b"dummy".to_string();

    // Create intent with add_dep action
    let mut intent = create_dummy_intent(&mut scenario, &account, &extensions, &clock);
    add_add_dep_spec(&mut intent, @0xABC, b"External".to_string(), 1);
    account.insert_intent(&extensions, intent, version::current(), DummyIntent());

    // Delete as expired
    let mut expired = account.delete_expired_intent<Outcome>(key, &clock, scenario.ctx());
    config::delete_add_dep(&mut expired);
    expired.destroy_empty();

    end(scenario, extensions, account, clock, cap);
}

#[test]
fun test_delete_remove_dep_expired() {
    let (mut scenario, extensions, mut account, mut clock, cap) = start();
    clock.increment_for_testing(1);
    let key = b"dummy".to_string();

    // Create intent with remove_dep action
    let mut intent = create_dummy_intent(&mut scenario, &account, &extensions, &clock);
    add_remove_dep_spec(&mut intent, @0xABC);
    account.insert_intent(&extensions, intent, version::current(), DummyIntent());

    // Delete as expired
    let mut expired = account.delete_expired_intent<Outcome>(key, &clock, scenario.ctx());
    config::delete_remove_dep(&mut expired);
    expired.destroy_empty();

    end(scenario, extensions, account, clock, cap);
}

#[test, expected_failure(abort_code = config::EPackageNotAuthorized)]
fun test_error_add_unverified_dep_when_not_allowed() {
    let (mut scenario, extensions, mut account, clock, cap) = start();
    let key = b"dummy".to_string();

    // unverified_allowed is false by default
    assert!(!account.deps().unverified_allowed());

    // Try to add an unverified package (not in global registry) - should fail
    let mut intent = create_dummy_intent(&mut scenario, &account, &extensions, &clock);
    add_add_dep_spec(&mut intent, CUSTOM_PKG, b"CustomPkg".to_string(), 1);
    account.insert_intent(&extensions, intent, version::current(), DummyIntent());

    let (_, mut executable) = account.create_executable<Config, Outcome, Witness>(
        &extensions,
        key,
        &clock,
        version::current(),
        Witness(),
        scenario.ctx(),
    );

    // This should fail because CUSTOM_PKG is not in global registry and unverified_allowed is false
    config::do_add_dep<Config, Outcome, DummyIntent>(
        &mut executable,
        &mut account,
        &extensions,
        version_witness::new_for_testing(@account_protocol),
        DummyIntent(),
    );

    // unreachable
    account.confirm_execution(executable);
    end(scenario, extensions, account, clock, cap);
}

#[test]
fun test_add_dep_spec() {
    let (scenario, extensions, mut account, clock, cap) = start();

    // Verify the account_deps table starts empty
    let external_addr = @0xABC;
    assert!(!deps::contains_dep(account.account_deps(), external_addr));

    end(scenario, extensions, account, clock, cap);
}
