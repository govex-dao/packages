// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

module futarchy_governance_actions::protocol_admin_intents;

use account_protocol::intents::Intent;
use futarchy_governance_actions::protocol_admin_actions;
use std::bcs;
use std::string::String;
use std::type_name::{Self, TypeName};

// === Cap Acceptance ===
//
// NOTE: For accepting admin caps into Protocol DAO custody, use the generic
// access_control::lock_cap() function from the Move Framework.
//
// Example:
//   access_control::lock_cap<Config, FactoryOwnerCap>(auth, account, registry, cap)
//
// This stores the capability in the Account's managed assets using a type-based key.

// === Intent Helper Functions for All Protocol Admin Actions ===

// === Factory Admin Intent Helpers ===

/// Add set factory paused action to an intent
public fun add_set_factory_paused_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    paused: bool,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_set_factory_paused(paused);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::SetFactoryPaused>().into_string().to_string(), action_data, intent_witness);
}

/// Add stable type to factory whitelist
public fun add_stable_type_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    stable_type: TypeName,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_add_stable_type(stable_type);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::AddStableType>().into_string().to_string(), action_data, intent_witness);
}

/// Remove stable type from factory whitelist
public fun remove_stable_type_from_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    stable_type: TypeName,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_remove_stable_type(stable_type);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::RemoveStableType>().into_string().to_string(), action_data, intent_witness);
}

// === Fee Management Intent Helpers ===

/// Update DAO creation fee
public fun add_update_dao_creation_fee_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    new_fee: u64,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_update_dao_creation_fee(new_fee);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::UpdateDaoCreationFee>().into_string().to_string(), action_data, intent_witness);
}

/// Update proposal fee
public fun add_update_proposal_fee_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    new_fee: u64,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_update_proposal_fee(new_fee);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::UpdateProposalFee>().into_string().to_string(), action_data, intent_witness);
}

/// Update verification fee
public fun add_update_verification_fee_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    level: u8,
    new_fee: u64,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_update_verification_fee(level, new_fee);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::UpdateVerificationFee>().into_string().to_string(), action_data, intent_witness);
}

/// Withdraw fees to treasury
public fun add_withdraw_fees_to_treasury_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    amount: u64,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_withdraw_fees_to_treasury(amount);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::WithdrawFeesToTreasury>().into_string().to_string(), action_data, intent_witness);
}

// === Verification Intent Helpers ===

/// Add verification level
public fun add_verification_level_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    level: u8,
    fee: u64,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_add_verification_level(level, fee);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::AddVerificationLevel>().into_string().to_string(), action_data, intent_witness);
}

/// Remove verification level
public fun remove_verification_level_from_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    level: u8,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_remove_verification_level(level);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::RemoveVerificationLevel>().into_string().to_string(), action_data, intent_witness);
}

// === Coin Fee Configuration Intent Helpers ===

/// Add coin fee configuration
public fun add_coin_fee_config_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    coin_type: TypeName,
    decimals: u8,
    dao_creation_fee: u64,
    proposal_fee_per_outcome: u64,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_add_coin_fee_config(
        coin_type,
        decimals,
        dao_creation_fee,
        proposal_fee_per_outcome,
    );
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::AddCoinFeeConfig>().into_string().to_string(), action_data, intent_witness);
}

/// Update coin creation fee
public fun add_update_coin_creation_fee_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    coin_type: TypeName,
    new_fee: u64,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_update_coin_creation_fee(coin_type, new_fee);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::UpdateCoinCreationFee>().into_string().to_string(), action_data, intent_witness);
}

/// Update coin proposal fee
public fun add_update_coin_proposal_fee_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    coin_type: TypeName,
    new_fee: u64,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_update_coin_proposal_fee(coin_type, new_fee);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::UpdateCoinProposalFee>().into_string().to_string(), action_data, intent_witness);
}

/// Apply pending coin fees
public fun add_apply_pending_coin_fees_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    coin_type: TypeName,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_apply_pending_coin_fees(coin_type);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::ApplyPendingCoinFees>().into_string().to_string(), action_data, intent_witness);
}
