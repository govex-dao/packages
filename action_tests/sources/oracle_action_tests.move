// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Tests for oracle actions via launchpad init flow
///
/// Tests:
/// - do_create_oracle_grant (creates price-based unlock grants)
#[test_only]
module action_tests::oracle_action_tests;

use account_actions::action_spec_builder;
use account_actions::version;
use account_protocol::account::Account;
use account_protocol::package_registry::{Self, PackageRegistry};
use futarchy_oracle::oracle_actions;
use futarchy_oracle::oracle_init_actions;
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

const RECIPIENT1: address = @0xBEEF;
const RECIPIENT2: address = @0xDEAD;

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
        package_registry::add_for_testing(&mut registry, b"futarchy_oracle".to_string(), @futarchy_oracle, 1);
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
            allowed_caps, option::none(), false, b"Oracle Test".to_string(),
            vector::empty<String>(), vector::empty<String>(), payment,
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
/// Test do_create_oracle_grant action via launchpad init flow
/// This creates a DAO, then executes the create_oracle_grant action
fun test_do_create_oracle_grant() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build oracle grant spec - single tier with one recipient
    let mut builder = action_spec_builder::new();

    // Create tier spec: price threshold 2.0 (in 1e12 scale), unlock above, single recipient
    let recipients = vector[oracle_init_actions::new_recipient_mint(RECIPIENT1, 1000)];
    let tier_spec = oracle_init_actions::new_tier_spec(
        2_000_000_000_000u128, // 2.0 price threshold (absolute price in 1e12 scale)
        true, // unlock above this price
        recipients,
        b"Single Tier Grant".to_string(),
    );

    oracle_init_actions::add_create_oracle_grant_spec<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
        &mut builder,
        vector[tier_spec],
        false, // use_relative_pricing = false (absolute prices)
        1_500_000_000, // launchpad_multiplier (1.5x in 1e9 scale)
        0, // earliest_execution_offset_ms (no delay)
        1, // expiry_years
        true, // cancelable
        b"Test Oracle Grant".to_string(),
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the create oracle grant action
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

        oracle_actions::do_create_oracle_grant<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR, dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Action executed successfully - if we got here without abort, grant was created
        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_create_oracle_grant with multiple tiers and recipients
fun test_do_create_oracle_grant_multi_tier() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build oracle grant spec with multiple tiers
    let mut builder = action_spec_builder::new();

    // Tier 1: 2x price threshold, unlock above
    let tier1_recipients = vector[
        oracle_init_actions::new_recipient_mint(RECIPIENT1, 500),
        oracle_init_actions::new_recipient_mint(RECIPIENT2, 300),
    ];
    let tier1 = oracle_init_actions::new_tier_spec(
        2_000_000_000_000u128, // 2.0 price
        true,
        tier1_recipients,
        b"Tier 1 - 2x".to_string(),
    );

    // Tier 2: 5x price threshold, unlock above
    let tier2_recipients = vector[
        oracle_init_actions::new_recipient_mint(RECIPIENT1, 1000),
    ];
    let tier2 = oracle_init_actions::new_tier_spec(
        5_000_000_000_000u128, // 5.0 price
        true,
        tier2_recipients,
        b"Tier 2 - 5x".to_string(),
    );

    oracle_init_actions::add_create_oracle_grant_spec<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
        &mut builder,
        vector[tier1, tier2],
        false, // use_relative_pricing = false
        1_000_000_000, // 1x launchpad multiplier
        0, // no delay
        2, // 2 years expiry
        true, // cancelable
        b"Multi-Tier Grant".to_string(),
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the create oracle grant action
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

        oracle_actions::do_create_oracle_grant<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR, dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Multi-tier grant created successfully
        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_create_oracle_grant with relative pricing mode
