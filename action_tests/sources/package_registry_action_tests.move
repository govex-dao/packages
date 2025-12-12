// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Tests for package registry actions
///
/// Tests:
/// - do_pause_account_creation
/// - do_unpause_account_creation
///
/// These tests use a DAO created via launchpad flow, then add the
/// PackageAdminCap as a managed asset to simulate a "protocol DAO".
#[test_only]
module action_tests::package_registry_action_tests;

use account_actions::action_spec_builder;
use account_actions::version;
use account_protocol::account::{Self as account_mod, Account};
use account_protocol::package_registry::{Self, PackageRegistry, PackageAdminCap};
use futarchy_actions::config_actions;
use futarchy_actions::config_init_actions;
use futarchy_factory::dao_init_executor;
use futarchy_factory::dao_init_outcome;
use futarchy_factory::factory::{Self, Factory, FactoryOwnerCap};
use futarchy_factory::launchpad::{Self, Raise, CreatorCap};
use futarchy_factory::test_asset_regular::{Self as test_asset, TEST_ASSET_REGULAR};
use futarchy_factory::test_stable_regular::TEST_STABLE_REGULAR;
use futarchy_governance_actions::package_registry_actions;
use futarchy_governance_actions::package_registry_init_actions;
use futarchy_markets_core::fee::{Self, FeeManager};
use futarchy_one_shot_utils::constants;
use sui::clock;
use sui::coin::{Self as coin, Coin, TreasuryCap, CoinMetadata};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use std::string::String;

// === Constants ===
const TOKENS_FOR_SALE: u64 = 1_000_000_000_000;
const MIN_RAISE: u64 = 10_000_000_000;
const MAX_RAISE: u64 = 100_000_000_000;
const CONTRIBUTION_AMOUNT: u64 = 30_000_000_000;

// === Setup Helpers ===

fun setup_test(sender: address): Scenario {
    let mut scenario = ts::begin(sender);

    // Create factory
    ts::next_tx(&mut scenario, sender);
    { factory::create_factory(ts::ctx(&mut scenario)); };

    // Create fee manager
    ts::next_tx(&mut scenario, sender);
    { fee::create_fee_manager_for_testing(ts::ctx(&mut scenario)); };

    // Create package registry
    ts::next_tx(&mut scenario, sender);
    { package_registry::init_for_testing(ts::ctx(&mut scenario)); };

    // Register packages
    ts::next_tx(&mut scenario, sender);
    {
        let mut registry = ts::take_shared<PackageRegistry>(&scenario);
        package_registry::add_for_testing(&mut registry, b"account_protocol".to_string(), @account_protocol, 1);
        package_registry::add_for_testing(&mut registry, b"account_actions".to_string(), @account_actions, 1);
        package_registry::add_for_testing(&mut registry, b"futarchy_core".to_string(), @futarchy_core, 1);
        package_registry::add_for_testing(&mut registry, b"futarchy_factory".to_string(), @futarchy_factory, 1);
        package_registry::add_for_testing(&mut registry, b"futarchy_actions".to_string(), @futarchy_actions, 1);
        package_registry::add_for_testing(&mut registry, b"futarchy_governance_actions".to_string(), @futarchy_governance_actions, 1);
        ts::return_shared(registry);
    };

    // Add TEST_STABLE_REGULAR as allowed stable type
    ts::next_tx(&mut scenario, sender);
    {
        let mut factory = ts::take_shared<Factory>(&scenario);
        let owner_cap = ts::take_from_sender<FactoryOwnerCap>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        factory::add_allowed_stable_type<TEST_STABLE_REGULAR>(&mut factory, &owner_cap, &clock, ts::ctx(&mut scenario));
        clock::destroy_for_testing(clock);
        ts::return_to_sender(&scenario, owner_cap);
        ts::return_shared(factory);
    };

    scenario
}

fun create_payment(amount: u64, scenario: &mut Scenario): Coin<SUI> {
    coin::mint_for_testing<SUI>(amount, ts::ctx(scenario))
}

