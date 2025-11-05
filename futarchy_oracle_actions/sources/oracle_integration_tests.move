#[test_only]
module futarchy_oracle::oracle_integration_tests;

use futarchy_oracle::oracle_actions::{Self, PriceBasedMintGrant};
use account_protocol::package_registry::{Self, PackageRegistry, PackageAdminCap};
use account_protocol::account::{Self, Account};
use account_protocol::deps;
use futarchy_core::futarchy_config::{Self};
use futarchy_core::dao_config;
use sui::clock::{Self, Clock};
use sui::test_scenario::{Self as ts, Scenario};
use sui::test_utils::destroy;
use sui::url;
use std::string;

// === Test Coin Types ===

public struct TEST_ASSET has drop {}
public struct TEST_STABLE has drop {}

// === Test Constants ===

const OWNER: address = @0xCAFE;
const RECIPIENT1: address = @0xBEEF;
const RECIPIENT2: address = @0xDEAD;
const RECIPIENT3: address = @0xF00D;

// === Helper Functions ===

fun start(): (Scenario, PackageRegistry, Account, Clock) {
    let mut scenario = ts::begin(OWNER);
    package_registry::init_for_testing(scenario.ctx());
    scenario.next_tx(OWNER);

    let mut registry = scenario.take_shared<PackageRegistry>();
    let cap = scenario.take_from_sender<PackageAdminCap>();

    package_registry::add_for_testing(&mut registry, b"account_protocol".to_string(), @account_protocol, 1);
    package_registry::add_for_testing(&mut registry, b"account_actions".to_string(), @account_actions, 1);
    package_registry::add_for_testing(&mut registry, b"futarchy_core".to_string(), @futarchy_core, 1);
    package_registry::add_for_testing(&mut registry, b"futarchy_oracle".to_string(), @futarchy_oracle, 1);

    let deps = deps::new(&registry, vector[
            b"account_actions".to_string(),
            b"futarchy_core".to_string(),
            b"futarchy_oracle".to_string()
        ]
    );

    // Create minimal DaoConfig for testing
    let metadata_config = dao_config::new_metadata_config(
        b"TestDAO".to_ascii_string(),
        url::new_unsafe_from_bytes(b"https://test.com"),
        string::utf8(b"Test DAO for oracle tests"),
    );

    let dao_config = dao_config::new_dao_config(
        dao_config::default_trading_params(),
        dao_config::default_twap_config(),
        dao_config::default_governance_config(),
        metadata_config,
        dao_config::default_conditional_coin_config(),
        dao_config::default_quota_config(),
        dao_config::default_sponsorship_config(),
    );

    // Create futarchy config with launchpad price
    let mut config = futarchy_config::new<TEST_ASSET, TEST_STABLE>(dao_config);
    // Set launchpad price so oracle grants can read it
    futarchy_config::set_launchpad_initial_price(&mut config, 1_000_000_000_000u128); // 1.0 price

    let mut account = account::new(config, deps, &registry, futarchy_core::version::current(), futarchy_config::witness(), scenario.ctx());

    // Initialize DAO state
    let dao_state = futarchy_config::new_dao_state();
    account::add_managed_data(
        &mut account,
        &registry,
        futarchy_config::new_dao_state_key(),
        dao_state,
        futarchy_core::version::current()
    );

    let clock = clock::create_for_testing(scenario.ctx());
    destroy(cap);
    (scenario, registry, account, clock)
}

fun end(scenario: Scenario, registry: PackageRegistry, account: Account, clock: Clock) {
    destroy(registry);
    destroy(account);
    destroy(clock);
    ts::end(scenario);
}

// === Integration Tests ===

