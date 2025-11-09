// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init action staging for transfer operations
///
/// This module provides action structs and builders for:
/// - Vault withdrawals + transfers (vault operations)
/// - Direct object transfers (transfer module operations)
module account_actions::transfer_init_actions;

use account_protocol::intents::{Self, ActionSpec};
use std::string::String;

// === Action Structs (for staging) ===

/// Action to withdraw from vault and transfer to recipient
public struct WithdrawAndTransferAction has store, copy, drop {
    vault_name: String,
    amount: u64,
    recipient: address,
}

/// Action to transfer an object to a recipient
/// Used for direct object transfers (not vault withdrawals)
public struct TransferObjectAction has store, copy, drop {
    recipient: address,
}

/// Action to transfer an object to the transaction sender (cranker)
/// This is an empty struct - the recipient is determined at execution time
public struct TransferToSenderAction has store, copy, drop {
    // Empty struct - no fields to serialize
}

// === Spec Builders (for PTB construction) ===

/// Add WithdrawAndTransferAction to Builder
/// Used for staging vault withdrawals + transfers in proposals via PTB
public fun add_withdraw_and_transfer_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    vault_name: String,
    amount: u64,
    recipient: address,
) {
    use account_actions::action_spec_builder as builder;
    use std::type_name;
    use sui::bcs;

    // Create action struct
    let action = WithdrawAndTransferAction {
        vault_name,
        amount,
        recipient,
    };

    // Serialize
    let action_data = bcs::to_bytes(&action);

    // Add to builder with marker type from vault module
    // We use vault::Withdraw as the action type marker
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::vault::Withdraw>(),
        action_data,
        1  // version
    );
    builder::add(builder, action_spec);
}

/// Add a transfer object action to the spec builder
/// Used for transferring objects (not vault funds) to a recipient
public fun add_transfer_object_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    recipient: address,
) {
    use account_actions::action_spec_builder as builder_mod;
    use std::type_name;
    use sui::bcs;

    let action = TransferObjectAction {
        recipient,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::transfer::TransferObject>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add a transfer to sender action to the spec builder
/// The object will be transferred to whoever executes the intent (cranker)
public fun add_transfer_to_sender_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;
    use std::type_name;
    use sui::bcs;

    let action = TransferToSenderAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::transfer::TransferObject>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}