fun test_do_cancel_grant() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build oracle grant spec - single tier with cancelable=true
    let mut builder = action_spec_builder::new();
    let recipients = vector[oracle_init_actions::new_recipient_mint(RECIPIENT1, 1000)];
    let tier_spec = oracle_init_actions::new_tier_spec(
        2_000_000_000_000u128,
        true,
        recipients,
        b"Cancelable Grant Tier".to_string(),
    );

    oracle_init_actions::add_create_oracle_grant_spec<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
        &mut builder,
        vector[tier_spec],
        false,
        1_500_000_000,
        0,
        1,
        true, // cancelable = true
        b"Cancelable Oracle Grant".to_string(),
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Phase 1: Execute create oracle grant action
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

        oracle_actions::do_create_oracle_grant<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR, dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    // Phase 2: Get the grant and create a new intent to cancel it
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let grant = ts::take_shared<oracle_actions::PriceBasedMintGrant<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);

        // Build cancel grant spec
        let mut cancel_builder = action_spec_builder::new();
        oracle_init_actions::add_cancel_grant_spec(&mut cancel_builder, object::id(&grant));
        let specs = action_spec_builder::into_vector(cancel_builder);

        // Create a new test intent with cancel action
        dao_init_executor::create_test_intent_from_specs(
            &mut account,
            &registry,
            specs,
            b"cancel_grant_test".to_string(),
            &clock,
            ts::ctx(&mut scenario),
        );

        ts::return_shared(grant);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    // Phase 3: Execute the cancel grant action (advance clock to execution time)
    // The intent was created with expiry_ms as the execution time, so advance clock
    clock::increment_for_testing(&mut clock, 30 * 24 * 60 * 60 * 1000); // 30 days
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let mut grant = ts::take_shared<oracle_actions::PriceBasedMintGrant<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);

        // Verify grant is not canceled initially
        assert!(!oracle_actions::is_canceled(&grant), 0);

        let mut executable = dao_init_executor::begin_test_execution(
            &mut account,
            &registry,
            b"cancel_grant_test".to_string(),
            &clock,
            ts::ctx(&mut scenario),
        );

        let version_witness = version::current();
        let intent_witness = dao_init_executor::dao_init_intent_witness();

        oracle_actions::do_cancel_grant<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR, dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, version_witness, intent_witness, &mut grant, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Verify grant is now canceled
        assert!(oracle_actions::is_canceled(&grant), 1);

        ts::return_shared(grant);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test do_create_oracle_grant with relative pricing mode
fun test_do_create_oracle_grant_relative_pricing() {
    let sender = @0xA;
    let contributor = @0xB;

    let mut scenario = setup_test(sender);

    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    create_raise(&mut scenario, sender);

    // Build oracle grant spec with relative pricing
    let mut builder = action_spec_builder::new();

    // With relative pricing, thresholds are multipliers (in 1e9 scale)
    // 2_000_000_000 = 2x launchpad price
    let recipients = vector[oracle_init_actions::new_recipient_mint(RECIPIENT1, 2000)];
    let tier_spec = oracle_init_actions::new_tier_spec(
        2_000_000_000u128, // 2x multiplier (in 1e9 scale when use_relative_pricing=true)
        true, // unlock above
        recipients,
        b"2x Multiplier Tier".to_string(),
    );

    oracle_init_actions::add_create_oracle_grant_spec<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
        &mut builder,
        vector[tier_spec],
        true, // use_relative_pricing = true (thresholds are multipliers)
        1_500_000_000, // launchpad_multiplier (1.5x minimum)
        0, // no delay
        1, // 1 year expiry
        false, // not cancelable (immutable grant)
        b"Relative Price Grant".to_string(),
    );

    stage_success_specs(&mut scenario, sender, builder);
    lock_and_start(&mut scenario, sender);
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the create oracle grant action
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

        oracle_actions::do_create_oracle_grant<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR, dao_init_outcome::DaoInitOutcome, dao_init_executor::DaoInitIntent>(
            &mut executable, &mut account, &registry, version_witness, intent_witness, &clock, ts::ctx(&mut scenario),
        );

        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        // Relative pricing grant created successfully
        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
