// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_factory::launchpad_settlement_tests;

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

const CREATOR: address = @0xAAA001;
const CONTRIBUTOR1: address = @0xAAA002;
const CONTRIBUTOR2: address = @0xAAA003;
const CONTRIBUTOR3: address = @0xAAA004;
const CONTRIBUTOR4: address = @0xAAA005;

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

        package_registry::add_for_testing(&mut registry, b"AccountProtocol".to_string(), @account_protocol, 1);
        package_registry::add_for_testing(&mut registry, b"FutarchyCore".to_string(), @futarchy_core, 1);
        package_registry::add_for_testing(&mut registry, b"AccountActions".to_string(), @account_actions, 1);
        package_registry::add_for_testing(&mut registry, b"FutarchyActions".to_string(), @futarchy_actions, 1);
        package_registry::add_for_testing(
            &mut registry,
            b"FutarchyGovernanceActions".to_string(),
            @0xb1054e9a9b316e105c908be2cddb7f64681a63f0ae80e9e5922bf461589c4bc7,
            1
        );
        package_registry::add_for_testing(&mut registry, b"FutarchyOracleActions".to_string(), @futarchy_oracle, 1);

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
            ts::ctx(&mut scenario)
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
/// Test settlement algorithm: O(C) complexity with multiple cap levels
/// Settlement should find the maximum valid raise amount where total <= cap
fun test_settlement_algorithm_basic() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    // Create raise with 3 cap levels: 15k, 30k, unlimited
    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, 15_000_000_000);  // 15k
        vector::push_back(&mut allowed_caps, 30_000_000_000);  // 30k
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"settlement-test".to_string(),
            1_000_000_000_000,
            10_000_000_000,  // min 10k
            option::none(),
            allowed_caps,
            option::none(),
            false,
            b"Settlement Algorithm Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
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
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    // Contributor 1: 12k with 15k cap
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(12_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, 15_000_000_000, crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Contributor 2: 10k with 30k cap
    ts::next_tx(&mut scenario, CONTRIBUTOR2);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(10_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, 30_000_000_000, crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Advance time past deadline
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let deadline = launchpad::deadline(&raise);
        clock.set_for_testing(deadline + 1000);

        // Settle
        launchpad::settle_raise(&mut raise, &clock, ts::ctx(&mut scenario));

        // cap_sums:
        // [0] (15k cap): 12k (only contributor1)
        // [1] (30k cap): 22k (contributor1 + contributor2)
        // [2] (unlimited): 22k (all)
        //
        // Settlement algorithm should choose:
        // - 15k cap: sum=12k, 12k <= 15k ✓, valid
        // - 30k cap: sum=22k, 22k <= 30k ✓, valid
        // - unlimited cap: sum=22k, 22k <= unlimited ✓, valid
        //
        // Best (maximum valid): 22k

        assert!(launchpad::settlement_done(&raise), 0);
        assert!(launchpad::final_raise_amount(&raise) == 22_000_000_000, 1);

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
    };

    ts::end(scenario);
}

#[test]
/// Test settlement with cap violation
/// When sum exceeds cap, that cap level becomes invalid
fun test_settlement_with_cap_violation() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    // Create raise with tight caps
    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, 10_000_000_000);  // 10k (tight)
        vector::push_back(&mut allowed_caps, 25_000_000_000);  // 25k
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"cap-violation".to_string(),
            1_000_000_000_000,
            5_000_000_000,  // min 5k
            option::none(),
            allowed_caps,
            option::none(),
            false,
            b"Cap Violation Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
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
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    // Contributor 1: 7k with 10k cap
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(7_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, 10_000_000_000, crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Contributor 2: 6k with 10k cap (total = 13k, exceeds 10k cap!)
    ts::next_tx(&mut scenario, CONTRIBUTOR2);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(6_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, 10_000_000_000, crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Settle
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let deadline = launchpad::deadline(&raise);
        clock.set_for_testing(deadline + 1000);

        launchpad::settle_raise(&mut raise, &clock, ts::ctx(&mut scenario));

        // cap_sums:
        // [0] (10k cap): 13k (both contributors with 10k cap)
        // [1] (25k cap): 13k
        // [2] (unlimited): 13k
        //
        // Settlement:
        // - 10k cap: sum=13k, 13k > 10k ✗ INVALID
        // - 25k cap: sum=13k, 13k <= 25k ✓ valid
        // - unlimited: sum=13k, 13k <= unlimited ✓ valid
        //
        // Best valid: 13k (from 25k cap level or unlimited)

        assert!(launchpad::final_raise_amount(&raise) == 13_000_000_000, 0);

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
    };

    ts::end(scenario);
}

