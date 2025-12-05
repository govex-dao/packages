// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Comprehensive tests for init actions that require the launchpad flow
///
/// These tests exercise the full production code path:
/// 1. Create launchpad raise
/// 2. Stage init action specs (success/failure)
/// 3. Contribute to meet minimum
/// 4. Settle raise
/// 5. Create DAO (which deposits stables into vault)
/// 6. Execute init actions via dao_init_executor
///
/// Actions tested:
/// - do_init_create_stream (vault with funds)
/// - do_init_create_pool_with_mint (vault with stables + treasury cap)
/// - do_spend + do_init_transfer (VaultSpend + TransferObject pattern)
#[test_only]
module action_tests::launchpad_init_action_tests;

use account_actions::action_spec_builder;
use account_actions::stream_init_actions;
use account_actions::transfer_init_actions;
use account_actions::transfer;
use account_actions::vault;
use account_actions::vault_init_actions;
use account_actions::version;
use account_protocol::account::{Self as account_mod, Account};
use account_protocol::intents;
use account_protocol::package_registry::{Self, PackageRegistry};
use futarchy_factory::dao_init_executor;
use futarchy_factory::dao_init_outcome;
use futarchy_factory::factory::{Self, Factory, FactoryOwnerCap};
use futarchy_factory::launchpad::{Self, Raise, CreatorCap};
use futarchy_factory::test_asset_regular::{Self as test_asset, TEST_ASSET_REGULAR};
use futarchy_factory::test_stable_regular::TEST_STABLE_REGULAR;
use futarchy_markets_core::fee::{Self, FeeManager};
use futarchy_one_shot_utils::constants;
use sui::clock::{Self, Clock};
use sui::coin::{Self as coin, Coin, TreasuryCap, CoinMetadata};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use std::string::String;

// === Constants ===
const TOKENS_FOR_SALE: u64 = 1_000_000_000_000; // 1M tokens
const MIN_RAISE: u64 = 10_000_000_000; // 10k stable
const MAX_RAISE: u64 = 100_000_000_000; // 100k stable
const CONTRIBUTION_AMOUNT: u64 = 30_000_000_000; // 30k stable (meets minimum)

// === Setup Helpers ===

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

    // Register packages
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
        package_registry::add_for_testing(
            &mut registry,
            b"futarchy_actions".to_string(),
            @futarchy_actions,
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

/// Create a raise and return its ID
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
            &factory,
            &mut fee_manager,
            treasury_cap,
            coin_metadata,
            b"test".to_string(),
            TOKENS_FOR_SALE,
            MIN_RAISE,
            option::some(MAX_RAISE),
            allowed_caps,
            option::none(),
            false,
            b"Init Action Test".to_string(),
            vector::empty<String>(),
            vector::empty<String>(),
            payment,
            0,
            &clock,
            ts::ctx(scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(factory);
        ts::return_shared(fee_manager);
    };
}

/// Stage success specs with the given builder
fun stage_success_specs(
    scenario: &mut Scenario,
    sender: address,
    builder: action_spec_builder::Builder,
) {
    ts::next_tx(scenario, sender);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        let registry = ts::take_shared<PackageRegistry>(scenario);
        let creator_cap = ts::take_from_sender<CreatorCap>(scenario);
        let clock = clock::create_for_testing(ts::ctx(scenario));

        launchpad::stage_success_intent(
            &mut raise,
            &registry,
            &creator_cap,
            builder,
            &clock,
            ts::ctx(scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_to_sender(scenario, creator_cap);
        ts::return_shared(registry);
        ts::return_shared(raise);
    };
}

/// Lock intents and start raise
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

/// Contribute to the raise
fun contribute(scenario: &mut Scenario, contributor: address, amount: u64) {
    ts::next_tx(scenario, contributor);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        let factory = ts::take_shared<Factory>(scenario);
        let clock = clock::create_for_testing(ts::ctx(scenario));

        let contribution = coin::mint_for_testing<TEST_STABLE_REGULAR>(amount, ts::ctx(scenario));
        let crank_fee = create_payment(100_000_000, scenario);

        launchpad::contribute(
            &mut raise,
            &factory,
            contribution,
            launchpad::unlimited_cap(),
            crank_fee,
            &clock,
            ts::ctx(scenario),
        );

        clock::destroy_for_testing(clock);
        ts::return_shared(raise);
        ts::return_shared(factory);
    };
}

