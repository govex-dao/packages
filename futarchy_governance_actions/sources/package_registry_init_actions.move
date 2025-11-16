// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for package registry operations.
/// These can be staged in intents for proposals.
module futarchy_governance_actions::package_registry_init_actions;

use account_protocol::intents;
use std::string::String;
use std::type_name;
use std::vector;
use sui::bcs;

// === Layer 1: Action Structs ===

public struct AddPackageAction has drop, store {
    name: String,
    addr: address,
    version: u64,
    action_types: vector<String>, // Action types as strings (e.g., "package_name::ActionType")
    category: String,
    description: String,
}

public struct RemovePackageAction has drop, store {
    name: String,
}

public struct UpdatePackageVersionAction has drop, store {
    name: String,
    addr: address,
    version: u64,
}

public struct UpdatePackageMetadataAction has drop, store {
    name: String,
    new_action_types: vector<String>,
    new_category: String,
    new_description: String,
}

public struct PauseAccountCreationAction has drop, store {
    // No fields needed - this action just sets a flag
}

public struct UnpauseAccountCreationAction has drop, store {
    // No fields needed - this action just sets a flag
}

// === Layer 2: Spec Builder Functions ===

/// Add an add package action to the spec builder
public fun add_add_package_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    name: String,
    addr: address,
    version: u64,
    action_types: vector<String>,
    category: String,
    description: String,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = AddPackageAction {
        name,
        addr,
        version,
        action_types,
        category,
        description,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<
            futarchy_governance_actions::package_registry_actions::AddPackage,
        >(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add a remove package action to the spec builder
public fun add_remove_package_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    name: String,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = RemovePackageAction { name };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<
            futarchy_governance_actions::package_registry_actions::RemovePackage,
        >(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add an update package version action to the spec builder
public fun add_update_package_version_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    name: String,
    addr: address,
    version: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UpdatePackageVersionAction {
        name,
        addr,
        version,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<
            futarchy_governance_actions::package_registry_actions::UpdatePackageVersion,
        >(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add an update package metadata action to the spec builder
public fun add_update_package_metadata_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    name: String,
    new_action_types: vector<String>,
    new_category: String,
    new_description: String,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UpdatePackageMetadataAction {
        name,
        new_action_types,
        new_category,
        new_description,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<
            futarchy_governance_actions::package_registry_actions::UpdatePackageMetadata,
        >(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add a pause account creation action to the spec builder
public fun add_pause_account_creation_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = PauseAccountCreationAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<
            futarchy_governance_actions::package_registry_actions::PauseAccountCreation,
        >(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add an unpause account creation action to the spec builder
public fun add_unpause_account_creation_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UnpauseAccountCreationAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<
            futarchy_governance_actions::package_registry_actions::UnpauseAccountCreation,
        >(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}
