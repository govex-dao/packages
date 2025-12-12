// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init action staging for standalone vestings
///
/// This module provides action structs and builders for creating
/// vestings with TRUE fund isolation during DAO initialization or proposals.
///
/// Layer 1: Action structs (CreateVestingAction, CancelVestingAction)
/// Layer 2: Spec builders (add_create_vesting_spec, add_cancel_vesting_spec)
/// Layer 3: Execution functions are in vesting.move (do_create_vesting, do_cancel_vesting)
module account_actions::vesting_init_actions;

use account_protocol::intents;
use std::option::Option;
use std::string::String;

// === Action Structs (Layer 1) ===

/// Action to create a standalone vesting with TRUE fund isolation
/// Funds are physically moved to a shared Vesting object
///
/// NOTE: This action requires a prior action (e.g., VaultSpend) to provide
/// the coin via executable_resources with the specified resource_name.
public struct CreateVestingAction has copy, drop, store {
    beneficiary: address,
    amount_per_iteration: u64,
    start_time: u64,
    iterations_total: u64,
    iteration_period_ms: u64,
    cliff_time: Option<u64>,
    claim_window_ms: Option<u64>,
    max_per_withdrawal: u64,
    is_transferable: bool,
    is_cancellable: bool,
    resource_name: String, // Name of coin resource from prior action
}

/// Action to cancel a vesting (if cancellable)
/// The refund coin is provided to executable_resources under the given resource_name
/// for consumption by subsequent actions (e.g., VaultDeposit to return funds)
public struct CancelVestingAction has copy, drop, store {
    vesting_id: address, // Object ID as address for BCS
    resource_name: String,
}

// === Spec Builders (Layer 2) ===

/// Add CreateVestingAction to Builder
/// Used for staging actions in launchpad raises or proposals via PTB
///
/// NOTE: The coin for vesting must be provided by a prior action in the same Intent.
/// Typically: VaultSpend -> CreateVesting
/// The resource_name must match between the two actions.
public fun add_create_vesting_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    beneficiary: address,
    amount_per_iteration: u64,
    start_time: u64,
    iterations_total: u64,
    iteration_period_ms: u64,
    cliff_time: Option<u64>,
    claim_window_ms: Option<u64>,
    max_per_withdrawal: u64,
    is_transferable: bool,
    is_cancellable: bool,
    resource_name: String,
) {
    use account_actions::action_spec_builder as builder;
    use std::type_name;
    use sui::bcs;

    let action = CreateVestingAction {
        beneficiary,
        amount_per_iteration,
        start_time,
        iterations_total,
        iteration_period_ms,
        cliff_time,
        claim_window_ms,
        max_per_withdrawal,
        is_transferable,
        is_cancellable,
        resource_name,
    };

    let action_data = bcs::to_bytes(&action);

    // Use marker type from vesting module
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::vesting::CreateVesting>(),
        action_data,
        1, // version
    );
    builder::add(builder, action_spec);
}

/// Add CancelVestingAction to Builder
/// Used for cancelling vestings via proposals
/// The resource_name is used to store the refund coin in executable_resources
/// so subsequent actions can retrieve it (e.g., VaultDeposit to return funds)
public fun add_cancel_vesting_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    vesting_id: address,
    resource_name: String,
) {
    use account_actions::action_spec_builder as builder;
    use std::type_name;
    use sui::bcs;

    let action = CancelVestingAction {
        vesting_id,
        resource_name,
    };

    let action_data = bcs::to_bytes(&action);

    // Use marker type from vesting module
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::vesting::CancelVesting>(),
        action_data,
        1, // version
    );
    builder::add(builder, action_spec);
}
