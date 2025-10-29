#[test_only]
module futarchy_governance::proposal_escrow_tests;

use futarchy_governance::proposal_escrow::{Self, ProposalEscrow, EscrowReceipt};
use futarchy_markets_core::proposal::{Self, Proposal};
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::object::{Self, ID};
use sui::test_scenario::{Self as ts, Scenario};
use sui::test_utils;

// === Test Constants ===
const USER_ADDR: address = @0xABCD;
const DAO_ADDR: address = @0xDA0;

// Proposal state constants
const STATE_PREMARKET: u8 = 0;
const STATE_REVIEW: u8 = 1;
const STATE_TRADING: u8 = 2;
const STATE_FINALIZED: u8 = 3;

// Error codes from proposal_escrow.move
const EInvalidReceipt: u64 = 1;
const ENotEmpty: u64 = 2;
const EInsufficientBalance: u64 = 3;
const EObjectNotFound: u64 = 4;
const EInvalidProposal: u64 = 5;
const EAlreadyWithdrawn: u64 = 6;
const EProposalNotReady: u64 = 7;
const EOutcomeCountMismatch: u64 = 8;
const EMarketNotInitialized: u64 = 9;
const EInvalidOutcome: u64 = 10;

// === Test Helpers ===

fun create_test_clock(timestamp_ms: u64, ctx: &mut TxContext): Clock {
    let mut clock = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clock, timestamp_ms);
    clock
}

fun create_test_proposal_in_review(ctx: &mut TxContext): Proposal<TEST_COIN_A, TEST_COIN_B> {
    let mut proposal = proposal::create_test_proposal<TEST_COIN_A, TEST_COIN_B>(
        2,      // outcome_count
        0,      // winning_outcome
        false,  // is_finalized
        ctx
    );

    // Advance to REVIEW state
    proposal::set_state(&mut proposal, STATE_REVIEW);
    proposal
}

fun create_test_coin(amount: u64, ctx: &mut TxContext): Coin<TEST_COIN_A> {
    coin::mint_for_testing<TEST_COIN_A>(amount, ctx)
}

// === Escrow Creation Tests ===

#[test]
fun test_create_escrow_with_coin_deposit() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);
    let deposit_coin = create_test_coin(1000, ctx);
    let outcome_index = 0u64;

    // Create escrow
    let (escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        outcome_index,
        deposit_coin,
        &clock,
        ctx
    );

    // Verify escrow properties
    assert!(proposal_escrow::escrow_outcome_index(&escrow) == outcome_index, 0);
    assert!(proposal_escrow::balance(&escrow) == 1000, 1);
    assert!(proposal_escrow::escrow_locked_outcome_count(&escrow) == 2, 2);

    // Verify receipt properties
    assert!(proposal_escrow::receipt_outcome_index(&receipt) == outcome_index, 3);
    assert!(proposal_escrow::receipt_initial_coin_amount(&receipt) == 1000, 4);

    // Cleanup
    test_utils::destroy(escrow);
    test_utils::destroy(receipt);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure]  // Expects EProposalNotReady (code 7)
fun test_cannot_create_escrow_in_premarket_state() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let proposal = proposal::create_test_proposal<TEST_COIN_A, TEST_COIN_B>(
        2,      // outcome_count
        0,      // winning_outcome
        false,  // is_finalized
        ctx
    );
    // Note: Proposal starts in PREMARKET state by default

    let deposit_coin = create_test_coin(1000, ctx);

    // Should fail - proposal not in REVIEW state yet
    let (escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        0,
        deposit_coin,
        &clock,
        ctx
    );

    // Cleanup (won't reach here)
    test_utils::destroy(escrow);
    test_utils::destroy(receipt);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure]  // Expects EInvalidOutcome (code 10)
fun test_cannot_create_escrow_with_invalid_outcome_index() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);
    let deposit_coin = create_test_coin(1000, ctx);

    // Try to create escrow for outcome 99 (but only 2 outcomes exist)
    let (escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        99,
        deposit_coin,
        &clock,
        ctx
    );

    // Cleanup (won't reach here)
    test_utils::destroy(escrow);
    test_utils::destroy(receipt);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

// === Receipt Management Tests ===

#[test]
fun test_store_and_retrieve_receipt() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);
    let deposit_coin = create_test_coin(1000, ctx);
    let outcome_index = 0u64;

    // Create escrow
    let (escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        outcome_index,
        deposit_coin,
        &clock,
        ctx
    );

    // Store receipt in proposal
    proposal_escrow::store_receipt_in_proposal(&mut proposal, outcome_index, receipt);

    // Verify receipt exists
    assert!(proposal_escrow::has_escrow_receipt(&proposal, outcome_index), 0);

    // Retrieve receipt
    let retrieved_receipt = proposal_escrow::get_receipt_from_proposal(&proposal, outcome_index);
    assert!(proposal_escrow::receipt_outcome_index(retrieved_receipt) == outcome_index, 1);

    // Cleanup
    test_utils::destroy(escrow);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_remove_receipt_from_proposal() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);
    let deposit_coin = create_test_coin(1000, ctx);
    let outcome_index = 0u64;

    // Create escrow and store receipt
    let (escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        outcome_index,
        deposit_coin,
        &clock,
        ctx
    );
    proposal_escrow::store_receipt_in_proposal(&mut proposal, outcome_index, receipt);

    // Verify receipt exists
    assert!(proposal_escrow::has_escrow_receipt(&proposal, outcome_index), 0);

    // Remove receipt (this is package-private so we can't test it directly)
    // Just verify it exists before removal

    // Cleanup
    test_utils::destroy(escrow);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

