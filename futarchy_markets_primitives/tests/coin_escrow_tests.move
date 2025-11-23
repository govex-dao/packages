#[test_only]
module futarchy_markets_primitives::coin_escrow_tests;

use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::market_state::{Self, MarketState};
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use sui::clock;
use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};
use sui::test_scenario as ts;
use sui::test_utils;

// === Test Coin Types for Conditional Coins ===
// We need unique types for each outcome's conditional coins

// Outcome 0 conditional coins
public struct COND_0_ASSET {}
public struct COND_0_STABLE {}

// Outcome 1 conditional coins
public struct COND_1_ASSET {}
public struct COND_1_STABLE {}

// Outcome 2 conditional coins (for 3-outcome tests)
public struct COND_2_ASSET {}
public struct COND_2_STABLE {}

// === Helper Functions ===

/// Create a test market state with specified outcome count
fun create_test_market_state(outcome_count: u64, ctx: &mut TxContext): MarketState {
    market_state::create_for_testing(outcome_count, ctx)
}

/// Create blank treasury cap for testing (no metadata needed for tests)
fun create_blank_treasury_cap_for_testing<T>(ctx: &mut TxContext): TreasuryCap<T> {
    coin::create_treasury_cap_for_testing<T>(ctx)
}

// === Stage 1: Basic Setup and Registration Tests ===

#[test]
fun test_create_empty_escrow() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Create market state with 2 outcomes
    let market_state = create_test_market_state(2, ctx);

    // Create escrow
    let escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Verify initial state
    assert!(coin_escrow::caps_registered_count(&escrow) == 0, 0);
    let (asset_bal, stable_bal) = coin_escrow::get_spot_balances(&escrow);
    assert!(asset_bal == 0, 1);
    assert!(stable_bal == 0, 2);

    // Verify market state is accessible
    let ms = coin_escrow::get_market_state(&escrow);
    assert!(market_state::outcome_count(ms) == 2, 3);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_register_single_outcome_caps() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Create market state with 1 outcome
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Create conditional coin caps for outcome 0
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);

    // Register the caps
    coin_escrow::register_conditional_caps(
        &mut escrow,
        0, // outcome_idx
        asset_cap,
        stable_cap,
    );

    // Verify registration
    assert!(coin_escrow::caps_registered_count(&escrow) == 1, 0);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_register_multiple_outcome_caps_in_order() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Create market state with 2 outcomes
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register outcome 0
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    // Verify count after first registration
    assert!(coin_escrow::caps_registered_count(&escrow) == 1, 0);

    // Register outcome 1
    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Verify count after second registration
    assert!(coin_escrow::caps_registered_count(&escrow) == 2, 1);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_get_asset_and_stable_supply_after_registration() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Create market state and escrow
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps for outcome 0
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Check initial supplies (should be 0)
    let asset_supply = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let stable_supply = coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &escrow,
        0,
    );

    assert!(asset_supply == 0, 0);
    assert!(stable_supply == 0, 1);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_market_state_accessors() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let outcome_count = 3;
    let market_state = create_test_market_state(outcome_count, ctx);
    let expected_market_id = market_state::market_id(&market_state);

    let escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Test get_market_state
    let ms = coin_escrow::get_market_state(&escrow);
    assert!(market_state::outcome_count(ms) == outcome_count, 0);

    // Test market_state_id
    let market_id = coin_escrow::market_state_id(&escrow);
    assert!(market_id == expected_market_id, 1);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_get_spot_balances_initially_zero() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(2, ctx);
    let escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let (asset_balance, stable_balance) = coin_escrow::get_spot_balances(&escrow);
    assert!(asset_balance == 0, 0);
    assert!(stable_balance == 0, 1);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

// === Error Case Tests ===

#[test]
#[expected_failure(abort_code = coin_escrow::EOutcomeOutOfBounds)]
fun test_register_caps_outcome_out_of_bounds() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Create market with 2 outcomes (indices 0 and 1)
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Try to register outcome 2 (out of bounds)
    let asset_cap = create_blank_treasury_cap_for_testing<COND_2_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_2_STABLE>(ctx);

    coin_escrow::register_conditional_caps(&mut escrow, 2, asset_cap, stable_cap);

    // Should not reach here
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = coin_escrow::EIncorrectSequence)]
fun test_register_caps_incorrect_sequence() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Create market with 3 outcomes
    let market_state = create_test_market_state(3, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register outcome 0 first (correct)
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    // Try to register outcome 2 (skipping 1) - should fail
    let asset_cap_2 = create_blank_treasury_cap_for_testing<COND_2_ASSET>(ctx);
    let stable_cap_2 = create_blank_treasury_cap_for_testing<COND_2_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 2, asset_cap_2, stable_cap_2);

    // Should not reach here
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_three_outcome_market_registration() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Create market with 3 outcomes
    let market_state = create_test_market_state(3, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register all three outcomes in order
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    let asset_cap_2 = create_blank_treasury_cap_for_testing<COND_2_ASSET>(ctx);
    let stable_cap_2 = create_blank_treasury_cap_for_testing<COND_2_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 2, asset_cap_2, stable_cap_2);

    // Verify all registered
    assert!(coin_escrow::caps_registered_count(&escrow) == 3, 0);

    // Verify supplies for all outcomes
    let supply_0 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let supply_1 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &escrow,
        1,
    );
    let supply_2 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_2_ASSET>(
        &escrow,
        2,
    );

    assert!(supply_0 == 0, 1);
    assert!(supply_1 == 0, 2);
    assert!(supply_2 == 0, 3);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

// === Stage 2: Minting Conditional Coins Tests ===

#[test]
fun test_mint_conditional_asset_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with registered caps
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint conditional asset coins
    let amount = 1000;
    let cond_coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0, // outcome_index
        amount,
        ctx,
    );

    // Verify minted coin
    assert!(cond_coin.value() == amount, 0);

    // Verify supply updated
    let supply = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0);
    assert!(supply == amount, 1);

    coin::burn_for_testing(cond_coin);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_mint_conditional_stable_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with registered caps
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint conditional stable coins
    let amount = 2000;
    let cond_coin = coin_escrow::mint_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow,
        0, // outcome_index
        amount,
        ctx,
    );

    // Verify minted coin
    assert!(cond_coin.value() == amount, 0);

    // Verify supply updated
    let supply = coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &escrow,
        0,
    );
    assert!(supply == amount, 1);

    coin::burn_for_testing(cond_coin);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_mint_multiple_times_accumulates_supply() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint first batch
    let coin1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        500,
        ctx,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 500,
        0,
    );

    // Mint second batch
    let coin2 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        300,
        ctx,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 800,
        1,
    );

    // Mint third batch
    let coin3 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        200,
        ctx,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 1000,
        2,
    );

    coin::burn_for_testing(coin1);
    coin::burn_for_testing(coin2);
    coin::burn_for_testing(coin3);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_mint_different_outcomes_independently() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup 2-outcome market
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps for both outcomes
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Mint for outcome 0
    let coin_0 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        1000,
        ctx,
    );

    // Mint for outcome 1
    let coin_1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &mut escrow,
        1,
        2000,
        ctx,
    );

    // Verify independent supplies
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 1000,
        0,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(&escrow, 1) == 2000,
        1,
    );

    coin::burn_for_testing(coin_0);
    coin::burn_for_testing(coin_1);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = coin_escrow::EOutcomeOutOfBounds)]
