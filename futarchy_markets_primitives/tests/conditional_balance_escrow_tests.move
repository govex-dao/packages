#[test_only]
module futarchy_markets_primitives::conditional_balance_escrow_tests;

use futarchy_markets_primitives::coin_escrow;
use futarchy_markets_primitives::cond0_asset::{Self, COND0_ASSET};
use futarchy_markets_primitives::cond0_stable::{Self, COND0_STABLE};
use futarchy_markets_primitives::cond1_asset::{Self, COND1_ASSET};
use futarchy_markets_primitives::cond1_stable::{Self, COND1_STABLE};
use futarchy_markets_primitives::conditional_balance;
use futarchy_markets_primitives::market_state;
use sui::coin::{Self, TreasuryCap, CoinMetadata};
use sui::object;
use sui::sui::SUI;
use sui::test_scenario as ts;
use sui::test_utils::destroy;

// Test coin types
public struct USDC has drop {}

const ADMIN: address = @0xAD;

// === Test Helpers ===

fun start(): ts::Scenario {
    ts::begin(ADMIN)
}

fun end(scenario: ts::Scenario) {
    let effects = ts::end(scenario);
    destroy(effects);
}

// === Setup Helper ===

/// Creates escrow and registers conditional caps for 2-outcome market
/// Returns (market_id, escrow)
fun setup_escrow_with_caps(scenario: &mut ts::Scenario): (ID, coin_escrow::TokenEscrow<SUI, USDC>) {
    // Initialize conditional coin types (creates TreasuryCaps and transfers to sender)
    cond0_asset::init_for_testing(ts::ctx(scenario));
    cond0_stable::init_for_testing(ts::ctx(scenario));
    cond1_asset::init_for_testing(ts::ctx(scenario));
    cond1_stable::init_for_testing(ts::ctx(scenario));

    // Advance transaction to retrieve created objects
    ts::next_tx(scenario, ADMIN);

    // Take TreasuryCaps and metadata from sender
    let cond0_asset_cap = ts::take_from_sender<TreasuryCap<COND0_ASSET>>(scenario);
    let cond0_asset_metadata = ts::take_from_sender<CoinMetadata<COND0_ASSET>>(scenario);
    let cond0_stable_cap = ts::take_from_sender<TreasuryCap<COND0_STABLE>>(scenario);
    let cond0_stable_metadata = ts::take_from_sender<CoinMetadata<COND0_STABLE>>(scenario);
    let cond1_asset_cap = ts::take_from_sender<TreasuryCap<COND1_ASSET>>(scenario);
    let cond1_asset_metadata = ts::take_from_sender<CoinMetadata<COND1_ASSET>>(scenario);
    let cond1_stable_cap = ts::take_from_sender<TreasuryCap<COND1_STABLE>>(scenario);
    let cond1_stable_metadata = ts::take_from_sender<CoinMetadata<COND1_STABLE>>(scenario);

    // Create market state for 2 outcomes
    let market_state = market_state::create_for_testing(2, ts::ctx(scenario));
    let market_id = market_state::market_id(&market_state);

    // Create escrow (consumes market_state)
    let mut escrow = coin_escrow::new<SUI, USDC>(market_state, ts::ctx(scenario));

    // Register conditional caps for outcome 0
    coin_escrow::register_conditional_caps<SUI, USDC, COND0_ASSET, COND0_STABLE>(
        &mut escrow,
        0,
        cond0_asset_cap,
        cond0_stable_cap,
    );

    // Register conditional caps for outcome 1
    coin_escrow::register_conditional_caps<SUI, USDC, COND1_ASSET, COND1_STABLE>(
        &mut escrow,
        1,
        cond1_asset_cap,
        cond1_stable_cap,
    );

    // Destroy metadata (not needed for tests)
    destroy(cond0_asset_metadata);
    destroy(cond0_stable_metadata);
    destroy(cond1_asset_metadata);
    destroy(cond1_stable_metadata);

    (market_id, escrow)
}

// === unwrap_to_coin Tests ===

