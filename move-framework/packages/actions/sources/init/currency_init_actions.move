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
public struct ReturnTreasuryCapAction has copy, drop, store {
    recipient: address,
}

/// Action to return CoinMetadata to creator when raise fails
/// PTB will call: currency::do_init_remove_metadata<Config, Outcome, Key, CoinType, IW>(executable, ...)
public struct ReturnMetadataAction has copy, drop, store {
    recipient: address,
}

/// Action to mint new coins
public struct MintAction has copy, drop, store {
    amount: u64,
}

/// Action to burn coins
public struct BurnAction has copy, drop, store {
    amount: u64,
}

/// Action to disable currency operations (immutable - can only disable, not re-enable)
public struct DisableAction has copy, drop, store {
    mint: bool, // Disable minting
    burn: bool, // Disable burning
    update_symbol: bool, // Disable symbol updates
    update_name: bool, // Disable name updates
    update_description: bool, // Disable description updates
    update_icon: bool, // Disable icon updates
}

/// Action to update currency metadata
public struct UpdateAction has copy, drop, store {
    symbol: std::option::Option<vector<u8>>, // ASCII string
    name: std::option::Option<vector<u8>>, // UTF-8 string
    description: std::option::Option<vector<u8>>, // UTF-8 string
    icon_url: std::option::Option<vector<u8>>, // ASCII string
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
        1, // version
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
        1, // version
    );
    action_spec_builder::add(builder, action_spec);
}

/// Add MintAction to Builder
public fun add_mint_spec(builder: &mut account_actions::action_spec_builder::Builder, amount: u64) {
    use account_actions::action_spec_builder;
    use std::type_name;
    use sui::bcs;

    let action = MintAction { amount };
    let action_data = bcs::to_bytes(&action);

    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::currency::CurrencyMint>(),
        action_data,
        1, // version
    );
    action_spec_builder::add(builder, action_spec);
}

/// Add BurnAction to Builder
public fun add_burn_spec(builder: &mut account_actions::action_spec_builder::Builder, amount: u64) {
    use account_actions::action_spec_builder;
    use std::type_name;
    use sui::bcs;

    let action = BurnAction { amount };
    let action_data = bcs::to_bytes(&action);

    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::currency::CurrencyBurn>(),
        action_data,
        1, // version
    );
    action_spec_builder::add(builder, action_spec);
}

/// Add DisableAction to Builder
public fun add_disable_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    mint: bool,
    burn: bool,
    update_symbol: bool,
    update_name: bool,
    update_description: bool,
    update_icon: bool,
) {
    use account_actions::action_spec_builder;
    use std::type_name;
    use sui::bcs;

    let action = DisableAction {
        mint,
        burn,
        update_symbol,
        update_name,
        update_description,
        update_icon,
    };
    let action_data = bcs::to_bytes(&action);

    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::currency::CurrencyDisable>(),
        action_data,
        1, // version
    );
    action_spec_builder::add(builder, action_spec);
}

/// Add UpdateAction to Builder
public fun add_update_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    symbol: std::option::Option<vector<u8>>,
    name: std::option::Option<vector<u8>>,
    description: std::option::Option<vector<u8>>,
    icon_url: std::option::Option<vector<u8>>,
) {
    use account_actions::action_spec_builder;
    use std::type_name;
    use sui::bcs;

    let action = UpdateAction {
        symbol,
        name,
        description,
        icon_url,
    };
    let action_data = bcs::to_bytes(&action);

    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::currency::CurrencyUpdate>(),
        action_data,
        1, // version
    );
    action_spec_builder::add(builder, action_spec);
}
