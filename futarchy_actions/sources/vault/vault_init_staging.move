// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// InitActionSpecs builders for vault init actions
///
/// This module provides helper functions to build InitActionSpecs from simple parameters,
/// avoiding the Sui SDK limitation where complex nested structs (TypeName) cannot be
/// passed as pure arguments from TypeScript.
///
/// Pattern:
/// 1. Define data structs matching init action parameters (for BCS serialization)
/// 2. Define marker structs for TypeName identity
/// 3. Provide builder functions that construct InitActionSpecs in Move
///
/// Usage from launchpad or other consumers:
/// ```move
/// use futarchy_actions::vault_init_staging;
///
/// let specs = vault_init_staging::build_stream_init_spec(
///     vault_name,
///     beneficiary,
///     total_amount,
///     ...
/// );
/// stage_launchpad_init_intent(raise, registry, creator_cap, specs, clock, ctx);
/// ```
module futarchy_actions::vault_init_staging;

use futarchy_types::init_action_specs::{Self, InitActionSpecs};
use std::option::Option;
use std::string::String;
use std::type_name;
use sui::bcs;

// === Data Structs for BCS Serialization ===

/// Data struct matching init_vault_deposit parameters
/// Used for BCS serialization when staging vault deposit init actions
public struct VaultDepositInitData has drop, copy, store {
    vault_name: String,
    // Note: Coin<CoinType> cannot be serialized - must be passed directly in PTB
    // This is for staging/disclosure only
}

/// Data struct matching init_create_stream parameters
/// Used for BCS serialization when staging stream init actions
public struct StreamInitData has drop, copy, store {
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

// === Marker Structs for TypeName Identity ===

/// Marker struct for init_vault_deposit action type
public struct VaultDepositInitMarker has drop {}

/// Marker struct for init_create_stream action type
public struct StreamInitMarker has drop {}

// === Builder Functions ===

/// Build InitActionSpecs for vault deposit init action
///
/// Note: This is primarily for staging/disclosure purposes.
/// The actual coin deposit must be done in the PTB execution phase.
public fun build_vault_deposit_init_spec(
    vault_name: String,
): InitActionSpecs {
    let data = VaultDepositInitData {
        vault_name,
    };

    let action_data = bcs::to_bytes(&data);
    let action_type = type_name::get<VaultDepositInitMarker>();

    let mut specs = init_action_specs::new_init_specs();
    init_action_specs::add_action(&mut specs, action_type, action_data);
    specs
}

/// Build InitActionSpecs for stream creation init action
///
/// This allows investors to see that a stream will be created during DAO initialization.
/// The actual stream creation happens in the PTB execution phase by calling
/// account_actions::init_actions::init_create_stream.
///
/// Parameters match init_create_stream exactly:
/// - vault_name: Name of the vault to stream from
/// - beneficiary: Address that can withdraw from stream
/// - total_amount: Total amount to stream over lifetime
/// - start_time: Unix timestamp (ms) when stream starts
/// - end_time: Unix timestamp (ms) when stream ends
/// - cliff_time: Optional cliff timestamp - no withdrawals before this
/// - max_per_withdrawal: Maximum amount per withdrawal
/// - min_interval_ms: Minimum time between withdrawals
/// - max_beneficiaries: Maximum number of beneficiaries (typically 1)
public fun build_stream_init_spec(
    vault_name: String,
    beneficiary: address,
    total_amount: u64,
    start_time: u64,
    end_time: u64,
    cliff_time: Option<u64>,
    max_per_withdrawal: u64,
    min_interval_ms: u64,
    max_beneficiaries: u64,
): InitActionSpecs {
    let data = StreamInitData {
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

    let action_data = bcs::to_bytes(&data);
    let action_type = type_name::get<StreamInitMarker>();

    let mut specs = init_action_specs::new_init_specs();
    init_action_specs::add_action(&mut specs, action_type, action_data);
    specs
}
