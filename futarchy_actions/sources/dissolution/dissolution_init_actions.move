// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for dissolution operations.
/// These can be staged in intents for proposals.
module futarchy_actions::dissolution_init_actions;

use account_protocol::intents;
use std::type_name;
use sui::bcs;

// === Layer 1: Action Structs ===

/// Action to create a dissolution capability
/// Note: This is typically called permissionlessly AFTER termination,
/// but can also be included in the termination proposal itself
/// All parameters come from DAO config set during termination
/// Note: No phantom type parameter here - type comes from generic parameter at execution time
public struct CreateDissolutionCapabilityAction has copy, drop, store {
    // Empty - all parameters come from DAO config set during termination
}

// === Layer 2: Spec Builder Functions ===

/// Add create dissolution capability action to the spec builder
/// Can be bundled with termination proposal for atomic dissolution setup
/// Note: AssetType is kept for API compatibility but not serialized - type comes from generic param at execution
public fun add_create_dissolution_capability_spec<AssetType>(
    builder: &mut account_actions::action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;

    // Use empty vector directly since empty struct BCS produces 1 byte (not 0)
    let action_data = vector::empty<u8>();
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<
            futarchy_actions::dissolution_actions::CreateDissolutionCapability,
        >(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

#[test_only]
/// Create action for testing BCS serialization
public fun create_dissolution_capability_action_for_testing(): CreateDissolutionCapabilityAction {
    CreateDissolutionCapabilityAction {}
}
