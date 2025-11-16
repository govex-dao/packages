// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for vault operations.
/// These can be staged in intents for proposals or launchpad initialization.
module account_actions::vault_init_actions;

use account_actions::action_spec_builder;
use account_protocol::intents;
use std::string::String;
use std::type_name;
use sui::bcs;
use sui::object::ID;

// === Layer 1: Action Structs ===

/// Action to deposit coins to a vault
public struct DepositAction has copy, drop, store {
    vault_name: String,
    amount: u64,
}

/// Action to spend/withdraw coins from a vault
public struct SpendAction has copy, drop, store {
    vault_name: String,
    amount: u64,
    spend_all: bool,
}

/// Action to approve a coin type for permissionless deposits
public struct ApproveCoinTypeAction has copy, drop, store {
    vault_name: String,
}

/// Action to remove coin type approval
public struct RemoveApprovedCoinTypeAction has copy, drop, store {
    vault_name: String,
}

/// Action to cancel a vesting stream
public struct CancelStreamAction has copy, drop, store {
    vault_name: String,
    stream_id: ID,
}

// === Layer 2: Spec Builder Functions ===

/// Add a deposit action to the spec builder
public fun add_deposit_spec(
    builder: &mut action_spec_builder::Builder,
    vault_name: String,
    amount: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = DepositAction {
        vault_name,
        amount,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::vault::VaultDeposit>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add a spend action to the spec builder
public fun add_spend_spec(
    builder: &mut action_spec_builder::Builder,
    vault_name: String,
    amount: u64,
    spend_all: bool,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = SpendAction {
        vault_name,
        amount,
        spend_all,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::vault::VaultSpend>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add an approve coin type action to the spec builder
public fun add_approve_coin_type_spec(
    builder: &mut action_spec_builder::Builder,
    vault_name: String,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = ApproveCoinTypeAction {
        vault_name,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::vault::VaultApproveCoinType>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add a remove approved coin type action to the spec builder
public fun add_remove_approved_coin_type_spec(
    builder: &mut action_spec_builder::Builder,
    vault_name: String,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = RemoveApprovedCoinTypeAction {
        vault_name,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::vault::VaultRemoveApprovedCoinType>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add a cancel stream action to the spec builder
public fun add_cancel_stream_spec(
    builder: &mut action_spec_builder::Builder,
    vault_name: String,
    stream_id: ID,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = CancelStreamAction {
        vault_name,
        stream_id,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<account_actions::vault::CancelStream>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}
