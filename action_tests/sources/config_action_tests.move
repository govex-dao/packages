// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Tests for config actions via launchpad init flow
///
/// Tests actions like:
/// - do_update_name
/// - do_update_trading_params
/// - do_update_twap_config
/// - do_set_proposals_enabled
#[test_only]
module action_tests::config_action_tests;

use account_actions::action_spec_builder;
use account_actions::version;
use account_protocol::account::Account;
use account_protocol::package_registry::{Self, PackageRegistry};
use futarchy_actions::config_actions;
use futarchy_actions::config_init_actions;
use futarchy_actions::dissolution_actions;
use futarchy_actions::dissolution_init_actions;
use futarchy_factory::dao_init_executor;
use futarchy_factory::dao_init_outcome;
use futarchy_factory::factory::{Self, Factory, FactoryOwnerCap};
use futarchy_factory::launchpad::{Self, Raise, CreatorCap};
use futarchy_factory::test_asset_regular::{Self as test_asset, TEST_ASSET_REGULAR};
use futarchy_factory::test_stable_regular::TEST_STABLE_REGULAR;
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

    ts::next_tx(&mut scenario, sender);
    { factory::create_factory(ts::ctx(&mut scenario)); };

    ts::next_tx(&mut scenario, sender);
    { fee::create_fee_manager_for_testing(ts::ctx(&mut scenario)); };

    ts::next_tx(&mut scenario, sender);
    { package_registry::init_for_testing(ts::ctx(&mut scenario)); };

    ts::next_tx(&mut scenario, sender);
    {
        let mut registry = ts::take_shared<PackageRegistry>(&scenario);
        package_registry::add_for_testing(&mut registry, b"account_protocol".to_string(), @account_protocol, 1);
        package_registry::add_for_testing(&mut registry, b"account_actions".to_string(), @account_actions, 1);
        package_registry::add_for_testing(&mut registry, b"futarchy_core".to_string(), @futarchy_core, 1);
        package_registry::add_for_testing(&mut registry, b"futarchy_factory".to_string(), @futarchy_factory, 1);
        package_registry::add_for_testing(&mut registry, b"futarchy_actions".to_string(), @futarchy_actions, 1);
        ts::return_shared(registry);
    };

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
            b"test".to_string(), TOKENS_FOR_SALE, MIN_RAISE, option::some(MAX_RAISE),
            allowed_caps, option::none(), false, b"Config Test".to_string(),
            vector::empty<String>(), vector::empty<String>(), payment, 0,
            &clock, ts::ctx(scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };
}

