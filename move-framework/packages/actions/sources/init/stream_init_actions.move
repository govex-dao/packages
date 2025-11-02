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

/// Action to create a vesting stream
/// Stored in InitActionSpecs with BCS serialization
public struct CreateStreamAction has store, copy, drop {
    vault_name: String,
    beneficiary: address,
    total_amount: u64,
    start_time: u64,
    end_time: u64,
    cliff_time: Option<u64>,
    max_per_withdrawal: u64,
    min_interval_ms: u64,
    max_beneficiaries: u64,
}

// === Spec Builders (for staging in InitActionSpecs) ===

/// Add CreateStreamAction to InitActionSpecs
/// Used for staging actions in launchpad raises
public fun add_create_stream_spec(
    specs: &mut account_actions::init_action_specs::InitActionSpecs,
    vault_name: String,
    beneficiary: address,
    total_amount: u64,
    start_time: u64,
    end_time: u64,
    cliff_time: Option<u64>,
    max_per_withdrawal: u64,
    min_interval_ms: u64,
    max_beneficiaries: u64,
) {
    use std::type_name;
    use sui::bcs;

    // Create action struct
    let action = CreateStreamAction {
        vault_name,
        beneficiary,
        total_amount,
        start_time,
        end_time,
        cliff_time,
        max_per_withdrawal,
        min_interval_ms,
        max_beneficiaries,
    };

    // Serialize
    let action_data = bcs::to_bytes(&action);

    // Add to specs with type marker
    account_actions::init_action_specs::add_action(
        specs,
        type_name::get<CreateStreamAction>(),
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
        action.total_amount,
        action.start_time,
        action.end_time,
        action.cliff_time,
        action.max_per_withdrawal,
        action.min_interval_ms,
        action.max_beneficiaries,
        clock,
        ctx,
    )
}