#[test]
/// Test creating a grant with a single tier
fun test_create_grant_single_tier() {
    let (mut scenario, registry, mut account, mut clock) = start();
    clock.set_for_testing(1000);

    // Create tier with single recipient
    let recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 1000),
    ];

    let tier_spec = oracle_actions::new_tier_spec(
        2_000_000_000_000u128, // 2.0 price
        true, // unlock above
        recipients,
        string::utf8(b"Tier 1")
    );

    let tiers = oracle_actions::convert_tier_specs_for_testing(vector[tier_spec]);

    // Create grant
    let dao_id = object::id(&account);
    let grant_id = oracle_actions::create_grant<TEST_ASSET, TEST_STABLE>(
        &mut account,
        &registry,
        tiers,
        false, // use_relative_pricing (absolute prices)
        0, // no launchpad multiplier
        0, // immediate execution
        0, // no expiry
        true, // cancelable
        string::utf8(b"Test Grant"),
        dao_id,
        futarchy_core::version::current(),
        &clock,
        scenario.ctx()
    );

    // Verify grant was created
    assert!(grant_id != object::id_from_address(@0x0), 0);

    // Verify grant appears in registry
    let grant_ids = oracle_actions::get_all_grant_ids(
        &account,
        &registry,
        futarchy_core::version::current()
    );
    assert!(grant_ids.length() == 1, 1);
    assert!(*grant_ids.borrow(0) == grant_id, 2);

    end(scenario, registry, account, clock);
}

#[test]
/// Test creating multiple grants
fun test_create_multiple_grants() {
    let (mut scenario, registry, mut account, mut clock) = start();
    clock.set_for_testing(2000);

    // Create first grant
    let recipients1 = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 500),
    ];
    let tier1 = oracle_actions::new_tier_spec(
        1_000_000_000_000u128,
        true,
        recipients1,
        string::utf8(b"Grant 1 Tier")
    );
    let tiers1 = oracle_actions::convert_tier_specs_for_testing(vector[tier1]);

    let dao_id = object::id(&account);
    let grant_id1 = oracle_actions::create_grant<TEST_ASSET, TEST_STABLE>(
        &mut account,
        &registry,
        tiers1,
        false, // use_relative_pricing (absolute prices)
        0, 0, 0, true,
        string::utf8(b"Grant 1"),
        dao_id,
        futarchy_core::version::current(),
        &clock,
        scenario.ctx()
    );

    // Create second grant
    let recipients2 = vector[
        oracle_actions::new_recipient_mint(RECIPIENT2, 1000),
    ];
    let tier2 = oracle_actions::new_tier_spec(
        3_000_000_000_000u128,
        false,
        recipients2,
        string::utf8(b"Grant 2 Tier")
    );
    let tiers2 = oracle_actions::convert_tier_specs_for_testing(vector[tier2]);

    let grant_id2 = oracle_actions::create_grant<TEST_ASSET, TEST_STABLE>(
        &mut account,
        &registry,
        tiers2,
        false, // use_relative_pricing (absolute prices)
        0, 0, 0, false,
        string::utf8(b"Grant 2"),
        dao_id,
        futarchy_core::version::current(),
        &clock,
        scenario.ctx()
    );

    // Verify both grants exist in registry
    let grant_ids = oracle_actions::get_all_grant_ids(
        &account,
        &registry,
        futarchy_core::version::current()
    );
    assert!(grant_ids.length() == 2, 0);
    assert!(*grant_ids.borrow(0) == grant_id1, 1);
    assert!(*grant_ids.borrow(1) == grant_id2, 2);

    end(scenario, registry, account, clock);
}

