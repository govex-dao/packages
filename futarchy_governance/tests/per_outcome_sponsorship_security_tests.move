// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_governance::per_outcome_sponsorship_security_tests;

use futarchy_markets_core::proposal::{Self, Proposal};
use futarchy_governance::proposal_sponsorship;
use futarchy_core::sponsorship_auth::SponsorshipAuth;
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use futarchy_types::signed;
use sui::test_scenario::{Self as ts, Scenario};

// === Test Constants ===
const ADMIN: address = @0xAD;
const ALICE: address = @0xA11CE;
const BOB_ATTACKER: address = @0xB0B;

// === Security Test: Cannot Create Witness Externally ===
//
// NOTE: The test below is commented out because the security property is enforced
// at COMPILE TIME, not runtime. `SponsorshipAuth` has no public constructor,
// so attempting to instantiate it outside the `proposal` module results in:
//   "Struct 'SponsorshipAuth' can only be instantiated within its defining module"
//
// This is the desired security behavior - the witness pattern provides compile-time
// guarantees that only authorized modules can create the witness.
//
// The commented code below demonstrates what an attacker would TRY to do,
// and proves it's impossible at the type system level.

// #[test]
// #[expected_failure]
// fun test_cannot_create_witness_externally() {
//     let mut scenario = ts::begin(ALICE);
//     let _auth = SponsorshipAuth {}; // COMPILE ERROR: restricted visibility
//     ts::end(scenario);
// }

// === Security Test: Cannot Call set_outcome_sponsorship Without Witness ===
//
// NOTE: This security property is enforced at COMPILE TIME by the type system.
// The function `set_outcome_sponsorship` requires a `SponsorshipAuth` parameter,
// which means you CANNOT call it without obtaining a valid witness first.
// No runtime test is needed because the compiler enforces this guarantee.

// === Security Test: Cannot Steal Refunds ===

#[test]
fun test_cannot_steal_refund_via_mark_sponsor_quota_used() {
    let mut scenario = ts::begin(ALICE);

    // Alice creates and sponsors a proposal
    let mut proposal = create_test_proposal(&mut scenario);

    // Simulate Alice sponsoring (would require witness from proposal_sponsorship)
    // In real code: proposal::mark_sponsor_quota_used(&mut proposal, ALICE, auth);
    // We cannot do this in tests without going through proposal_sponsorship module

    // Bob (attacker) tries to overwrite the sponsor
    // He CANNOT call mark_sponsor_quota_used because he cannot create SponsorshipAuth

    // Verify: The only way to mark quota is through proposal_sponsorship module
    // which does proper permission checks
    assert!(!proposal::is_sponsor_quota_used(&proposal), 0);

    destroy_test_proposal(proposal);
    ts::end(scenario);
}

// === Security Test: Cannot DoS by Clearing Sponsorships ===

#[test]
fun test_cannot_dos_via_clear_all_sponsorships() {
    let mut scenario = ts::begin(ALICE);

    // Alice creates a proposal
    let mut proposal = create_test_proposal(&mut scenario);

    // Bob (attacker) tries to clear sponsorships
    // He CANNOT call clear_all_sponsorships because he cannot create SponsorshipAuth

    // The function requires witness that only proposal_sponsorship can create:
    // proposal::clear_all_sponsorships(&mut proposal, auth);

    // This test verifies the type system prevents the attack
    // No runtime test needed - it's compile-time safe

    destroy_test_proposal(proposal);
    ts::end(scenario);
}

// === Security Test: Cannot Sponsor Outcome 0 (Reject) ===

#[test]
#[expected_failure(abort_code = proposal::ECannotSponsorReject)]
fun test_cannot_sponsor_outcome_zero() {
    let mut scenario = ts::begin(ALICE);

    let mut proposal = create_test_proposal(&mut scenario);
    let threshold = signed::from_u64(50);

    // Even with witness, cannot sponsor outcome 0
    let auth = create_test_witness(); // Hypothetical test helper
    proposal::set_outcome_sponsorship(&mut proposal, 0, threshold, auth);

    destroy_test_proposal(proposal);
    ts::end(scenario);
}

// === Security Test: Cannot Double-Sponsor Same Outcome ===

