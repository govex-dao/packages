// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

// Portions of this file are derived from the account.tech Move Framework project.
// Those portions remain licensed under the Apache License, Version 2.0.

/// This module allows to manage Account settings.
/// The actions are related to the modifications of certain fields of the Account
/// (metadata, deposits, etc).
/// All these fields are encapsulated in the `Account` struct and each managed in
/// their own module.
/// They are only accessible mutably via package functions defined in account.move
/// which are used here only.

module account_protocol::config;

// === Imports ===

use std::{string::{Self, String}, option::Option, type_name::{Self, TypeName}};
use sui::bcs::{Self, BCS};
use sui::{vec_set::{Self, VecSet}, event};
use account_protocol::{
    account::{Self, Account, Auth},
    intents::{Intent, Expired, Params},
    executable::Executable,
    deps::{Self, DepInfo},
    metadata,
    version,
    version_witness::VersionWitness,
    intent_interface,
};
use account_protocol::package_registry::{Self, PackageRegistry};

use fun account_protocol::intents::add_typed_action as Intent.add_typed_action;

// === Aliases ===

use fun intent_interface::build_intent as Account.build_intent;
use fun intent_interface::process_intent as Account.process_intent;

// === Error Constants ===

/// Error when action version is not supported
const EUnsupportedActionVersion: u64 = 1;
/// Error when package is not authorized (not in global registry and unverified_allowed is false)
const EPackageNotAuthorized: u64 = 10;

// === Action Type Markers ===

/// Update account metadata
public struct ConfigUpdateMetadata has drop {}
/// Configure object deposit settings
public struct ConfigUpdateDeposits has drop {}
/// Manage type whitelist for deposits
public struct ConfigManageWhitelist has drop {}
/// Toggle unverified packages allowed flag
public struct ConfigToggleUnverified has drop {}
/// Add package to per-account deps
public struct ConfigAddDep has drop {}
/// Remove package from per-account deps
public struct ConfigRemoveDep has drop {}

public fun config_update_metadata(): ConfigUpdateMetadata { ConfigUpdateMetadata {} }
public fun config_update_deposits(): ConfigUpdateDeposits { ConfigUpdateDeposits {} }
public fun config_manage_whitelist(): ConfigManageWhitelist { ConfigManageWhitelist {} }
public fun config_toggle_unverified(): ConfigToggleUnverified { ConfigToggleUnverified {} }
public fun config_add_dep(): ConfigAddDep { ConfigAddDep {} }
public fun config_remove_dep(): ConfigRemoveDep { ConfigRemoveDep {} }

// === Structs ===

/// Intent Witness for deposit configuration
public struct ConfigureDepositsIntent() has drop;
/// Intent Witness for whitelist management
public struct ManageWhitelistIntent() has drop;
/// Intent Witness for toggling unverified allowed
public struct ToggleUnverifiedAllowedIntent() has drop;
/// Intent Witness for adding a dep
public struct AddDepIntent() has drop;
/// Intent Witness for removing a dep
public struct RemoveDepIntent() has drop;

/// Action to configure object deposit settings
public struct ConfigureDepositsAction has drop, store {
    enable: bool,
    new_max: Option<u128>,
    reset_counter: bool,
}
/// Action to manage type whitelist for deposits
public struct ManageWhitelistAction has drop, store {
    add_types: vector<String>,
    remove_types: vector<String>,
}
/// Action to toggle the unverified_allowed flag for per-account deps
public struct ToggleUnverifiedAllowedAction has copy, drop, store {}

/// Action to add a package to the per-account deps table
public struct AddDepAction has copy, drop, store {
    addr: address,
    name: String,
    version: u64,
}

/// Action to remove a package from the per-account deps table
public struct RemoveDepAction has copy, drop, store {
    addr: address,
}

// === Public Constructors for Actions ===

/// Create a new ConfigureDepositsAction
/// Allows external modules to construct this action for their own intents
public fun new_configure_deposits_action(
    enable: bool,
    new_max: Option<u128>,
    reset_counter: bool,
): ConfigureDepositsAction {
    ConfigureDepositsAction { enable, new_max, reset_counter }
}