#[test]
/// Test creating grant with multiple tiers and recipients
fun test_create_grant_multi_tier() {
    let (mut scenario, registry, mut account, mut clock) = start();
    clock.set_for_testing(3000);

    // Tier 1: Multiple recipients
    let tier1_recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 100),
        oracle_actions::new_recipient_mint(RECIPIENT2, 200),
        oracle_actions::new_recipient_mint(RECIPIENT3, 300),
    ];
    let tier1 = oracle_actions::new_tier_spec(
        2_000_000_000_000u128,
        true,
        tier1_recipients,
        string::utf8(b"Low Tier")
    );

    // Tier 2: Different recipients
    let tier2_recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 500),
        oracle_actions::new_recipient_mint(RECIPIENT3, 700),
    ];
    let tier2 = oracle_actions::new_tier_spec(
        5_000_000_000_000u128,
        true,
        tier2_recipients,
        string::utf8(b"High Tier")
    );

    let tiers = oracle_actions::convert_tier_specs_for_testing(vector[tier1, tier2]);

    let dao_id = object::id(&account);
    let grant_id = oracle_actions::create_grant<TEST_ASSET, TEST_STABLE>(
        &mut account,
        &registry,
        tiers,
        false, // use_relative_pricing (absolute prices)
        1_500_000_000, // 1.5x launchpad multiplier
        30 * 24 * 60 * 60 * 1000, // 30 days earliest
        2, // 2 year expiry
        false, // not cancelable
        string::utf8(b"Multi-Tier Grant"),
        dao_id,
        futarchy_core::version::current(),
        &clock,
        scenario.ctx()
    );

    assert!(grant_id != object::id_from_address(@0x0), 0);

    end(scenario, registry, account, clock);
}

#[test]
/// Test grant view functions
fun test_grant_view_functions() {
    let (mut scenario, registry, mut account, mut clock) = start();
    clock.set_for_testing(4000);

    let recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 1000),
        oracle_actions::new_recipient_mint(RECIPIENT2, 500),
    ];
    let tier = oracle_actions::new_tier_spec(
        2_000_000_000_000u128,
        true,
        recipients,
        string::utf8(b"Test Tier")
    );
    let tiers = oracle_actions::convert_tier_specs_for_testing(vector[tier]);

    let dao_id = object::id(&account);
    let _grant_id = oracle_actions::create_grant<TEST_ASSET, TEST_STABLE>(
        &mut account,
        &registry,
        tiers,
        false, // use_relative_pricing (absolute prices)
        0, 0, 0, true,
        string::utf8(b"View Test Grant"),
        dao_id,
        futarchy_core::version::current(),
        &clock,
        scenario.ctx()
    );

    // Advance transaction to retrieve the shared grant
    scenario.next_tx(OWNER);
    {
        let grant = scenario.take_shared<PriceBasedMintGrant<TEST_ASSET, TEST_STABLE>>();

        // Test view functions
        let total = oracle_actions::total_amount(&grant);
        assert!(total == 1500, 0); // 1000 + 500

        let canceled = oracle_actions::is_canceled(&grant);
        assert!(!canceled, 1);

        let desc = oracle_actions::description(&grant);
        assert!(desc == &string::utf8(b"View Test Grant"), 2);

        let tier_count = oracle_actions::tier_count(&grant);
        assert!(tier_count == 1, 3);

        ts::return_shared(grant);
    };

    end(scenario, registry, account, clock);
}

#[test]
/// Test canceling a cancelable grant
fun test_cancel_grant_success() {
    let (mut scenario, registry, mut account, mut clock) = start();
    clock.set_for_testing(5000);

    let recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 1000),
    ];
    let tier = oracle_actions::new_tier_spec(
        2_000_000_000_000u128,
        true,
        recipients,
        string::utf8(b"Cancel Test")
    );
    let tiers = oracle_actions::convert_tier_specs_for_testing(vector[tier]);

    let dao_id = object::id(&account);
    oracle_actions::create_grant<TEST_ASSET, TEST_STABLE>(
        &mut account,
        &registry,
        tiers,
        false, // use_relative_pricing (absolute prices)
        0, 0, 0,
        true, // cancelable = true
        string::utf8(b"Cancelable Grant"),
        dao_id,
        futarchy_core::version::current(),
        &clock,
        scenario.ctx()
    );

    scenario.next_tx(OWNER);
    {
        let mut grant = scenario.take_shared<PriceBasedMintGrant<TEST_ASSET, TEST_STABLE>>();

        // Verify not canceled initially
        assert!(!oracle_actions::is_canceled(&grant), 0);

        // Cancel the grant
        oracle_actions::cancel_grant(&mut grant, &clock);

        // Verify now canceled
        assert!(oracle_actions::is_canceled(&grant), 1);

        ts::return_shared(grant);
    };

    end(scenario, registry, account, clock);
}

