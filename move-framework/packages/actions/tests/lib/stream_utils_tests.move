#[test_only]
module account_actions::stream_utils_tests;

use account_actions::stream_utils;

// === Imports ===

// === Linear Vesting Tests ===

#[test]
fun test_linear_vesting_before_start() {
    let vested = stream_utils::calculate_linear_vested(
        1000, // total_amount
        100, // start_time
        200, // end_time
        50, // current_time (before start)
    );
    assert!(vested == 0, 0);
}

#[test]
fun test_linear_vesting_at_start() {
    let vested = stream_utils::calculate_linear_vested(1000, 100, 200, 100);
    assert!(vested == 0, 0);
}

#[test]
fun test_linear_vesting_halfway() {
    let vested = stream_utils::calculate_linear_vested(1000, 100, 200, 150);
    assert!(vested == 500, 0);
}

#[test]
fun test_linear_vesting_at_end() {
    let vested = stream_utils::calculate_linear_vested(1000, 100, 200, 200);
    assert!(vested == 1000, 0);
}

#[test]
fun test_linear_vesting_after_end() {
    let vested = stream_utils::calculate_linear_vested(1000, 100, 200, 250);
    assert!(vested == 1000, 0);
}

// === Cliff Vesting Tests ===

#[test]
fun test_cliff_vesting_before_cliff() {
    let vested = stream_utils::calculate_vested_with_cliff(
        1000, // total_amount
        100, // start_time
        200, // end_time
        130, // cliff_time
        120, // current_time (before cliff)
    );
    assert!(vested == 0, 0);
}

#[test]
fun test_cliff_vesting_at_cliff() {
    let vested = stream_utils::calculate_vested_with_cliff(1000, 100, 200, 130, 130);
    assert!(vested == 300, 0); // 30% of way through
}

#[test]
fun test_cliff_vesting_after_cliff() {
    let vested = stream_utils::calculate_vested_with_cliff(1000, 100, 200, 130, 150);
    assert!(vested == 500, 0); // 50% of way through
}

// === Effective Time Tests ===

// === Time Parameter Validation Tests ===

#[test]
fun test_validate_time_parameters_valid() {
    let is_valid = stream_utils::validate_time_parameters(
        100, // start_time
        200, // end_time
        &std::option::some(130), // cliff_time between start and end
        50, // current_time (start is in future)
    );
    assert!(is_valid, 0);
}

#[test]
fun test_validate_time_parameters_end_before_start() {
    let is_valid = stream_utils::validate_time_parameters(
        200, // start_time
        100, // end_time (invalid: before start)
        &std::option::none(),
        50,
    );
    assert!(!is_valid, 0);
}

#[test]
fun test_validate_time_parameters_start_in_past() {
    let is_valid = stream_utils::validate_time_parameters(
        50, // start_time (invalid: in past)
        200, // end_time
        &std::option::none(),
        100, // current_time
    );
    assert!(!is_valid, 0);
}

#[test]
fun test_validate_time_parameters_cliff_before_start() {
    let is_valid = stream_utils::validate_time_parameters(
        100,
        200,
        &std::option::some(50), // cliff before start (invalid)
        0,
    );
    assert!(!is_valid, 0);
}

#[test]
fun test_validate_time_parameters_cliff_after_end() {
    let is_valid = stream_utils::validate_time_parameters(
        100,
        200,
        &std::option::some(250), // cliff after end (invalid)
        0,
    );
    assert!(!is_valid, 0);
}

// === Rate Limit Tests ===

#[test]
fun test_check_rate_limit_no_limit() {
    let allowed = stream_utils::check_rate_limit(
        100, // last_withdrawal_time
        0, // min_interval_ms (no limit)
        150, // current_time
    );
    assert!(allowed, 0);
}

#[test]
fun test_check_rate_limit_first_withdrawal() {
    let allowed = stream_utils::check_rate_limit(
        0, // last_withdrawal_time (never withdrawn)
        1000, // min_interval_ms
        150, // current_time
    );
    assert!(allowed, 0);
}

#[test]
fun test_check_rate_limit_too_soon() {
    let allowed = stream_utils::check_rate_limit(
        100, // last_withdrawal_time
        1000, // min_interval_ms
        500, // current_time (only 400ms elapsed)
    );
    assert!(!allowed, 0);
}

#[test]
fun test_check_rate_limit_after_interval() {
    let allowed = stream_utils::check_rate_limit(
        100, // last_withdrawal_time
        1000, // min_interval_ms
        1100, // current_time (1000ms+ elapsed)
    );
    assert!(allowed, 0);
}

// === Withdrawal Limit Tests ===

