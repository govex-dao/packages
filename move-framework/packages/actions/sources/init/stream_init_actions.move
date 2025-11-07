// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init action staging and dispatching for streams
///
/// This module provides action structs and builders for creating
/// vesting streams during DAO initialization.
module account_actions::stream_init_actions;

use account_actions::init_actions;
use account_protocol::account::Account;
use account_protocol::package_registry::PackageRegistry;
use std::option::Option;
use std::string::String;
use sui::clock::Clock;
use sui::object::ID;
use sui::tx_context::TxContext;

// === Action Structs (for staging/dispatching) ===

/// Action to create an iteration-based vesting stream
/// Stored in InitActionSpecs with BCS serialization
public struct CreateStreamAction has store, copy, drop {
    vault_name: String,
    beneficiary: address,
    amount_per_iteration: u64,  // Tokens per iteration (NO DIVISION)
    start_time: u64,
    iterations_total: u64,
    iteration_period_ms: u64,
    cliff_time: Option<u64>,
    claim_window_ms: Option<u64>,
    max_per_withdrawal: u64,
    is_transferable: bool,
    is_cancellable: bool,
}

// === Spec Builders (for staging in InitActionSpecs) ===

/// Add CreateStreamAction to InitActionSpecs
/// Used for staging actions in launchpad raises
public fun add_create_stream_spec(
    specs: &mut account_actions::init_action_specs::InitActionSpecs,
    vault_name: String,
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
) {
    use std::type_name;
    use sui::bcs;

    // Create action struct
    let action = CreateStreamAction {
        vault_name,
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
    };

    // Serialize
    let action_data = bcs::to_bytes(&action);

    // Add to specs with marker type from vault module (NOT the action struct!)
    account_actions::init_action_specs::add_action(
        specs,
        type_name::with_defining_ids<account_actions::vault::CreateStream>(),
        action_data
    );
}

// === Dispatchers ===

/// Execute init_create_stream from a staged action
/// Accepts typed action directly (zero deserialization cost!)
public fun dispatch_create_stream<Config: store, CoinType: drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    action: &CreateStreamAction,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    // Execute with the exact parameters from the staged action
    account_actions::init_actions::init_create_stream<Config, CoinType>(
        account,
        registry,
        action.vault_name,
        action.beneficiary,
        action.amount_per_iteration,
        action.start_time,
        action.iterations_total,
        action.iteration_period_ms,
        action.cliff_time,
        action.claim_window_ms,
        action.max_per_withdrawal,
        action.is_transferable,
        action.is_cancellable,
        clock,
        ctx,
    )
}