fun test_mint_conditional_asset_out_of_bounds() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup 1-outcome market (only index 0 valid)
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Try to mint for outcome 1 (out of bounds)
    let coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        1, // out of bounds
        1000,
        ctx,
    );

    // Should not reach here
    coin::burn_for_testing(coin);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_mint_conditional_asset_and_stable_for_same_outcome() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint both asset and stable for same outcome
    let asset_coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        1500,
        ctx,
    );
    let stable_coin = coin_escrow::mint_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow,
        0,
        2500,
        ctx,
    );

    // Verify independent supplies
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 1500,
        0,
    );
    assert!(
        coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(&escrow, 0) == 2500,
        1,
    );

    coin::burn_for_testing(asset_coin);
    coin::burn_for_testing(stable_coin);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_mint_zero_amount() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint zero amount (should be allowed)
    let coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        0,
        ctx,
    );

    assert!(coin.value() == 0, 0);
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        1,
    );

    coin::burn_for_testing(coin);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_mint_large_amount() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint large amount
    let large_amount = 1_000_000_000_000; // 1 trillion
    let coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        large_amount,
        ctx,
    );

    assert!(coin.value() == large_amount, 0);
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == large_amount,
        1,
    );

    coin::burn_for_testing(coin);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

// === Stage 3: Burning Conditional Coins Tests ===

#[test]
fun test_burn_conditional_asset_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint and then burn
    let amount = 1000;
    let coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        amount,
        ctx,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == amount,
        0,
    );

    // Burn the coin
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        coin,
    );

    // Verify supply reduced to zero
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        1,
    );

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_burn_conditional_stable_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint and then burn
    let amount = 2000;
    let coin = coin_escrow::mint_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow,
        0,
        amount,
        ctx,
    );
    assert!(
        coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(&escrow, 0) == amount,
        0,
    );

    // Burn the coin
    coin_escrow::burn_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow,
        0,
        coin,
    );

    // Verify supply reduced to zero
    assert!(
        coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(&escrow, 0) == 0,
        1,
    );

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_burn_partial_supply() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint 1000
    let coin1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        1000,
        ctx,
    );
    // Mint another 500
    let coin2 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        500,
        ctx,
    );

    // Total supply should be 1500
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 1500,
        0,
    );

    // Burn first coin (1000)
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        coin1,
    );

    // Supply should be 500
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 500,
        1,
    );

    // Burn second coin (500)
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        coin2,
    );

    // Supply should be 0
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        2,
    );

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_burn_different_outcomes_independently() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup 2-outcome market
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Mint for both outcomes
    let coin_0 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        1000,
        ctx,
    );
    let coin_1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &mut escrow,
        1,
        2000,
        ctx,
    );

    // Burn outcome 0
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        coin_0,
    );

    // Verify outcome 0 supply is 0, outcome 1 unchanged
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        0,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(&escrow, 1) == 2000,
        1,
    );

    // Burn outcome 1
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &mut escrow,
        1,
        coin_1,
    );

    // Verify both supplies are 0
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        2,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(&escrow, 1) == 0,
        3,
    );

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_burn_asset_and_stable_independently() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint both
    let asset_coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        1500,
        ctx,
    );
    let stable_coin = coin_escrow::mint_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow,
        0,
        2500,
        ctx,
    );

    // Burn asset
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        asset_coin,
    );

    // Verify asset supply is 0, stable unchanged
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        0,
    );
    assert!(
        coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(&escrow, 0) == 2500,
        1,
    );

    // Burn stable
    coin_escrow::burn_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow,
        0,
        stable_coin,
    );

    // Verify both supplies are 0
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        2,
    );
    assert!(
        coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(&escrow, 0) == 0,
        3,
    );

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = coin_escrow::EOutcomeOutOfBounds)]
fun test_burn_conditional_asset_out_of_bounds() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup 1-outcome market
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint for outcome 0
    let coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        1000,
        ctx,
    );

    // Try to burn with outcome 1 (out of bounds)
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        1,
        coin, // Wrong outcome index
    );

    // Should not reach here
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_mint_burn_cycle_maintains_zero_supply() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Initial supply is 0
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        0,
    );

    // Cycle 1: Mint and burn
    let coin1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        1000,
        ctx,
    );
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        coin1,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        1,
    );

    // Cycle 2: Mint and burn different amount
    let coin2 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        5000,
        ctx,
    );
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        coin2,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        2,
    );

    // Cycle 3: Mint and burn again
    let coin3 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        100,
        ctx,
    );
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        coin3,
    );
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        3,
    );

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_burn_zero_amount() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint zero
    let coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        0,
        ctx,
    );

    // Burn zero
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        coin,
    );

    // Supply should still be 0
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        0,
    );

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_burn_large_amount() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint large amount
    let large_amount = 1_000_000_000_000; // 1 trillion
    let coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        large_amount,
        ctx,
    );

    // Burn large amount
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        coin,
    );

    // Supply should be back to 0
    assert!(
        coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0) == 0,
        0,
    );

    test_utils::destroy(escrow);
    ts::end(scenario);
}

// === Stage 4: Spot Deposits and Withdrawals Tests ===

#[test]
fun test_deposit_spot_coins_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Create spot coins
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(2000, ctx);

    // Deposit spot coins
    let (asset_amt, stable_amt) = coin_escrow::deposit_spot_coins(
        &mut escrow,
        asset_coin,
        stable_coin,
    );

    // Verify returned amounts
    assert!(asset_amt == 1000, 0);
    assert!(stable_amt == 2000, 1);

    // Verify balances
    let (bal_asset, bal_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 1000, 2);
    assert!(bal_stable == 2000, 3);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_spot_coins_multiple_times() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // First deposit
    let asset_coin_1 = coin::mint_for_testing<TEST_COIN_A>(500, ctx);
    let stable_coin_1 = coin::mint_for_testing<TEST_COIN_B>(1000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin_1, stable_coin_1);

    let (bal1_asset, bal1_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal1_asset == 500, 0);
    assert!(bal1_stable == 1000, 1);

    // Second deposit
    let asset_coin_2 = coin::mint_for_testing<TEST_COIN_A>(300, ctx);
    let stable_coin_2 = coin::mint_for_testing<TEST_COIN_B>(700, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin_2, stable_coin_2);

    let (bal2_asset, bal2_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal2_asset == 800, 2);
    assert!(bal2_stable == 1700, 3);

    // Third deposit
    let asset_coin_3 = coin::mint_for_testing<TEST_COIN_A>(200, ctx);
    let stable_coin_3 = coin::mint_for_testing<TEST_COIN_B>(300, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin_3, stable_coin_3);

    let (bal3_asset, bal3_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal3_asset == 1000, 4);
    assert!(bal3_stable == 2000, 5);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_withdraw_from_escrow_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Deposit first
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(2000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin, stable_coin);

    // Withdraw
    let (withdrawn_asset, withdrawn_stable) = coin_escrow::withdraw_from_escrow(
        &mut escrow,
        500, // asset amount
        1000, // stable amount
        ctx,
    );

    // Verify withdrawn amounts
    assert!(withdrawn_asset.value() == 500, 0);
    assert!(withdrawn_stable.value() == 1000, 1);

    // Verify remaining balances
    let (bal_asset, bal_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 500, 2);
    assert!(bal_stable == 1000, 3);

    coin::burn_for_testing(withdrawn_asset);
    coin::burn_for_testing(withdrawn_stable);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_withdraw_all_from_escrow() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Deposit
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(2000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin, stable_coin);

    // Withdraw all
    let (withdrawn_asset, withdrawn_stable) = coin_escrow::withdraw_from_escrow(
        &mut escrow,
        1000,
        2000,
        ctx,
    );

    // Verify amounts
    assert!(withdrawn_asset.value() == 1000, 0);
    assert!(withdrawn_stable.value() == 2000, 1);

    // Verify escrow is empty
    let (bal_asset, bal_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 0, 2);
    assert!(bal_stable == 0, 3);

    coin::burn_for_testing(withdrawn_asset);
    coin::burn_for_testing(withdrawn_stable);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_withdraw_asset_balance_only() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Deposit
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(2000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin, stable_coin);

    // Withdraw only asset
    let withdrawn_asset = coin_escrow::withdraw_asset_balance(
        &mut escrow,
        500,
        ctx,
    );

    assert!(withdrawn_asset.value() == 500, 0);

    // Verify balances (only asset reduced, stable unchanged)
    let (bal_asset, bal_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 500, 1);
    assert!(bal_stable == 2000, 2);

    coin::burn_for_testing(withdrawn_asset);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_withdraw_stable_balance_only() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Deposit
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(2000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin, stable_coin);

    // Withdraw only stable
    let withdrawn_stable = coin_escrow::withdraw_stable_balance(
        &mut escrow,
        1000,
        ctx,
    );

    assert!(withdrawn_stable.value() == 1000, 0);

    // Verify balances (only stable reduced, asset unchanged)
    let (bal_asset, bal_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 1000, 1);
    assert!(bal_stable == 1000, 2);

    coin::burn_for_testing(withdrawn_stable);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_withdraw_cycle() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Cycle 1: Deposit and withdraw
    let asset1 = coin::mint_for_testing<TEST_COIN_A>(500, ctx);
    let stable1 = coin::mint_for_testing<TEST_COIN_B>(1000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset1, stable1);

    let (w_asset1, w_stable1) = coin_escrow::withdraw_from_escrow(&mut escrow, 500, 1000, ctx);
    coin::burn_for_testing(w_asset1);
    coin::burn_for_testing(w_stable1);

    let (bal1_a, bal1_s) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal1_a == 0 && bal1_s == 0, 0);

    // Cycle 2: Different amounts
    let asset2 = coin::mint_for_testing<TEST_COIN_A>(2000, ctx);
    let stable2 = coin::mint_for_testing<TEST_COIN_B>(3000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset2, stable2);

    let (w_asset2, w_stable2) = coin_escrow::withdraw_from_escrow(&mut escrow, 2000, 3000, ctx);
    coin::burn_for_testing(w_asset2);
    coin::burn_for_testing(w_stable2);

    let (bal2_a, bal2_s) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal2_a == 0 && bal2_s == 0, 1);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = coin_escrow::EZeroAmount)]