#[test]
fun test_check_withdrawal_limit_no_limit() {
    let allowed = stream_utils::check_withdrawal_limit(
        500, // amount
        0, // max_per_withdrawal (no limit)
    );
    assert!(allowed, 0);
}

#[test]
fun test_check_withdrawal_limit_within_limit() {
    let allowed = stream_utils::check_withdrawal_limit(500, 1000);
    assert!(allowed, 0);
}

#[test]
fun test_check_withdrawal_limit_exceeds_limit() {
    let allowed = stream_utils::check_withdrawal_limit(1500, 1000);
    assert!(!allowed, 0);
}

// === Claimable Amount Tests ===

#[test]
fun test_calculate_claimable_nothing_vested() {
    let claimable = stream_utils::calculate_claimable(
        1000, // total_amount
        0, // claimed_amount
        100, // start_time
        200, // end_time
        50, // current_time (before start)
        &std::option::none(),
    );
    assert!(claimable == 0, 0);
}

#[test]
fun test_calculate_claimable_partial_vested() {
    let claimable = stream_utils::calculate_claimable(
        1000, // total_amount
        200, // claimed_amount
        100, // start_time
        200, // end_time
        150, // current_time (50% vested = 500)
        &std::option::none(),
    );
    assert!(claimable == 300, 0); // 500 vested - 200 claimed
}

#[test]
fun test_calculate_claimable_all_vested() {
    let claimable = stream_utils::calculate_claimable(
        1000,
        0,
        100,
        200,
        250, // current_time (after end)
        &std::option::none(),
    );
    assert!(claimable == 1000, 0);
}

// === Split Vested/Unvested Tests ===

#[test]
fun test_split_vested_unvested_all_vested() {
    let (to_pay, to_refund, unvested_claimed) = stream_utils::split_vested_unvested(
        1000, // total_amount
        0, // claimed_amount
        1000, // balance_remaining
        100, // start_time
        200, // end_time
        250, // current_time (after end, all vested)
        &std::option::none(),
    );

    assert!(to_pay == 1000, 0); // All goes to beneficiary
    assert!(to_refund == 0, 0); // Nothing to refund
    assert!(unvested_claimed == 0, 0); // Nothing unvested was claimed
}

#[test]
fun test_split_vested_unvested_partial() {
    let (to_pay, to_refund, unvested_claimed) = stream_utils::split_vested_unvested(
        1000, // total_amount
        0, // claimed_amount
        1000, // balance_remaining
        100, // start_time
        200, // end_time
        150, // current_time (50% vested = 500)
        &std::option::none(),
    );

    assert!(to_pay == 500, 0); // 500 vested goes to beneficiary
    assert!(to_refund == 500, 0); // 500 unvested refunded
    assert!(unvested_claimed == 0, 0);
}

#[test]
fun test_split_vested_unvested_overclaimed() {
    // Beneficiary withdrew 700 but only 500 had vested
    let (to_pay, to_refund, unvested_claimed) = stream_utils::split_vested_unvested(
        1000, // total_amount
        700, // claimed_amount (overclaimed!)
        300, // balance_remaining
        100, // start_time
        200, // end_time
        150, // current_time (50% vested = 500)
        &std::option::none(),
    );

    assert!(to_pay == 0, 0); // Nothing more to pay (already overclaimed)
    assert!(to_refund == 300, 0); // All remaining refunded
    assert!(unvested_claimed == 200, 0); // 200 was claimed before vesting
}

// === State Check Tests ===

#[test]
fun test_can_claim_all_clear() {
    let can = stream_utils::can_claim(
        &std::option::some(1000), // expiry
        500, // current_time (before expiry)
    );
    assert!(can, 0);
}

#[test]
fun test_can_claim_expired() {
    let can = stream_utils::can_claim(
        &std::option::some(500), // expiry
        1000, // current_time (after expiry)
    );
    assert!(!can, 0);
}

// === Edge Cases ===

#[test]
fun test_large_amounts_no_overflow() {
    // Test with large amounts that could overflow without u128
    let vested = stream_utils::calculate_linear_vested(
        18_446_744_073_709_551_615, // Max u64
        0,
        1000,
        500, // 50%
    );
    // Should be approximately half without overflow
    assert!(vested > 0, 0);
}

// =============================================================================
// === ITERATION-BASED VESTING TESTS ===
// =============================================================================

// === Basic Iteration Vesting Tests ===

#[test]
fun test_iteration_vesting_before_start() {
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        500, // current_time (before start)
        &std::option::none(), // no cliff
        &std::option::none(), // no claim window
    );
    assert!(vested == 0, 0);
}

#[test]
fun test_iteration_vesting_at_start() {
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1000, // current_time (at start)
        &std::option::none(),
        &std::option::none(),
    );
    assert!(vested == 0, 0); // No iterations completed yet
}