fun create_raise(scenario: &mut Scenario, sender: address) {
    ts::next_tx(scenario, sender);
    {
        let factory = ts::take_shared<Factory>(scenario);
        let mut fee_manager = ts::take_shared<FeeManager>(scenario);
        let clock = clock::create_for_testing(ts::ctx(scenario));
        let treasury_cap = ts::take_from_sender<TreasuryCap<TEST_ASSET_REGULAR>>(scenario);
        let coin_metadata = ts::take_from_sender<CoinMetadata<TEST_ASSET_REGULAR>>(scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory, &mut fee_manager, treasury_cap, coin_metadata,
            b"test".to_string(), TOKENS_FOR_SALE, MIN_RAISE,
            allowed_caps, option::none(), false, b"Package Registry Test".to_string(),
            vector::empty<String>(), vector::empty<String>(), payment,
            &clock, ts::ctx(scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };
}

/// Stage a placeholder action spec (update_name) for the success intent
/// Launchpad requires at least one action in the success intent
fun stage_placeholder_action(scenario: &mut Scenario, sender: address) {
    ts::next_tx(scenario, sender);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        let registry = ts::take_shared<PackageRegistry>(scenario);
        let creator_cap = ts::take_from_sender<CreatorCap>(scenario);
        let clock = clock::create_for_testing(ts::ctx(scenario));

        // Create a placeholder action spec (update_name)
        let mut builder = action_spec_builder::new();
        config_init_actions::add_update_name_spec(&mut builder, b"Package Registry Test DAO".to_string());

        launchpad::stage_success_intent(&mut raise, &registry, &creator_cap, builder, &clock, ts::ctx(scenario));
        clock::destroy_for_testing(clock);
        ts::return_to_sender(scenario, creator_cap);
        ts::return_shared(registry);
        ts::return_shared(raise);
    };
}

fun lock_and_start(scenario: &mut Scenario, sender: address) {
    ts::next_tx(scenario, sender);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        let creator_cap = ts::take_from_sender<CreatorCap>(scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(scenario));
        ts::return_to_sender(scenario, creator_cap);
        ts::return_shared(raise);
    };
}

fun contribute(scenario: &mut Scenario, contributor: address, amount: u64) {
    ts::next_tx(scenario, contributor);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        let factory = ts::take_shared<Factory>(scenario);
        let clock = clock::create_for_testing(ts::ctx(scenario));
        let contribution = coin::mint_for_testing<TEST_STABLE_REGULAR>(amount, ts::ctx(scenario));
        let crank_fee = create_payment(100_000_000, scenario);
        launchpad::contribute(&mut raise, &factory, contribution, launchpad::unlimited_cap(), crank_fee, &clock, ts::ctx(scenario));
        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };
}

fun settle_and_create_dao(scenario: &mut Scenario, sender: address, clock: &sui::clock::Clock) {
    ts::next_tx(scenario, sender);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        launchpad::settle_raise(&mut raise, clock, ts::ctx(scenario));
        ts::return_shared(raise);
    };

    ts::next_tx(scenario, sender);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        let mut factory = ts::take_shared<Factory>(scenario);
        let registry = ts::take_shared<PackageRegistry>(scenario);
        let unshared_dao = launchpad::begin_dao_creation(&mut raise, &mut factory, &registry, clock, ts::ctx(scenario));
        launchpad::finalize_and_share_dao(&mut raise, unshared_dao, &registry, clock, ts::ctx(scenario));
        ts::return_shared(raise);
        ts::return_shared(factory);
        ts::return_shared(registry);
    };
}

/// Add PackageAdminCap as managed asset to the DAO (simulating protocol DAO)
fun add_package_admin_cap_to_dao(scenario: &mut Scenario, sender: address) {
    ts::next_tx(scenario, sender);
    {
        let mut account = ts::take_shared<Account>(scenario);
        let registry = ts::take_shared<PackageRegistry>(scenario);
        let admin_cap = ts::take_from_sender<PackageAdminCap>(scenario);

        account_mod::add_managed_asset(
            &mut account,
            &registry,
            b"protocol:package_admin_cap".to_string(),
            admin_cap,
            version::current(),
        );

        ts::return_shared(registry);
        ts::return_shared(account);
    };
}

// === Tests ===