#[test]
fun test_unwrap_to_coin_basic() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);
    // market_id already available

    // Create balance and set some amount
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    conditional_balance::set_balance(&mut balance, 0, true, 1000);
    // Set wrapped balance tracking to match
    coin_escrow::set_wrapped_balance_for_testing(&mut escrow, 0, true, 1000);

    // Unwrap to coin
    let coin = conditional_balance::unwrap_to_coin<SUI, USDC, COND0_ASSET>(
        &mut balance,
        &mut escrow,
        0,
        true,
        ts::ctx(&mut scenario),
    );

    // Verify coin amount
    assert!(coin.value() == 1000, 0);

    // Verify balance is now zero
    assert!(conditional_balance::get_balance(&balance, 0, true) == 0, 1);

    // Cleanup
    coin::burn_for_testing(coin);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
fun test_unwrap_to_coin_stable() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);
    // market_id already available

    // Create balance with stable balance
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    conditional_balance::set_balance(&mut balance, 1, false, 5000);
    // Set wrapped balance tracking to match
    coin_escrow::set_wrapped_balance_for_testing(&mut escrow, 1, false, 5000);

    // Unwrap stable coin
    let coin = conditional_balance::unwrap_to_coin<SUI, USDC, COND1_STABLE>(
        &mut balance,
        &mut escrow,
        1,
        false,
        ts::ctx(&mut scenario),
    );

    // Verify
    assert!(coin.value() == 5000, 0);
    assert!(conditional_balance::get_balance(&mut balance, 1, false) == 0, 1);

    // Cleanup
    coin::burn_for_testing(coin);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
#[expected_failure(abort_code = conditional_balance::EProposalMismatch)]
fun test_unwrap_wrong_market_fails() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    // Create balance for DIFFERENT market
    let wrong_market_id = object::id_from_address(@0x9999);
    let mut balance = conditional_balance::new<SUI, USDC>(
        wrong_market_id,
        2,
        ts::ctx(&mut scenario),
    );

    conditional_balance::set_balance(&mut balance, 0, true, 1000);

    // Try to unwrap - should fail with EProposalMismatch
    let coin = conditional_balance::unwrap_to_coin<SUI, USDC, COND0_ASSET>(
        &mut balance,
        &mut escrow,
        0,
        true,
        ts::ctx(&mut scenario),
    );

    // Cleanup (won't reach here)
    coin::burn_for_testing(coin);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
#[expected_failure(abort_code = conditional_balance::EOutcomeNotRegistered)]
fun test_unwrap_unregistered_outcome_fails() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);
    // market_id already available

    // Create balance with 3 outcomes (but escrow only has 2 registered)
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        3,
        ts::ctx(&mut scenario),
    );

    conditional_balance::set_balance(&mut balance, 2, true, 1000);

    // Try to unwrap outcome 2 - should fail (only 0 and 1 registered)
    let coin = conditional_balance::unwrap_to_coin<SUI, USDC, COND0_ASSET>(
        &mut balance,
        &mut escrow,
        2, // Unregistered outcome
        true,
        ts::ctx(&mut scenario),
    );

    // Cleanup (won't reach here)
    coin::burn_for_testing(coin);
    conditional_balance::set_balance(&mut balance, 2, true, 0);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
#[expected_failure(abort_code = conditional_balance::EInvalidBalanceAccess)]
fun test_unwrap_zero_balance_fails() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);
    // market_id already available

    // Create balance with zero balance
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Balance is 0, unwrap should fail
    let coin = conditional_balance::unwrap_to_coin<SUI, USDC, COND0_ASSET>(
        &mut balance,
        &mut escrow,
        0,
        true,
        ts::ctx(&mut scenario),
    );

    // Cleanup (won't reach here)
    coin::burn_for_testing(coin);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

// === wrap_coin Tests ===