#[test]
fun test_iteration_vesting_one_iteration() {
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1100, // current_time (1 iteration completed)
        &std::option::none(),
        &std::option::none(),
    );
    assert!(vested == 100, 0); // 1 * 100 = 100
}

#[test]
fun test_iteration_vesting_five_iterations() {
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1500, // current_time (5 iterations completed)
        &std::option::none(),
        &std::option::none(),
    );
    assert!(vested == 500, 0); // 5 * 100 = 500
}

#[test]
fun test_iteration_vesting_all_iterations() {
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        2000, // current_time (10 iterations completed)
        &std::option::none(),
        &std::option::none(),
    );
    assert!(vested == 1000, 0); // 10 * 100 = 1000
}

#[test]
fun test_iteration_vesting_after_all_iterations() {
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        5000, // current_time (way after end)
        &std::option::none(),
        &std::option::none(),
    );
    assert!(vested == 1000, 0); // Capped at 10 * 100 = 1000
}

// === Iteration Vesting with Cliff Tests ===

#[test]
fun test_iteration_vesting_before_cliff() {
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1250, // current_time (2.5 iterations elapsed)
        &std::option::some(1300), // cliff_time (3 iterations in)
        &std::option::none(),
    );
    assert!(vested == 0, 0); // Before cliff, nothing vested
}

#[test]
fun test_iteration_vesting_at_cliff() {
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1300, // current_time (3 iterations elapsed, at cliff)
        &std::option::some(1300), // cliff_time
        &std::option::none(),
    );
    assert!(vested == 300, 0); // 3 * 100 = 300
}

#[test]
fun test_iteration_vesting_after_cliff() {
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1500, // current_time (5 iterations elapsed)
        &std::option::some(1300), // cliff_time (3 iterations in)
        &std::option::none(),
    );
    assert!(vested == 500, 0); // After cliff, normal vesting: 5 * 100 = 500
}

// === Iteration Vesting with Claim Window (Forfeit) Tests ===

#[test]
fun test_iteration_vesting_with_window_no_forfeit() {
    // Claim window = 500ms = 5 iterations
    // Only 3 iterations completed, all within window
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1300, // current_time (3 iterations completed)
        &std::option::none(),
        &std::option::some(500), // claim_window_ms = 5 iterations
    );
    assert!(vested == 300, 0); // All 3 iterations claimable: 3 * 100 = 300
}

#[test]
fun test_iteration_vesting_with_window_partial_forfeit() {
    // Claim window = 300ms = 3 iterations
    // 5 iterations completed, oldest 2 are forfeited
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1500, // current_time (5 iterations completed)
        &std::option::none(),
        &std::option::some(300), // claim_window_ms = 3 iterations
    );
    // Window covers 3 iterations: iterations 2, 3, 4 (0-indexed counting from oldest)
    // Claimable = 3 * 100 = 300 (iterations 0 and 1 forfeited)
    assert!(vested == 300, 0);
}

#[test]
fun test_iteration_vesting_with_window_full_forfeit_except_window() {
    // Claim window = 200ms = 2 iterations
    // 10 iterations completed (all done), only last 2 claimable
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        2000, // current_time (10 iterations completed)
        &std::option::none(),
        &std::option::some(200), // claim_window_ms = 2 iterations
    );
    // Only last 2 iterations claimable: 2 * 100 = 200
    // Iterations 0-7 forfeited
    assert!(vested == 200, 0);
}

#[test]
fun test_iteration_vesting_with_cliff_and_window() {
    // Cliff at iteration 3, claim window = 3 iterations
    // 6 iterations completed
    let vested = stream_utils::calculate_iteration_vested(
        100, // amount_per_iteration
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1600, // current_time (6 iterations completed)
        &std::option::some(1300), // cliff_time (at iteration 3)
        &std::option::some(300), // claim_window_ms = 3 iterations
    );
    // After cliff, 6 iterations completed
    // Claim window covers last 3: iterations 3, 4, 5
    // Vested = 3 * 100 = 300
    assert!(vested == 300, 0);
}

// === Iteration Parameter Validation Tests ===

#[test]
fun test_validate_iteration_parameters_valid() {
    let is_valid = stream_utils::validate_iteration_parameters(
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        &std::option::some(1300), // cliff_time (valid)
        500, // current_time (start in future)
    );
    assert!(is_valid, 0);
}

#[test]
fun test_validate_iteration_parameters_zero_iterations() {
    let is_valid = stream_utils::validate_iteration_parameters(
        1000,
        0, // iterations_total (invalid: must be > 0)
        100,
        &std::option::none(),
        500,
    );
    assert!(!is_valid, 0);
}