/// Create a new ManageWhitelistAction
/// Allows external modules to construct this action for their own intents
public fun new_manage_whitelist_action(
    add_types: vector<String>,
    remove_types: vector<String>,
): ManageWhitelistAction {
    ManageWhitelistAction { add_types, remove_types }
}

// === Destruction Functions ===

/// Destroy a ConfigureDepositsAction after serialization
public fun destroy_configure_deposits_action(action: ConfigureDepositsAction) {
    let ConfigureDepositsAction { enable: _, new_max: _, reset_counter: _ } = action;
}

/// Destroy a ManageWhitelistAction after serialization
public fun destroy_manage_whitelist_action(action: ManageWhitelistAction) {
    let ManageWhitelistAction { add_types: _, remove_types: _ } = action;
}

/// Helper to deserialize vector<String>
fun peel_vector_string(reader: &mut BCS): vector<String> {
    let len = bcs::peel_vec_length(reader);
    let mut i = 0;
    let mut vec = vector::empty();
    while (i < len) {
        vec.push_back(string::utf8(bcs::peel_vec_u8(reader)));
        i = i + 1;
    };
    vec
}

// === Public functions ===

/// Authorized addresses can configure object deposit settings directly
public fun configure_deposits<Config: store>(
    auth: Auth,
    account: &mut Account,
    enable: bool,
    new_max: Option<u128>,
    reset_counter: bool,
) {
    account.verify(auth);
    // Apply the configuration using the helper function
    account.apply_deposit_config(enable, new_max, reset_counter);
}

/// Authorized addresses can edit the metadata of the account
public fun edit_metadata<Config: store>(
    auth: Auth,
    account: &mut Account,
    registry: &PackageRegistry,
    keys: vector<String>,
    values: vector<String>,
) {
    account.verify(auth);
    *account::metadata_mut(account, registry, version::current()) =
        metadata::from_keys_values(keys, values);
}

/// Creates an intent to configure object deposit settings
public fun request_configure_deposits<Config: store, Outcome: store>(
    auth: Auth,
    account: &mut Account,
    registry: &PackageRegistry,
    outcome: Outcome,
    params: Params,
    enable: bool,
    new_max: Option<u128>,
    reset_counter: bool,
    ctx: &mut TxContext,
) {
    account.verify(auth);
    account.build_intent!(
        registry,
        params,
        outcome,
        b"ConfigureDepositsIntent".to_string(),
        version::current(),
        ConfigureDepositsIntent(),
        ctx,
        |intent, iw| {
            // Create the action struct
            let action = ConfigureDepositsAction { enable, new_max, reset_counter };

            // Serialize it
            let action_data = bcs::to_bytes(&action);

            // Add to intent with pre-serialized bytes
            intent.add_typed_action(
                config_update_deposits(),
                action_data,
                iw
            );

            // Explicitly destroy the action struct
            destroy_configure_deposits_action(action);
        },
    );
}

/// Executes an intent to configure object deposit settings
public fun execute_configure_deposits<Config: store, Outcome: store>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version_witness: VersionWitness,
) {
    account.process_intent!(
        registry,
        executable,
        version_witness,
        ConfigureDepositsIntent(),
        |executable, _iw| {
            // Get BCS bytes from ActionSpec
            let specs = executable.intent().action_specs();
            let spec = specs.borrow(executable.action_idx());

            // Check version before deserialization
            let spec_version = account_protocol::intents::action_spec_version(spec);
            assert!(spec_version == 1, EUnsupportedActionVersion);

            let action_data = account_protocol::intents::action_spec_data(spec);

            // Create BCS reader and deserialize
            let mut reader = bcs::new(*action_data);
            let enable = bcs::peel_bool(&mut reader);
            let new_max = bcs::peel_option_u128(&mut reader);
            let reset_counter = bcs::peel_bool(&mut reader);

            // Validate all bytes consumed (prevent trailing data attacks)
            account_protocol::bcs_validation::validate_all_bytes_consumed(reader);

            // Apply the action
            account.apply_deposit_config(enable, new_max, reset_counter);
            account_protocol::executable::increment_action_idx(executable);
        },
    );
}

