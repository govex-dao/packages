// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_actions::config_actions_tests;

use futarchy_actions::config_actions;
use sui::test_utils::destroy;

// === Constants ===

const DEFAULT_TWAP_THRESHOLD: u128 = 1_000_000;

// === Tests ===

#[test]
/// Test creating update config action with all fields
fun test_new_update_config_comprehensive() {
    let action = config_actions::new_update_config(
        option::some(1000u64),              // min_asset_amount
        option::some(2000u64),              // min_stable_amount
        option::some(86400000u64),          // review_period_ms (1 day)
        option::some(604800000u64),         // trading_period_ms (7 days)
        option::some(30u16),                // conditional_amm_fee_bps (0.3%)
        option::some(25u16),                // spot_amm_fee_bps (0.25%)
        option::some(3600000u64),           // amm_twap_start_delay (1 hour)
        option::some(100u64),               // amm_twap_step_max
        option::some(1000000000u128),       // amm_twap_initial_observation
        option::some(option::some(500000u128)), // twap_threshold
        option::some(5u8),                  // max_outcomes
        option::some(15u8),                 // max_actions_per_outcome
        option::some(10u8),                 // max_intents_per_outcome
        option::some(604800000u64),         // proposal_intent_expiry_ms (7 days)
        option::some(option::some(b"https://icon.url".to_string())), // icon_url
        option::some(option::some(b"DAO description".to_string())),  // description
    );

    // Verify all fields are set
    assert!(config_actions::min_asset_amount(&action).is_some(), 0);
    assert!(config_actions::min_stable_amount(&action).is_some(), 1);
    assert!(config_actions::review_period_ms(&action).is_some(), 2);
    assert!(config_actions::trading_period_ms(&action).is_some(), 3);
    assert!(config_actions::conditional_amm_fee_bps(&action).is_some(), 4);
    assert!(config_actions::spot_amm_fee_bps(&action).is_some(), 5);

    // Verify actual values
    assert!(*config_actions::min_asset_amount(&action).borrow() == 1000, 10);
    assert!(*config_actions::min_stable_amount(&action).borrow() == 2000, 11);
    assert!(*config_actions::review_period_ms(&action).borrow() == 86400000, 12);

    destroy(action);
}

#[test]
/// Test creating update config action with partial updates
fun test_new_update_config_partial() {
    // Only update min amounts and fee
    let action = config_actions::new_update_config(
        option::some(5000u64),              // min_asset_amount
        option::some(10000u64),             // min_stable_amount
        option::none(),                     // review_period_ms (no change)
        option::none(),                     // trading_period_ms (no change)
        option::some(35u16),                // conditional_amm_fee_bps
        option::none(),                     // spot_amm_fee_bps (no change)
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
    );

    // Verify only specified fields are set
    assert!(config_actions::min_asset_amount(&action).is_some(), 0);
    assert!(config_actions::min_stable_amount(&action).is_some(), 1);
    assert!(config_actions::review_period_ms(&action).is_none(), 2);
    assert!(config_actions::trading_period_ms(&action).is_none(), 3);
    assert!(config_actions::conditional_amm_fee_bps(&action).is_some(), 4);
    assert!(config_actions::spot_amm_fee_bps(&action).is_none(), 5);

    destroy(action);
}

#[test]
/// Test creating update config with no changes (all None)
fun test_new_update_config_empty() {
    let action = config_actions::new_update_config(
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
    );

    // Verify all fields are None
    assert!(config_actions::min_asset_amount(&action).is_none(), 0);
    assert!(config_actions::min_stable_amount(&action).is_none(), 1);
    assert!(config_actions::review_period_ms(&action).is_none(), 2);
    assert!(config_actions::trading_period_ms(&action).is_none(), 3);

    destroy(action);
}

#[test]
/// Test updating only time periods
fun test_new_update_config_time_periods() {
    let action = config_actions::new_update_config(
        option::none(),
        option::none(),
        option::some(172800000u64),         // review_period_ms (2 days)
        option::some(1209600000u64),        // trading_period_ms (14 days)
        option::none(),
        option::none(),
        option::some(7200000u64),           // amm_twap_start_delay (2 hours)
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::some(1209600000u64),        // proposal_intent_expiry_ms (14 days)
        option::none(),
        option::none(),
    );

    assert!(*config_actions::review_period_ms(&action).borrow() == 172800000, 0);
    assert!(*config_actions::trading_period_ms(&action).borrow() == 1209600000, 1);
    assert!(*config_actions::amm_twap_start_delay(&action).borrow() == 7200000, 2);
    assert!(*config_actions::proposal_intent_expiry_ms(&action).borrow() == 1209600000, 3);

    destroy(action);
}

#[test]
/// Test updating only AMM parameters
fun test_new_update_config_amm_params() {
    let action = config_actions::new_update_config(
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::some(50u16),                // conditional_amm_fee_bps (0.5%)
        option::some(40u16),                // spot_amm_fee_bps (0.4%)
        option::some(1800000u64),           // amm_twap_start_delay (30 min)
        option::some(200u64),               // amm_twap_step_max
        option::some(2000000000u128),       // amm_twap_initial_observation
        option::some(option::some(750000u128)), // twap_threshold
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
    );

    assert!(*config_actions::conditional_amm_fee_bps(&action).borrow() == 50, 0);
    assert!(*config_actions::spot_amm_fee_bps(&action).borrow() == 40, 1);
    assert!(*config_actions::amm_twap_step_max(&action).borrow() == 200, 2);

    destroy(action);
}