#[test]
fun test_wrap_coin_basic() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);
    // market_id already available

    // Create balance with some amount
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );
    conditional_balance::set_balance(&mut balance, 0, true, 2000);
    // Set wrapped balance tracking to match
    coin_escrow::set_wrapped_balance_for_testing(&mut escrow, 0, true, 2000);

    // Unwrap to get a properly minted coin
    let coin = conditional_balance::unwrap_to_coin<SUI, USDC, COND0_ASSET>(
        &mut balance,
        &mut escrow,
        0,
        true,
        ts::ctx(&mut scenario),
    );

    // Balance should now be zero
    assert!(conditional_balance::get_balance(&balance, 0, true) == 0, 0);

    // Wrap coin back into balance
    conditional_balance::wrap_coin<SUI, USDC, COND0_ASSET>(
        &mut balance,
        &mut escrow,
        coin,
        0,
        true,
    );

    // Verify balance increased back to original
    assert!(conditional_balance::get_balance(&balance, 0, true) == 2000, 1);

    // Cleanup
    conditional_balance::set_balance(&mut balance, 0, true, 0);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
fun test_wrap_coin_accumulates() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);
    // market_id already available

    // Create balance with existing amount
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Start with 1000 (but we'll unwrap 500, so set wrapped to 500)
    conditional_balance::set_balance(&mut balance, 0, false, 500);
    // Set wrapped balance tracking to match what we'll unwrap
    coin_escrow::set_wrapped_balance_for_testing(&mut escrow, 0, false, 500);

    // Unwrap 500 to get a properly minted coin
    let coin = conditional_balance::unwrap_to_coin<SUI, USDC, COND0_STABLE>(
        &mut balance,
        &mut escrow,
        0,
        false,
        ts::ctx(&mut scenario),
    );

    // After unwrap, balance should be 0, set it back to 1000
    // wrapped_balance is now 0 after unwrap
    conditional_balance::set_balance(&mut balance, 0, false, 1000);
    // Set wrapped balance to 1000 so after wrap of 500, total is 1500
    coin_escrow::set_wrapped_balance_for_testing(&mut escrow, 0, false, 1000);

    // Wrap coin - should add to existing balance
    conditional_balance::wrap_coin<SUI, USDC, COND0_STABLE>(
        &mut balance,
        &mut escrow,
        coin,
        0,
        false,
    );

    // Verify accumulated (1000 + 500 = 1500)
    assert!(conditional_balance::get_balance(&balance, 0, false) == 1500, 1);

    // Cleanup
    conditional_balance::set_balance(&mut balance, 0, false, 0);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
#[expected_failure(abort_code = conditional_balance::EProposalMismatch)]
fun test_wrap_coin_wrong_market_fails() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    // Create balance for DIFFERENT market
    let wrong_market_id = object::id_from_address(@0x9999);
    let mut balance = conditional_balance::new<SUI, USDC>(
        wrong_market_id,
        2,
        ts::ctx(&mut scenario),
    );

    let coin = coin::mint_for_testing<COND0_ASSET>(1000, ts::ctx(&mut scenario));

    // Try to wrap - should fail with EProposalMismatch
    conditional_balance::wrap_coin<SUI, USDC, COND0_ASSET>(
        &mut balance,
        &mut escrow,
        coin,
        0,
        true,
    );

    // Cleanup (won't reach here)
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
#[expected_failure(abort_code = conditional_balance::EInvalidBalanceAccess)]
fun test_wrap_coin_zero_amount_fails() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);
    // market_id already available

    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Create zero-value coin
    let coin = coin::mint_for_testing<COND1_ASSET>(0, ts::ctx(&mut scenario));

    // Try to wrap zero coin - should fail
    conditional_balance::wrap_coin<SUI, USDC, COND1_ASSET>(
        &mut balance,
        &mut escrow,
        coin,
        1,
        true,
    );

    // Cleanup (won't reach here)
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

// === Roundtrip Test ===