fun test_deposit_zero_both_coins() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Try to deposit zero for both (should fail)
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(0, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(0, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin, stable_coin);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_zero_asset_nonzero_stable() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Deposit zero asset, non-zero stable (should succeed)
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(0, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(1000, ctx);
    let (asset_amt, stable_amt) = coin_escrow::deposit_spot_coins(
        &mut escrow,
        asset_coin,
        stable_coin,
    );

    assert!(asset_amt == 0, 0);
    assert!(stable_amt == 1000, 1);

    let (bal_a, bal_s) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_a == 0, 2);
    assert!(bal_s == 1000, 3);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_nonzero_asset_zero_stable() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Deposit non-zero asset, zero stable (should succeed)
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(0, ctx);
    let (asset_amt, stable_amt) = coin_escrow::deposit_spot_coins(
        &mut escrow,
        asset_coin,
        stable_coin,
    );

    assert!(asset_amt == 1000, 0);
    assert!(stable_amt == 0, 1);

    let (bal_a, bal_s) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_a == 1000, 2);
    assert!(bal_s == 0, 3);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = coin_escrow::ENotEnoughLiquidity)]
fun test_withdraw_insufficient_asset() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Deposit 500 asset
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(500, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(1000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin, stable_coin);

    // Try to withdraw 1000 asset (more than available)
    let (w_asset, w_stable) = coin_escrow::withdraw_from_escrow(&mut escrow, 1000, 500, ctx);

    // Should not reach here
    coin::burn_for_testing(w_asset);
    coin::burn_for_testing(w_stable);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = coin_escrow::ENotEnoughLiquidity)]
fun test_withdraw_insufficient_stable() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Deposit 1000 stable
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(1000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin, stable_coin);

    // Try to withdraw 2000 stable (more than available)
    let (w_asset, w_stable) = coin_escrow::withdraw_from_escrow(&mut escrow, 500, 2000, ctx);

    // Should not reach here
    coin::burn_for_testing(w_asset);
    coin::burn_for_testing(w_stable);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_large_amounts() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Deposit large amounts
    let large_amt = 1_000_000_000_000;
    let asset_coin = coin::mint_for_testing<TEST_COIN_A>(large_amt, ctx);
    let stable_coin = coin::mint_for_testing<TEST_COIN_B>(large_amt, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, asset_coin, stable_coin);

    let (bal_a, bal_s) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_a == large_amt, 0);
    assert!(bal_s == large_amt, 1);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

// === Stage 5: Deposit-Mint and Burn-Withdraw Tests ===