#[test]
fun test_validate_iteration_parameters_zero_period() {
    let is_valid = stream_utils::validate_iteration_parameters(
        1000,
        10,
        0, // iteration_period_ms (invalid: must be > 0)
        &std::option::none(),
        500,
    );
    assert!(!is_valid, 0);
}

#[test]
fun test_validate_iteration_parameters_start_in_past() {
    let is_valid = stream_utils::validate_iteration_parameters(
        500, // start_time (invalid: in past)
        10,
        100,
        &std::option::none(),
        1000, // current_time
    );
    assert!(!is_valid, 0);
}

#[test]
fun test_validate_iteration_parameters_cliff_before_start() {
    let is_valid = stream_utils::validate_iteration_parameters(
        1000,
        10,
        100,
        &std::option::some(500), // cliff_time (invalid: before start)
        0,
    );
    assert!(!is_valid, 0);
}

// === Iteration Claimable Tests ===

#[test]
fun test_calculate_claimable_iterations_nothing_vested() {
    let claimable = stream_utils::calculate_claimable_iterations(
        100, // amount_per_iteration
        0, // claimed_amount
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        500, // current_time (before start)
        &std::option::none(),
        &std::option::none(),
    );
    assert!(claimable == 0, 0);
}

#[test]
fun test_calculate_claimable_iterations_partial_vested() {
    let claimable = stream_utils::calculate_claimable_iterations(
        100, // amount_per_iteration
        200, // claimed_amount (2 iterations claimed)
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1500, // current_time (5 iterations vested)
        &std::option::none(),
        &std::option::none(),
    );
    assert!(claimable == 300, 0); // 5 * 100 - 200 = 300
}

#[test]
fun test_calculate_claimable_iterations_all_claimed() {
    let claimable = stream_utils::calculate_claimable_iterations(
        100, // amount_per_iteration
        500, // claimed_amount (all claimed)
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1500, // current_time (5 iterations vested)
        &std::option::none(),
        &std::option::none(),
    );
    assert!(claimable == 0, 0); // Already claimed all vested
}

// === Iteration Split Vested/Unvested Tests ===

#[test]
fun test_split_vested_unvested_iterations_all_vested() {
    let (to_pay, to_refund, unvested_claimed) = stream_utils::split_vested_unvested_iterations(
        100, // amount_per_iteration
        0, // claimed_amount
        1000, // balance_remaining
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        2000, // current_time (all 10 iterations vested)
        &std::option::none(),
        &std::option::none(),
    );

    assert!(to_pay == 1000, 0); // All goes to beneficiary (10 * 100)
    assert!(to_refund == 0, 0); // Nothing to refund
    assert!(unvested_claimed == 0, 0); // Nothing unvested was claimed
}

#[test]
fun test_split_vested_unvested_iterations_partial() {
    let (to_pay, to_refund, unvested_claimed) = stream_utils::split_vested_unvested_iterations(
        100, // amount_per_iteration
        0, // claimed_amount
        1000, // balance_remaining (full amount)
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1500, // current_time (5 iterations vested)
        &std::option::none(),
        &std::option::none(),
    );

    assert!(to_pay == 500, 0); // 5 iterations vested (5 * 100)
    assert!(to_refund == 500, 0); // 5 iterations unvested refunded
    assert!(unvested_claimed == 0, 0);
}

#[test]
fun test_split_vested_unvested_iterations_overclaimed() {
    // Beneficiary withdrew 700 but only 5 iterations (500) had vested
    let (to_pay, to_refund, unvested_claimed) = stream_utils::split_vested_unvested_iterations(
        100, // amount_per_iteration
        700, // claimed_amount (overclaimed by 200!)
        300, // balance_remaining
        1000, // start_time
        10, // iterations_total
        100, // iteration_period_ms
        1500, // current_time (5 iterations = 500 vested)
        &std::option::none(),
        &std::option::none(),
    );

    assert!(to_pay == 0, 0); // Nothing more to pay (already overclaimed)
    assert!(to_refund == 300, 0); // All remaining refunded
    assert!(unvested_claimed == 200, 0); // 200 was claimed before vesting (700 - 500)
}

// === Iteration Overflow Protection Tests ===

#[test]
fun test_iteration_vesting_large_amounts_no_overflow() {
    // Test with amounts that would overflow without u128
    let vested = stream_utils::calculate_iteration_vested(
        1_000_000_000_000_000, // Large amount per iteration
        1000,
        1000, // Many iterations
        100,
        1500, // 5 iterations completed
        &std::option::none(),
        &std::option::none(),
    );
    // Should be 5 * 1_000_000_000_000_000 = 5_000_000_000_000_000
    assert!(vested == 5_000_000_000_000_000, 0);
}

