// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Unified package registry intents for governance
module futarchy_governance_actions::package_registry_intents;

use account_protocol::account::{Self, Account};
use account_protocol::intents::Intent;
use account_protocol::package_registry::{PackageAdminCap, PackageRegistry};
use futarchy_core::version;
use futarchy_governance_actions::package_registry_actions;
use std::bcs;
use std::string::String;
use std::type_name;

// === Cap Acceptance Helper Functions ===
//
// NOTE: For accepting PackageAdminCap into Protocol DAO custody, use the migration
// helper function below OR use the generic WithdrawObjectsAndTransferIntent
// from the Move Framework's owned_intents module.
//
// The AcceptPackageAdminCapIntent was removed as it was a redundant wrapper
// around the generic object transfer functionality.

// === Migration Helper Functions ===

/// One-time migration function to transfer PackageAdminCap to the protocol DAO
entry fun migrate_package_admin_cap_to_dao(
    account: &mut Account,
    registry: &PackageRegistry,
    cap: PackageAdminCap,
    ctx: &mut TxContext,
) {
    account::add_managed_asset(
        account,
        registry,
        b"protocol:package_admin_cap".to_string(),
        cap,
        version::current(),
    );
}

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
        type_name::get<package_registry_actions::AddPackage>().into_string().to_string(),
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
        type_name::get<package_registry_actions::RemovePackage>().into_string().to_string(),
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
        type_name::get<package_registry_actions::UpdatePackageVersion>().into_string().to_string(),
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
        type_name::get<package_registry_actions::UpdatePackageMetadata>().into_string().to_string(),
        action_data,
        intent_witness
    );
}