fun stage_success_specs(scenario: &mut Scenario, sender: address, builder: action_spec_builder::Builder) {
    ts::next_tx(scenario, sender);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        let registry = ts::take_shared<PackageRegistry>(scenario);
        let creator_cap = ts::take_from_sender<CreatorCap>(scenario);
        let clock = clock::create_for_testing(ts::ctx(scenario));
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

// === Tests ===

#[test]
/// Test do_update_name action via launchpad init flow
fun test_do_update_name() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build update name spec
    let mut builder = action_spec_builder::new();
    config_init_actions::add_update_name_spec(&mut builder, b"New DAO Name".to_string());

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the update name action
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

        // Action executed successfully - if we got here without abort, it worked
        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_update_trading_params action
fun test_do_update_trading_params() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build update trading params spec with new values
    // Signature: (builder, min_asset, min_stable, review_period, trading_period, amm_fee)
    let mut builder = action_spec_builder::new();
    config_init_actions::add_update_trading_params_spec(
        &mut builder,
        option::none(), // min_asset_amount (unchanged)
        option::none(), // min_stable_amount (unchanged)
        option::some(172800000), // new review period (2 days)
        option::some(518400000), // new trading period (6 days)
        option::none(), // amm_total_fee_bps (unchanged)
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the update trading params action
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

        config_actions::do_update_trading_params<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Action executed successfully - if we got here without abort, it worked
        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_set_proposals_enabled action
fun test_do_set_proposals_enabled() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build set proposals disabled spec
    let mut builder = action_spec_builder::new();
    config_init_actions::add_set_proposals_enabled_spec(&mut builder, false); // Disable proposals

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the set proposals enabled action
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

        config_actions::do_set_proposals_enabled<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Action executed successfully - if we got here without abort, it worked
        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test multiple config actions in sequence
fun test_multiple_config_actions() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build multiple config specs: update name + update trading params
    let mut builder = action_spec_builder::new();
    config_init_actions::add_update_name_spec(&mut builder, b"Multi Config DAO".to_string());
    config_init_actions::add_update_trading_params_spec(
        &mut builder,
        option::none(),
        option::none(),
        option::some(172800000),
        option::some(518400000),
        option::none(),
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute both actions in sequence
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

        // Action 1: Update name
        config_actions::do_update_name<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        // Action 2: Update trading params
        config_actions::do_update_trading_params<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Both actions executed successfully - if we got here without abort, they worked
        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_update_twap_config action
fun test_do_update_twap_config() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build update twap config spec
    let mut builder = action_spec_builder::new();
    config_init_actions::add_update_twap_config_spec(
        &mut builder,
        option::some(7200000), // start_delay (2 hours in ms)
        option::some(50), // step_max
        option::none(), // initial_observation
        option::none(), // threshold (unchanged)
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the update twap config action
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

        config_actions::do_update_twap_config<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_update_governance action
fun test_do_update_governance() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build update governance spec
    let mut builder = action_spec_builder::new();
    config_init_actions::add_update_governance_spec(
        &mut builder,
        option::some(10), // max_outcomes
        option::some(15), // max_actions_per_outcome (max is 20)
        option::some(500_000_000), // required_bond_amount (0.5 SUI)
        option::none(), // max_intents_per_outcome
        option::none(), // proposal_intent_expiry_ms
        option::none(), // optimistic_challenge_fee
        option::none(), // optimistic_challenge_period_ms
        option::none(), // proposal_creation_fee
        option::none(), // proposal_fee_per_outcome
        option::some(true), // accept_new_proposals
        option::none(), // enable_premarket_reservation_lock
        option::none(), // show_proposal_details
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the update governance action
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

        config_actions::do_update_governance<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_update_metadata_table action
fun test_do_update_metadata_table() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build update metadata table spec
    let mut builder = action_spec_builder::new();
    let mut keys = vector::empty<String>();
    let mut values = vector::empty<String>();
    vector::push_back(&mut keys, b"website".to_string());
    vector::push_back(&mut values, b"https://example.com".to_string());
    vector::push_back(&mut keys, b"twitter".to_string());
    vector::push_back(&mut values, b"@example_dao".to_string());

    config_init_actions::add_update_metadata_table_spec(
        &mut builder,
        keys,
        values,
        vector::empty<String>(), // keys_to_remove
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the update metadata table action
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

        config_actions::do_update_metadata_table<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_update_metadata action (updates DAO name, icon, description)
fun test_do_update_metadata() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build update metadata spec
    let mut builder = action_spec_builder::new();
    config_init_actions::add_update_metadata_spec(
        &mut builder,
        option::some(b"Updated DAO Name".to_ascii_string()), // dao_name
        option::some(sui::url::new_unsafe(b"https://new-icon.com/icon.png".to_ascii_string())), // icon_url
        option::some(b"Updated DAO description".to_string()), // description
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the update metadata action
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

        config_actions::do_update_metadata<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_update_sponsorship_config action
fun test_do_update_sponsorship_config() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build update sponsorship config spec
    // Note: sponsored_threshold must be non-positive and magnitude must be ≤5% (50_000_000_000 in 1e12 scale)
    let mut builder = action_spec_builder::new();
    config_init_actions::add_update_sponsorship_config_spec(
        &mut builder,
        option::some(true), // enabled
        option::some(futarchy_types::signed::new(30_000_000_000, true)), // sponsored_threshold (-0.03 = -3% in 1e12, must be non-positive)
        option::some(true), // waive_advancement_fees
        option::some(5), // default_sponsor_quota_amount
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the update sponsorship config action
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

        config_actions::do_update_sponsorship_config<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_update_conditional_metadata action
fun test_do_update_conditional_metadata() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build update conditional metadata spec
    let mut builder = action_spec_builder::new();
    config_init_actions::add_update_conditional_metadata_spec(
        &mut builder,
        option::some(true), // use_outcome_index
        option::none(), // conditional_metadata (keep default)
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the update conditional metadata action
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

        config_actions::do_update_conditional_metadata<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_terminate_dao action
/// Note: This terminates the DAO, setting it to dissolving state
fun test_do_terminate_dao() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build terminate dao spec
    let mut builder = action_spec_builder::new();
    config_init_actions::add_terminate_dao_spec(
        &mut builder,
        b"Test termination reason".to_string(), // reason
        86400000, // dissolution_unlock_delay_ms (1 day)
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the terminate dao action
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

        config_actions::do_terminate_dao<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_create_dissolution_capability action
/// This test chains termination with dissolution capability creation
/// Both actions are included in the same init intent
fun test_do_create_dissolution_capability() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build terminate dao spec followed by create dissolution capability spec
    // These are chained in the same intent
    let mut builder = action_spec_builder::new();
    config_init_actions::add_terminate_dao_spec(
        &mut builder,
        b"Dissolution test termination".to_string(),
        86400000, // dissolution_unlock_delay_ms (1 day)
    );
    dissolution_init_actions::add_create_dissolution_capability_spec<TEST_ASSET_REGULAR>(&mut builder);

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute both actions: terminate_dao then create_dissolution_capability
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

        // Action 1: Terminate the DAO
        config_actions::do_terminate_dao<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        // Action 2: Create dissolution capability (DAO is now in TERMINATED state)
        dissolution_actions::do_create_dissolution_capability<TEST_ASSET_REGULAR, dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
