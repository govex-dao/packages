// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Tests for currency-related actions
/// Tests the full intent execution flow using dao_init pattern
///
/// These tests use the futarchy_factory test infrastructure to create
/// proper DAO environments for testing currency actions.
#[test_only]
module action_tests::currency_action_tests;

use account_actions::action_spec_builder;
use account_actions::currency;
use account_actions::currency_init_actions;
use account_actions::version;
use account_protocol::account::{Self as account_mod, Account};
use account_protocol::intents;
use account_protocol::package_registry::{Self, PackageRegistry};
use futarchy_factory::dao_init_executor;
use futarchy_factory::dao_init_outcome;
use futarchy_factory::factory::{Self, Factory, FactoryOwnerCap};
use futarchy_factory::test_asset::{Self, TEST_ASSET};
use futarchy_factory::test_stable_regular::TEST_STABLE_REGULAR;
use futarchy_markets_core::fee::{Self, FeeManager};
use sui::clock;
use sui::coin::{Self as coin, Coin, TreasuryCap, CoinMetadata};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};

// === Setup Helper ===

/// Setup test environment with factory, fee manager, and registry
fun setup_test(sender: address): Scenario {
    let mut scenario = ts::begin(sender);

    // Create factory
    ts::next_tx(&mut scenario, sender);
    {
        factory::create_factory(ts::ctx(&mut scenario));
    };

    // Create fee manager
    ts::next_tx(&mut scenario, sender);
    {
        fee::create_fee_manager_for_testing(ts::ctx(&mut scenario));
    };

    // Create package registry
    ts::next_tx(&mut scenario, sender);
    {
        package_registry::init_for_testing(ts::ctx(&mut scenario));
    };

    // Register packages in registry
    ts::next_tx(&mut scenario, sender);
    {
        let mut registry = ts::take_shared<PackageRegistry>(&scenario);
        package_registry::add_for_testing(
            &mut registry,
            b"account_protocol".to_string(),
            @account_protocol,
            1,
        );
        package_registry::add_for_testing(
            &mut registry,
            b"account_actions".to_string(),
            @account_actions,
            1,
        );
        package_registry::add_for_testing(
            &mut registry,
            b"futarchy_core".to_string(),
            @futarchy_core,
            1,
        );
        package_registry::add_for_testing(
            &mut registry,
            b"futarchy_factory".to_string(),
            @futarchy_factory,
            1,
        );
        ts::return_shared(registry);
    };

    // Add TEST_STABLE_REGULAR as allowed stable type
    ts::next_tx(&mut scenario, sender);
    {
        let mut factory = ts::take_shared<Factory>(&scenario);
        let owner_cap = ts::take_from_sender<FactoryOwnerCap>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        factory::add_allowed_stable_type<TEST_STABLE_REGULAR>(
            &mut factory,
            &owner_cap,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_to_sender(&scenario, owner_cap);
        ts::return_shared(factory);
    };

    scenario
}

fun create_payment(amount: u64, scenario: &mut Scenario): Coin<SUI> {
    coin::mint_for_testing<SUI>(amount, ts::ctx(scenario))
}

// === Test: Return Both Treasury Cap and Metadata ===

#[test]
/// Test returning both treasury cap and metadata in a single intent execution
/// This exercises multiple do_init_* actions in sequence
fun test_return_treasury_cap_and_metadata() {
    let sender = @0xA;
    let treasury_recipient = @0xB;
    let metadata_recipient = @0xC;

    let mut scenario = setup_test(sender);

    // Initialize test asset coin
    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    // Create DAO with both ReturnTreasuryCap and ReturnMetadata specs
    ts::next_tx(&mut scenario, sender);
    {
        let mut factory = ts::take_shared<Factory>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let mut fee_manager = ts::take_shared<FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = create_payment(10_000, &mut scenario);

        let treasury_cap = ts::take_from_sender<TreasuryCap<TEST_ASSET>>(&scenario);
        let coin_metadata = ts::take_from_sender<CoinMetadata<TEST_ASSET>>(&scenario);

        // Build action specs - return both treasury cap and metadata
        let mut builder = action_spec_builder::new();
        currency_init_actions::add_return_treasury_cap_spec(&mut builder, treasury_recipient);
        currency_init_actions::add_return_metadata_spec(&mut builder, metadata_recipient);
        let init_specs = action_spec_builder::into_vector(builder);

        factory::create_dao_test<TEST_ASSET, TEST_STABLE_REGULAR>(
            &mut factory,
            &registry,
            &mut fee_manager,
            payment,
            treasury_cap,
            coin_metadata,
            init_specs,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        ts::return_shared(fee_manager);
        ts::return_shared(factory);
    };

    // Execute both actions: begin → do_init_remove_treasury_cap → do_init_remove_metadata → finalize
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // 1. Begin execution
        let mut executable = dao_init_executor::begin_execution(
            &mut account,
            &registry,
            &clock,
            ts::ctx(&mut scenario),
        );

        let version_witness = version::current();
        let intent_witness = dao_init_executor::dao_init_intent_witness();

        // 2. Execute first action - remove treasury cap
        currency::do_init_remove_treasury_cap<
            futarchy_core::futarchy_config::FutarchyConfig,
            dao_init_outcome::DaoInitOutcome,
            TEST_ASSET,
            dao_init_executor::DaoInitIntent,
        >(
            &mut executable,
            &mut account,
            &registry,
            version_witness,
            intent_witness,
        );

        // 3. Execute second action - remove metadata
        // NOTE: Must use factory::coin_metadata_key since that's how factory stores the metadata
        currency::do_init_remove_metadata<
            futarchy_core::futarchy_config::FutarchyConfig,
            dao_init_outcome::DaoInitOutcome,
            factory::CoinMetadataKey<TEST_ASSET>,
            TEST_ASSET,
            dao_init_executor::DaoInitIntent,
        >(
            &mut executable,
            &mut account,
            &registry,
            factory::coin_metadata_key<TEST_ASSET>(),
            version_witness,
            intent_witness,
        );

        // 4. Finalize execution
        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    // Verify treasury cap was transferred to treasury_recipient
    ts::next_tx(&mut scenario, treasury_recipient);
    {
        let treasury_cap = ts::take_from_sender<TreasuryCap<TEST_ASSET>>(&scenario);
        ts::return_to_sender(&scenario, treasury_cap);
    };

    // Verify metadata was transferred to metadata_recipient
    ts::next_tx(&mut scenario, metadata_recipient);
    {
        let coin_metadata = ts::take_from_sender<CoinMetadata<TEST_ASSET>>(&scenario);
        ts::return_to_sender(&scenario, coin_metadata);
    };

    ts::end(scenario);
}

// === Test: Action Order Matters ===

#[test]
#[expected_failure]
/// Test that executing actions in wrong order fails
/// Specs say: treasury_cap first, metadata second
/// We try: metadata first - should fail
fun test_wrong_action_order_fails() {
    let sender = @0xA;
    let treasury_recipient = @0xB;
    let metadata_recipient = @0xC;

    let mut scenario = setup_test(sender);

    // Initialize test asset coin
    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    // Create DAO with treasury cap THEN metadata specs (in that order)
    ts::next_tx(&mut scenario, sender);
    {
        let mut factory = ts::take_shared<Factory>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let mut fee_manager = ts::take_shared<FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = create_payment(10_000, &mut scenario);

        let treasury_cap = ts::take_from_sender<TreasuryCap<TEST_ASSET>>(&scenario);
        let coin_metadata = ts::take_from_sender<CoinMetadata<TEST_ASSET>>(&scenario);

        // Build specs: treasury_cap first, metadata second
        let mut builder = action_spec_builder::new();
        currency_init_actions::add_return_treasury_cap_spec(&mut builder, treasury_recipient);
        currency_init_actions::add_return_metadata_spec(&mut builder, metadata_recipient);
        let init_specs = action_spec_builder::into_vector(builder);

        factory::create_dao_test<TEST_ASSET, TEST_STABLE_REGULAR>(
            &mut factory,
            &registry,
            &mut fee_manager,
            payment,
            treasury_cap,
            coin_metadata,
            init_specs,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        ts::return_shared(fee_manager);
        ts::return_shared(factory);
    };

    // Try to execute metadata FIRST (wrong order) - should fail
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let mut executable = dao_init_executor::begin_execution(
            &mut account,
            &registry,
            &clock,
            ts::ctx(&mut scenario),
        );

        let version_witness = version::current();
        let intent_witness = dao_init_executor::dao_init_intent_witness();

        // Try metadata first (but spec says treasury_cap first)
        // This should FAIL because action type validation will fail
        // NOTE: Must use factory::coin_metadata_key since that's how factory stores the metadata
        currency::do_init_remove_metadata<
            futarchy_core::futarchy_config::FutarchyConfig,
            dao_init_outcome::DaoInitOutcome,
            factory::CoinMetadataKey<TEST_ASSET>,
            TEST_ASSET,
            dao_init_executor::DaoInitIntent,
        >(
            &mut executable,
            &mut account,
            &registry,
            factory::coin_metadata_key<TEST_ASSET>(),
            version_witness,
            intent_witness,
        );

        // Should never reach here
        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    ts::end(scenario);
}

// === Test: Empty Init Specs ===

#[test]
/// Test that DAO can be created with empty init specs
/// This verifies the basic DAO creation works without any initialization actions
fun test_create_dao_with_empty_specs() {
    let sender = @0xA;

    let mut scenario = setup_test(sender);

    // Initialize test asset coin
    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    // Create DAO with empty specs
    ts::next_tx(&mut scenario, sender);
    {
        let mut factory = ts::take_shared<Factory>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let mut fee_manager = ts::take_shared<FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = create_payment(10_000, &mut scenario);

        let treasury_cap = ts::take_from_sender<TreasuryCap<TEST_ASSET>>(&scenario);
        let coin_metadata = ts::take_from_sender<CoinMetadata<TEST_ASSET>>(&scenario);

        // Empty init specs
        let init_specs = vector::empty();

        factory::create_dao_test<TEST_ASSET, TEST_STABLE_REGULAR>(
            &mut factory,
            &registry,
            &mut fee_manager,
            payment,
            treasury_cap,
            coin_metadata,
            init_specs,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        ts::return_shared(fee_manager);
        ts::return_shared(factory);
    };

    // Verify DAO was created and has no dao_init intent
    ts::next_tx(&mut scenario, sender);
    {
        let account = ts::take_shared<Account>(&scenario);

        // With empty specs, no dao_init intent should be created
        let account_intents = account_mod::intents(&account);
        assert!(!intents::contains(account_intents, b"dao_init".to_string()), 0);

        ts::return_shared(account);
    };

    ts::end(scenario);
}
