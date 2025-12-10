// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for config operations.
/// These can be staged in intents for proposals.
///
/// Contains actions for per-account dependencies management:
/// - ToggleUnverifiedAllowed: Toggle whether unverified packages can be added
/// - AddDep: Add a package to the per-account deps table
/// - RemoveDep: Remove a package from the per-account deps table
module account_actions::config_init_actions;

use account_actions::action_spec_builder;
use account_protocol::intents;
use std::string::String;
use std::type_name;
use sui::bcs;

// === Layer 1: Action Structs ===

/// Action to toggle the unverified_allowed flag for per-account deps.
/// When enabled, the account can add packages not in the global registry.
/// This is an empty struct - no fields to serialize.
public struct ToggleUnverifiedAllowedAction has copy, drop, store {
    // Empty struct - toggle is a simple flip operation
}

/// Action to add a package to the per-account deps table.
/// If unverified_allowed is false, the package must be in the global registry.
public struct AddDepAction has copy, drop, store {
    /// The package address to add
    addr: address,
    /// The package name (for reference only)
    name: String,
    /// The package version
    version: u64,
}

/// Action to remove a package from the per-account deps table.
public struct RemoveDepAction has copy, drop, store {
    /// The package address to remove
    addr: address,
}

// === Layer 2: Spec Builder Functions ===

/// Add a toggle unverified allowed action to the spec builder.
/// This toggles the flag that controls whether unverified packages can be added
/// to the per-account deps table.
public fun add_toggle_unverified_spec(builder: &mut action_spec_builder::Builder) {
    use account_actions::action_spec_builder as builder_mod;

    let action = ToggleUnverifiedAllowedAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_protocol::config::ConfigToggleUnverified>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add an add dep action to the spec builder.
/// This adds a package to the per-account deps table, allowing it to be used
/// for action execution on this account.
///
/// If the account's unverified_allowed flag is false, the package must exist
/// in the global PackageRegistry.
public fun add_add_dep_spec(
    builder: &mut action_spec_builder::Builder,
    addr: address,
    name: String,
    version: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = AddDepAction {
        addr,
        name,
        version,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_protocol::config::ConfigAddDep>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add a remove dep action to the spec builder.
/// This removes a package from the per-account deps table.
public fun add_remove_dep_spec(
    builder: &mut action_spec_builder::Builder,
    addr: address,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = RemoveDepAction {
        addr,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_protocol::config::ConfigRemoveDep>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}