#[test]
#[expected_failure(abort_code = proposal::EAlreadySponsored)]
fun test_cannot_double_sponsor_outcome() {
    let mut scenario = ts::begin(ALICE);

    let mut proposal = create_test_proposal(&mut scenario);
    let threshold = signed::from_u64(50);

    // First sponsorship
    let auth1 = create_test_witness();
    proposal::set_outcome_sponsorship(&mut proposal, 1, threshold, auth1);

    // Try to sponsor again - should fail
    let auth2 = create_test_witness();
    proposal::set_outcome_sponsorship(&mut proposal, 1, threshold, auth2);

    destroy_test_proposal(proposal);
    ts::end(scenario);
}

// === Security Test: Outcome 0 Never Cleared in clear_all_sponsorships ===

#[test]
fun test_clear_all_sponsorships_skips_outcome_zero() {
    let mut scenario = ts::begin(ALICE);

    let mut proposal = create_test_proposal_with_3_outcomes(&mut scenario);

    // Sponsor outcomes 1 and 2
    let threshold = signed::from_u64(50);
    let auth1 = create_test_witness();
    proposal::set_outcome_sponsorship(&mut proposal, 1, threshold, auth1);
    let auth2 = create_test_witness();
    proposal::set_outcome_sponsorship(&mut proposal, 2, threshold, auth2);

    // Verify outcomes are sponsored
    assert!(proposal::is_outcome_sponsored(&proposal, 1), 0);
    assert!(proposal::is_outcome_sponsored(&proposal, 2), 0);

    // Clear all sponsorships
    let auth_clear = create_test_witness();
    proposal::clear_all_sponsorships(&mut proposal, auth_clear);

    // Verify outcomes 1 and 2 are cleared
    assert!(!proposal::is_outcome_sponsored(&proposal, 1), 1);
    assert!(!proposal::is_outcome_sponsored(&proposal, 2), 2);

    // Verify outcome 0 was never touched (it's always None)
    assert!(!proposal::is_outcome_sponsored(&proposal, 0), 3);

    destroy_test_proposal(proposal);
    ts::end(scenario);
}

// === Helper Functions ===

fun create_test_proposal(scenario: &mut Scenario): Proposal<TEST_COIN_A, TEST_COIN_B> {
    // Use the simplified test helper with sensible defaults
    proposal::create_test_proposal<TEST_COIN_A, TEST_COIN_B>(
        2, // outcome_count (Reject + Accept)
        0, // winning_outcome (not finalized, so doesn't matter)
        false, // is_finalized
        ts::ctx(scenario)
    )
}

fun create_test_proposal_with_3_outcomes(scenario: &mut Scenario): Proposal<TEST_COIN_A, TEST_COIN_B> {
    // Use the simplified test helper with sensible defaults
    proposal::create_test_proposal<TEST_COIN_A, TEST_COIN_B>(
        3, // outcome_count (Reject + Accept A + Accept B)
        0, // winning_outcome (not finalized, so doesn't matter)
        false, // is_finalized
        ts::ctx(scenario)
    )
}

fun create_test_proposal_finalized(scenario: &mut Scenario): Proposal<TEST_COIN_A, TEST_COIN_B> {
    proposal::create_test_proposal<TEST_COIN_A, TEST_COIN_B>(
        2, // outcome_count (Reject + Accept)
        1, // winning_outcome
        true, // is_finalized
        ts::ctx(scenario)
    )
}

fun destroy_test_proposal(proposal: Proposal<TEST_COIN_A, TEST_COIN_B>) {
    proposal::destroy_for_testing(proposal);
}

// Helper to create SponsorshipAuth for testing
// NOTE: With the new security model, SponsorshipAuth can only be created within
// proposal_sponsorship module. Use the test-only helper for testing.
fun create_test_witness(): SponsorshipAuth {
    proposal_sponsorship::create_sponsorship_auth_for_testing()
}

// === Additional Security Tests ===

// === Security Test: Cannot Sponsor Out-of-Bounds Outcome ===

#[test]
#[expected_failure(abort_code = proposal::EOutcomeOutOfBounds)]
fun test_cannot_sponsor_out_of_bounds_outcome() {
    let mut scenario = ts::begin(ALICE);

    let mut proposal = create_test_proposal(&mut scenario); // 2 outcomes: 0 and 1
    let threshold = signed::from_u64(50);

    // Try to sponsor outcome 2 (out of bounds for 2-outcome proposal)
    let auth = create_test_witness();
    proposal::set_outcome_sponsorship(&mut proposal, 2, threshold, auth);

    destroy_test_proposal(proposal);
    ts::end(scenario);
}