#[test]
fun test_deposit_asset_and_mint_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Create spot asset coin
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);

    // Deposit and mint in one operation
    let cond_asset = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0, // outcome_index
        spot_asset,
        ctx,
    );

    // Verify conditional coin amount (1:1 ratio due to quantum liquidity)
    assert!(cond_asset.value() == 1000, 0);

    // Verify escrow balance increased
    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 1000, 1);

    // Verify conditional supply increased
    let supply = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0);
    assert!(supply == 1000, 2);

    coin::burn_for_testing(cond_asset);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_stable_and_mint_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Create spot stable coin
    let spot_stable = coin::mint_for_testing<TEST_COIN_B>(2000, ctx);

    // Deposit and mint in one operation
    let cond_stable = coin_escrow::deposit_stable_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_STABLE,
    >(
        &mut escrow,
        0, // outcome_index
        spot_stable,
        ctx,
    );

    // Verify conditional coin amount (1:1 ratio)
    assert!(cond_stable.value() == 2000, 0);

    // Verify escrow balance increased
    let (_, bal_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_stable == 2000, 1);

    // Verify conditional supply increased
    let supply = coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &escrow,
        0,
    );
    assert!(supply == 2000, 2);

    coin::burn_for_testing(cond_stable);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_both_asset_and_stable_for_same_outcome() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Deposit and mint asset
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1500, ctx);
    let cond_asset = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot_asset,
        ctx,
    );

    // Deposit and mint stable
    let spot_stable = coin::mint_for_testing<TEST_COIN_B>(2500, ctx);
    let cond_stable = coin_escrow::deposit_stable_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_STABLE,
    >(
        &mut escrow,
        0,
        spot_stable,
        ctx,
    );

    // Verify both conditional coins
    assert!(cond_asset.value() == 1500, 0);
    assert!(cond_stable.value() == 2500, 1);

    // Verify escrow balances
    let (bal_asset, bal_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 1500, 2);
    assert!(bal_stable == 2500, 3);

    // Verify supplies
    let asset_supply = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let stable_supply = coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &escrow,
        0,
    );
    assert!(asset_supply == 1500, 4);
    assert!(stable_supply == 2500, 5);

    coin::burn_for_testing(cond_asset);
    coin::burn_for_testing(cond_stable);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_mint_for_different_outcomes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup 2-outcome market
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps for both outcomes
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Deposit and mint for outcome 0
    let spot_0 = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let cond_0 = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot_0,
        ctx,
    );

    // Deposit and mint for outcome 1 (must be same amount to maintain quantum invariant)
    let spot_1 = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let cond_1 = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_1_ASSET,
    >(
        &mut escrow,
        1,
        spot_1,
        ctx,
    );

    // Verify conditional coins have equal amounts (quantum model)
    assert!(cond_0.value() == 1000, 0);
    assert!(cond_1.value() == 1000, 1);

    // Verify escrow balance (accumulated from both deposits)
    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 2000, 2); // 1000 + 1000

    // Verify equal supplies (quantum model)
    let supply_0 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let supply_1 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &escrow,
        1,
    );
    assert!(supply_0 == 1000, 3);
    assert!(supply_1 == 1000, 4);

    coin::burn_for_testing(cond_0);
    coin::burn_for_testing(cond_1);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_quantum_liquidity_1_to_1_ratio() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Deposit 1000 spot, should get 1000 conditional (not proportional split)
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let original_amount = spot_asset.value();

    let cond_asset = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot_asset,
        ctx,
    );

    // Quantum liquidity: 1 spot → 1 conditional (for EACH outcome)
    assert!(cond_asset.value() == original_amount, 0);

    // Escrow should hold the deposited spot amount
    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == original_amount, 1);

    // Conditional supply should equal deposited amount
    let supply = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0);
    assert!(supply == original_amount, 2);

    coin::burn_for_testing(cond_asset);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_burn_asset_and_withdraw_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // First, deposit spot tokens and mint conditional coins
    let spot_deposit = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let mut cond_asset = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot_deposit,
        ctx,
    );

    // Split to get 500 for withdrawal
    let cond_to_burn = cond_asset.split(500, ctx);
    coin::burn_for_testing(cond_asset);

    // Finalize market for redemption
    let ms = coin_escrow::get_market_state_mut(&mut escrow);
    market_state::finalize_for_testing(ms);

    // Burn conditional and withdraw spot (this is for redemption scenario)
    let withdrawn_spot = coin_escrow::burn_conditional_asset_and_withdraw<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        cond_to_burn,
        ctx,
    );

    // Verify withdrawn amount (1:1 ratio)
    assert!(withdrawn_spot.value() == 500, 0);

    // Verify escrow balance decreased
    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 500, 1); // 1000 - 500

    // Verify conditional supply (minted 1000, burned 500 through escrow)
    // Note: coin::burn_for_testing doesn't affect escrow supply tracking
    let supply = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0);
    assert!(supply == 500, 2); // 1000 minted - 500 burned via escrow

    coin::burn_for_testing(withdrawn_spot);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_burn_stable_and_withdraw_basic() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Deposit stable and mint conditional stable coins
    let spot_deposit = coin::mint_for_testing<TEST_COIN_B>(2000, ctx);
    let mut cond_stable = coin_escrow::deposit_stable_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_STABLE,
    >(
        &mut escrow,
        0,
        spot_deposit,
        ctx,
    );

    // Split to get 1000 for withdrawal
    let cond_to_burn = cond_stable.split(1000, ctx);
    coin::burn_for_testing(cond_stable);

    // Finalize market for redemption
    let ms = coin_escrow::get_market_state_mut(&mut escrow);
    market_state::finalize_for_testing(ms);

    // Burn conditional and withdraw spot
    let withdrawn_spot = coin_escrow::burn_conditional_stable_and_withdraw<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_STABLE,
    >(
        &mut escrow,
        cond_to_burn,
        ctx,
    );

    // Verify withdrawn amount
    assert!(withdrawn_spot.value() == 1000, 0);

    // Verify escrow balance decreased
    let (_, bal_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_stable == 1000, 1); // 2000 - 1000

    // Verify supply (minted 2000, burned 1000 through escrow)
    // Note: coin::burn_for_testing doesn't affect escrow supply tracking
    let supply = coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &escrow,
        0,
    );
    assert!(supply == 1000, 2); // 2000 minted - 1000 burned via escrow

    coin::burn_for_testing(withdrawn_spot);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_full_cycle_deposit_mint_burn_withdraw() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Initial state: zero balances
    let (bal0_a, bal0_s) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal0_a == 0 && bal0_s == 0, 0);

    // Step 1: Deposit and mint
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let mut cond_asset = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot_asset,
        ctx,
    );
    assert!(cond_asset.value() == 1000, 1);

    // State after deposit: escrow has 1000, supply is 1000
    let (bal1_a, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal1_a == 1000, 2);
    let supply1 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0);
    assert!(supply1 == 1000, 3);

    // Step 2: Split and burn some conditional coins (manually, separate from withdraw)
    let cond_to_withdraw = cond_asset.split(500, ctx);
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        cond_asset,
    );

    // State after burn: escrow still has 1000, supply is 500 (burned 500)
    let (bal2_a, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal2_a == 1000, 4);
    let supply2 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0);
    assert!(supply2 == 500, 5);

    // Finalize market for redemption
    let ms = coin_escrow::get_market_state_mut(&mut escrow);
    market_state::finalize_for_testing(ms);

    // Step 3: Now use burn_and_withdraw to get spot back
    let withdrawn = coin_escrow::burn_conditional_asset_and_withdraw<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        cond_to_withdraw,
        ctx,
    );
    assert!(withdrawn.value() == 500, 6);

    // Final state: escrow has 500, supply is 0
    let (bal3_a, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal3_a == 500, 7);
    let supply3 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(&escrow, 0);
    assert!(supply3 == 0, 8);

    coin::burn_for_testing(withdrawn);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_multiple_deposit_mint_burn_withdraw_cycles() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Finalize market for redemption (only needed once)
    let ms = coin_escrow::get_market_state_mut(&mut escrow);
    market_state::finalize_for_testing(ms);

    // Cycle 1: Deposit 500, withdraw 500
    let spot1 = coin::mint_for_testing<TEST_COIN_A>(500, ctx);
    let cond1 = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot1,
        ctx,
    );

    let withdrawn1 = coin_escrow::burn_conditional_asset_and_withdraw<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        cond1,
        ctx,
    );
    coin::burn_for_testing(withdrawn1);
    let (bal1, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal1 == 0, 0);

    // Cycle 2: Deposit 1000, withdraw 1000
    let spot2 = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let cond2 = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot2,
        ctx,
    );
    let withdrawn2 = coin_escrow::burn_conditional_asset_and_withdraw<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        cond2,
        ctx,
    );
    coin::burn_for_testing(withdrawn2);
    let (bal2, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal2 == 0, 1);

    // Cycle 3: Deposit 2000, withdraw 2000
    let spot3 = coin::mint_for_testing<TEST_COIN_A>(2000, ctx);
    let cond3 = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot3,
        ctx,
    );
    let withdrawn3 = coin_escrow::burn_conditional_asset_and_withdraw<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        cond3,
        ctx,
    );
    coin::burn_for_testing(withdrawn3);
    let (bal3, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal3 == 0, 2);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_cross_outcome_operations() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup 2-outcome market
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Deposit and mint for outcome 0 (quantum model: same amount for all outcomes)
    let spot_0 = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let cond_0 = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot_0,
        ctx,
    );

    // Deposit and mint for outcome 1 (same amount to maintain quantum invariant)
    let spot_1 = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let mut cond_1 = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_1_ASSET,
    >(
        &mut escrow,
        1,
        spot_1,
        ctx,
    );

    // Escrow should have accumulated liquidity
    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 2000, 0); // 1000 + 1000

    // Burn outcome 0 conditionals
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow,
        0,
        cond_0,
    );

    // Verify outcome 0 supply is 0, outcome 1 unchanged
    let supply_0 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let supply_1 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &escrow,
        1,
    );
    assert!(supply_0 == 0, 1);
    assert!(supply_1 == 1000, 2);

    // Finalize market for redemption with outcome 1 as winner
    let ms = coin_escrow::get_market_state_mut(&mut escrow);
    market_state::finalize_for_testing(ms);
    market_state::test_set_winning_outcome(ms, 1);

    // Split cond_1 to get 500 for withdrawal
    let cond_to_withdraw = cond_1.split(500, ctx);

    // Withdraw from shared liquidity using outcome 1's burn-withdraw
    let withdrawn = coin_escrow::burn_conditional_asset_and_withdraw<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_1_ASSET,
    >(
        &mut escrow,
        cond_to_withdraw,
        ctx,
    );
    assert!(withdrawn.value() == 500, 3);

    // Escrow balance should decrease
    let (bal_asset2, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset2 == 1500, 4); // 2000 - 500

    coin::burn_for_testing(cond_1);
    coin::burn_for_testing(withdrawn);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_mint_zero_amount_edge_case() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Deposit zero amount (should work)
    let spot_zero = coin::mint_for_testing<TEST_COIN_A>(0, ctx);
    let cond_zero = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot_zero,
        ctx,
    );

    assert!(cond_zero.value() == 0, 0);
    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 0, 1);

    coin::burn_for_testing(cond_zero);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_deposit_mint_large_amounts() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);
    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Deposit large amount
    let large_amt = 1_000_000_000_000; // 1 trillion
    let spot_large = coin::mint_for_testing<TEST_COIN_A>(large_amt, ctx);
    let cond_large = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(
        &mut escrow,
        0,
        spot_large,
        ctx,
    );

    assert!(cond_large.value() == large_amt, 0);
    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == large_amt, 1);

    coin::burn_for_testing(cond_large);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

