// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

// Portions of this file are derived from the account.tech Move Framework project.
// Those portions remain licensed under the Apache License, Version 2.0.

/// Dependencies management for Accounts.
///
/// Two-tier authorization system:
/// 1. Global PackageRegistry - curated whitelist managed by protocol admins
/// 2. Per-Account Deps Table - custom packages each account can authorize
///
/// A package is authorized if it's in the global registry OR the per-account table.

module account_protocol::deps;

use account_protocol::package_registry::{Self, PackageRegistry};
use account_protocol::version_witness::{Self, VersionWitness};
use std::string::String;
use sui::table::{Self, Table};

// === Errors ===

const ENotDep: u64 = 2;
const ERegistryMismatch: u64 = 7;
const EDepAlreadyExists: u64 = 8;
const EDepNotFound: u64 = 9;

// === Constants ===

/// Authorization source: package is in global registry
const AUTH_SOURCE_GLOBAL: u8 = 0;
/// Authorization source: package is in per-account table
const AUTH_SOURCE_ACCOUNT: u8 = 1;

// === Structs ===

/// Deps config stored in Account
/// The actual per-account table is stored as a dynamic field on the Account
public struct Deps has copy, drop, store {
    // ID of the PackageRegistry to use for global whitelist checking
    registry_id: ID,
    // Whether unverified (non-global-registry) packages can be added to per-account table
    unverified_allowed: bool,
}

/// Key for the per-account deps Table dynamic field
public struct AccountDepsKey has copy, drop, store {}

/// Info stored for each package in the per-account table
public struct DepInfo has copy, drop, store {
    name: String,
    version: u64,
}

// === Public functions ===

/// Creates a new Deps struct with reference to the global registry.
public fun new(registry: &PackageRegistry, unverified_allowed: bool): Deps {
    Deps {
        registry_id: sui::object::id(registry),
        unverified_allowed,
    }
}

/// Creates an empty per-account deps table
public fun new_account_deps_table(ctx: &mut TxContext): Table<address, DepInfo> {
    table::new(ctx)
}

/// Returns the key for accessing the per-account deps table dynamic field
public fun account_deps_key(): AccountDepsKey {
    AccountDepsKey {}
}

// === View functions ===

/// Checks if a package is authorized for this account.
/// A package is authorized if:
/// 1. It's in the global PackageRegistry, OR
/// 2. It's in the per-account deps table
///
/// Validates that the registry passed matches the stored registry_id to prevent malicious
/// registries from bypassing the whitelist.
public fun check(
    deps: &Deps,
    version_witness: VersionWitness,
    registry: &PackageRegistry,
    account_deps: &Table<address, DepInfo>,
) {
    // SECURITY: Validate registry matches stored ID to prevent fake registries
    assert!(deps.registry_id == sui::object::id(registry), ERegistryMismatch);

    let addr = version_witness.package_addr();

    // Check global registry first (most common case)
    if (registry.contains_package_addr(addr)) return;

    // Then check per-account table
    if (account_deps.contains(addr)) return;

    // Not found in either - abort
    abort ENotDep
}

/// Check without per-account table (for backwards compatibility or when table doesn't exist)
public fun check_global_only(
    deps: &Deps,
    version_witness: VersionWitness,
    registry: &PackageRegistry,
) {
    assert!(deps.registry_id == sui::object::id(registry), ERegistryMismatch);
    let addr = version_witness.package_addr();
    assert!(registry.contains_package_addr(addr), ENotDep);
}

/// Checks if a package is authorized and returns the authorization source.
/// Returns AUTH_SOURCE_GLOBAL (0) if found in global registry,
/// AUTH_SOURCE_ACCOUNT (1) if found in per-account table.
/// Aborts with ENotDep if not authorized.
/// Useful for auditing/logging which tier granted authorization.
public fun check_with_source(
    deps: &Deps,
    version_witness: VersionWitness,
    registry: &PackageRegistry,
    account_deps: &Table<address, DepInfo>,
): u8 {
    // SECURITY: Validate registry matches stored ID to prevent fake registries
    assert!(deps.registry_id == sui::object::id(registry), ERegistryMismatch);

    let addr = version_witness.package_addr();

    // Check global registry first (most common case)
    if (registry.contains_package_addr(addr)) return AUTH_SOURCE_GLOBAL;

    // Then check per-account table
    if (account_deps.contains(addr)) return AUTH_SOURCE_ACCOUNT;

    // Not found in either - abort
    abort ENotDep
}

/// Returns the constant for global authorization source
public fun auth_source_global(): u8 { AUTH_SOURCE_GLOBAL }

/// Returns the constant for account authorization source
public fun auth_source_account(): u8 { AUTH_SOURCE_ACCOUNT }

/// Returns the registry ID
public fun registry_id(deps: &Deps): ID {
    deps.registry_id
}

/// Returns whether unverified packages are allowed
public fun unverified_allowed(deps: &Deps): bool {
    deps.unverified_allowed
}

