// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init action staging for transfer operations
///
/// This module provides action structs and builders for:
/// - Direct object transfers (transfer module operations)
///
/// NOTE: For vault withdrawals + transfers, use the composable pattern:
/// 1. VaultSpend action (puts coin in executable_resources)
/// 2. TransferObject action (takes from executable_resources and transfers)
module account_actions::transfer_init_actions;

use account_protocol::intents;
use std::string::String;

// === Action Structs (for staging) ===

/// Action to transfer an object to a recipient
/// The resource_name specifies which object to take from executable_resources
public struct TransferObjectAction has copy, drop, store {
    recipient: address,
    resource_name: String,
}

/// Action to transfer an object to the transaction sender (cranker)
/// The resource_name specifies which object to take from executable_resources
public struct TransferToSenderAction has copy, drop, store {
    resource_name: String,
}

// === Spec Builders (for PTB construction) ===

/// Add a transfer object action to the spec builder
/// Used for transferring objects to a recipient
/// The resource_name should match what the previous action (e.g., VaultSpend) used
public fun add_transfer_object_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    recipient: address,
    resource_name: String,
) {
    use account_actions::action_spec_builder as builder_mod;
    use std::type_name;
    use sui::bcs;

    let action = TransferObjectAction {
        recipient,
        resource_name,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::transfer::TransferObject>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add a transfer to sender action to the spec builder
/// The object will be transferred to whoever executes the intent (cranker)
/// The resource_name should match what the previous action used
public fun add_transfer_to_sender_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    resource_name: String,
) {
    use account_actions::action_spec_builder as builder_mod;
    use std::type_name;
    use sui::bcs;

    let action = TransferToSenderAction { resource_name };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::transfer::TransferToSender>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}
