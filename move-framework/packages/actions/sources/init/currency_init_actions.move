// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init action staging for currency operations during launchpad raises
///
/// This module provides action structs and spec builders for staging currency return actions.
/// Follows the 3-layer action execution pattern (see IMPORTANT_ACTION_EXECUTION_PATTERN.md)
module account_actions::currency_init_actions;

use account_protocol::intents::{Self, ActionSpec};
use std::vector;

// === Action Structs (for BCS serialization) ===

/// Action to return TreasuryCap to creator when raise fails
/// PTB will call: currency::do_init_remove_treasury_cap<Config, Outcome, CoinType, IW>(executable, ...)
public struct ReturnTreasuryCapAction has store, copy, drop {
    recipient: address,
}

/// Action to return CoinMetadata to creator when raise fails
/// PTB will call: currency::do_init_remove_metadata<Config, Outcome, Key, CoinType, IW>(executable, ...)
public struct ReturnMetadataAction has store, copy, drop {
    recipient: address,
}

// === Spec Builders ===

/// Add ReturnTreasuryCapAction to Builder
/// Used for staging failure actions in launchpad raises via PTB
/// Uses marker type from currency module (not action struct type)
public fun add_return_treasury_cap_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    recipient: address,
) {
    use account_actions::action_spec_builder;
    use std::type_name;
    use sui::bcs;

    let action = ReturnTreasuryCapAction { recipient };
    let action_data = bcs::to_bytes(&action);

    // CRITICAL: Use marker type from currency module, not action struct type
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::currency::RemoveTreasuryCap>(),
        action_data,
        1  // version
    );
    action_spec_builder::add(builder, action_spec);
}

/// Add ReturnMetadataAction to Builder
/// Used for staging failure actions in launchpad raises via PTB
/// Uses marker type from currency module (not action struct type)
public fun add_return_metadata_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    recipient: address,
) {
    use account_actions::action_spec_builder;
    use std::type_name;
    use sui::bcs;

    let action = ReturnMetadataAction { recipient };
    let action_data = bcs::to_bytes(&action);

    // CRITICAL: Use marker type from currency module, not action struct type
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::currency::RemoveMetadata>(),
        action_data,
        1  // version
    );
    action_spec_builder::add(builder, action_spec);
}
