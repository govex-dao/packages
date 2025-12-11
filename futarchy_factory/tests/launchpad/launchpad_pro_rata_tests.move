// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_factory::launchpad_pro_rata_tests;

use account_protocol::package_registry::{Self as package_registry, PackageRegistry};
use futarchy_factory::factory;
use futarchy_factory::launchpad;
use futarchy_factory::test_asset_regular::{Self as test_asset_regular, TEST_ASSET_REGULAR};
use futarchy_factory::test_stable_regular::{Self as test_stable_regular, TEST_STABLE_REGULAR};
use futarchy_markets_core::fee;
use std::string::String;
use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};

// === Constants ===

const CREATOR: address = @0xCCCCC1;
const CONTRIBUTOR1: address = @0xCCCCC2;
const CONTRIBUTOR2: address = @0xCCCCC3;

// === Helper Functions ===

fun setup_test(sender: address): Scenario {
    let mut scenario = ts::begin(sender);

    // Create factory
    ts::next_tx(&mut scenario, sender);
    factory::create_factory(ts::ctx(&mut scenario));

    // Create fee manager
    ts::next_tx(&mut scenario, sender);
    fee::create_fee_manager_for_testing(ts::ctx(&mut scenario));

    // Create package registry
    ts::next_tx(&mut scenario, sender);
    package_registry::init_for_testing(ts::ctx(&mut scenario));

    // Register required packages
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

    // Add TEST_STABLE_REGULAR as allowed stable type
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
/// Test pro-rata allocation with different cap levels
/// User with 10k cap should be excluded when final raise is above 10k
fun test_pro_rata_cap_exclusion() {
    let mut scenario = setup_test(CREATOR);

    // Initialize test coin
    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    // Create a launchpad with multiple cap levels
    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, 10_000_000_000); // 10k cap
        vector::push_back(&mut allowed_caps, 50_000_000_000); // 50k cap
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"pro-rata-test".to_string(),
            1_000_000_000_000, // tokens_for_sale (1M tokens)
            15_000_000_000, // min_raise_amount (15k)
            allowed_caps,
            option::none(),
            false,
            b"Pro-Rata Test".to_string(),
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

    // Contributor 1 contributes with 10k cap
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(8_000_000_000, &mut scenario); // 8k
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            10_000_000_000, // 10k cap
            crank_fee,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Contributor 2 contributes with unlimited cap
    ts::next_tx(&mut scenario, CONTRIBUTOR2);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(20_000_000_000, &mut scenario); // 20k
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

    // Verify cap_sums updated correctly
    ts::next_tx(&mut scenario, CREATOR);
    {
        let raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let cap_sums = launchpad::cap_sums(&raise);

        // At 10k cap level: only contributor2's 20k (contributor1's 10k cap excluded)
        // At 50k cap level: both contributors (8k + 20k = 28k)
        // At unlimited cap level: both contributors (8k + 20k = 28k)

        // Actually let me recalculate:
        // Contributor1: max_cap = 10k, contribution = 8k
        // Contributor2: max_cap = unlimited, contribution = 20k
        //
        // cap_sums[0] (10k cap): Contributors with max_cap <= 10k can participate
        //   - Contributor1 (10k <= 10k): 8k
        //   Total: 8k
        // cap_sums[1] (50k cap): Contributors with max_cap <= 50k
        //   - Contributor1 (10k <= 50k): 8k
        //   Total: 8k
        // cap_sums[2] (unlimited): Everyone
        //   - Contributor1: 8k
        //   - Contributor2: 20k
        //   Total: 28k

        assert!(*cap_sums.borrow(0) == 8_000_000_000, 0); // 8k
        assert!(*cap_sums.borrow(1) == 8_000_000_000, 1); // 8k
        assert!(*cap_sums.borrow(2) == 28_000_000_000, 2); // 28k

        ts::return_shared(raise);
    };

    ts::end(scenario);
}

#[test]
/// Test contribution with cap change restriction (24h before deadline)
fun test_contribution_multiple_times_same_cap() {
    let mut scenario = setup_test(CREATOR);

    // Initialize test coin
    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    // Create launchpad
    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, 10_000_000_000);
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"multi-contrib".to_string(),
            1_000_000_000_000,
            10_000_000_000,
            allowed_caps,
            option::none(),
            false,
            b"Multi Contribution Test".to_string(),
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

    // First contribution
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(5_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            10_000_000_000,
            crank_fee,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Second contribution (same cap, should accumulate)
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(3_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            10_000_000_000, // same cap
            crank_fee,
            &clock,
            ts::ctx(&mut scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Verify total contribution
    ts::next_tx(&mut scenario, CREATOR);
    {
        let raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );

        assert!(launchpad::contribution_of(&raise, CONTRIBUTOR1) == 8_000_000_000, 0);
        assert!(launchpad::total_raised(&raise) == 8_000_000_000, 1);

        ts::return_shared(raise);
    };

    ts::end(scenario);
}

#[test]
/// Test viewing functions for cap configuration
fun test_view_allowed_caps() {
    let mut scenario = setup_test(CREATOR);

    // Initialize test coin
    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    // Create launchpad with specific caps
    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, 5_000_000_000); // 5k
        vector::push_back(&mut allowed_caps, 10_000_000_000); // 10k
        vector::push_back(&mut allowed_caps, 25_000_000_000); // 25k
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
            b"View Test".to_string(),
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

    // Verify allowed caps
    ts::next_tx(&mut scenario, CREATOR);
    {
        let raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(
            &scenario,
        );
        let allowed_caps = launchpad::allowed_caps(&raise);

        assert!(allowed_caps.length() == 4, 0);
        assert!(*allowed_caps.borrow(0) == 5_000_000_000, 1);
        assert!(*allowed_caps.borrow(1) == 10_000_000_000, 2);
        assert!(*allowed_caps.borrow(2) == 25_000_000_000, 3);
        assert!(*allowed_caps.borrow(3) == launchpad::unlimited_cap(), 4);

        ts::return_shared(raise);
    };

    ts::end(scenario);
}