// === Stage 6: Complete Set Operations and Quantum Invariant Tests ===
// Validates the PTB progress helpers for complete set splits/recombines that
// frontends will chain together when constructing programmable transactions.

fun split_asset_complete_set_2_for_testing<AssetType, StableType, Cond0, Cond1>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    spot_asset: Coin<AssetType>,
    ctx: &mut TxContext,
): (Coin<Cond0>, Coin<Cond1>) {
    let progress = coin_escrow::start_split_asset_progress(escrow, spot_asset);
    let (progress, cond_0) = coin_escrow::split_asset_progress_step<AssetType, StableType, Cond0>(
        progress,
        escrow,
        0,
        ctx,
    );
    let (progress, cond_1) = coin_escrow::split_asset_progress_step<AssetType, StableType, Cond1>(
        progress,
        escrow,
        1,
        ctx,
    );
    coin_escrow::finish_split_asset_progress(progress, escrow);
    (cond_0, cond_1)
}

fun split_stable_complete_set_2_for_testing<AssetType, StableType, Cond0, Cond1>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    spot_stable: Coin<StableType>,
    ctx: &mut TxContext,
): (Coin<Cond0>, Coin<Cond1>) {
    let progress = coin_escrow::start_split_stable_progress(escrow, spot_stable);
    let (progress, cond_0) = coin_escrow::split_stable_progress_step<AssetType, StableType, Cond0>(
        progress,
        escrow,
        0,
        ctx,
    );
    let (progress, cond_1) = coin_escrow::split_stable_progress_step<AssetType, StableType, Cond1>(
        progress,
        escrow,
        1,
        ctx,
    );
    coin_escrow::finish_split_stable_progress(progress, escrow);
    (cond_0, cond_1)
}

fun split_asset_complete_set_3_for_testing<AssetType, StableType, Cond0, Cond1, Cond2>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    spot_asset: Coin<AssetType>,
    ctx: &mut TxContext,
): (Coin<Cond0>, Coin<Cond1>, Coin<Cond2>) {
    let progress = coin_escrow::start_split_asset_progress(escrow, spot_asset);
    let (progress, cond_0) = coin_escrow::split_asset_progress_step<AssetType, StableType, Cond0>(
        progress,
        escrow,
        0,
        ctx,
    );
    let (progress, cond_1) = coin_escrow::split_asset_progress_step<AssetType, StableType, Cond1>(
        progress,
        escrow,
        1,
        ctx,
    );
    let (progress, cond_2) = coin_escrow::split_asset_progress_step<AssetType, StableType, Cond2>(
        progress,
        escrow,
        2,
        ctx,
    );
    coin_escrow::finish_split_asset_progress(progress, escrow);
    (cond_0, cond_1, cond_2)
}

fun recombine_asset_complete_set_2_for_testing<AssetType, StableType, Cond0, Cond1>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    cond_0: Coin<Cond0>,
    cond_1: Coin<Cond1>,
    ctx: &mut TxContext,
): Coin<AssetType> {
    let progress = coin_escrow::start_recombine_asset_progress<AssetType, StableType, Cond0>(
        escrow,
        0,
        cond_0,
    );
    let progress = coin_escrow::recombine_asset_progress_step<AssetType, StableType, Cond1>(
        progress,
        escrow,
        1,
        cond_1,
    );
    coin_escrow::finish_recombine_asset_progress(progress, escrow, ctx)
}

fun recombine_stable_complete_set_2_for_testing<AssetType, StableType, Cond0, Cond1>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    cond_0: Coin<Cond0>,
    cond_1: Coin<Cond1>,
    ctx: &mut TxContext,
): Coin<StableType> {
    let progress = coin_escrow::start_recombine_stable_progress<AssetType, StableType, Cond0>(
        escrow,
        0,
        cond_0,
    );
    let progress = coin_escrow::recombine_stable_progress_step<AssetType, StableType, Cond1>(
        progress,
        escrow,
        1,
        cond_1,
    );
    coin_escrow::finish_recombine_stable_progress(progress, escrow, ctx)
}

fun recombine_asset_complete_set_3_for_testing<AssetType, StableType, Cond0, Cond1, Cond2>(
    escrow: &mut TokenEscrow<AssetType, StableType>,
    cond_0: Coin<Cond0>,
    cond_1: Coin<Cond1>,
    cond_2: Coin<Cond2>,
    ctx: &mut TxContext,
): Coin<AssetType> {
    let progress = coin_escrow::start_recombine_asset_progress<AssetType, StableType, Cond0>(
        escrow,
        0,
        cond_0,
    );
    let progress = coin_escrow::recombine_asset_progress_step<AssetType, StableType, Cond1>(
        progress,
        escrow,
        1,
        cond_1,
    );
    let progress = coin_escrow::recombine_asset_progress_step<AssetType, StableType, Cond2>(
        progress,
        escrow,
        2,
        cond_2,
    );
    coin_escrow::finish_recombine_asset_progress(progress, escrow, ctx)
}

#[test]
fun test_split_asset_complete_set_2_basic() {
    let mut scenario = ts::begin(@0xBABE);
    let ctx = ts::ctx(&mut scenario);
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Create spot asset
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);

    // Split into complete set via PTB progress flow
    let (cond_0, cond_1) = split_asset_complete_set_2_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
    >(&mut escrow, spot_asset, ctx);

    // Verify escrow balance increased
    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 1000, 0);

    // Verify both outcomes have supply
    let supply_0 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let supply_1 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &escrow,
        1,
    );
    assert!(supply_0 == 1000, 1);
    assert!(supply_1 == 1000, 2);

    assert!(cond_0.value() == 1000, 3);
    assert!(cond_1.value() == 1000, 4);

    coin::burn_for_testing(cond_0);
    coin::burn_for_testing(cond_1);

    test_utils::destroy(escrow);

    ts::end(scenario);
}

