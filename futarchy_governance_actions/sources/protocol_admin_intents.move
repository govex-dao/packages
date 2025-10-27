// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

module futarchy_governance_actions::protocol_admin_intents;

use account_protocol::account::{Self, Account};
use account_protocol::intents::{Self, Intent};
use account_protocol::package_registry::PackageRegistry;
use futarchy_core::version;
use futarchy_factory::factory::{FactoryOwnerCap, ValidatorAdminCap};
use futarchy_governance_actions::protocol_admin_actions;
use futarchy_markets_core::fee::FeeAdminCap;
use std::bcs;
use std::string::String;
use std::type_name::{Self, TypeName};

// === Cap Acceptance Helper Functions ===
//
// NOTE: For accepting admin caps into Protocol DAO custody, use the migration
// helper functions below OR use the generic WithdrawObjectsAndTransferIntent
// from the Move Framework's owned_intents module.
//
// The cap acceptance intents were removed as they were redundant wrappers
// around the generic object transfer functionality.

// === Migration Helper Functions ===

/// One-time migration function to transfer all admin caps to the protocol DAO
/// This should be called by the current admin cap holders to transfer control
public entry fun migrate_admin_caps_to_dao(
    account: &mut Account,
    registry: &PackageRegistry,
    factory_cap: FactoryOwnerCap,
    fee_cap: FeeAdminCap,
    validator_cap: ValidatorAdminCap,
    ctx: &mut TxContext,
) {
    // Store all caps in the DAO's account
    account::add_managed_asset(
        account,
        registry,
        b"protocol:factory_owner_cap".to_string(),
        factory_cap,
        version::current(),
    );

    account::add_managed_asset(
        account,
        registry,
        b"protocol:fee_admin_cap".to_string(),
        fee_cap,
        version::current(),
    );

    account::add_managed_asset(
        account,
        registry,
        b"protocol:validator_admin_cap".to_string(),
        validator_cap,
        version::current(),
    );
}

/// Transfer a specific admin cap to the protocol DAO (for gradual migration)
public entry fun migrate_factory_cap_to_dao(
    account: &mut Account,
    registry: &PackageRegistry,
    cap: FactoryOwnerCap,
    ctx: &mut TxContext,
) {
    account::add_managed_asset(
        account,
        registry,
        b"protocol:factory_owner_cap".to_string(),
        cap,
        version::current(),
    );
}

public entry fun migrate_fee_cap_to_dao(
    account: &mut Account,
    registry: &PackageRegistry,
    cap: FeeAdminCap,
    ctx: &mut TxContext,
) {
    account::add_managed_asset(
        account,
        registry,
        b"protocol:fee_admin_cap".to_string(),
        cap,
        version::current(),
    );
}

public entry fun migrate_validator_cap_to_dao(
    account: &mut Account,
    registry: &PackageRegistry,
    cap: ValidatorAdminCap,
    ctx: &mut TxContext,
) {
    account::add_managed_asset(
        account,
        registry,
        b"protocol:validator_admin_cap".to_string(),
        cap,
        version::current(),
    );
}

// === New Intent Helper Functions for All Protocol Admin Actions ===

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

/// Request DAO verification (DAO requests its own verification)
public fun add_request_verification_to_intent<Outcome: store, IW: drop>(
    intent: &mut Intent<Outcome>,
    level: u8,
    attestation_url: String,
    intent_witness: IW,
) {
    let action = protocol_admin_actions::new_request_verification(level, attestation_url);
    let action_data = bcs::to_bytes(&action);
    intent.add_typed_action(type_name::get<protocol_admin_actions::RequestVerification>().into_string().to_string(), action_data, intent_witness);
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