// === Mutators (package-only) ===

/// Toggle the unverified_allowed flag
public(package) fun toggle_unverified_allowed(deps: &mut Deps) {
    deps.unverified_allowed = !deps.unverified_allowed;
}

/// Add a package to the per-account table
/// If unverified_allowed is false, the package must be in the global registry
public fun add_dep(
    deps: &Deps,
    account_deps: &mut Table<address, DepInfo>,
    registry: &PackageRegistry,
    addr: address,
    name: String,
    version: u64,
) {
    assert!(!account_deps.contains(addr), EDepAlreadyExists);

    // If unverified not allowed, must be in global registry
    if (!deps.unverified_allowed) {
        assert!(registry.contains_package_addr(addr), ENotDep);
    };

    account_deps.add(addr, DepInfo { name, version });
}

/// Add a package to the per-account table without registry authorization check.
/// IMPORTANT: Caller must verify authorization before calling this function.
/// This variant exists to avoid borrow conflicts when Account needs both &Deps and &mut Table.
/// See also: config::do_add_dep which performs the authorization check then calls this.
public fun add_dep_no_auth_check(
    account_deps: &mut Table<address, DepInfo>,
    addr: address,
    name: String,
    version: u64,
) {
    assert!(!account_deps.contains(addr), EDepAlreadyExists);
    account_deps.add(addr, DepInfo { name, version });
}

/// Remove a package from the per-account table
public fun remove_dep(
    account_deps: &mut Table<address, DepInfo>,
    addr: address,
): DepInfo {
    assert!(account_deps.contains(addr), EDepNotFound);
    account_deps.remove(addr)
}

/// Check if a package is in the per-account table
public fun contains_dep(account_deps: &Table<address, DepInfo>, addr: address): bool {
    account_deps.contains(addr)
}

/// Get dep info from per-account table
public fun get_dep(account_deps: &Table<address, DepInfo>, addr: address): &DepInfo {
    assert!(account_deps.contains(addr), EDepNotFound);
    account_deps.borrow(addr)
}

/// Get dep name
public fun dep_name(info: &DepInfo): String {
    info.name
}

/// Get dep version
public fun dep_version(info: &DepInfo): u64 {
    info.version
}

// === Test only ===

#[test_only]
use sui::test_utils::destroy;

#[test_only]
public fun new_for_testing(registry: &PackageRegistry): Deps {
    Deps {
        registry_id: sui::object::id(registry),
        unverified_allowed: false,
    }
}

#[test_only]
public fun new_for_testing_with_unverified(registry: &PackageRegistry, unverified_allowed: bool): Deps {
    Deps {
        registry_id: sui::object::id(registry),
        unverified_allowed,
    }
}

// === Tests ===

#[test]
fun test_check_global_only(ctx: &mut TxContext) {
    let mut registry = package_registry::new_for_testing(ctx);

    package_registry::add_for_testing(
        &mut registry,
        b"AccountProtocol".to_string(),
        @account_protocol,
        1,
    );

    let deps = new_for_testing(&registry);
    let account_deps = new_account_deps_table(ctx);
    let witness = version_witness::new_for_testing(@account_protocol);

    // Should pass - in global registry
    deps.check(witness, &registry, &account_deps);

    destroy(registry);
    destroy(account_deps);
}

#[test]
fun test_check_per_account_only(ctx: &mut TxContext) {
    let registry = package_registry::new_for_testing(ctx);
    let deps = new_for_testing_with_unverified(&registry, true); // Allow adding unverified

    let mut account_deps = new_account_deps_table(ctx);

    // Add custom package to per-account table
    let custom_addr = @0xCAFE;
    add_dep(&deps, &mut account_deps, &registry, custom_addr, b"CustomPkg".to_string(), 1);

    let witness = version_witness::new_for_testing(custom_addr);

    // Should pass - in per-account table
    deps.check(witness, &registry, &account_deps);

    destroy(registry);
    destroy(account_deps);
}

#[test, expected_failure(abort_code = ENotDep)]
fun test_error_not_in_either(ctx: &mut TxContext) {
    let registry = package_registry::new_for_testing(ctx);
    let deps = new_for_testing(&registry);
    let account_deps = new_account_deps_table(ctx);

    let witness = version_witness::new_for_testing(@0xDEAD);

    // Should fail - not in global or per-account
    deps.check(witness, &registry, &account_deps);

    destroy(registry);
    destroy(account_deps);
}

#[test, expected_failure(abort_code = ERegistryMismatch)]
fun test_error_registry_mismatch(ctx: &mut TxContext) {
    let registry1 = package_registry::new_for_testing(ctx);
    let registry2 = package_registry::new_for_testing(ctx);

    let deps = new_for_testing(&registry1);
    let account_deps = new_account_deps_table(ctx);
    let witness = version_witness::new_for_testing(@account_protocol);

    // Try to use different registry - should fail
    deps.check(witness, &registry2, &account_deps);

    destroy(registry1);
    destroy(registry2);
    destroy(account_deps);
}