#[test]
/// Test do_pause_account_creation action
fun test_do_pause_account_creation() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    // Create test asset
    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    // Create raise and go through launchpad flow
    create_raise(&mut scenario, sender);
    stage_placeholder_action(&mut scenario, sender);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the placeholder action (update_name) from launchpad
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);

        let mut executable = dao_init_executor::begin_execution_for_launchpad(
            object::id(&raise), &mut account, &registry, &clock, ts::ctx(&mut scenario),
        );

        let version_witness = version::current();
        let intent_witness = dao_init_executor::dao_init_intent_witness();

        config_actions::do_update_name<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    // Add PackageAdminCap to the DAO as a managed asset
    add_package_admin_cap_to_dao(&mut scenario, sender);

    // Build pause_account_creation spec and create intent
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);

        let mut builder = action_spec_builder::new();
        package_registry_init_actions::add_pause_account_creation_spec(&mut builder);
        let specs = action_spec_builder::into_vector(builder);

        dao_init_executor::create_test_intent_from_specs(
            &mut account,
            &registry,
            specs,
            b"pause_account_creation_test".to_string(),
            &clock,
            ts::ctx(&mut scenario),
        );

        ts::return_shared(registry);
        ts::return_shared(account);
    };

    // Execute the action (advance clock past intent execution time)
    clock::increment_for_testing(&mut clock, 30 * 24 * 60 * 60 * 1000); // 30 days
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let mut registry = ts::take_shared<PackageRegistry>(&scenario);

        // Verify account creation is not paused initially
        assert!(!package_registry::is_account_creation_paused(&registry), 0);

        let mut executable = dao_init_executor::begin_test_execution(
            &mut account,
            &registry,
            b"pause_account_creation_test".to_string(),
            &clock,
            ts::ctx(&mut scenario),
        );

        let version_witness = version::current();
        let intent_witness = dao_init_executor::dao_init_intent_witness();

        package_registry_actions::do_pause_account_creation<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable,
            &mut account,
            version_witness,
            intent_witness,
            &mut registry,
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Verify account creation is now paused
        assert!(package_registry::is_account_creation_paused(&registry), 1);

        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_unpause_account_creation action
fun test_do_unpause_account_creation() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    // Create test asset
    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    // Create raise and go through launchpad flow
    create_raise(&mut scenario, sender);
    stage_placeholder_action(&mut scenario, sender);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the placeholder action (update_name) from launchpad
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);

        let mut executable = dao_init_executor::begin_execution_for_launchpad(
            object::id(&raise), &mut account, &registry, &clock, ts::ctx(&mut scenario),
        );

        let version_witness = version::current();
        let intent_witness = dao_init_executor::dao_init_intent_witness();

        config_actions::do_update_name<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    // Add PackageAdminCap to the DAO as a managed asset
    add_package_admin_cap_to_dao(&mut scenario, sender);

    // First pause account creation directly (so we can test unpausing)
    ts::next_tx(&mut scenario, sender);
    {
        let mut registry = ts::take_shared<PackageRegistry>(&scenario);
        let admin_cap = package_registry::new_admin_cap_for_testing(ts::ctx(&mut scenario));
        package_registry::pause_account_creation(&mut registry, &admin_cap);
        sui::transfer::public_transfer(admin_cap, sender);
        ts::return_shared(registry);
    };

    // Build unpause_account_creation spec and create intent
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);

        let mut builder = action_spec_builder::new();
        package_registry_init_actions::add_unpause_account_creation_spec(&mut builder);
        let specs = action_spec_builder::into_vector(builder);

        dao_init_executor::create_test_intent_from_specs(
            &mut account,
            &registry,
            specs,
            b"unpause_account_creation_test".to_string(),
            &clock,
            ts::ctx(&mut scenario),
        );

        ts::return_shared(registry);
        ts::return_shared(account);
    };

    // Execute the action (advance clock past intent execution time)
    clock::increment_for_testing(&mut clock, 30 * 24 * 60 * 60 * 1000); // 30 days
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let mut registry = ts::take_shared<PackageRegistry>(&scenario);

        // Verify account creation is paused
        assert!(package_registry::is_account_creation_paused(&registry), 0);

        let mut executable = dao_init_executor::begin_test_execution(
            &mut account,
            &registry,
            b"unpause_account_creation_test".to_string(),
            &clock,
            ts::ctx(&mut scenario),
        );

        let version_witness = version::current();
        let intent_witness = dao_init_executor::dao_init_intent_witness();

        package_registry_actions::do_unpause_account_creation<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable,
            &mut account,
            version_witness,
            intent_witness,
            &mut registry,
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Verify account creation is now unpaused
        assert!(!package_registry::is_account_creation_paused(&registry), 1);

        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
