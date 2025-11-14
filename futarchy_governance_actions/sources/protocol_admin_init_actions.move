// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for protocol admin operations.
/// These can be staged in intents for proposals.
module futarchy_governance_actions::protocol_admin_init_actions;

use std::{
    string::String,
    type_name::{Self, TypeName},
};
use sui::bcs;
use account_protocol::intents;

// === Layer 1: Action Structs ===

// Factory Admin Actions

/// Pause or unpause the factory
public struct SetFactoryPausedAction has store, drop {
    paused: bool,
}

/// Permanently disable the factory - CANNOT BE REVERSED
public struct DisableFactoryPermanentlyAction has store, drop {
    // No fields needed - this is a one-way operation
}

/// Add a stable coin type to the factory whitelist
/// Note: Type comes from generic parameter, not serialized
public struct AddStableTypeAction has store, drop {
    // Empty - type parameter provides the stable type
}

/// Remove a stable coin type from the factory whitelist
/// Note: Type comes from generic parameter, not serialized
public struct RemoveStableTypeAction has store, drop {
    // Empty - type parameter provides the stable type
}

// Fee Admin Actions

/// Update the DAO creation fee
public struct UpdateDaoCreationFeeAction has store, drop {
    new_fee: u64,
}

/// Update the proposal creation fee per outcome
public struct UpdateProposalFeeAction has store, drop {
    new_fee_per_outcome: u64,
}

/// Update verification fee for a specific level
public struct UpdateVerificationFeeAction has store, drop {
    level: u8,
    new_fee: u64,
}

/// Add a new verification level with fee
public struct AddVerificationLevelAction has store, drop {
    level: u8,
    fee: u64,
}

/// Remove a verification level
public struct RemoveVerificationLevelAction has store, drop {
    level: u8,
}

/// Withdraw accumulated fees to treasury (generic over coin type)
public struct WithdrawFeesToTreasuryAction has store, drop {
    vault_name: String,
    amount: u64,
}

// Coin-specific fee actions

/// Add a new coin type with fee configuration
/// Note: Type comes from generic parameter, not serialized
public struct AddCoinFeeConfigAction has store, drop {
    decimals: u8,
    dao_creation_fee: u64,
    proposal_fee_per_outcome: u64,
}

/// Update creation fee for a specific coin type (with 6-month delay)
/// Note: Type comes from generic parameter, not serialized
public struct UpdateCoinCreationFeeAction has store, drop {
    new_fee: u64,
}

/// Update proposal fee for a specific coin type (with 6-month delay)
/// Note: Type comes from generic parameter, not serialized
public struct UpdateCoinProposalFeeAction has store, drop {
    new_fee_per_outcome: u64,
}

/// Apply pending coin fees after delay
/// Note: Type comes from generic parameter, not serialized
public struct ApplyPendingCoinFeesAction has store, drop {
    // Empty - type parameter provides the coin type
}

// === Layer 2: Spec Builder Functions ===

// Factory Admin Spec Builders

/// Add set factory paused action to the spec builder
public fun add_set_factory_paused_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    paused: bool,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = SetFactoryPausedAction { paused };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::SetFactoryPaused>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add disable factory permanently action to the spec builder
public fun add_disable_factory_permanently_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = DisableFactoryPermanentlyAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::DisableFactoryPermanently>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add stable type action to the spec builder
/// Note: Type is passed as generic parameter at execution time
public fun add_add_stable_type_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = AddStableTypeAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::AddStableType>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add remove stable type action to the spec builder
/// Note: Type is passed as generic parameter at execution time
public fun add_remove_stable_type_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = RemoveStableTypeAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::RemoveStableType>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

// Fee Admin Spec Builders

/// Add update DAO creation fee action to the spec builder
public fun add_update_dao_creation_fee_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    new_fee: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UpdateDaoCreationFeeAction { new_fee };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::UpdateDaoCreationFee>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add update proposal fee action to the spec builder
public fun add_update_proposal_fee_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    new_fee_per_outcome: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UpdateProposalFeeAction { new_fee_per_outcome };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::UpdateProposalFee>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add update verification fee action to the spec builder
public fun add_update_verification_fee_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    level: u8,
    new_fee: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UpdateVerificationFeeAction { level, new_fee };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::UpdateVerificationFee>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add verification level action to the spec builder
public fun add_add_verification_level_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    level: u8,
    fee: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = AddVerificationLevelAction { level, fee };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::AddVerificationLevel>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add remove verification level action to the spec builder
public fun add_remove_verification_level_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    level: u8,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = RemoveVerificationLevelAction { level };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::RemoveVerificationLevel>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add withdraw fees to treasury action to the spec builder
public fun add_withdraw_fees_to_treasury_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    vault_name: String,
    amount: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = WithdrawFeesToTreasuryAction { vault_name, amount };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::WithdrawFeesToTreasury>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

// Coin-specific Fee Spec Builders

/// Add coin fee config action to the spec builder
/// Note: Coin type is passed as generic parameter at execution time
public fun add_add_coin_fee_config_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    decimals: u8,
    dao_creation_fee: u64,
    proposal_fee_per_outcome: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = AddCoinFeeConfigAction {
        decimals,
        dao_creation_fee,
        proposal_fee_per_outcome,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::AddCoinFeeConfig>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add update coin creation fee action to the spec builder
/// Note: Coin type is passed as generic parameter at execution time
public fun add_update_coin_creation_fee_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    new_fee: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UpdateCoinCreationFeeAction { new_fee };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::UpdateCoinCreationFee>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add update coin proposal fee action to the spec builder
/// Note: Coin type is passed as generic parameter at execution time
public fun add_update_coin_proposal_fee_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    new_fee_per_outcome: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UpdateCoinProposalFeeAction { new_fee_per_outcome };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::UpdateCoinProposalFee>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add apply pending coin fees action to the spec builder
/// Note: Coin type is passed as generic parameter at execution time
public fun add_apply_pending_coin_fees_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = ApplyPendingCoinFeesAction {};
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_governance_actions::protocol_admin_actions::ApplyPendingCoinFees>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}