#[test]
/// Test updating only limits
fun test_new_update_config_limits() {
    let action = config_actions::new_update_config(
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::some(10u8),                 // max_outcomes
        option::some(20u8),                 // max_actions_per_outcome
        option::some(15u8),                 // max_intents_per_outcome
        option::none(),
        option::none(),
        option::none(),
    );

    assert!(*config_actions::max_outcomes(&action).borrow() == 10, 0);
    assert!(*config_actions::max_actions_per_outcome(&action).borrow() == 20, 1);
    assert!(*config_actions::max_intents_per_outcome(&action).borrow() == 15, 2);

    destroy(action);
}

#[test]
/// Test updating metadata fields
fun test_new_update_config_metadata() {
    let action = config_actions::new_update_config(
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::some(option::some(b"https://example.com/icon.png".to_string())),
        option::some(option::some(b"A decentralized autonomous organization".to_string())),
    );

    assert!(config_actions::icon_url(&action).is_some(), 0);
    assert!(config_actions::description(&action).is_some(), 1);

    // Verify nested options are correct
    let icon_url_option = config_actions::icon_url(&action).borrow();
    assert!(icon_url_option.is_some(), 2);

    let description_option = config_actions::description(&action).borrow();
    assert!(description_option.is_some(), 3);

    destroy(action);
}

#[test]
/// Test removing optional fields (setting to None)
fun test_new_update_config_remove_optionals() {
    let action = config_actions::new_update_config(
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::some(option::none()), // Remove twap_threshold
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::some(option::none()), // Remove icon_url
        option::some(option::none()), // Remove description
    );

    // These should be Some(None) - meaning "set to None"
    assert!(config_actions::twap_threshold(&action).is_some(), 0);
    assert!(config_actions::icon_url(&action).is_some(), 1);
    assert!(config_actions::description(&action).is_some(), 2);

    // Inner options should be None
    assert!(config_actions::twap_threshold(&action).borrow().is_none(), 3);
    assert!(config_actions::icon_url(&action).borrow().is_none(), 4);
    assert!(config_actions::description(&action).borrow().is_none(), 5);

    destroy(action);
}

#[test]
/// Test extreme values for numeric fields
fun test_new_update_config_extreme_values() {
    let action = config_actions::new_update_config(
        option::some(1u64),                 // min_asset_amount (very low)
        option::some(18446744073709551615u64), // min_stable_amount (max u64)
        option::some(1000u64),              // review_period_ms (1 second)
        option::some(31536000000u64),       // trading_period_ms (1 year)
        option::some(1u16),                 // conditional_amm_fee_bps (0.01%)
        option::some(10000u16),             // spot_amm_fee_bps (100% - max)
        option::some(0u64),                 // amm_twap_start_delay (instant)
        option::some(1u64),                 // amm_twap_step_max (minimum)
        option::some(1u128),                // amm_twap_initial_observation (minimum)
        option::some(option::some(340282366920938463463374607431768211455u128)), // twap_threshold (max u128)
        option::some(1u8),                  // max_outcomes (minimum)
        option::some(255u8),                // max_actions_per_outcome (max u8)
        option::some(255u8),                // max_intents_per_outcome (max u8)
        option::some(1u64),                 // proposal_intent_expiry_ms (1ms)
        option::none(),
        option::none(),
    );

    assert!(*config_actions::min_asset_amount(&action).borrow() == 1, 0);
    assert!(*config_actions::min_stable_amount(&action).borrow() == 18446744073709551615, 1);
    assert!(*config_actions::conditional_amm_fee_bps(&action).borrow() == 1, 2);
    assert!(*config_actions::spot_amm_fee_bps(&action).borrow() == 10000, 3);
    assert!(*config_actions::max_outcomes(&action).borrow() == 1, 4);
    assert!(*config_actions::max_actions_per_outcome(&action).borrow() == 255, 5);

    destroy(action);
}

#[test]
/// Test common configuration scenarios
fun test_new_update_config_realistic_scenarios() {
    // Scenario 1: Reduce trading period and increase fees
    let action1 = config_actions::new_update_config(
        option::none(),
        option::none(),
        option::none(),
        option::some(432000000u64),         // trading_period_ms (5 days instead of 7)
        option::some(40u16),                // conditional_amm_fee_bps (0.4%)
        option::some(35u16),                // spot_amm_fee_bps (0.35%)
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
    );
    assert!(*config_actions::trading_period_ms(&action1).borrow() == 432000000, 0);
    destroy(action1);

    // Scenario 2: Increase limits for larger DAO
    let action2 = config_actions::new_update_config(
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::some(10u8),                 // max_outcomes (from 3)
        option::some(25u8),                 // max_actions_per_outcome (from 10)
        option::some(20u8),                 // max_intents_per_outcome (from 5)
        option::none(),
        option::none(),
        option::none(),
    );
    assert!(*config_actions::max_outcomes(&action2).borrow() == 10, 1);
    destroy(action2);

    // Scenario 3: Update minimum amounts for token price change
    let action3 = config_actions::new_update_config(
        option::some(500u64),               // min_asset_amount (reduced)
        option::some(500u64),               // min_stable_amount (reduced)
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
        option::none(),
    );
    assert!(*config_actions::min_asset_amount(&action3).borrow() == 500, 2);
    destroy(action3);
}