#[test]
fun test_split_stable_complete_set_2_basic() {
    let mut scenario = ts::begin(@0xBABE);
    let ctx = ts::ctx(&mut scenario);
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Create spot stable
    let spot_stable = coin::mint_for_testing<TEST_COIN_B>(2000, ctx);

    // Split into complete set via progress helpers
    let (cond_0, cond_1) = split_stable_complete_set_2_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_STABLE,
        COND_1_STABLE,
    >(&mut escrow, spot_stable, ctx);

    // Verify escrow balance
    let (_, bal_stable) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_stable == 2000, 0);

    // Verify supplies
    let supply_0 = coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &escrow,
        0,
    );
    let supply_1 = coin_escrow::get_stable_supply<TEST_COIN_A, TEST_COIN_B, COND_1_STABLE>(
        &escrow,
        1,
    );
    assert!(supply_0 == 2000, 1);
    assert!(supply_1 == 2000, 2);

    assert!(cond_0.value() == 2000, 3);
    assert!(cond_1.value() == 2000, 4);

    coin::burn_for_testing<COND_0_STABLE>(cond_0);
    coin::burn_for_testing<COND_1_STABLE>(cond_1);

    test_utils::destroy(escrow);

    ts::end(scenario);
}

#[test]
fun test_recombine_asset_complete_set_2_basic() {
    let mut scenario = ts::begin(@0xBABE);
    let ctx = ts::ctx(&mut scenario);
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // First, create complete set
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let (cond_0, cond_1) = split_asset_complete_set_2_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
    >(&mut escrow, spot_asset, ctx);

    // Verify supplies before recombination
    let supply_0_before = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let supply_1_before = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &escrow,
        1,
    );
    assert!(supply_0_before == 1000, 0);
    assert!(supply_1_before == 1000, 1);

    // Recombine and verify we receive spot asset
    let spot_back = recombine_asset_complete_set_2_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
    >(&mut escrow, cond_0, cond_1, ctx);

    assert!(spot_back.value() == 1000, 2);
    coin::burn_for_testing<TEST_COIN_A>(spot_back);

    // Supplies should now be zero and escrow balances restored
    let supply_0 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let supply_1 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &escrow,
        1,
    );
    assert!(supply_0 == 0, 3);
    assert!(supply_1 == 0, 4);

    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 0, 5);

    test_utils::destroy(escrow);

    ts::end(scenario);
}

#[test]
fun test_split_recombine_cycle_maintains_balance() {
    let mut scenario = ts::begin(@0xBABE);
    let ctx = ts::ctx(&mut scenario);
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Split
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(500, ctx);
    let (cond_0, cond_1) = split_asset_complete_set_2_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
    >(&mut escrow, spot_asset, ctx);

    // Immediately recombine
    let spot_back = recombine_asset_complete_set_2_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
    >(&mut escrow, cond_0, cond_1, ctx);

    // Verify complete cycle: balance should be back to zero
    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 0, 0);
    assert!(spot_back.value() == 500, 1);

    coin::burn_for_testing<TEST_COIN_A>(spot_back);
    test_utils::destroy(escrow);

    ts::end(scenario);
}

#[test]
fun test_split_asset_complete_set_3_outcomes() {
    let mut scenario = ts::begin(@0xBABE);
    let ctx = ts::ctx(&mut scenario);
    let market_state = create_test_market_state(3, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps for all 3 outcomes
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    let asset_cap_2 = create_blank_treasury_cap_for_testing<COND_2_ASSET>(ctx);
    let stable_cap_2 = create_blank_treasury_cap_for_testing<COND_2_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 2, asset_cap_2, stable_cap_2);

    // Split into 3-outcome complete set
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1500, ctx);
    let (cond_0, cond_1, cond_2) = split_asset_complete_set_3_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
        COND_2_ASSET,
    >(&mut escrow, spot_asset, ctx);

    // Verify all 3 outcomes have equal supply (quantum liquidity)
    let supply_0 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let supply_1 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &escrow,
        1,
    );
    let supply_2 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_2_ASSET>(
        &escrow,
        2,
    );
    assert!(supply_0 == 1500, 0);
    assert!(supply_1 == 1500, 1);
    assert!(supply_2 == 1500, 2);

    assert!(cond_0.value() == 1500, 3);
    assert!(cond_1.value() == 1500, 4);
    assert!(cond_2.value() == 1500, 5);

    coin::burn_for_testing<COND_0_ASSET>(cond_0);
    coin::burn_for_testing<COND_1_ASSET>(cond_1);
    coin::burn_for_testing<COND_2_ASSET>(cond_2);

    test_utils::destroy(escrow);

    ts::end(scenario);
}

#[test]
fun test_recombine_asset_complete_set_3_outcomes() {
    let mut scenario = ts::begin(@0xBABE);
    let ctx = ts::ctx(&mut scenario);
    let market_state = create_test_market_state(3, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    let asset_cap_2 = create_blank_treasury_cap_for_testing<COND_2_ASSET>(ctx);
    let stable_cap_2 = create_blank_treasury_cap_for_testing<COND_2_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 2, asset_cap_2, stable_cap_2);

    // Split
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1500, ctx);
    let (cond_0, cond_1, cond_2) = split_asset_complete_set_3_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
        COND_2_ASSET,
    >(&mut escrow, spot_asset, ctx);

    let spot = recombine_asset_complete_set_3_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
        COND_2_ASSET,
    >(&mut escrow, cond_0, cond_1, cond_2, ctx);

    assert!(spot.value() == 1500, 0);

    let supply_0 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &escrow,
        0,
    );
    let supply_1 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &escrow,
        1,
    );
    let supply_2 = coin_escrow::get_asset_supply<TEST_COIN_A, TEST_COIN_B, COND_2_ASSET>(
        &escrow,
        2,
    );
    assert!(supply_0 == 0, 1);
    assert!(supply_1 == 0, 2);
    assert!(supply_2 == 0, 3);

    let (bal_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(bal_asset == 0, 4);

    coin::burn_for_testing<TEST_COIN_A>(spot);
    test_utils::destroy(escrow);

    ts::end(scenario);
}

// === Stage 8: Quantum Invariant Tracking Tests ===

