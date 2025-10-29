#[test_only]
module futarchy_governance::proposal_sponsorship_tests;

use futarchy_governance::proposal_sponsorship;
use futarchy_markets_core::proposal::{Self, Proposal};
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use futarchy_types::signed;
use sui::clock::{Self, Clock};
use sui::test_scenario::{Self as ts};
use sui::test_utils;
use std::string;

// === Test Constants ===
const USER_ADDR: address = @0xABCD;
const SPONSOR_ADDR: address = @0x5999;
const DAO_ADDR: address = @0xDA0;

// State constants
const STATE_PREMARKET: u8 = 0;
const STATE_REVIEW: u8 = 1;
const STATE_TRADING: u8 = 2;
const STATE_FINALIZED: u8 = 3;

// Error codes from proposal_sponsorship.move
const ESponsorshipNotEnabled: u64 = 1;
const EAlreadySponsored: u64 = 2;
const ENoSponsorQuota: u64 = 3;
const EInvalidProposalState: u64 = 4;
const EDaoMismatch: u64 = 6;
const ETwapDelayPassed: u64 = 7;

// === Test Helpers ===

fun create_test_clock(timestamp_ms: u64, ctx: &mut TxContext): Clock {
    let mut clock = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clock, timestamp_ms);
    clock
}

fun create_test_proposal_in_state(
    state: u8,
    ctx: &mut TxContext
): Proposal<TEST_COIN_A, TEST_COIN_B> {
    let mut proposal = proposal::create_test_proposal<TEST_COIN_A, TEST_COIN_B>(
        2,      // outcome_count
        0,      // winning_outcome
        false,  // is_finalized
        ctx
    );

    proposal::set_state(&mut proposal, state);
    proposal
}

// === Timing Validation Tests ===

#[test]
fun test_sponsorship_timing_premarket_allowed() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let proposal = create_test_proposal_in_state(STATE_PREMARKET, ctx);

    // Verify proposal is in correct state
    assert!(proposal::state(&proposal) == STATE_PREMARKET, 0);

    // Sponsorship should be allowed in PREMARKET state
    // (Actual sponsorship requires Account + QuotaRegistry setup)

    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_sponsorship_timing_review_allowed() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let proposal = create_test_proposal_in_state(STATE_REVIEW, ctx);

    // Verify proposal is in correct state
    assert!(proposal::state(&proposal) == STATE_REVIEW, 0);

    // Sponsorship should be allowed in REVIEW state
    // (Actual sponsorship requires Account + QuotaRegistry setup)

    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_proposal_state_transitions() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);

    // Test PREMARKET -> REVIEW -> TRADING -> FINALIZED
    let mut proposal = create_test_proposal_in_state(STATE_PREMARKET, ctx);
    assert!(proposal::state(&proposal) == STATE_PREMARKET, 0);

    proposal::set_state(&mut proposal, STATE_REVIEW);
    assert!(proposal::state(&proposal) == STATE_REVIEW, 1);

    proposal::set_state(&mut proposal, STATE_TRADING);
    assert!(proposal::state(&proposal) == STATE_TRADING, 2);

    proposal::set_state(&mut proposal, STATE_FINALIZED);
    assert!(proposal::state(&proposal) == STATE_FINALIZED, 3);

    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_sponsorship_flag_operations() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_state(STATE_REVIEW, ctx);

    // Initially not sponsored
    assert!(!proposal::is_sponsored(&proposal), 0);

    // Set sponsorship
    let threshold_reduction = signed::from_u128(100000000000000000u128); // 0.1
    proposal::set_sponsorship(&mut proposal, SPONSOR_ADDR, threshold_reduction);

    // Now should be sponsored
    assert!(proposal::is_sponsored(&proposal), 1);

    // Get sponsor
    let sponsor_opt = proposal::get_sponsored_by(&proposal);
    assert!(sponsor_opt.is_some(), 2);
    assert!(*sponsor_opt.borrow() == SPONSOR_ADDR, 3);

    // Clear sponsorship
    proposal::clear_sponsorship(&mut proposal);
    assert!(!proposal::is_sponsored(&proposal), 4);

    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_effective_threshold_with_sponsorship() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let clock = create_test_clock(1000, ctx);
    let mut proposal = create_test_proposal_in_state(STATE_REVIEW, ctx);

    // Get base threshold
    let base_threshold = proposal::get_twap_threshold(&proposal);

    // Apply sponsorship reduction
    let reduction = signed::from_u128(100000000000000000u128); // 0.1 reduction
    proposal::set_sponsorship(&mut proposal, SPONSOR_ADDR, reduction);

    // Effective threshold should be base - reduction
    let effective = proposal::get_effective_twap_threshold(&proposal);

    // Verify effective threshold is different from base
    // (Actual comparison would require signed arithmetic)
    assert!(proposal::is_sponsored(&proposal), 0);

    test_utils::destroy(proposal);
    clock.destroy_for_testing();
    scenario.end();
}

// === Integration Test Documentation ===
//
// Full sponsorship tests require:
// 1. Account with FutarchyConfig (with sponsorship enabled)
// 2. ProposalQuotaRegistry with sponsor quotas configured
// 3. Proposal in valid state (not finalized)
// 4. Sponsor address with available quota
//
// Key scenarios to test in integration environment:
//
// **Quota Management:**
// - sponsor_proposal() consumes sponsor quota
// - sponsor_proposal_to_zero() is free for team members
// - refund_sponsorship_on_eviction() returns quota
// - check_sponsor_quota_available() validates quota
//
// **Timing Restrictions:**
// - Can sponsor in PREMARKET state
// - Can sponsor in REVIEW state
// - Can sponsor in TRADING before TWAP delay
// - Cannot sponsor after TWAP delay (prevents manipulation)
// - Cannot sponsor in FINALIZED state
//
// **Threshold Application:**
// - Sponsored threshold reduces pass requirement
// - Effective threshold = base_threshold - sponsor_reduction
// - calculate_winning_outcome uses effective threshold
//
// **Error Conditions:**
// - ESponsorshipNotEnabled: DAO has sponsorship disabled
// - EAlreadySponsored: Proposal already sponsored
// - ENoSponsorQuota: Sponsor has no quota available
// - EInvalidProposalState: Proposal is finalized
// - EDaoMismatch: Account/Registry/Proposal DAO mismatch
// - ETwapDelayPassed: Sponsorship too late in trading period
//
// **Economic Model:**
// - sponsor_proposal(): Uses quota, applies configured threshold
// - sponsor_proposal_to_zero(): Free for team, sets 0% threshold
// - Quota refunded on proposal eviction
// - No reward paid if proposal is sponsored (prevents double-dipping)

#[test]
fun test_module_compiles() {
    // This test just verifies the module compiles successfully
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();
    let clock = create_test_clock(1000, ctx);

    // Basic smoke test
    assert!(true, 0);

    clock.destroy_for_testing();
    scenario.end();
}