#[test]
fun test_add_remove_dep(ctx: &mut TxContext) {
    let registry = package_registry::new_for_testing(ctx);
    let deps = new_for_testing_with_unverified(&registry, true);

    let mut account_deps = new_account_deps_table(ctx);

    let addr = @0xCAFE;

    // Add
    add_dep(&deps, &mut account_deps, &registry, addr, b"Test".to_string(), 1);
    assert!(contains_dep(&account_deps, addr));

    // Get info
    let info = get_dep(&account_deps, addr);
    assert!(dep_name(info) == b"Test".to_string());
    assert!(dep_version(info) == 1);

    // Remove
    let removed = remove_dep(&mut account_deps, addr);
    assert!(!contains_dep(&account_deps, addr));
    assert!(dep_name(&removed) == b"Test".to_string());

    destroy(registry);
    destroy(account_deps);
}

#[test, expected_failure(abort_code = EDepAlreadyExists)]
fun test_error_add_duplicate(ctx: &mut TxContext) {
    let registry = package_registry::new_for_testing(ctx);
    let deps = new_for_testing_with_unverified(&registry, true);

    let mut account_deps = new_account_deps_table(ctx);
    let addr = @0xCAFE;

    add_dep(&deps, &mut account_deps, &registry, addr, b"Test".to_string(), 1);
    add_dep(&deps, &mut account_deps, &registry, addr, b"Test2".to_string(), 2); // Should fail

    destroy(registry);
    destroy(account_deps);
}

#[test, expected_failure(abort_code = ENotDep)]
fun test_error_add_unverified_when_not_allowed(ctx: &mut TxContext) {
    let registry = package_registry::new_for_testing(ctx);
    let deps = new_for_testing(&registry); // unverified_allowed = false

    let mut account_deps = new_account_deps_table(ctx);
    let addr = @0xCAFE; // Not in global registry

    // Should fail - unverified not allowed and not in global registry
    add_dep(&deps, &mut account_deps, &registry, addr, b"Test".to_string(), 1);

    destroy(registry);
    destroy(account_deps);
}

#[test]
fun test_toggle_unverified_allowed(ctx: &mut TxContext) {
    let registry = package_registry::new_for_testing(ctx);
    let mut deps = new_for_testing(&registry);

    assert!(!deps.unverified_allowed());
    toggle_unverified_allowed(&mut deps);
    assert!(deps.unverified_allowed());
    toggle_unverified_allowed(&mut deps);
    assert!(!deps.unverified_allowed());

    destroy(registry);
}

#[test]
fun test_check_with_source_global(ctx: &mut TxContext) {
    let mut registry = package_registry::new_for_testing(ctx);

    package_registry::add_for_testing(
        &mut registry,
        b"AccountProtocol".to_string(),
        @account_protocol,
        1,
    );

    let deps = new_for_testing(&registry);
    let account_deps = new_account_deps_table(ctx);
    let witness = version_witness::new_for_testing(@account_protocol);

    // Should return AUTH_SOURCE_GLOBAL (0) - in global registry
    let source = check_with_source(&deps, witness, &registry, &account_deps);
    assert!(source == auth_source_global(), 0);

    destroy(registry);
    destroy(account_deps);
}

#[test]
fun test_check_with_source_account(ctx: &mut TxContext) {
    let registry = package_registry::new_for_testing(ctx);
    let deps = new_for_testing_with_unverified(&registry, true);

    let mut account_deps = new_account_deps_table(ctx);

    // Add custom package to per-account table (not in global registry)
    let custom_addr = @0xCAFE;
    add_dep(&deps, &mut account_deps, &registry, custom_addr, b"CustomPkg".to_string(), 1);

    let witness = version_witness::new_for_testing(custom_addr);

    // Should return AUTH_SOURCE_ACCOUNT (1) - in per-account table
    let source = check_with_source(&deps, witness, &registry, &account_deps);
    assert!(source == auth_source_account(), 0);

    destroy(registry);
    destroy(account_deps);
}

#[test]
fun test_add_dep_verified_in_global_registry(ctx: &mut TxContext) {
    // Test that we can add a dep to per-account table even when unverified_allowed=false
    // if the package IS in the global registry
    let mut registry = package_registry::new_for_testing(ctx);

    package_registry::add_for_testing(
        &mut registry,
        b"AccountProtocol".to_string(),
        @account_protocol,
        1,
    );

    let deps = new_for_testing(&registry); // unverified_allowed = false

    let mut account_deps = new_account_deps_table(ctx);

    // Should succeed - package is in global registry, so allowed even with unverified=false
    add_dep(&deps, &mut account_deps, &registry, @account_protocol, b"AccountProtocol".to_string(), 1);
    assert!(contains_dep(&account_deps, @account_protocol), 0);

    destroy(registry);
    destroy(account_deps);
}