#[test]
fun test_supply_vector_tracking_on_mint() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with 2 outcomes
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register caps for both outcomes
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Verify initial supplies are 0
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 0, 0);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 0, 1);
    assert!(coin_escrow::get_outcome_stable_supply(&escrow, 0) == 0, 2);
    assert!(coin_escrow::get_outcome_stable_supply(&escrow, 1) == 0, 3);

    // Mint to outcome 0
    let cond_asset_0 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 1000, ctx,
    );
    let cond_stable_0 = coin_escrow::mint_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow, 0, 2000, ctx,
    );

    // Verify outcome 0 supplies updated
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 1000, 4);
    assert!(coin_escrow::get_outcome_stable_supply(&escrow, 0) == 2000, 5);

    // Verify outcome 1 supplies unchanged
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 0, 6);
    assert!(coin_escrow::get_outcome_stable_supply(&escrow, 1) == 0, 7);

    // Mint to outcome 1
    let cond_asset_1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &mut escrow, 1, 500, ctx,
    );

    // Verify outcome 1 updated, outcome 0 unchanged
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 1000, 8);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 500, 9);

    coin::burn_for_testing(cond_asset_0);
    coin::burn_for_testing(cond_stable_0);
    coin::burn_for_testing(cond_asset_1);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_supply_vector_tracking_on_burn() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint coins
    let cond_asset = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 1000, ctx,
    );

    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 1000, 0);

    // Burn coins
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, cond_asset,
    );

    // Verify supply decremented
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 0, 1);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_get_all_supplies_vectors() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with 3 outcomes
    let market_state = create_test_market_state(3, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    // Register all caps
    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    let asset_cap_2 = create_blank_treasury_cap_for_testing<COND_2_ASSET>(ctx);
    let stable_cap_2 = create_blank_treasury_cap_for_testing<COND_2_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 2, asset_cap_2, stable_cap_2);

    // Mint different amounts to each outcome
    let c0 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 100, ctx,
    );
    let c1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &mut escrow, 1, 200, ctx,
    );
    let c2 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_2_ASSET>(
        &mut escrow, 2, 300, ctx,
    );

    // Verify get_all_asset_supplies returns correct vector
    let asset_supplies = coin_escrow::get_all_asset_supplies(&escrow);
    assert!(asset_supplies.length() == 3, 0);
    assert!(asset_supplies[0] == 100, 1);
    assert!(asset_supplies[1] == 200, 2);
    assert!(asset_supplies[2] == 300, 3);

    // Verify get_all_stable_supplies returns zeros (nothing minted)
    let stable_supplies = coin_escrow::get_all_stable_supplies(&escrow);
    assert!(stable_supplies.length() == 3, 4);
    assert!(stable_supplies[0] == 0, 5);
    assert!(stable_supplies[1] == 0, 6);
    assert!(stable_supplies[2] == 0, 7);

    coin::burn_for_testing(c0);
    coin::burn_for_testing(c1);
    coin::burn_for_testing(c2);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_assert_quantum_invariant_passes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Deposit spot tokens to escrow
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let spot_stable = coin::mint_for_testing<TEST_COIN_B>(2000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, spot_asset, spot_stable);

    // Mint conditional coins (equal to escrow balance for quantum invariant)
    // Quantum liquidity: escrow == supply[i] for ALL outcomes
    let c0 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 1000, ctx,
    );
    let c1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &mut escrow, 1, 1000, ctx,
    );
    // Also mint stable conditionals to match escrow
    let s0 = coin_escrow::mint_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow, 0, 2000, ctx,
    );
    let s1 = coin_escrow::mint_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_1_STABLE>(
        &mut escrow, 1, 2000, ctx,
    );

    // Invariant should pass (escrow == supply for all outcomes)
    coin_escrow::assert_quantum_invariant(&escrow);

    coin::burn_for_testing(s0);
    coin::burn_for_testing(s1);

    coin::burn_for_testing(c0);
    coin::burn_for_testing(c1);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = coin_escrow::EQuantumInvariantViolation)]
fun test_assert_quantum_invariant_fails_insufficient_escrow() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Deposit only 100 spot tokens
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(100, ctx);
    let spot_stable = coin::mint_for_testing<TEST_COIN_B>(100, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, spot_asset, spot_stable);

    // Mint 500 conditional (more than escrow balance of 100)
    let c0 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 500, ctx,
    );

    // This should fail - escrow (100) < supply (500)
    coin_escrow::assert_quantum_invariant(&escrow);

    coin::burn_for_testing(c0);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_assert_all_invariants_passes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Deposit via deposit_spot_liquidity (LP backing)
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let spot_stable = coin::mint_for_testing<TEST_COIN_B>(1000, ctx);
    coin_escrow::deposit_spot_liquidity(
        &mut escrow,
        coin::into_balance(spot_asset),
        coin::into_balance(spot_stable),
    );

    // Mint conditional coins (equal to escrow for quantum invariant)
    let c0 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 1000, ctx,
    );
    let s0 = coin_escrow::mint_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow, 0, 1000, ctx,
    );

    // Both invariants should pass
    coin_escrow::assert_all_invariants(&escrow);

    coin::burn_for_testing(c0);
    coin::burn_for_testing(s0);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_supply_tracking_independent_outcomes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with 2 outcomes
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Mint/burn only to outcome 0
    let c0 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 1000, ctx,
    );

    // Outcome 1 should be unaffected
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 0, 0);

    // Burn from outcome 0
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, c0,
    );

    // Both should be 0 now
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 0, 1);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 0, 2);

    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = coin_escrow::EQuantumInvariantViolation)]
fun test_quantum_invariant_checks_all_outcomes() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with 2 outcomes
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Deposit 500 spot
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(500, ctx);
    let spot_stable = coin::mint_for_testing<TEST_COIN_B>(500, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, spot_asset, spot_stable);

    // Outcome 0: mint 300 (OK, 300 <= 500)
    let c0 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 300, ctx,
    );

    // Outcome 1: mint 600 (FAIL, 600 > 500)
    let c1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        &mut escrow, 1, 600, ctx,
    );

    // Should fail because outcome 1 violates invariant
    coin_escrow::assert_quantum_invariant(&escrow);

    coin::burn_for_testing(c0);
    coin::burn_for_testing(c1);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_supply_tracking_deposit_and_mint() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Use deposit_asset_and_mint_conditional (full flow)
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let cond_coin = coin_escrow::deposit_asset_and_mint_conditional<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
    >(&mut escrow, 0, spot_asset, ctx);

    // Verify supply tracked
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 1000, 0);
    assert!(cond_coin.value() == 1000, 1);

    // Verify escrow balance
    let (escrow_asset, _) = coin_escrow::get_spot_balances(&escrow);
    assert!(escrow_asset == 1000, 2);

    // Quantum invariant should pass (1000 >= 1000)
    coin_escrow::assert_quantum_invariant(&escrow);

    coin::burn_for_testing(cond_coin);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_supply_tracking_split_recombine() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with 2 outcomes
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Split complete set
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let (cond_0, cond_1) = split_asset_complete_set_2_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
    >(&mut escrow, spot_asset, ctx);

    // Both outcomes should have 1000 supply (quantum model)
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 1000, 0);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 1000, 1);

    // Quantum invariant should pass
    coin_escrow::assert_quantum_invariant(&escrow);

    // Recombine
    let spot = recombine_asset_complete_set_2_for_testing<
        TEST_COIN_A,
        TEST_COIN_B,
        COND_0_ASSET,
        COND_1_ASSET,
    >(&mut escrow, cond_0, cond_1, ctx);

    // Both supplies should be 0
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 0, 2);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 0, 3);

    coin::burn_for_testing(spot);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_quantum_invariant_after_partial_burn_and_withdraw() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Deposit 1000
    let spot = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    coin_escrow::deposit_spot_coins(&mut escrow, spot, coin::zero<TEST_COIN_B>(ctx));

    // Mint 1000
    let mut cond = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 1000, ctx,
    );

    // Invariant passes (1000 == 1000)
    coin_escrow::assert_quantum_invariant(&escrow);

    // Split the coin and burn half
    let cond_half = coin::split(&mut cond, 500, ctx);
    coin_escrow::burn_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, cond_half,
    );

    // Also withdraw to maintain quantum invariant (escrow == supply)
    let withdrawn = coin_escrow::withdraw_asset_balance(&mut escrow, 500, ctx);
    coin_escrow::decrement_user_backing(&mut escrow, 500);
    coin::burn_for_testing(withdrawn);

    // Supply should be 500, escrow should be 500
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 500, 0);
    assert!(coin_escrow::get_escrowed_asset_balance(&escrow) == 500, 1);

    // Invariant still passes (500 == 500)
    coin_escrow::assert_quantum_invariant(&escrow);

    coin::burn_for_testing(cond);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_multiple_mints_accumulate_supply() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Multiple mints should accumulate
    let c1 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 100, ctx,
    );
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 100, 0);

    let c2 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 200, ctx,
    );
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 300, 1);

    let c3 = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 300, ctx,
    );
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 600, 2);

    coin::burn_for_testing(c1);
    coin::burn_for_testing(c2);
    coin::burn_for_testing(c3);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_supply_tracks_both_asset_and_stable_independently() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow
    let market_state = create_test_market_state(1, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap, stable_cap);

    // Mint different amounts of asset and stable
    let asset_coin = coin_escrow::mint_conditional_asset<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, 1000, ctx,
    );
    let stable_coin = coin_escrow::mint_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow, 0, 5000, ctx,
    );

    // Verify independent tracking
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 1000, 0);
    assert!(coin_escrow::get_outcome_stable_supply(&escrow, 0) == 5000, 1);

    // Burn only stable
    coin_escrow::burn_conditional_stable<TEST_COIN_A, TEST_COIN_B, COND_0_STABLE>(
        &mut escrow, 0, stable_coin,
    );

    // Asset unchanged, stable decremented
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 1000, 2);
    assert!(coin_escrow::get_outcome_stable_supply(&escrow, 0) == 0, 3);

    coin::burn_for_testing(asset_coin);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