#[test]
fun test_unwrap_wrap_roundtrip() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);
    // market_id already available

    // Create balance
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Set initial balance
    conditional_balance::set_balance(&mut balance, 0, true, 3000);
    // Set wrapped balance tracking to match
    coin_escrow::set_wrapped_balance_for_testing(&mut escrow, 0, true, 3000);

    // Unwrap to coin
    let coin = conditional_balance::unwrap_to_coin<SUI, USDC, COND0_ASSET>(
        &mut balance,
        &mut escrow,
        0,
        true,
        ts::ctx(&mut scenario),
    );

    // Verify balance is now zero
    assert!(conditional_balance::get_balance(&balance, 0, true) == 0, 0);
    assert!(coin.value() == 3000, 1);

    // Wrap it back
    conditional_balance::wrap_coin<SUI, USDC, COND0_ASSET>(
        &mut balance,
        &mut escrow,
        coin,
        0,
        true,
    );

    // Verify back to original amount
    assert!(conditional_balance::get_balance(&balance, 0, true) == 3000, 2);

    // Cleanup
    conditional_balance::set_balance(&mut balance, 0, true, 0);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

// === Atomic Balance Operation Tests ===

#[test]
fun test_split_stable_to_balance_basic() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    // Create balance
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Create stable coin to split
    let stable_coin = coin::mint_for_testing<USDC>(5000, ts::ctx(&mut scenario));

    // Use atomic split_stable_to_balance (single call for all outcomes!)
    let amount = conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    // Verify amount returned
    assert!(amount == 5000, 0);

    // Verify balance updated for BOTH outcomes (quantum model)
    assert!(conditional_balance::get_balance(&balance, 0, false) == 5000, 1);
    assert!(conditional_balance::get_balance(&balance, 1, false) == 5000, 2);

    // Verify escrow state
    let (_, stable_bal) = coin_escrow::get_spot_balances(&escrow);
    assert!(stable_bal == 5000, 3);

    // Cleanup
    conditional_balance::set_balance(&mut balance, 0, false, 0);
    conditional_balance::set_balance(&mut balance, 1, false, 0);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
fun test_split_asset_to_balance_basic() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    // Create balance
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Create asset coin to split
    let asset_coin = coin::mint_for_testing<SUI>(3000, ts::ctx(&mut scenario));

    // Use atomic split_asset_to_balance
    let amount = conditional_balance::split_asset_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        asset_coin,
    );

    // Verify amount returned
    assert!(amount == 3000, 0);

    // Verify balance updated for BOTH outcomes
    assert!(conditional_balance::get_balance(&balance, 0, true) == 3000, 1);
    assert!(conditional_balance::get_balance(&balance, 1, true) == 3000, 2);

    // Verify escrow state
    let (asset_bal, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(asset_bal == 3000, 3);

    // Cleanup
    conditional_balance::set_balance(&mut balance, 0, true, 0);
    conditional_balance::set_balance(&mut balance, 1, true, 0);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
fun test_recombine_balance_to_stable_basic() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    // Create balance
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // First split to get balances
    let stable_coin = coin::mint_for_testing<USDC>(4000, ts::ctx(&mut scenario));
    conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    // Verify initial state
    assert!(conditional_balance::get_balance(&balance, 0, false) == 4000, 0);
    assert!(conditional_balance::get_balance(&balance, 1, false) == 4000, 1);

    // Recombine 2000 back to spot
    let recombined = conditional_balance::recombine_balance_to_stable<SUI, USDC>(
        &mut escrow,
        &mut balance,
        2000,
        ts::ctx(&mut scenario),
    );

    // Verify recombined amount
    assert!(recombined.value() == 2000, 2);

    // Verify balance decreased for BOTH outcomes
    assert!(conditional_balance::get_balance(&balance, 0, false) == 2000, 3);
    assert!(conditional_balance::get_balance(&balance, 1, false) == 2000, 4);

    // Cleanup
    coin::burn_for_testing(recombined);
    conditional_balance::set_balance(&mut balance, 0, false, 0);
    conditional_balance::set_balance(&mut balance, 1, false, 0);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
fun test_recombine_balance_to_asset_basic() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    // Create balance
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // First split to get balances
    let asset_coin = coin::mint_for_testing<SUI>(6000, ts::ctx(&mut scenario));
    conditional_balance::split_asset_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        asset_coin,
    );

    // Recombine 3000 back to spot
    let recombined = conditional_balance::recombine_balance_to_asset<SUI, USDC>(
        &mut escrow,
        &mut balance,
        3000,
        ts::ctx(&mut scenario),
    );

    // Verify recombined amount
    assert!(recombined.value() == 3000, 0);

    // Verify balance decreased for BOTH outcomes
    assert!(conditional_balance::get_balance(&balance, 0, true) == 3000, 1);
    assert!(conditional_balance::get_balance(&balance, 1, true) == 3000, 2);

    // Cleanup
    coin::burn_for_testing(recombined);
    conditional_balance::set_balance(&mut balance, 0, true, 0);
    conditional_balance::set_balance(&mut balance, 1, true, 0);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
