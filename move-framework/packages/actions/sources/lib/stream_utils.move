// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Common utilities for time-based streaming/vesting functionality.
/// Shared between vault streams and vesting modules to avoid duplication.
/// Provides reusable math helpers for vesting and stream modules.
/// - Vested/unvested split calculations for cancellations
///
/// This enables both vault streams and standalone vestings to have:
/// - Consistent mathematical accuracy
/// - Shared security validations
/// - Unified approach to time-based fund releases

module account_actions::stream_utils;

use std::u128;

// === Imports ===

// === Constants ===
//
// UPGRADABLE CONSTANT PATTERN:
// These constants are defined here in the framework for backwards compatibility,
// but the canonical source is futarchy_one_shot_utils::constants.
//
// To upgrade these values:
// 1. Update futarchy_one_shot_utils::constants::max_beneficiaries()
// 2. Deploy new version of futarchy_one_shot_utils
// 3. All dependent packages inherit new limits on next deployment
//
// This pattern allows system-wide configuration updates without modifying
// the framework package, enabling DAOs to adjust limits via governance.

public fun max_beneficiaries(): u64 { 100 }

// === Iteration-Based Vesting Functions ===

/// Checks if withdrawal amount respects maximum limit
public fun check_withdrawal_limit(amount: u64, max_per_withdrawal: u64): bool {
    if (max_per_withdrawal == 0) {
        true
    } else {
        amount <= max_per_withdrawal
    }
}

/// Calculates vested amount based on discrete iterations with optional forfeit window
/// Used for iteration-based streams where tokens unlock at specific intervals
/// NOTE: Uses amount_per_iteration directly (NO DIVISION) to avoid precision loss
public fun calculate_iteration_vested(
    amount_per_iteration: u64,
    start_time: u64,
    iterations_total: u64,
    iteration_period_ms: u64,
    current_time: u64,
    cliff_time_opt: &Option<u64>,
    claim_window_ms_opt: &Option<u64>,
): u64 {
    // Check cliff first
    if (cliff_time_opt.is_some()) {
        let cliff = *cliff_time_opt.borrow();
        if (current_time < cliff) {
            return 0 // Nothing vested before cliff
        };
    };

    // Before start time, nothing vested
    if (current_time < start_time) {
        return 0
    };

    // Calculate elapsed time
    let elapsed = current_time - start_time;

    // Calculate current iteration (how many unlocks have occurred)
    let current_iteration = elapsed / iteration_period_ms;

    // Cap at total iterations
    let completed_iterations = if (current_iteration > iterations_total) {
        iterations_total
    } else {
        current_iteration
    };

    if (completed_iterations == 0) {
        return 0
    };

    // If claim window enabled, calculate forfeited iterations
    if (claim_window_ms_opt.is_some()) {
        let claim_window_ms = *claim_window_ms_opt.borrow();

        // How many iteration periods fit in the claim window?
        let window_in_iterations = claim_window_ms / iteration_period_ms;

        // Oldest claimable iteration
        let oldest_claimable = if (completed_iterations > window_in_iterations) {
            completed_iterations - window_in_iterations
        } else {
            0 // All iterations still within window
        };

        // Only iterations from oldest_claimable to completed_iterations are vested (not forfeited)
        let claimable_iterations = completed_iterations - oldest_claimable;

        // Use u128 to prevent overflow during multiplication
        let vested_u128 = (claimable_iterations as u128) * (amount_per_iteration as u128);
        assert!(vested_u128 <= (18446744073709551615 as u128), 0); // u64::MAX check
        (vested_u128 as u64)
    } else {
        // No forfeit - all completed iterations are vested
        // Use u128 to prevent overflow during multiplication
        let vested_u128 = (completed_iterations as u128) * (amount_per_iteration as u128);
        assert!(vested_u128 <= (18446744073709551615 as u128), 0); // u64::MAX check
        (vested_u128 as u64)
    }
}

/// Calculate claimable amount for iteration-based streams
public fun calculate_claimable_iterations(
    amount_per_iteration: u64,
    claimed_amount: u64,
    start_time: u64,
    iterations_total: u64,
    iteration_period_ms: u64,
    current_time: u64,
    cliff_time_opt: &Option<u64>,
    claim_window_ms_opt: &Option<u64>,
): u64 {
    let vested = calculate_iteration_vested(
        amount_per_iteration,
        start_time,
        iterations_total,
        iteration_period_ms,
        current_time,
        cliff_time_opt,
        claim_window_ms_opt,
    );

    if (vested > claimed_amount) {
        vested - claimed_amount
    } else {
        0
    }
}

/// Splits vested and unvested amounts for cancellation (iteration-based)
public fun split_vested_unvested_iterations(
    amount_per_iteration: u64,
    claimed_amount: u64,
    balance_remaining: u64,
    start_time: u64,
    iterations_total: u64,
    iteration_period_ms: u64,
    current_time: u64,
    cliff_time_opt: &Option<u64>,
    claim_window_ms_opt: &Option<u64>,
): (u64, u64, u64) {
    let vested = calculate_iteration_vested(
        amount_per_iteration,
        start_time,
        iterations_total,
        iteration_period_ms,
        current_time,
        cliff_time_opt,
        claim_window_ms_opt,
    );

    // Calculate amounts
    let unvested_claimed = if (claimed_amount > vested) {
        claimed_amount - vested
    } else {
        0
    };

    let to_pay_beneficiary = if (vested > claimed_amount) {
        let owed = vested - claimed_amount;
        if (owed > balance_remaining) {
            balance_remaining
        } else {
            owed
        }
    } else {
        0
    };

    let to_refund = if (balance_remaining > to_pay_beneficiary) {
        balance_remaining - to_pay_beneficiary
    } else {
        0
    };

    (to_pay_beneficiary, to_refund, unvested_claimed)
}

/// Validate iteration-based stream parameters
public fun validate_iteration_parameters(
    start_time: u64,
    iterations_total: u64,
    iteration_period_ms: u64,
    cliff_time_opt: &Option<u64>,
    current_time: u64,
): bool {
    // Must have at least 1 iteration
    if (iterations_total == 0) return false;

    // Iteration period must be positive
    if (iteration_period_ms == 0) return false;

    // Start must be in future or present
    if (start_time < current_time) return false;

    // If cliff exists, must be at or after start
    if (cliff_time_opt.is_some()) {
        let cliff = *cliff_time_opt.borrow();
        if (cliff < start_time) return false;
    };

    true
}