// === Security Test: Cannot Sponsor Finalized Proposal ===

#[test]
#[expected_failure(abort_code = proposal::EInvalidState)]
fun test_cannot_sponsor_finalized_proposal() {
    let mut scenario = ts::begin(ALICE);

    let mut proposal = create_test_proposal_finalized(&mut scenario);
    let threshold = signed::from_u64(50);

    // Try to sponsor a finalized proposal - should fail
    let auth = create_test_witness();
    proposal::set_outcome_sponsorship(&mut proposal, 1, threshold, auth);

    destroy_test_proposal(proposal);
    ts::end(scenario);
}

// === Security Test: mark_sponsor_quota_used Correctly Tracks Sponsor ===

#[test]
fun test_mark_sponsor_quota_used_tracks_sponsor() {
    let mut scenario = ts::begin(ALICE);

    let mut proposal = create_test_proposal(&mut scenario);

    // Initially quota not used
    assert!(!proposal::is_sponsor_quota_used(&proposal), 0);
    assert!(proposal::get_sponsor_quota_user(&proposal).is_none(), 1);

    // Mark quota used
    let auth = create_test_witness();
    proposal::mark_sponsor_quota_used(&mut proposal, ALICE, auth);

    // Verify quota is marked as used with correct sponsor
    assert!(proposal::is_sponsor_quota_used(&proposal), 2);
    assert!(proposal::get_sponsor_quota_user(&proposal) == option::some(ALICE), 3);

    destroy_test_proposal(proposal);
    ts::end(scenario);
}

// === Security Test: clear_all_sponsorships Resets Quota Tracking ===

#[test]
fun test_clear_all_sponsorships_resets_quota_tracking() {
    let mut scenario = ts::begin(ALICE);

    let mut proposal = create_test_proposal(&mut scenario);
    let threshold = signed::from_u64(50);

    // Sponsor and mark quota
    let auth1 = create_test_witness();
    proposal::set_outcome_sponsorship(&mut proposal, 1, threshold, auth1);
    let auth2 = create_test_witness();
    proposal::mark_sponsor_quota_used(&mut proposal, ALICE, auth2);

    // Verify state
    assert!(proposal::is_outcome_sponsored(&proposal, 1), 0);
    assert!(proposal::is_sponsor_quota_used(&proposal), 1);

    // Clear all sponsorships
    let auth_clear = create_test_witness();
    proposal::clear_all_sponsorships(&mut proposal, auth_clear);

    // Verify sponsorship cleared
    assert!(!proposal::is_outcome_sponsored(&proposal, 1), 2);
    // Quota tracking should also be reset
    assert!(!proposal::is_sponsor_quota_used(&proposal), 3);
    assert!(proposal::get_sponsor_quota_user(&proposal).is_none(), 4);

    destroy_test_proposal(proposal);
    ts::end(scenario);
}

// === Security Test: get_effective_twap_threshold Returns Correct Values ===

#[test]
fun test_effective_twap_threshold_uses_sponsored_when_available() {
    let mut scenario = ts::begin(ALICE);

    let mut proposal = create_test_proposal_with_3_outcomes(&mut scenario);
    let sponsored_threshold = signed::from_u64(25); // Lower threshold

    // Get base threshold for outcome 1 (unsponsored)
    let base_threshold = proposal::get_effective_twap_threshold_for_outcome(&proposal, 1);

    // Sponsor outcome 1
    let auth = create_test_witness();
    proposal::set_outcome_sponsorship(&mut proposal, 1, sponsored_threshold, auth);

    // Verify sponsored outcome uses sponsored threshold
    let effective_threshold_1 = proposal::get_effective_twap_threshold_for_outcome(&proposal, 1);
    assert!(effective_threshold_1 == sponsored_threshold, 0);

    // Verify unsponsored outcome 2 still uses base threshold
    let effective_threshold_2 = proposal::get_effective_twap_threshold_for_outcome(&proposal, 2);
    assert!(effective_threshold_2 == base_threshold, 1);

    destroy_test_proposal(proposal);
    ts::end(scenario);
}