fun test_atomic_split_recombine_roundtrip() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    // Create balance
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Split 10000 stable
    let stable_coin = coin::mint_for_testing<USDC>(10000, ts::ctx(&mut scenario));
    conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    // Verify full amount in both outcomes
    assert!(conditional_balance::get_balance(&balance, 0, false) == 10000, 0);
    assert!(conditional_balance::get_balance(&balance, 1, false) == 10000, 1);

    // Recombine full amount back
    let recombined = conditional_balance::recombine_balance_to_stable<SUI, USDC>(
        &mut escrow,
        &mut balance,
        10000,
        ts::ctx(&mut scenario),
    );

    // Verify full amount returned
    assert!(recombined.value() == 10000, 2);

    // Verify balance is now zero for both outcomes
    assert!(conditional_balance::get_balance(&balance, 0, false) == 0, 3);
    assert!(conditional_balance::get_balance(&balance, 1, false) == 0, 4);

    // Cleanup
    coin::burn_for_testing(recombined);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
#[expected_failure(abort_code = conditional_balance::EInsufficientBalance)]
fun test_recombine_insufficient_balance_fails() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    // Create balance
    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Split 1000 stable
    let stable_coin = coin::mint_for_testing<USDC>(1000, ts::ctx(&mut scenario));
    conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    // Try to recombine more than available - should fail
    let recombined = conditional_balance::recombine_balance_to_stable<SUI, USDC>(
        &mut escrow,
        &mut balance,
        2000, // More than 1000 available
        ts::ctx(&mut scenario),
    );

    // Won't reach here
    coin::burn_for_testing(recombined);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
