// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Unified package registry intents for governance
module futarchy_governance_actions::package_registry_intents;

use account_protocol::intents::Intent;
use futarchy_governance_actions::package_registry_actions;
use std::bcs;
use std::string::String;
use std::type_name;

// === Cap Acceptance ===
//
// NOTE: For accepting PackageAdminCap into Protocol DAO custody, use the generic
// access_control::lock_cap() function from the Move Framework.
//
// Example:
//   access_control::lock_cap<Config, PackageAdminCap>(auth, account, registry, cap)
//
// This stores the capability in the Account's managed assets using a type-based key.

// === Intent Helper Functions ===

/// Add package to registry
/// action_types should be full type names as strings (e.g., "package_name::module_name::ActionType")
public fun add_package_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    name: String,
    addr: address,
    version: u64,
    action_types: vector<String>,
    category: String,
    description: String,
    intent_witness: IW,
) {
    let action = package_registry_actions::new_add_package(
        name,
        addr,
        version,
        action_types,
        category,
        description,
    );
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(
        package_registry_actions::add_package_marker(),
        action_data,
        intent_witness
    );
}

/// Remove package from registry
public fun remove_package_from_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    name: String,
    intent_witness: IW,
) {
    let action = package_registry_actions::new_remove_package(name);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(
        package_registry_actions::remove_package_marker(),
        action_data,
        intent_witness
    );
}

/// Update package version
public fun update_package_version_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    name: String,
    addr: address,
    version: u64,
    intent_witness: IW,
) {
    let action = package_registry_actions::new_update_package_version(name, addr, version);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(
        package_registry_actions::update_package_version_marker(),
        action_data,
        intent_witness
    );
}

/// Update package metadata
/// new_action_types should be full type names as strings (e.g., "package_name::module_name::ActionType")
public fun update_package_metadata_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    name: String,
    new_action_types: vector<String>,
    new_category: String,
    new_description: String,
    intent_witness: IW,
) {
    let action = package_registry_actions::new_update_package_metadata(
        name,
        new_action_types,
        new_category,
        new_description,
    );
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(
        package_registry_actions::update_package_metadata_marker(),
        action_data,
        intent_witness
    );
}