/// Settle and complete the raise, creating the DAO
fun settle_and_create_dao(scenario: &mut Scenario, sender: address, clock: &Clock) {
    // Settle
    ts::next_tx(scenario, sender);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        launchpad::settle_raise(&mut raise, clock, ts::ctx(scenario));
        ts::return_shared(raise);
    };

    // Create and share DAO
    ts::next_tx(scenario, sender);
    {
        let mut raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(scenario);
        let mut factory = ts::take_shared<Factory>(scenario);
        let registry = ts::take_shared<PackageRegistry>(scenario);

        let unshared_dao = launchpad::begin_dao_creation(
            &mut raise,
            &mut factory,
            &registry,
            clock,
            ts::ctx(scenario),
        );
        launchpad::finalize_and_share_dao(
            &mut raise,
            unshared_dao,
            &registry,
            clock,
            ts::ctx(scenario),
        );

        ts::return_shared(raise);
        ts::return_shared(factory);
        ts::return_shared(registry);
    };
}

// === Tests ===

#[test]
/// Test do_init_create_stream via launchpad flow
///
/// This test:
/// 1. Creates a launchpad raise
/// 2. Stages a CreateStream action as success spec
/// 3. Contributes to meet minimum
/// 4. Settles and creates DAO (deposits stables into vault)
/// 5. Executes the stream creation via dao_init_executor
fun test_do_init_create_stream() {
    let sender = @0xA;
    let contributor = @0xB;
    let stream_beneficiary = @0xC;

    let mut scenario = setup_test(sender);

    // Initialize test coin
    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    // Create raise
    create_raise(&mut scenario, sender);

    // Build stream spec
    let mut builder = action_spec_builder::new();
    let stream_amount = 1_000_000_000; // 1k stable per iteration
    // Start time must be in the future relative to when the clock advances past deadline
    // clock time after settlement = launchpad_duration_ms() + 1 = 30001
    // So start_time must be > 30001
    let start_time = constants::launchpad_duration_ms() + 60_000; // 1 minute after deadline
    let iterations = 12; // 12 iterations
    let period_ms = 2_592_000_000; // 30 days per iteration

    stream_init_actions::add_create_stream_spec(
        &mut builder,
        b"treasury".to_string(), // vault_name
        stream_beneficiary,
        stream_amount, // amount_per_iteration
        start_time,
        iterations,
        period_ms,
        option::none(), // cliff_time
        option::none(), // claim_window_ms
        stream_amount, // max_per_withdrawal
        true, // is_transferable
        true, // is_cancellable
    );

    // Stage success specs
    stage_success_specs(&mut scenario, sender, builder);

    // Lock and start
    lock_and_start(&mut scenario, sender);

    // Contribute enough to meet minimum
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    // Advance past deadline
    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    // Settle and create DAO
    settle_and_create_dao(&mut scenario, sender, &clock);

    // Now execute the stream creation action via dao_init_executor
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);

        // Verify intent exists
        let account_intents = account_mod::intents(&account);
        assert!(intents::contains(account_intents, b"dao_init".to_string()), 0);

        // Begin execution
        let mut executable = dao_init_executor::begin_execution_for_launchpad(
            object::id(&raise),
            &mut account,
            &registry,
            &clock,
            ts::ctx(&mut scenario),
        );

        let version_witness = version::current();
        let intent_witness = dao_init_executor::dao_init_intent_witness();

        // Execute stream creation
        let _stream_id = vault::do_init_create_stream<
            futarchy_core::futarchy_config::FutarchyConfig,
            dao_init_outcome::DaoInitOutcome,
            TEST_STABLE_REGULAR,
            dao_init_executor::DaoInitIntent,
        >(
            &mut executable,
            &mut account,
            &registry,
            &clock,
            version_witness,
            intent_witness,
            ts::ctx(&mut scenario),
        );

        // Finalize
        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test VaultSpend + TransferObject pattern via launchpad flow
