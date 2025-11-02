// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init action staging for currency operations during launchpad raises
///
/// This module provides action structs and spec builders for staging currency return actions.
/// Execution dispatch is handled CLIENT-SIDE like proposals - the frontend/keeper
/// composes a PTB that calls account_actions::init_actions::init_remove_treasury_cap.
module account_actions::currency_init_actions;

// === Action Schema (for BCS serialization) ===

/// Schema for returning TreasuryCap to creator when raise fails
/// Clients deserialize this to get parameters for init_actions::init_remove_treasury_cap
public struct ReturnTreasuryCapAction has store, copy, drop {
    recipient: address,
}

// === Spec Builders ===

/// Add ReturnTreasuryCapAction to InitActionSpecs
/// Used for staging failure actions in launchpad raises
public fun add_return_treasury_cap_spec(
    specs: &mut account_actions::init_action_specs::InitActionSpecs,
    recipient: address,
) {
    use std::type_name;
    use sui::bcs;

    let action = ReturnTreasuryCapAction { recipient };
    let action_data = bcs::to_bytes(&action);

    account_actions::init_action_specs::add_action(
        specs,
        type_name::get<ReturnTreasuryCapAction>(),
        action_data
    );
}

// Dispatch is handled CLIENT-SIDE:
// The client deserializes ReturnTreasuryCapAction from the Intent's action specs,
// then calls: init_actions::init_remove_treasury_cap<Config, CoinType>(account, registry, action.recipient)