/// Deletes the ConfigureDepositsAction from an expired intent
public fun delete_configure_deposits(expired: &mut Expired) {
    let spec = expired.remove_action_spec();
    let action_data = account_protocol::intents::action_spec_data(&spec);
    let mut reader = bcs::new(*action_data);

    // We don't need the values, but we must peel them to consume the bytes
    let ConfigureDepositsAction { enable: _, new_max: _, reset_counter: _ } =
        ConfigureDepositsAction {
            enable: bcs::peel_bool(&mut reader),
            new_max: bcs::peel_option_u128(&mut reader),
            reset_counter: bcs::peel_bool(&mut reader)
        };
}

/// Creates an intent to manage type whitelist
public fun request_manage_whitelist<Config: store, Outcome: store>(
    auth: Auth,
    account: &mut Account,
    registry: &PackageRegistry,
    outcome: Outcome,
    params: Params,
    add_types: vector<String>,
    remove_types: vector<String>,
    ctx: &mut TxContext,
) {
    account.verify(auth);
    account.build_intent!(
        registry,
        params,
        outcome,
        b"ManageWhitelistIntent".to_string(),
        version::current(),
        ManageWhitelistIntent(),
        ctx,
        |intent, iw| {
            // Create the action struct
            let action = ManageWhitelistAction { add_types, remove_types };

            // Serialize it
            let action_data = bcs::to_bytes(&action);

            // Add to intent with pre-serialized bytes
            intent.add_typed_action(
                config_manage_whitelist(),
                action_data,
                iw
            );

            // Explicitly destroy the action struct
            destroy_manage_whitelist_action(action);
        },
    );
}

/// Executes an intent to manage type whitelist
public fun execute_manage_whitelist<Config: store, Outcome: store>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version_witness: VersionWitness,
) {
    account.process_intent!(
        registry,
        executable,
        version_witness,
        ManageWhitelistIntent(),
        |executable, _iw| {
            // Get BCS bytes from ActionSpec
            let specs = executable.intent().action_specs();
            let spec = specs.borrow(executable.action_idx());

            // Check version before deserialization
            let spec_version = account_protocol::intents::action_spec_version(spec);
            assert!(spec_version == 1, EUnsupportedActionVersion);

            let action_data = account_protocol::intents::action_spec_data(spec);

            // Create BCS reader and deserialize
            let mut reader = bcs::new(*action_data);
            let add_types = peel_vector_string(&mut reader);
            let remove_types = peel_vector_string(&mut reader);

            // Validate all bytes consumed (prevent trailing data attacks)
            account_protocol::bcs_validation::validate_all_bytes_consumed(reader);

            // Apply the action
            account.apply_whitelist_changes(&add_types, &remove_types);
            account_protocol::executable::increment_action_idx(executable);
        },
    );
}

/// Deletes the ManageWhitelistAction from an expired intent
public fun delete_manage_whitelist(expired: &mut Expired) {
    let spec = expired.remove_action_spec();
    let action_data = account_protocol::intents::action_spec_data(&spec);
    let mut reader = bcs::new(*action_data);

    // We don't need the values, but we must peel them to consume the bytes
    let ManageWhitelistAction { add_types: _, remove_types: _ } = ManageWhitelistAction {
        add_types: peel_vector_string(&mut reader),
        remove_types: peel_vector_string(&mut reader)
    };
}

// ============================================================================
// === Per-Account Dependencies Management (3-Layer Pattern) ===
// ============================================================================

// --- Toggle Unverified Allowed ---