#[expected_failure(abort_code = conditional_balance::EWrongMarket)]
fun test_split_wrong_market_fails() {
    let mut scenario = start();

    let (_market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    // Create balance for DIFFERENT market
    let wrong_market_id = object::id_from_address(@0x9999);
    let mut balance = conditional_balance::new<SUI, USDC>(
        wrong_market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Try to split - should fail with wrong market
    let stable_coin = coin::mint_for_testing<USDC>(1000, ts::ctx(&mut scenario));
    conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    // Won't reach here
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
/// Verify that atomic split only increments wrapped, NOT supply.
/// This is critical: atomic functions go directly to balance form, bypassing typed coins.
fun test_atomic_split_supply_remains_zero() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Split 1000 stable to balance
    let stable_coin = coin::mint_for_testing<USDC>(1000, ts::ctx(&mut scenario));
    conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    // Verify balance is updated
    assert!(conditional_balance::get_balance(&balance, 0, false) == 1000);
    assert!(conditional_balance::get_balance(&balance, 1, false) == 1000);

    // CRITICAL: Verify supply is still 0 (atomic functions don't touch supply)
    let (asset_supplies, stable_supplies) = coin_escrow::get_all_supplies(&escrow);
    assert!(asset_supplies[0] == 0, 0);
    assert!(asset_supplies[1] == 0, 0);
    assert!(stable_supplies[0] == 0, 0);
    assert!(stable_supplies[1] == 0, 0);

    // Verify wrapped balance is incremented
    let (wrapped_asset, wrapped_stable) = coin_escrow::get_wrapped_balances(&escrow);
    assert!(wrapped_asset[0] == 0, 0);
    assert!(wrapped_asset[1] == 0, 0);
    assert!(wrapped_stable[0] == 1000, 0);
    assert!(wrapped_stable[1] == 1000, 0);

    // Cleanup: recombine to get back the stable
    let recombined = conditional_balance::recombine_balance_to_stable<SUI, USDC>(
        &mut escrow,
        &mut balance,
        1000,
        ts::ctx(&mut scenario),
    );

    coin::burn_for_testing(recombined);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
/// Verify that atomic recombine only decrements wrapped, NOT supply.
fun test_atomic_recombine_supply_remains_zero() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Split and then recombine
    let stable_coin = coin::mint_for_testing<USDC>(1000, ts::ctx(&mut scenario));
    conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    let recombined = conditional_balance::recombine_balance_to_stable<SUI, USDC>(
        &mut escrow,
        &mut balance,
        1000,
        ts::ctx(&mut scenario),
    );

    // CRITICAL: Verify supply is still 0 after recombine
    let (asset_supplies, stable_supplies) = coin_escrow::get_all_supplies(&escrow);
    assert!(asset_supplies[0] == 0, 0);
    assert!(asset_supplies[1] == 0, 0);
    assert!(stable_supplies[0] == 0, 0);
    assert!(stable_supplies[1] == 0, 0);

    // Verify wrapped balance is back to 0
    let (wrapped_asset, wrapped_stable) = coin_escrow::get_wrapped_balances(&escrow);
    assert!(wrapped_asset[0] == 0, 0);
    assert!(wrapped_asset[1] == 0, 0);
    assert!(wrapped_stable[0] == 0, 0);
    assert!(wrapped_stable[1] == 0, 0);

    coin::burn_for_testing(recombined);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
/// Test partial recombine - recombine only part of the balance.
fun test_atomic_partial_recombine() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Split 1000 stable to balance
    let stable_coin = coin::mint_for_testing<USDC>(1000, ts::ctx(&mut scenario));
    conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    // Recombine only 300
    let recombined = conditional_balance::recombine_balance_to_stable<SUI, USDC>(
        &mut escrow,
        &mut balance,
        300,
        ts::ctx(&mut scenario),
    );

    assert!(recombined.value() == 300);

    // Verify 700 remains in balance
    assert!(conditional_balance::get_balance(&balance, 0, false) == 700);
    assert!(conditional_balance::get_balance(&balance, 1, false) == 700);

    // Verify 700 remains in wrapped
    let (_wrapped_asset, wrapped_stable) = coin_escrow::get_wrapped_balances(&escrow);
    assert!(wrapped_stable[0] == 700, 0);
    assert!(wrapped_stable[1] == 700, 0);

    // Recombine the rest
    let recombined2 = conditional_balance::recombine_balance_to_stable<SUI, USDC>(
        &mut escrow,
        &mut balance,
        700,
        ts::ctx(&mut scenario),
    );

    coin::burn_for_testing(recombined);
    coin::burn_for_testing(recombined2);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
#[expected_failure(abort_code = conditional_balance::EInvalidBalanceAccess)]
/// Test that splitting zero amount fails.
fun test_atomic_split_zero_amount_fails() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Try to split 0 - should fail
    let stable_coin = coin::mint_for_testing<USDC>(0, ts::ctx(&mut scenario));
    conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    // Won't reach here
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}

#[test]
#[expected_failure(abort_code = conditional_balance::EInvalidBalanceAccess)]
/// Test that recombining zero amount fails.
fun test_atomic_recombine_zero_amount_fails() {
    let mut scenario = start();

    let (market_id, mut escrow) = setup_escrow_with_caps(&mut scenario);

    let mut balance = conditional_balance::new<SUI, USDC>(
        market_id,
        2,
        ts::ctx(&mut scenario),
    );

    // Split some first
    let stable_coin = coin::mint_for_testing<USDC>(1000, ts::ctx(&mut scenario));
    conditional_balance::split_stable_to_balance<SUI, USDC>(
        &mut escrow,
        &mut balance,
        stable_coin,
    );

    // Try to recombine 0 - should fail
    let recombined = conditional_balance::recombine_balance_to_stable<SUI, USDC>(
        &mut escrow,
        &mut balance,
        0,
        ts::ctx(&mut scenario),
    );

    // Won't reach here
    coin::burn_for_testing(recombined);
    conditional_balance::destroy_empty(balance);
    coin_escrow::destroy_for_testing(escrow);

    end(scenario);
}
