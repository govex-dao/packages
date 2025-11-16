// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

// Portions of this file are derived from the account.tech Move Framework project.
// Those portions remain licensed under the Apache License, Version 2.0.

/// Dependencies are validated against the global PackageRegistry.
/// Accounts can only execute actions from packages in the registry.
/// This provides a curated whitelist of allowed packages managed by registry admins.

module account_protocol::deps;

use account_protocol::package_registry::{Self, PackageRegistry};
use account_protocol::version_witness::{Self, VersionWitness};
use std::string::String;

// === Errors ===

const ENotDep: u64 = 2;
const ERegistryMismatch: u64 = 7;

// === Structs ===

/// Simplified deps struct - only tracks which registry to use
public struct Deps has copy, drop, store {
    // ID of the PackageRegistry to use for whitelist checking
    registry_id: ID,
}

// === Public functions ===

/// Creates a new Deps struct with reference to the global registry.
/// All package validation is done against this registry.
public fun new(registry: &PackageRegistry): Deps {
    Deps {
        registry_id: sui::object::id(registry),
    }
}

// === View functions ===

/// Checks if a package is in the global PackageRegistry whitelist.
/// This validates that the package address is registered and approved.
///
/// Validates that the registry passed matches the stored registry_id to prevent malicious
/// registries from bypassing the whitelist.
public fun check(deps: &Deps, version_witness: VersionWitness, registry: &PackageRegistry) {
    // SECURITY: Validate registry matches stored ID to prevent fake registries
    assert!(deps.registry_id == sui::object::id(registry), ERegistryMismatch);

    let addr = version_witness.package_addr();

    // Check if it's in the global whitelist
    assert!(registry.contains_package_addr(addr), ENotDep);
}

/// Returns the registry ID
public fun registry_id(deps: &Deps): ID {
    deps.registry_id
}

// === Test only ===

#[test_only]
use sui::test_utils::destroy;

#[test_only]
public fun new_for_testing(registry: &PackageRegistry): Deps {
    Deps {
        registry_id: sui::object::id(registry),
    }
}

#[test_only]
/// Create deps for testing with a shared registry
public fun new_for_testing_with_config_and_registry(
    _config_name: String,
    _config_addr: address,
    registry: &PackageRegistry,
): Deps {
    Deps {
        registry_id: sui::object::id(registry),
    }
}

// === Tests ===

#[test]
fun test_new_and_check(ctx: &mut TxContext) {
    let mut registry = package_registry::new_for_testing(ctx);

    // Add AccountProtocol to registry
    package_registry::add_for_testing(
        &mut registry,
        b"AccountProtocol".to_string(),
        @account_protocol,
        1,
    );

    let deps = new_for_testing(&registry);
    let witness = version_witness::new_for_testing(@account_protocol);
    deps.check(witness, &registry);

    destroy(registry);
}

#[test, expected_failure(abort_code = ENotDep)]
fun test_error_assert_is_dep(ctx: &mut TxContext) {
    let registry = package_registry::new_for_testing(ctx);
    let deps = new_for_testing(&registry);
    let witness = version_witness::new_for_testing(@0xDEAD);
    deps.check(witness, &registry);
    destroy(registry);
}

#[test, expected_failure(abort_code = ERegistryMismatch)]
fun test_error_registry_mismatch(ctx: &mut TxContext) {
    let registry1 = package_registry::new_for_testing(ctx);
    let registry2 = package_registry::new_for_testing(ctx);

    let deps = new_for_testing(&registry1);
    let witness = version_witness::new_for_testing(@account_protocol);

    // Try to use different registry - should fail
    deps.check(witness, &registry2);

    destroy(registry1);
    destroy(registry2);
}