/// Executes an action to toggle the unverified_allowed flag
/// When enabled, the account can add packages not in the global registry
public fun do_toggle_unverified_allowed<Config: store, Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    _version_witness: VersionWitness,
    _intent_witness: IW,
) {
    // Assert account ownership
    executable.intent().assert_is_account(account.addr());

    // Get ActionSpec
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // Validate action type
    account_protocol::action_validation::assert_action_type<ConfigToggleUnverified>(spec);

    // Check version
    let spec_version = account_protocol::intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // ToggleUnverifiedAllowedAction has no fields, nothing to deserialize

    // Toggle the flag
    deps::toggle_unverified_allowed(account::deps_mut(account, registry, version::current()));

    // Increment action index
    account_protocol::executable::increment_action_idx(executable);
}

/// Deletes the ToggleUnverifiedAllowedAction from an expired intent
public fun delete_toggle_unverified_allowed(expired: &mut Expired) {
    let _spec = expired.remove_action_spec();
    // Empty struct, nothing to deserialize
}

// --- Add Dep ---

/// Executes an action to add a package to the per-account deps table
/// If unverified_allowed is false, the package must be in the global registry
public fun do_add_dep<Config: store, Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    _version_witness: VersionWitness,
    _intent_witness: IW,
) {
    // Assert account ownership
    executable.intent().assert_is_account(account.addr());

    // Get ActionSpec
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // Validate action type
    account_protocol::action_validation::assert_action_type<ConfigAddDep>(spec);

    // Check version
    let spec_version = account_protocol::intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // Deserialize action
    let action_data = account_protocol::intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);
    let addr = bcs::peel_address(&mut reader);
    let name = string::utf8(bcs::peel_vec_u8(&mut reader));
    let dep_version = bcs::peel_u64(&mut reader);

    // Validate all bytes consumed
    account_protocol::bcs_validation::validate_all_bytes_consumed(reader);

    // Authorization check: if unverified_allowed is false, package must be in global registry.
    // We perform this check here (duplicating deps::add_dep logic) to avoid borrow conflicts:
    // we need &Deps to check unverified_allowed, but &mut Table to add the dep.
    // See deps::add_dep for the canonical implementation of this authorization logic.
    let unverified_allowed = account.deps().unverified_allowed();
    if (!unverified_allowed) {
        assert!(registry.contains_package_addr(addr), EPackageNotAuthorized);
    };

    // Add to per-account table (auth check already done above)
    let account_deps = account::account_deps_mut(account);
    deps::add_dep_no_auth_check(
        account_deps,
        addr,
        name,
        dep_version,
    );

    // Increment action index
    account_protocol::executable::increment_action_idx(executable);
}

/// Deletes the AddDepAction from an expired intent
public fun delete_add_dep(expired: &mut Expired) {
    let spec = expired.remove_action_spec();
    let action_data = account_protocol::intents::action_spec_data(&spec);
    let mut reader = bcs::new(*action_data);

    // Consume the bytes
    let _addr = bcs::peel_address(&mut reader);
    let _name = string::utf8(bcs::peel_vec_u8(&mut reader));
    let _version = bcs::peel_u64(&mut reader);
}

// --- Remove Dep ---

/// Executes an action to remove a package from the per-account deps table
public fun do_remove_dep<Config: store, Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    _version_witness: VersionWitness,
    _intent_witness: IW,
) {
    // Assert account ownership
    executable.intent().assert_is_account(account.addr());

    // Get ActionSpec
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // Validate action type
    account_protocol::action_validation::assert_action_type<ConfigRemoveDep>(spec);

    // Check version
    let spec_version = account_protocol::intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // Deserialize action
    let action_data = account_protocol::intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);
    let addr = bcs::peel_address(&mut reader);

    // Validate all bytes consumed
    account_protocol::bcs_validation::validate_all_bytes_consumed(reader);

    // Remove the dep from per-account table
    let _removed = deps::remove_dep(account::account_deps_mut(account), addr);

    // Increment action index
    account_protocol::executable::increment_action_idx(executable);
}

/// Deletes the RemoveDepAction from an expired intent
public fun delete_remove_dep(expired: &mut Expired) {
    let spec = expired.remove_action_spec();
    let action_data = account_protocol::intents::action_spec_data(&spec);
    let mut reader = bcs::new(*action_data);

    // Consume the bytes
    let _addr = bcs::peel_address(&mut reader);
}
