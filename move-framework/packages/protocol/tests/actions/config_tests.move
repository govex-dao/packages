#[test_only]
module account_protocol::config_intents_tests;

use account_protocol::package_registry::{Self as package_registry, PackageRegistry, PackageAdminCap};
use account_protocol::account::{Self, Account};
use account_protocol::config;
use account_protocol::deps;
use account_protocol::intents;
use account_protocol::version;
use sui::clock::{Self, Clock};
use sui::test_scenario::{Self as ts, Scenario};
use sui::test_utils::destroy;

// === Imports ===

// === Constants ===

const OWNER: address = @0xCAFE;

// === Structs ===

public struct Witness() has copy, drop;

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
    package_registry::add_for_testing(&mut extensions,  b"AccountProtocol".to_string(), @account_protocol, 1);
    package_registry::add_for_testing(&mut extensions,  b"AccountConfig".to_string(), @0x1, 1);
    package_registry::update_for_testing(&mut extensions,  b"AccountConfig".to_string(), @0x11, 2);
    package_registry::add_for_testing(&mut extensions,  b"AccountActions".to_string(), @0x2, 1);
    // add external dep
    package_registry::add_for_testing(&mut extensions,  b"External".to_string(), @0xABC, 1);

    let deps = deps::new(&extensions);
    let account = account::new(Config {}, deps, &extensions, version::current(), Witness(), scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    // create world
    (scenario, extensions, account, clock, cap)
}

fun end(scenario: Scenario, extensions: PackageRegistry, account: Account, clock: Clock, cap: PackageAdminCap) {
    destroy(extensions);
    destroy(account);
    destroy(clock);
    destroy(cap);
    ts::end(scenario);
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

// Removed test - config_deps functionality no longer exists after deps refactoring

// Removed test - config_deps functionality no longer exists after deps refactoring

// Removed test - toggle_unverified_allowed functionality no longer exists after deps refactoring

// Removed test - toggle_unverified_allowed functionality no longer exists after deps refactoring