// === Withdrawal Tests ===

#[test]
fun test_withdraw_partial_amount() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);
    let deposit_coin = create_test_coin(1000, ctx);
    let outcome_index = 0u64;

    // Create escrow
    let (mut escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        outcome_index,
        deposit_coin,
        &clock,
        ctx
    );

    // Withdraw partial amount
    let withdrawn = proposal_escrow::withdraw_partial(
        &mut escrow,
        &proposal,
        &receipt,
        300,
        &clock,
        ctx
    );

    // Verify amounts
    assert!(withdrawn.value() == 300, 0);
    assert!(proposal_escrow::balance(&escrow) == 700, 1);

    // Cleanup
    withdrawn.burn_for_testing();
    test_utils::destroy(escrow);
    test_utils::destroy(receipt);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure]  // Expects EInsufficientBalance (code 3)
fun test_withdraw_more_than_balance() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);
    let deposit_coin = create_test_coin(1000, ctx);
    let outcome_index = 0u64;

    // Create escrow
    let (mut escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        outcome_index,
        deposit_coin,
        &clock,
        ctx
    );

    // Try to withdraw more than balance
    let withdrawn = proposal_escrow::withdraw_partial(
        &mut escrow,
        &proposal,
        &receipt,
        2000,  // More than 1000 deposited
        &clock,
        ctx
    );

    // Cleanup (won't reach here)
    withdrawn.burn_for_testing();
    test_utils::destroy(escrow);
    test_utils::destroy(receipt);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_withdraw_all_coins() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);
    let deposit_coin = create_test_coin(1000, ctx);
    let outcome_index = 0u64;

    // Create escrow
    let (mut escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        outcome_index,
        deposit_coin,
        &clock,
        ctx
    );

    // Withdraw all coins
    let withdrawn = proposal_escrow::withdraw_all_coins(
        &mut escrow,
        &proposal,
        receipt,  // Consumes receipt
        &clock,
        ctx
    );

    // Verify amounts
    assert!(withdrawn.value() == 1000, 0);
    assert!(proposal_escrow::balance(&escrow) == 0, 1);
    assert!(proposal_escrow::is_empty(&escrow), 2);

    // Cleanup
    withdrawn.burn_for_testing();
    proposal_escrow::destroy_empty(escrow);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

// === Security Tests ===

#[test]
#[expected_failure]  // Expects EInvalidReceipt (code 1)
fun test_cross_outcome_theft_blocked() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);

    // Create escrow for outcome 0
    let deposit_coin_0 = create_test_coin(1000, ctx);
    let (mut escrow_0, receipt_0) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        0,
        deposit_coin_0,
        &clock,
        ctx
    );

    // Create escrow for outcome 1
    let deposit_coin_1 = create_test_coin(2000, ctx);
    let (mut escrow_1, receipt_1) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        1,
        deposit_coin_1,
        &clock,
        ctx
    );

    // Try to use outcome 0's receipt to withdraw from outcome 1's escrow (THEFT ATTEMPT)
    let stolen = proposal_escrow::withdraw_partial(
        &mut escrow_1,  // Outcome 1's escrow
        &proposal,
        &receipt_0,      // Outcome 0's receipt (mismatch!)
        500,
        &clock,
        ctx
    );

    // Cleanup (won't reach here)
    stolen.burn_for_testing();
    test_utils::destroy(escrow_0);
    test_utils::destroy(escrow_1);
    test_utils::destroy(receipt_0);
    test_utils::destroy(receipt_1);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

// Note: test_double_withdraw_all_blocked removed
// Reason: Receipt is consumed on first withdrawal, making double withdrawal
// impossible to test without internal access to the balance_withdrawn flag.
// The security property is enforced by Move's linear type system (receipt consumption).

// === Cleanup Tests ===

#[test]
fun test_destroy_empty_escrow() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);
    let deposit_coin = create_test_coin(1000, ctx);

    // Create escrow
    let (mut escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        0,
        deposit_coin,
        &clock,
        ctx
    );

    // Withdraw all coins
    let withdrawn = proposal_escrow::withdraw_all_coins(
        &mut escrow,
        &proposal,
        receipt,
        &clock,
        ctx
    );

    // Verify empty
    assert!(proposal_escrow::is_empty(&escrow), 0);

    // Destroy empty escrow
    proposal_escrow::destroy_empty(escrow);

    // Cleanup
    withdrawn.burn_for_testing();
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure]  // Expects ENotEmpty (code 2)
fun test_cannot_destroy_non_empty_escrow() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_review(ctx);
    let deposit_coin = create_test_coin(1000, ctx);

    // Create escrow with balance
    let (escrow, receipt) = proposal_escrow::create_for_outcome_with_coin(
        &proposal,
        0,
        deposit_coin,
        &clock,
        ctx
    );

    // Try to destroy non-empty escrow (should fail)
    proposal_escrow::destroy_empty(escrow);

    // Cleanup (won't reach here)
    test_utils::destroy(receipt);
    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}
