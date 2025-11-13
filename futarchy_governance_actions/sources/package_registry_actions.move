// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Unified package registry governance actions
/// Manages both package whitelisting AND action type declarations in a single system
module futarchy_governance_actions::package_registry_actions;

use std::string::String;
use sui::bcs::{Self, BCS};
use account_protocol::{
    package_registry::PackageRegistry,
    account::{Self, Account},
    bcs_validation,
    executable::{Self, Executable},
    intents,
    version_witness::VersionWitness,
    action_validation,
    package_registry,
    deps,
};

// === Action Type Markers ===

public struct AddPackage has drop {}
public struct RemovePackage has drop {}
public struct UpdatePackageVersion has drop {}
public struct UpdatePackageMetadata has drop {}
public struct PauseAccountCreation has drop {}
public struct UnpauseAccountCreation has drop {}

// === Action Structs ===

public struct AddPackageAction has store, drop {
    name: String,
    addr: address,
    version: u64,
    action_types: vector<String>,  // Action types as strings (e.g., "package_name::ActionType")
    category: String,
    description: String,
}

public struct RemovePackageAction has store, drop {
    name: String,
}

public struct UpdatePackageVersionAction has store, drop {
    name: String,
    addr: address,
    version: u64,
}

public struct UpdatePackageMetadataAction has store, drop {
    name: String,
    new_action_types: vector<String>,
    new_category: String,
    new_description: String,
}

public struct PauseAccountCreationAction has store, drop {
    // No fields needed - this action just sets a flag
}

public struct UnpauseAccountCreationAction has store, drop {
    // No fields needed - this action just sets a flag
}

// === Marker Functions ===

public fun add_package_marker(): AddPackage { AddPackage {} }
public fun remove_package_marker(): RemovePackage { RemovePackage {} }
public fun update_package_version_marker(): UpdatePackageVersion { UpdatePackageVersion {} }
public fun update_package_metadata_marker(): UpdatePackageMetadata { UpdatePackageMetadata {} }
public fun pause_account_creation_marker(): PauseAccountCreation { PauseAccountCreation {} }
public fun unpause_account_creation_marker(): UnpauseAccountCreation { UnpauseAccountCreation {} }

// === Errors ===

const EUnsupportedActionVersion: u64 = 1;
const EUnauthorized: u64 = 2;

fun assert_account_authority<Outcome: store>(
    executable: &Executable<Outcome>,
    account: &Account,
) {
    executable::intent(executable).assert_is_account(account.addr());
}

// === Public Constructors ===

public fun new_add_package(
    name: String,
    addr: address,
    version: u64,
    action_types: vector<String>,
    category: String,
    description: String,
): AddPackageAction {
    AddPackageAction { name, addr, version, action_types, category, description }
}

public fun new_remove_package(name: String): RemovePackageAction {
    RemovePackageAction { name }
}

public fun new_update_package_version(
    name: String,
    addr: address,
    version: u64,
): UpdatePackageVersionAction {
    UpdatePackageVersionAction { name, addr, version }
}

public fun new_update_package_metadata(
    name: String,
    new_action_types: vector<String>,
    new_category: String,
    new_description: String,
): UpdatePackageMetadataAction {
    UpdatePackageMetadataAction { name, new_action_types, new_category, new_description }
}

public fun new_pause_account_creation(): PauseAccountCreationAction {
    PauseAccountCreationAction {}
}

public fun new_unpause_account_creation(): UnpauseAccountCreationAction {
    UnpauseAccountCreationAction {}
}

// === Execution Functions ===
//
// ARCHITECTURE NOTE:
// These functions use Move's type-system based authorization instead of explicit capability checks.
// The &mut PackageRegistry parameter provides proof of authorization - only the registry owner
// can obtain this mutable reference. This is enforced by Move's linear type system.
//
// This approach is:
// - More idiomatic (follows sui::coin, sui::token patterns)
// - Simpler (fewer parameters, clearer intent)
// - Type-safe (impossible to bypass authorization)
// - Solves borrow checker conflicts (no need to borrow PackageAdminCap from account)

public fun do_add_package<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    version_witness: VersionWitness,
    witness: IW,
    registry: &mut PackageRegistry,
) {
    assert_account_authority(executable, account);
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<AddPackage>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);

    let name = bcs::peel_vec_u8(&mut reader).to_string();
    let addr = bcs::peel_address(&mut reader);
    let version = bcs::peel_u64(&mut reader);

    // Deserialize action type strings
    let action_types_count = bcs::peel_vec_length(&mut reader);
    let mut action_types = vector::empty();
    let mut i = 0;
    while (i < action_types_count) {
        action_types.push_back(bcs::peel_vec_u8(&mut reader).to_string());
        i = i + 1;
    };

    let category = bcs::peel_vec_u8(&mut reader).to_string();
    let description = bcs::peel_vec_u8(&mut reader).to_string();

    bcs_validation::validate_all_bytes_consumed(reader);

    // Verify package dependencies for security
    // This checks both account-specific deps and the global PackageRegistry whitelist
    account.deps().check(version_witness, registry);

    // Authorization is enforced by Move's type system:
    // Only the registry owner can obtain &mut PackageRegistry
    // No need to borrow PackageAdminCap - the mutable registry reference is sufficient proof
    package_registry::add_package(
        registry,
        name,
        addr,
        version,
        action_types,
        category,
        description,
    );

    executable::increment_action_idx(executable);
}