#[test]
#[expected_failure(abort_code = oracle_actions::EGrantNotCancelable)]
/// Test that canceling a non-cancelable grant fails
fun test_cancel_non_cancelable_grant_fails() {
    let (mut scenario, registry, mut account, mut clock) = start();
    clock.set_for_testing(6000);

    let recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 1000),
    ];
    let tier = oracle_actions::new_tier_spec(
        2_000_000_000_000u128,
        true,
        recipients,
        string::utf8(b"Non-Cancelable")
    );
    let tiers = oracle_actions::convert_tier_specs_for_testing(vector[tier]);

    let dao_id = object::id(&account);
    oracle_actions::create_grant<TEST_ASSET, TEST_STABLE>(
        &mut account,
        &registry,
        tiers,
        false, // use_relative_pricing (absolute prices)
        0, 0, 0,
        false, // cancelable = false
        string::utf8(b"Non-Cancelable Grant"),
        dao_id,
        futarchy_core::version::current(),
        &clock,
        scenario.ctx()
    );

    scenario.next_tx(OWNER);
    {
        let mut grant = scenario.take_shared<PriceBasedMintGrant<TEST_ASSET, TEST_STABLE>>();

        // This should fail
        oracle_actions::cancel_grant(&mut grant, &clock);

        ts::return_shared(grant);
    };

    end(scenario, registry, account, clock);
}

#[test]
#[expected_failure(abort_code = oracle_actions::EAlreadyCanceled)]
/// Test that canceling an already-canceled grant fails
fun test_cancel_already_canceled_fails() {
    let (mut scenario, registry, mut account, mut clock) = start();
    clock.set_for_testing(7000);

    let recipients = vector[
        oracle_actions::new_recipient_mint(RECIPIENT1, 1000),
    ];
    let tier = oracle_actions::new_tier_spec(
        2_000_000_000_000u128,
        true,
        recipients,
        string::utf8(b"Double Cancel Test")
    );
    let tiers = oracle_actions::convert_tier_specs_for_testing(vector[tier]);

    let dao_id = object::id(&account);
    oracle_actions::create_grant<TEST_ASSET, TEST_STABLE>(
        &mut account,
        &registry,
        tiers,
        false, // use_relative_pricing (absolute prices)
        0, 0, 0, true,
        string::utf8(b"Grant"),
        dao_id,
        futarchy_core::version::current(),
        &clock,
        scenario.ctx()
    );

    scenario.next_tx(OWNER);
    {
        let mut grant = scenario.take_shared<PriceBasedMintGrant<TEST_ASSET, TEST_STABLE>>();

        // First cancel succeeds
        oracle_actions::cancel_grant(&mut grant, &clock);

        // Second cancel should fail
        oracle_actions::cancel_grant(&mut grant, &clock);

        ts::return_shared(grant);
    };

    end(scenario, registry, account, clock);
}

#[test]
#[expected_failure(abort_code = oracle_actions::EEmptyTiers)]
/// Test that creating grant with empty tiers fails
fun test_create_grant_empty_tiers_fails() {
    let (mut scenario, registry, mut account, mut clock) = start();
    clock.set_for_testing(8000);

    let empty_tiers = vector[];

    // Should fail with EEmptyTiers
    let dao_id = object::id(&account);
    oracle_actions::create_grant<TEST_ASSET, TEST_STABLE>(
        &mut account,
        &registry,
        empty_tiers,
        false, // use_relative_pricing (absolute prices)
        0, 0, 0, true,
        string::utf8(b"Empty Grant"),
        dao_id,
        futarchy_core::version::current(),
        &clock,
        scenario.ctx()
    );

    end(scenario, registry, account, clock);
}

#[test]
/// Test empty registry returns empty grant list
fun test_empty_grant_registry() {
    let (scenario, registry, account, clock) = start();

    let grant_ids = oracle_actions::get_all_grant_ids(
        &account,
        &registry,
        futarchy_core::version::current()
    );

    assert!(grant_ids.is_empty(), 0);

    end(scenario, registry, account, clock);
}
