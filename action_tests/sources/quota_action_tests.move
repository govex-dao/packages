// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Tests for quota actions via launchpad init flow
///
/// Tests:
/// - do_set_quotas (sets proposal quotas for addresses)
#[test_only]
module action_tests::quota_action_tests;

use account_actions::action_spec_builder;
use account_actions::version;
use account_protocol::account::{Self, Account};
use account_protocol::package_registry::{Self, PackageRegistry};
use futarchy_actions::quota_actions;
use futarchy_actions::quota_init_actions;
use futarchy_factory::dao_init_executor;
use futarchy_factory::dao_init_outcome;
use futarchy_factory::factory::{Self, Factory, FactoryOwnerCap};
use futarchy_factory::launchpad::{Self, Raise, CreatorCap};
use futarchy_factory::test_asset_regular::{Self as test_asset, TEST_ASSET_REGULAR};
use futarchy_factory::test_stable_regular::TEST_STABLE_REGULAR;
use futarchy_markets_core::fee::{Self, FeeManager};
use futarchy_one_shot_utils::constants;
use futarchy_core::futarchy_config;
use futarchy_core::proposal_quota_registry;
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

const USER1: address = @0xBEEF;
const USER2: address = @0xDEAD;

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
            b"test".to_string(), TOKENS_FOR_SALE, MIN_RAISE,
            allowed_caps, option::none(), false, b"Quota Test".to_string(),
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
/// Test do_set_quotas action via launchpad init flow
/// This creates a DAO, then executes the set_quotas action to grant quotas to users
fun test_do_set_quotas() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build set quotas spec - grant quota to USER1 and USER2
    let mut builder = action_spec_builder::new();
    quota_init_actions::add_set_quotas_spec(
        &mut builder,
        vector[USER1, USER2], // users
        5u64, // quota_amount (5 proposals per period)
        2592000000u64, // quota_period_ms (30 days)
        100u64, // reduced_fee
        3u64, // sponsor_quota_amount
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the set quotas action
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

        quota_actions::do_set_quotas<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Verify quotas were set by checking the registry embedded in FutarchyConfig
        let config = account::config<futarchy_config::FutarchyConfig>(&account);
        let quota_registry = futarchy_config::quota_registry(config);

        // Check that USER1 has quota
        assert!(proposal_quota_registry::has_quota(quota_registry, USER1), 0);
        // Check that USER2 has quota
        assert!(proposal_quota_registry::has_quota(quota_registry, USER2), 1);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_set_quotas with quota removal (quota_amount = 0)
fun test_do_set_quotas_removal() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build set quotas spec with quota_amount = 0 (removal)
    let mut builder = action_spec_builder::new();
    quota_init_actions::add_set_quotas_spec(
        &mut builder,
        vector[USER1], // users
        0u64, // quota_amount = 0 means removal
        0u64, // ignored for removal
        0u64, // ignored for removal
        0u64, // ignored for removal
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the set quotas action (removal)
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

        quota_actions::do_set_quotas<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Action executed successfully - if we got here without abort, quota removal worked
        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_set_quotas with multiple users and high quota
fun test_do_set_quotas_vip_tier() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build VIP tier quota spec
    let mut builder = action_spec_builder::new();
    quota_init_actions::add_set_quotas_spec(
        &mut builder,
        vector[USER1, USER2], // VIP users
        20u64, // high quota (20 proposals per month)
        2592000000u64, // 30 days
        10u64, // very low fee
        10u64, // high sponsor quota
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the set quotas action
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

        quota_actions::do_set_quotas<dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Verify quotas were set by checking the registry embedded in FutarchyConfig
        let config = account::config<futarchy_config::FutarchyConfig>(&account);
        let quota_registry = futarchy_config::quota_registry(config);

        // Both users should have quota
        assert!(proposal_quota_registry::has_quota(quota_registry, USER1), 0);
        assert!(proposal_quota_registry::has_quota(quota_registry, USER2), 1);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
