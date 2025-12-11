// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_factory::launchpad_edge_cases_tests;

use account_protocol::package_registry::{Self as package_registry, PackageRegistry};
use futarchy_factory::factory;
use futarchy_factory::launchpad;
use futarchy_factory::test_asset_regular::{Self as test_asset_regular, TEST_ASSET_REGULAR};
use futarchy_factory::test_asset_regular_2::{Self as test_asset_regular_2, TEST_ASSET_REGULAR_2};
use futarchy_factory::test_stable_regular::{Self as test_stable_regular, TEST_STABLE_REGULAR};
use futarchy_markets_core::fee;
use std::string::String;
use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};

// === Constants ===

const CREATOR: address = @0xBBB001;
const CONTRIBUTOR1: address = @0xBBB002;

// === Helper Functions ===

fun setup_test(sender: address): Scenario {
    let mut scenario = ts::begin(sender);

    ts::next_tx(&mut scenario, sender);
    factory::create_factory(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, sender);
    fee::create_fee_manager_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, sender);
    package_registry::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, sender);
    {
        let mut registry = ts::take_shared<PackageRegistry>(&scenario);
        let admin_cap = ts::take_from_sender<package_registry::PackageAdminCap>(&scenario);

        package_registry::add_for_testing(
            &mut registry,
            b"AccountProtocol".to_string(),
            @account_protocol,
            1,
        );
        package_registry::add_for_testing(
            &mut registry,
            b"FutarchyCore".to_string(),
            @futarchy_core,
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
            b"FutarchyActions".to_string(),
            @futarchy_actions,
            1,
        );
        package_registry::add_for_testing(
            &mut registry,
            b"FutarchyGovernanceActions".to_string(),
            @0xb1054e9a9b316e105c908be2cddb7f64681a63f0ae80e9e5922bf461589c4bc7,
            1,
        );
        package_registry::add_for_testing(
            &mut registry,
            b"FutarchyOracleActions".to_string(),
            @futarchy_oracle,
            1,
        );

        ts::return_to_sender(&scenario, admin_cap);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, sender);
    {
        let mut factory = ts::take_shared<factory::Factory>(&scenario);
        let owner_cap = ts::take_from_sender<factory::FactoryOwnerCap>(&scenario);
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

fun create_stable_coin(amount: u64, scenario: &mut Scenario): Coin<TEST_STABLE_REGULAR> {
    coin::mint_for_testing<TEST_STABLE_REGULAR>(amount, ts::ctx(scenario))
}

// === Tests ===

#[test]
#[expected_failure(abort_code = launchpad::EZeroContribution)]
/// Test that zero contributions are rejected
fun test_zero_contribution_rejected() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"zero-test".to_string(),
            1_000_000_000_000,
            10_000_000_000,
            allowed_caps,
            option::none(),
            false,
            b"Zero Contribution Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
            0, // extra_mint_to_caller
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };

    // Lock intents before accepting contributions
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    // Try to contribute 0 (should fail)
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(0, &mut scenario); // Zero!
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            launchpad::unlimited_cap(),
            crank_fee,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = launchpad::ERaiseNotActive)]
/// Test contribution before start time is rejected
fun test_contribution_before_start_time() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    // Create raise with 1 day delay
    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"delayed-start".to_string(),
            1_000_000_000_000,
            10_000_000_000,
            allowed_caps,
            option::some(86400000), // 1 day delay
            false,
            b"Delayed Start Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
            0, // extra_mint_to_caller
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };

    // Lock intents before accepting contributions
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    // Try to contribute immediately (should fail - not started yet)
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(10_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            launchpad::unlimited_cap(),
            crank_fee,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = launchpad::ERaiseNotActive)]
/// Test contribution after deadline is rejected
fun test_contribution_after_deadline() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"after-deadline".to_string(),
            1_000_000_000_000,
            10_000_000_000,
            allowed_caps,
            option::none(),
            false,
            b"After Deadline Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
            0, // extra_mint_to_caller
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };

    // Lock intents before accepting contributions
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    // Try to contribute after deadline
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Set clock past deadline
        let deadline = launchpad::deadline(&raise);
        clock.set_for_testing(deadline + 1000);

        let contribution = create_stable_coin(10_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            launchpad::unlimited_cap(),
            crank_fee,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = launchpad::EDeadlineNotReached)]
/// Test settlement before deadline is rejected
fun test_settlement_before_deadline() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"early-settle".to_string(),
            1_000_000_000_000,
            10_000_000_000,
            allowed_caps,
            option::none(),
            false,
            b"Early Settlement Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
            0, // extra_mint_to_caller
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };

    // Lock intents before accepting contributions
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    // Contribute
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(15_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            launchpad::unlimited_cap(),
            crank_fee,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Try to settle before deadline (should fail)
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        launchpad::settle_raise(&mut raise, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = launchpad::ESettlementAlreadyDone)]
/// Test double settlement is rejected
fun test_double_settlement_rejected() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"double-settle".to_string(),
            1_000_000_000_000,
            10_000_000_000,
            allowed_caps,
            option::none(),
            false,
            b"Double Settlement Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
            0, // extra_mint_to_caller
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };

    // Lock intents before accepting contributions
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(15_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            launchpad::unlimited_cap(),
            crank_fee,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // First settlement (succeeds)
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let deadline = launchpad::deadline(&raise);
        clock.set_for_testing(deadline + 1000);

        launchpad::settle_raise(&mut raise, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
    };

    // Second settlement (should fail)
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let deadline = launchpad::deadline(&raise);
        clock.set_for_testing(deadline + 1000);

        launchpad::settle_raise(&mut raise, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
    };

    ts::end(scenario);
}

#[test]
/// Test contribution view function returns correct amount
fun test_contribution_of_view_function() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"view-test".to_string(),
            1_000_000_000_000,
            10_000_000_000,
            allowed_caps,
            option::none(),
            false,
            b"View Function Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
            0, // extra_mint_to_caller
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };

    // Lock intents before accepting contributions
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    // Check contribution_of before contribution (should be 0)
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        assert!(launchpad::contribution_of(&raise, CONTRIBUTOR1) == 0, 0);
        ts::return_shared(raise);
    };

    // Contribute
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(12_345_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            launchpad::unlimited_cap(),
            crank_fee,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Check contribution_of after contribution
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        assert!(launchpad::contribution_of(&raise, CONTRIBUTOR1) == 12_345_000_000, 1);
        assert!(launchpad::total_raised(&raise) == 12_345_000_000, 2);
        ts::return_shared(raise);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = launchpad::ESupplyNotZero)]
/// Test that treasury cap with existing supply is rejected
fun test_nonzero_supply_rejected() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular_2::init_for_testing(ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let mut treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR_2>>(
            &scenario,
        );
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR_2>>(
            &scenario,
        );

        // Mint some coins to make supply > 0
        let preminted = coin::mint(&mut treasury_cap, 1000, ts::ctx(&mut scenario));
        sui::transfer::public_transfer(preminted, CREATOR);

        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        // This should fail because supply is not zero
        launchpad::create_raise<TEST_ASSET_REGULAR_2, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"nonzero-supply".to_string(),
            1_000_000_000_000,
            10_000_000_000,
            allowed_caps,
            option::none(),
            false,
            b"Nonzero Supply Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
            0, // extra_mint_to_caller
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };

    ts::end(scenario);
}