// === Atomic Deposit+Mint Flow Tests ===
// These tests verify that the Progress pattern enforces the quantum invariant

#[test]
fun test_split_progress_maintains_quantum_invariant() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with 2 outcomes
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // Perform atomic split via Progress pattern
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let progress = coin_escrow::start_split_asset_progress(&mut escrow, spot_asset);

    let (progress, c0) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        progress, &mut escrow, 0, ctx,
    );
    let (progress, c1) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        progress, &mut escrow, 1, ctx,
    );
    coin_escrow::finish_split_asset_progress(progress, &escrow);

    // Quantum invariant should hold: escrow == supply for all outcomes
    coin_escrow::assert_quantum_invariant(&escrow);

    // Verify values
    assert!(coin_escrow::get_escrowed_asset_balance(&escrow) == 1000, 0);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 1000, 1);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 1000, 2);

    coin::burn_for_testing(c0);
    coin::burn_for_testing(c1);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_recombine_progress_maintains_quantum_invariant() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with 2 outcomes
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // First, split to create conditional tokens
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let progress = coin_escrow::start_split_asset_progress(&mut escrow, spot_asset);
    let (progress, c0) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        progress, &mut escrow, 0, ctx,
    );
    let (progress, c1) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        progress, &mut escrow, 1, ctx,
    );
    coin_escrow::finish_split_asset_progress(progress, &escrow);

    // Invariant holds after split
    coin_escrow::assert_quantum_invariant(&escrow);

    // Now recombine via Progress pattern
    let progress = coin_escrow::start_recombine_asset_progress<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, c0,
    );
    let progress = coin_escrow::recombine_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        progress, &mut escrow, 1, c1,
    );
    let withdrawn = coin_escrow::finish_recombine_asset_progress(progress, &mut escrow, ctx);

    // Quantum invariant should still hold: escrow == supply for all outcomes (both 0)
    coin_escrow::assert_quantum_invariant(&escrow);

    // Verify values are back to 0
    assert!(coin_escrow::get_escrowed_asset_balance(&escrow) == 0, 0);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 0, 1);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 0, 2);
    assert!(coin::value(&withdrawn) == 1000, 3);

    coin::burn_for_testing(withdrawn);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_split_recombine_round_trip_maintains_invariant() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with 3 outcomes to test more complex case
    let market_state = create_test_market_state(3, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    let asset_cap_2 = create_blank_treasury_cap_for_testing<COND_2_ASSET>(ctx);
    let stable_cap_2 = create_blank_treasury_cap_for_testing<COND_2_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 2, asset_cap_2, stable_cap_2);

    // Split 500 tokens
    let spot_asset = coin::mint_for_testing<TEST_COIN_A>(500, ctx);
    let progress = coin_escrow::start_split_asset_progress(&mut escrow, spot_asset);
    let (progress, c0) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        progress, &mut escrow, 0, ctx,
    );
    let (progress, c1) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        progress, &mut escrow, 1, ctx,
    );
    let (progress, c2) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_2_ASSET>(
        progress, &mut escrow, 2, ctx,
    );
    coin_escrow::finish_split_asset_progress(progress, &escrow);

    // Check invariant after split
    coin_escrow::assert_quantum_invariant(&escrow);
    assert!(coin_escrow::get_escrowed_asset_balance(&escrow) == 500, 0);

    // Recombine back
    let progress = coin_escrow::start_recombine_asset_progress<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        &mut escrow, 0, c0,
    );
    let progress = coin_escrow::recombine_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        progress, &mut escrow, 1, c1,
    );
    let progress = coin_escrow::recombine_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_2_ASSET>(
        progress, &mut escrow, 2, c2,
    );
    let withdrawn = coin_escrow::finish_recombine_asset_progress(progress, &mut escrow, ctx);

    // Check invariant after recombine
    coin_escrow::assert_quantum_invariant(&escrow);
    assert!(coin_escrow::get_escrowed_asset_balance(&escrow) == 0, 1);
    assert!(coin::value(&withdrawn) == 500, 2);

    coin::burn_for_testing(withdrawn);
    test_utils::destroy(escrow);
    ts::end(scenario);
}

#[test]
fun test_multiple_splits_maintain_quantum_invariant() {
    let mut scenario = ts::begin(@0x1);
    let ctx = ts::ctx(&mut scenario);

    // Setup escrow with 2 outcomes
    let market_state = create_test_market_state(2, ctx);
    let mut escrow = coin_escrow::new<TEST_COIN_A, TEST_COIN_B>(market_state, ctx);

    let asset_cap_0 = create_blank_treasury_cap_for_testing<COND_0_ASSET>(ctx);
    let stable_cap_0 = create_blank_treasury_cap_for_testing<COND_0_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 0, asset_cap_0, stable_cap_0);

    let asset_cap_1 = create_blank_treasury_cap_for_testing<COND_1_ASSET>(ctx);
    let stable_cap_1 = create_blank_treasury_cap_for_testing<COND_1_STABLE>(ctx);
    coin_escrow::register_conditional_caps(&mut escrow, 1, asset_cap_1, stable_cap_1);

    // First split: 1000
    let spot1 = coin::mint_for_testing<TEST_COIN_A>(1000, ctx);
    let progress = coin_escrow::start_split_asset_progress(&mut escrow, spot1);
    let (progress, c0_1) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        progress, &mut escrow, 0, ctx,
    );
    let (progress, c1_1) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        progress, &mut escrow, 1, ctx,
    );
    coin_escrow::finish_split_asset_progress(progress, &escrow);

    coin_escrow::assert_quantum_invariant(&escrow);
    assert!(coin_escrow::get_escrowed_asset_balance(&escrow) == 1000, 0);

    // Second split: 500 more
    let spot2 = coin::mint_for_testing<TEST_COIN_A>(500, ctx);
    let progress = coin_escrow::start_split_asset_progress(&mut escrow, spot2);
    let (progress, c0_2) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_0_ASSET>(
        progress, &mut escrow, 0, ctx,
    );
    let (progress, c1_2) = coin_escrow::split_asset_progress_step<TEST_COIN_A, TEST_COIN_B, COND_1_ASSET>(
        progress, &mut escrow, 1, ctx,
    );
    coin_escrow::finish_split_asset_progress(progress, &escrow);

    // Invariant should hold with accumulated values
    coin_escrow::assert_quantum_invariant(&escrow);
    assert!(coin_escrow::get_escrowed_asset_balance(&escrow) == 1500, 1);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 0) == 1500, 2);
    assert!(coin_escrow::get_outcome_asset_supply(&escrow, 1) == 1500, 3);

    coin::burn_for_testing(c0_1);
    coin::burn_for_testing(c1_1);
    coin::burn_for_testing(c0_2);
    coin::burn_for_testing(c1_2);
    test_utils::destroy(escrow);
    ts::end(scenario);
}
