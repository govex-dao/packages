// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for package upgrade operations.
/// These can be staged in intents for proposals or launchpad initialization.
module account_actions::package_upgrade_init_actions;

use account_protocol::intents;
use account_actions::action_spec_builder;
use std::string::String;
use std::type_name;
use sui::bcs;

// === Layer 1: Action Structs ===

/// Action to create an upgrade ticket for a package
/// The ticket authorizes the upgrade with the specified digest
public struct UpgradeAction has store, copy, drop {
    name: String,        // Package name
    digest: vector<u8>,  // Build digest for the upgrade
}

/// Action to commit an upgrade
/// Used for both commit_dao_only and commit_with_cap flows
/// The execution path (DAO-only vs with-cap) is determined by which do_commit_* function is called
public struct CommitAction has store, copy, drop {
    name: String,  // Package name
}

/// Action to restrict upgrade policy for a package
/// Policy values: 0 = additive, 128 = dep_only, 255 = immutable
public struct RestrictAction has store, copy, drop {
    name: String,  // Package name
    policy: u8,    // Upgrade policy to enforce
}

/// Action to create a commit capability and transfer it to a recipient
/// This delegates commit authority to an external party (e.g., core team)
public struct CreateCommitCapAction has store, copy, drop {
    name: String,                // Package name
    recipient: address,          // Who receives the commit cap
    new_reclaim_delay_ms: u64,  // New timelock delay for reclaiming commit authority
}

// === Layer 2: Spec Builder Functions ===

/// Add an upgrade action to the spec builder
/// Creates an upgrade ticket that authorizes an upgrade to the specified digest
public fun add_upgrade_spec(
    builder: &mut action_spec_builder::Builder,
    name: String,
    digest: vector<u8>,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UpgradeAction {
        name,
        digest,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::package_upgrade::PackageUpgrade>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add a commit action to the spec builder
/// Commits a package upgrade (must be called after do_upgrade returns an UpgradeReceipt)
/// Can be used with either commit_dao_only or commit_with_cap execution paths
public fun add_commit_spec(
    builder: &mut action_spec_builder::Builder,
    name: String,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = CommitAction {
        name,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::package_upgrade::PackageCommit>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add a restrict action to the spec builder
/// Restricts the upgrade policy for a package (additive, dep_only, or immutable)
public fun add_restrict_spec(
    builder: &mut action_spec_builder::Builder,
    name: String,
    policy: u8,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = RestrictAction {
        name,
        policy,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::package_upgrade::PackageRestrict>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add a create commit cap action to the spec builder
/// Creates a commit capability and transfers it to the recipient
/// This delegates commit authority while DAO retains ultimate control via reclaim mechanism
public fun add_create_commit_cap_spec(
    builder: &mut action_spec_builder::Builder,
    name: String,
    recipient: address,
    new_reclaim_delay_ms: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = CreateCommitCapAction {
        name,
        recipient,
        new_reclaim_delay_ms,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::package_upgrade::PackageCreateCommitCap>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}