#[test]
/// Test settlement with max_raise_amount enforcement
fun test_settlement_respects_max_raise() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    // Create raise with max_raise_amount of 20k
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
            b"max-raise".to_string(),
            1_000_000_000_000,
            10_000_000_000,  // min 10k
            option::some(20_000_000_000),  // max 20k
            allowed_caps,
            option::none(),
            false,
            b"Max Raise Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
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
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    // Contributors contribute 30k total (exceeds max)
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(15_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, launchpad::unlimited_cap(), crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    ts::next_tx(&mut scenario, CONTRIBUTOR2);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(15_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, launchpad::unlimited_cap(), crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Settle - should cap at 20k despite 30k contributed
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let deadline = launchpad::deadline(&raise);
        clock.set_for_testing(deadline + 1000);

        launchpad::settle_raise(&mut raise, &clock, ts::ctx(&mut scenario));

        // Settlement finds best_total = 30k, but max_raise_amount = 20k
        // So final_raise_amount should be capped at 20k
        assert!(launchpad::final_raise_amount(&raise) == 20_000_000_000, 0);

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
    };

    ts::end(scenario);
}

#[test]
/// Test settlement with complex multi-tier scenario
fun test_settlement_complex_multi_tier() {
    let mut scenario = setup_test(CREATOR);

    ts::next_tx(&mut scenario, CREATOR);
    test_asset_regular::init_for_testing(ts::ctx(&mut scenario));

    // Create raise with 4 cap levels
    ts::next_tx(&mut scenario, CREATOR);
    {
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let mut fee_manager = ts::take_shared<fee::FeeManager>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let treasury_cap = ts::take_from_sender<coin::TreasuryCap<TEST_ASSET_REGULAR>>(&scenario);
        let coin_metadata = ts::take_from_sender<coin::CoinMetadata<TEST_ASSET_REGULAR>>(&scenario);
        let payment = create_payment(fee::get_launchpad_creation_fee(&fee_manager), &mut scenario);

        let mut allowed_caps = vector::empty<u64>();
        vector::push_back(&mut allowed_caps, 5_000_000_000);   // 5k
        vector::push_back(&mut allowed_caps, 15_000_000_000);  // 15k
        vector::push_back(&mut allowed_caps, 40_000_000_000);  // 40k
        vector::push_back(&mut allowed_caps, launchpad::unlimited_cap());

        launchpad::create_raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>(
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"complex".to_string(),
            1_000_000_000_000,
            10_000_000_000,  // min 10k
            option::none(),
            allowed_caps,
            option::none(),
            false,
            b"Complex Multi-Tier Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
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
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let creator_cap = ts::take_from_sender<launchpad::CreatorCap>(&scenario);
        launchpad::lock_intents_and_start_raise(&mut raise, &creator_cap, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, creator_cap);
        ts::return_shared(raise);
    };

    // 4 contributors with different caps
    // C1: 4k with 5k cap
    ts::next_tx(&mut scenario, CONTRIBUTOR1);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(4_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, 5_000_000_000, crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // C2: 8k with 15k cap
    ts::next_tx(&mut scenario, CONTRIBUTOR2);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(8_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, 15_000_000_000, crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // C3: 12k with 40k cap
    ts::next_tx(&mut scenario, CONTRIBUTOR3);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(12_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, 40_000_000_000, crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // C4: 10k with unlimited cap
    ts::next_tx(&mut scenario, CONTRIBUTOR4);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let factory = ts::take_shared<factory::Factory>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let contribution = create_stable_coin(10_000_000_000, &mut scenario);
        let crank_fee = create_payment(factory::launchpad_bid_fee(&factory), &mut scenario);

        launchpad::contribute(&mut raise, &factory, contribution, launchpad::unlimited_cap(), crank_fee, &clock, ts::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };

    // Settle and verify correct calculation
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut raise = ts::take_shared<launchpad::Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        let deadline = launchpad::deadline(&raise);
        clock.set_for_testing(deadline + 1000);

        launchpad::settle_raise(&mut raise, &clock, ts::ctx(&mut scenario));

        // cap_sums:
        // [0] (5k):  C1(4k) = 4k
        // [1] (15k): C1(4k) + C2(8k) = 12k
        // [2] (40k): C1(4k) + C2(8k) + C3(12k) = 24k
        // [3] (unlimited): C1(4k) + C2(8k) + C3(12k) + C4(10k) = 34k
        //
        // Check validity (sum <= cap):
        // [0]: 4k <= 5k ✓ valid
        // [1]: 12k <= 15k ✓ valid
        // [2]: 24k <= 40k ✓ valid
        // [3]: 34k <= unlimited ✓ valid
        //
        // Best (maximum valid): 34k

        assert!(launchpad::final_raise_amount(&raise) == 34_000_000_000, 0);

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
    };

    ts::end(scenario);
}