///
/// This test:
/// 1. Creates a launchpad raise
/// 2. Stages VaultSpend + TransferObject actions as success spec
/// 3. Contributes to meet minimum
/// 4. Settles and creates DAO (deposits stables into vault)
/// 5. Executes the spend and transfer via dao_init_executor
/// 6. Verifies recipient receives the funds
fun test_spend_and_transfer() {
    let sender = @0xA;
    let contributor = @0xB;
    let transfer_recipient = @0xC;

    let mut scenario = setup_test(sender);

    // Initialize test coin
    ts::next_tx(&mut scenario, sender);
    test_asset::init_for_testing(ts::ctx(&mut scenario));

    // Create raise
    create_raise(&mut scenario, sender);

    // Build spend + transfer spec (composable pattern)
    let mut builder = action_spec_builder::new();
    let withdraw_amount = 5_000_000_000; // 5k stable
    let resource_name = b"stable_to_transfer".to_string();

    // Action 1: Spend from vault (puts coin in executable_resources)
    vault_init_actions::add_spend_spec(
        &mut builder,
        b"treasury".to_string(), // vault_name
        withdraw_amount,
        false, // spend_all
        resource_name,
    );

    // Action 2: Transfer to recipient (takes coin from executable_resources)
    transfer_init_actions::add_transfer_object_spec(
        &mut builder,
        transfer_recipient,
        resource_name,
    );

    // Stage success specs
    stage_success_specs(&mut scenario, sender, builder);

    // Lock and start
    lock_and_start(&mut scenario, sender);

    // Contribute enough (must exceed withdrawal amount)
    contribute(&mut scenario, contributor, CONTRIBUTION_AMOUNT);

    // Advance past deadline
    ts::next_tx(&mut scenario, sender);
    let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
    clock::increment_for_testing(&mut clock, constants::launchpad_duration_ms() + 1);

    // Settle and create DAO
    settle_and_create_dao(&mut scenario, sender, &clock);

    // Execute the spend and transfer actions
    ts::next_tx(&mut scenario, sender);
    {
        let mut account = ts::take_shared<Account>(&scenario);
        let registry = ts::take_shared<PackageRegistry>(&scenario);
        let raise = ts::take_shared<Raise<TEST_ASSET_REGULAR, TEST_STABLE_REGULAR>>(&scenario);

        // Begin execution
        let mut executable = dao_init_executor::begin_execution_for_launchpad(
            object::id(&raise),
            &mut account,
            &registry,
            &clock,
            ts::ctx(&mut scenario),
        );

        let version_witness = version::current();
        let intent_witness = dao_init_executor::dao_init_intent_witness();

        // Action 1: Execute spend (puts coin in executable_resources)
        vault::do_spend<
            futarchy_core::futarchy_config::FutarchyConfig,
            dao_init_outcome::DaoInitOutcome,
            TEST_STABLE_REGULAR,
            dao_init_executor::DaoInitIntent,
        >(
            &mut executable,
            &mut account,
            &registry,
            version_witness,
            intent_witness,
            ts::ctx(&mut scenario),
        );

        // Action 2: Execute transfer (takes from executable_resources)
        transfer::do_init_transfer<
            dao_init_outcome::DaoInitOutcome,
            Coin<TEST_STABLE_REGULAR>,
            dao_init_executor::DaoInitIntent,
        >(
            &mut executable,
            intent_witness,
        );

        // Finalize
        dao_init_executor::finalize_execution(&mut account, executable, &clock);

        ts::return_shared(raise);
        ts::return_shared(registry);
        ts::return_shared(account);
    };

    // Verify recipient received the funds
    ts::next_tx(&mut scenario, transfer_recipient);
    {
        let coin = ts::take_from_sender<Coin<TEST_STABLE_REGULAR>>(&scenario);
        assert!(coin::value(&coin) == 5_000_000_000, 0);
        ts::return_to_sender(&scenario, coin);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

