// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for access control operations.
/// These can be staged in intents for proposals or launchpad initialization.
///
/// Note: Borrow and Return are empty structs with no fields, but they still need
/// to be serialized as empty BCS structs for the 3-layer pattern to work correctly.
module account_actions::access_control_init_actions;

use account_protocol::intents;
use account_actions::action_spec_builder;
use std::type_name;
use sui::bcs;

// === Layer 1: Action Structs ===

/// Action to borrow a capability from the account
/// This is an empty struct - the capability type is determined by the type parameter
/// when calling do_borrow<Config, Outcome, Cap, IW>
public struct BorrowAction has store, copy, drop {
    // Empty struct - no fields to serialize
}

/// Action to return a borrowed capability to the account
/// This is an empty struct - the capability type is determined by the type parameter
/// when calling do_return<Config, Outcome, Cap, IW>
public struct ReturnAction has store, copy, drop {
    // Empty struct - no fields to serialize
}

// === Layer 2: Spec Builder Functions ===

/// Add a borrow action to the spec builder
/// Note: Even though BorrowAction is empty, we still serialize it as an empty BCS struct
public fun add_borrow_spec(
    builder: &mut action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = BorrowAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::access_control::AccessControlBorrow>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add a return action to the spec builder
/// Note: Even though ReturnAction is empty, we still serialize it as an empty BCS struct
/// IMPORTANT: A BorrowAction MUST have a matching ReturnAction later in the same intent
public fun add_return_spec(
    builder: &mut action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = ReturnAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::access_control::AccessControlReturn>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}