public fun do_remove_package<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    version_witness: VersionWitness,
    witness: IW,
    registry: &mut PackageRegistry,
) {
    assert_account_authority(executable, account);
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<RemovePackage>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);
    let name = bcs::peel_vec_u8(&mut reader).to_string();

    bcs_validation::validate_all_bytes_consumed(reader);

    // Verify package dependencies for security
    account.deps().check(version_witness, registry);

    // Authorization enforced by type system (&mut PackageRegistry)
    package_registry::remove_package(registry, name);

    executable::increment_action_idx(executable);
}

public fun do_update_package_version<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    version_witness: VersionWitness,
    witness: IW,
    registry: &mut PackageRegistry,
) {
    assert_account_authority(executable, account);
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<UpdatePackageVersion>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);

    let name = bcs::peel_vec_u8(&mut reader).to_string();
    let addr = bcs::peel_address(&mut reader);
    let version = bcs::peel_u64(&mut reader);

    bcs_validation::validate_all_bytes_consumed(reader);

    // Verify package dependencies for security
    account.deps().check(version_witness, registry);

    // Authorization enforced by type system (&mut PackageRegistry)
    package_registry::update_package_version(registry, name, addr, version);

    executable::increment_action_idx(executable);
}

public fun do_update_package_metadata<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    version_witness: VersionWitness,
    witness: IW,
    registry: &mut PackageRegistry,
) {
    assert_account_authority(executable, account);
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<UpdatePackageMetadata>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);

    let name = bcs::peel_vec_u8(&mut reader).to_string();

    // Deserialize action type strings
    let action_types_count = bcs::peel_vec_length(&mut reader);
    let mut action_types = vector::empty();
    let mut i = 0;
    while (i < action_types_count) {
        action_types.push_back(bcs::peel_vec_u8(&mut reader).to_string());
        i = i + 1;
    };

    let category = bcs::peel_vec_u8(&mut reader).to_string();
    let description = bcs::peel_vec_u8(&mut reader).to_string();

    bcs_validation::validate_all_bytes_consumed(reader);

    // Verify package dependencies for security
    account.deps().check(version_witness, registry);

    // Authorization enforced by type system (&mut PackageRegistry)
    // action_types are already Strings
    package_registry::update_package_metadata(
        registry,
        name,
        action_types,
        category,
        description,
    );

    executable::increment_action_idx(executable);
}

public fun do_pause_account_creation<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    version_witness: VersionWitness,
    _witness: IW,
    registry: &mut PackageRegistry,
) {
    assert_account_authority(executable, account);
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<PauseAccountCreation>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);
    let reader = bcs::new(*action_data);

    // No data to deserialize - pause action has no parameters
    bcs_validation::validate_all_bytes_consumed(reader);

    // Increment action index
    executable::increment_action_idx(executable);

    // Verify the account has the PackageAdminCap (proves authorization)
    // The cap must be locked in the account first using access_control::lock_cap()
    assert!(
        account::has_managed_asset(account, b"protocol:package_admin_cap".to_string()),
        EUnauthorized
    );

    // Verify deps compatibility
    deps::check(account::deps(account), version_witness, registry);

    // Pause account creation (authorization already verified above)
    package_registry::pause_account_creation_authorized(registry);
}

public fun do_unpause_account_creation<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    version_witness: VersionWitness,
    _witness: IW,
    registry: &mut PackageRegistry,
) {
    assert_account_authority(executable, account);
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<UnpauseAccountCreation>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);
    let reader = bcs::new(*action_data);

    // No data to deserialize - unpause action has no parameters
    bcs_validation::validate_all_bytes_consumed(reader);

    // Increment action index
    executable::increment_action_idx(executable);

    // Verify the account has the PackageAdminCap (proves authorization)
    // The cap must be locked in the account first using access_control::lock_cap()
    assert!(
        account::has_managed_asset(account, b"protocol:package_admin_cap".to_string()),
        EUnauthorized
    );

    // Verify deps compatibility
    deps::check(account::deps(account), version_witness, registry);

    // Unpause account creation (authorization already verified above)
    package_registry::unpause_account_creation_authorized(registry);
}

// === Garbage Collection ===

public fun delete_package_registry_action(expired: &mut account_protocol::intents::Expired) {
    let action_spec = account_protocol::intents::remove_action_spec(expired);
    let _ = action_spec;
}
