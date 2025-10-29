// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Protocol admin actions for managing the futarchy protocol through its own DAO (dogfooding).
/// This module allows the protocol's owner DAO and its security council to control:
/// - Factory admin functions (FactoryOwnerCap)
/// - Fee management (FeeAdminCap) 
/// - Validator functions (ValidatorAdminCap)
module futarchy_governance_actions::protocol_admin_actions;

// === Imports ===
use std::{
    string::{String as UTF8String, String},
    type_name::{Self, TypeName},
};
use sui::{
    bcs::{Self, BCS},
    clock::Clock,
    coin::{Self, Coin},
    event,
    object::{Self, ID},
    sui::SUI,
    vec_set::VecSet,
};
use account_protocol::{
    account::{Self, Account},
    bcs_validation,
    executable::{Self, Executable},
    intents,
    package_registry::PackageRegistry,
    version_witness::VersionWitness,
};
use futarchy_core::futarchy_config::{Self, FutarchyConfig};
use futarchy_factory::{
    factory::{Self, Factory, FactoryOwnerCap, ValidatorAdminCap},
};
use futarchy_markets_core::{
    fee::{Self, FeeManager, FeeAdminCap},
};
// futarchy_dao dependency removed - use ConfigWitness instead
use account_protocol::action_validation;

// === Action Type Markers ===

/// Add coin fee configuration
public struct AddCoinFeeConfig has drop {}
/// Add stable type
public struct AddStableType has drop {}
/// Add verification level
public struct AddVerificationLevel has drop {}
/// Apply pending coin fees
public struct ApplyPendingCoinFees has drop {}
/// Disable factory permanently
public struct DisableFactoryPermanently has drop {}
/// Remove stable type
public struct RemoveStableType has drop {}
/// Remove verification level
public struct RemoveVerificationLevel has drop {}
/// Set factory paused state
public struct SetFactoryPaused has drop {}
/// Update coin creation fee
public struct UpdateCoinCreationFee has drop {}
/// Update coin proposal fee
public struct UpdateCoinProposalFee has drop {}
/// Update DAO creation fee
public struct UpdateDaoCreationFee has drop {}
/// Update proposal fee
public struct UpdateProposalFee has drop {}
/// Update verification fee
public struct UpdateVerificationFee has drop {}
/// Withdraw fees to treasury
public struct WithdrawFeesToTreasury has drop {}

// === Marker Functions ===

public fun set_factory_paused_marker(): SetFactoryPaused { SetFactoryPaused {} }
public fun add_stable_type_marker(): AddStableType { AddStableType {} }
public fun remove_stable_type_marker(): RemoveStableType { RemoveStableType {} }
public fun update_dao_creation_fee_marker(): UpdateDaoCreationFee { UpdateDaoCreationFee {} }
public fun update_proposal_fee_marker(): UpdateProposalFee { UpdateProposalFee {} }
public fun update_verification_fee_marker(): UpdateVerificationFee { UpdateVerificationFee {} }
public fun withdraw_fees_to_treasury_marker(): WithdrawFeesToTreasury { WithdrawFeesToTreasury {} }
public fun add_verification_level_marker(): AddVerificationLevel { AddVerificationLevel {} }
public fun remove_verification_level_marker(): RemoveVerificationLevel { RemoveVerificationLevel {} }
public fun add_coin_fee_config_marker(): AddCoinFeeConfig { AddCoinFeeConfig {} }
public fun update_coin_creation_fee_marker(): UpdateCoinCreationFee { UpdateCoinCreationFee {} }
public fun update_coin_proposal_fee_marker(): UpdateCoinProposalFee { UpdateCoinProposalFee {} }
public fun apply_pending_coin_fees_marker(): ApplyPendingCoinFees { ApplyPendingCoinFees {} }
public fun disable_factory_permanently_marker(): DisableFactoryPermanently { DisableFactoryPermanently {} }

// === Errors ===
const EInvalidAdminCap: u64 = 1;
const ECapNotFound: u64 = 2;

// === Events ===

const EInvalidFeeAmount: u64 = 3;

// === Action Structs ===

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
public struct AddStableTypeAction has store, drop {
    stable_type: TypeName,
}

/// Remove a stable coin type from the factory whitelist
public struct RemoveStableTypeAction has store, drop {
    stable_type: TypeName,
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

/// Withdraw accumulated fees to treasury
public struct WithdrawFeesToTreasuryAction has store, drop {
    amount: u64,
}

// Coin-specific fee actions

/// Add a new coin type with fee configuration
public struct AddCoinFeeConfigAction has store, drop {
    coin_type: TypeName,
    decimals: u8,
    dao_creation_fee: u64,
    proposal_fee_per_outcome: u64,
}

/// Update creation fee for a specific coin type (with 6-month delay)
public struct UpdateCoinCreationFeeAction has store, drop {
    coin_type: TypeName,
    new_fee: u64,
}

/// Update proposal fee for a specific coin type (with 6-month delay)
public struct UpdateCoinProposalFeeAction has store, drop {
    coin_type: TypeName,
    new_fee_per_outcome: u64,
}

// === Public Functions ===

// Factory Actions

public fun new_set_factory_paused(paused: bool): SetFactoryPausedAction {
    SetFactoryPausedAction { paused }
}

public fun new_disable_factory_permanently(): DisableFactoryPermanentlyAction {
    DisableFactoryPermanentlyAction {}
}

public fun new_add_stable_type(stable_type: TypeName): AddStableTypeAction {
    AddStableTypeAction { stable_type }
}

public fun new_remove_stable_type(stable_type: TypeName): RemoveStableTypeAction {
    RemoveStableTypeAction { stable_type }
}

// Fee Actions

public fun new_update_dao_creation_fee(new_fee: u64): UpdateDaoCreationFeeAction {
    UpdateDaoCreationFeeAction { new_fee }
}

public fun new_update_proposal_fee(new_fee_per_outcome: u64): UpdateProposalFeeAction {
    UpdateProposalFeeAction { new_fee_per_outcome }
}

public fun new_update_verification_fee(level: u8, new_fee: u64): UpdateVerificationFeeAction {
    UpdateVerificationFeeAction { level, new_fee }
}

public fun new_add_verification_level(level: u8, fee: u64): AddVerificationLevelAction {
    AddVerificationLevelAction { level, fee }
}

public fun new_remove_verification_level(level: u8): RemoveVerificationLevelAction {
    RemoveVerificationLevelAction { level }
}

public fun new_withdraw_fees_to_treasury(amount: u64): WithdrawFeesToTreasuryAction {
    WithdrawFeesToTreasuryAction { amount }
}

// Coin-specific fee constructors

public fun new_add_coin_fee_config(
    coin_type: TypeName,
    decimals: u8,
    dao_creation_fee: u64,
    proposal_fee_per_outcome: u64,
): AddCoinFeeConfigAction {
    AddCoinFeeConfigAction {
        coin_type,
        decimals,
        dao_creation_fee,
        proposal_fee_per_outcome,
    }
}

public fun new_update_coin_creation_fee(
    coin_type: TypeName,
    new_fee: u64,
): UpdateCoinCreationFeeAction {
    UpdateCoinCreationFeeAction { coin_type, new_fee }
}

public fun new_update_coin_proposal_fee(
    coin_type: TypeName,
    new_fee_per_outcome: u64,
): UpdateCoinProposalFeeAction {
    UpdateCoinProposalFeeAction { coin_type, new_fee_per_outcome }
}

public fun new_apply_pending_coin_fees(
    coin_type: TypeName,
): ApplyPendingCoinFeesAction {
    ApplyPendingCoinFeesAction { coin_type }
}

// === Execution Functions ===

/// Execute factory pause/unpause action
public fun do_set_factory_paused<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    factory: &mut Factory,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<SetFactoryPaused>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let paused = bcs::peel_bool(&mut bcs);
    let action = SetFactoryPausedAction { paused };

    // Increment action index
    executable::increment_action_idx(executable);

    let _ = ctx;
    
    let cap = account::borrow_managed_asset<String, FactoryOwnerCap>(
        account,
        registry, b"protocol:factory_owner_cap".to_string(),
        version
    );
    
    // Toggle pause state if action says to pause and factory is unpaused, or vice versa
    if ((action.paused && !factory::is_paused(factory)) ||
        (!action.paused && factory::is_paused(factory))) {
        factory::toggle_pause(factory, cap);
    }
}

/// Execute permanent factory disable action - THIS CANNOT BE REVERSED
public fun do_disable_factory_permanently<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    factory: &mut Factory,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<DisableFactoryPermanently>(spec);

    // No deserialization needed - action has no fields
    let _action = DisableFactoryPermanentlyAction {};

    // Increment action index
    executable::increment_action_idx(executable);

    let _ = witness;

    let cap = account::borrow_managed_asset<String, FactoryOwnerCap>(
        account,
        registry, b"protocol:factory_owner_cap".to_string(),
        version
    );

    // Permanently disable the factory - THIS CANNOT BE UNDONE
    factory::disable_permanently(factory, cap, clock, ctx);
}

/// Execute add stable type action
public fun do_add_stable_type<Outcome: store, IW: drop, StableType>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    factory: &mut Factory,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<AddStableType>(spec);

    // Create action with generic type
    let stable_type = type_name::get<StableType>();
    let action = AddStableTypeAction { stable_type };

    // Increment action index
    executable::increment_action_idx(executable);
    
    let cap = account::borrow_managed_asset<String, FactoryOwnerCap>(
        account,
        registry, b"protocol:factory_owner_cap".to_string(),
        version
    );
    
    factory::add_allowed_stable_type<StableType>(factory, cap, clock, ctx);
}

/// Execute remove stable type action
public fun do_remove_stable_type<Outcome: store, IW: drop, StableType>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    factory: &mut Factory,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<RemoveStableType>(spec);

    // Create action with generic type
    let stable_type = type_name::get<StableType>();
    let action = RemoveStableTypeAction { stable_type };

    // Increment action index
    executable::increment_action_idx(executable);
    
    let cap = account::borrow_managed_asset<String, FactoryOwnerCap>(
        account,
        registry, b"protocol:factory_owner_cap".to_string(),
        version
    );
    
    factory::remove_allowed_stable_type<StableType>(factory, cap, clock, ctx);
}

/// Execute update DAO creation fee action
public fun do_update_dao_creation_fee<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<UpdateDaoCreationFee>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let new_fee = bcs::peel_u64(&mut bcs);
    let action = UpdateDaoCreationFeeAction { new_fee };

    // Increment action index
    executable::increment_action_idx(executable);
    
    let cap = account::borrow_managed_asset<String, FeeAdminCap>(
        account,
        registry, b"protocol:fee_admin_cap".to_string(),
        version
    );
    
    fee::update_dao_creation_fee(fee_manager, cap, action.new_fee, clock, ctx);
}

/// Execute update proposal fee action
public fun do_update_proposal_fee<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<UpdateProposalFee>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let new_fee_per_outcome = bcs::peel_u64(&mut bcs);
    let action = UpdateProposalFeeAction { new_fee_per_outcome };

    // Increment action index
    executable::increment_action_idx(executable);

    let cap = account::borrow_managed_asset<String, FeeAdminCap>(
        account,
        registry, b"protocol:fee_admin_cap".to_string(),
        version
    );

    fee::update_proposal_creation_fee(
        fee_manager,
        cap,
        action.new_fee_per_outcome,
        clock,
        ctx
    );
}

/// Execute update verification fee action
public fun do_update_verification_fee<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<UpdateVerificationFee>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let level = bcs::peel_u8(&mut bcs);
    let new_fee = bcs::peel_u64(&mut bcs);
    let action = UpdateVerificationFeeAction { level, new_fee };

    // Increment action index
    executable::increment_action_idx(executable);
    
    let cap = account::borrow_managed_asset<String, FeeAdminCap>(
        account,
        registry, b"protocol:fee_admin_cap".to_string(),
        version
    );
    
    fee::update_verification_fee(
        fee_manager,
        cap,
        action.level,
        action.new_fee,
        clock,
        ctx
    );
}

/// Execute add verification level action
public fun do_add_verification_level<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<AddVerificationLevel>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let level = bcs::peel_u8(&mut bcs);
    let fee = bcs::peel_u64(&mut bcs);
    let action = AddVerificationLevelAction { level, fee };

    // Increment action index
    executable::increment_action_idx(executable);
    
    let cap = account::borrow_managed_asset<String, FeeAdminCap>(
        account,
        registry, b"protocol:fee_admin_cap".to_string(),
        version
    );
    
    fee::add_verification_level(fee_manager, cap, action.level, action.fee, clock, ctx);
}

/// Execute remove verification level action
public fun do_remove_verification_level<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<RemoveVerificationLevel>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let level = bcs::peel_u8(&mut bcs);
    let action = RemoveVerificationLevelAction { level };

    // Increment action index
    executable::increment_action_idx(executable);

    let cap = account::borrow_managed_asset<String, FeeAdminCap>(
        account,
        registry, b"protocol:fee_admin_cap".to_string(),
        version
    );

    fee::remove_verification_level(fee_manager, cap, action.level, clock, ctx);
}

/// Execute withdraw fees to treasury action
public fun do_withdraw_fees_to_treasury<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<WithdrawFeesToTreasury>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let amount = bcs::peel_u64(&mut bcs);
    let action = WithdrawFeesToTreasuryAction { amount };

    // Increment action index
    executable::increment_action_idx(executable);
    
    let cap = account::borrow_managed_asset<String, FeeAdminCap>(
        account,
        registry, b"protocol:fee_admin_cap".to_string(),
        version
    );
    
    // Withdraw all fees from the fee manager
    fee::withdraw_all_fees(fee_manager, cap, clock, ctx);
    // Note: The withdraw_all_fees function transfers directly to sender
    // In a proper implementation, we would need a function that returns the coin
    // for deposit into the DAO treasury
}

// Coin-specific fee execution functions

/// Execute action to add a coin fee configuration
public fun do_add_coin_fee_config<Outcome: store, IW: drop, StableType>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<AddCoinFeeConfig>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let decimals = bcs::peel_u8(&mut bcs);
    let dao_creation_fee = bcs::peel_u64(&mut bcs);
    let proposal_fee_per_outcome = bcs::peel_u64(&mut bcs);
    let action = AddCoinFeeConfigAction {
        coin_type: type_name::get<StableType>(),
        decimals,
        dao_creation_fee,
        proposal_fee_per_outcome,
    };

    // Increment action index
    executable::increment_action_idx(executable);

    let cap = account::borrow_managed_asset<String, FeeAdminCap>(
        account,
        registry, b"protocol:fee_admin_cap".to_string(),
        version
    );

    fee::add_coin_fee_config(
        fee_manager,
        cap,
        action.coin_type,
        action.decimals,
        action.dao_creation_fee,
        action.proposal_fee_per_outcome,
        clock,
        ctx
    );
}

/// Execute action to update coin creation fee
public fun do_update_coin_creation_fee<Outcome: store, IW: drop, StableType>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<UpdateCoinCreationFee>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let new_fee = bcs::peel_u64(&mut bcs);
    let action = UpdateCoinCreationFeeAction { coin_type: type_name::get<StableType>(), new_fee };

    // Increment action index
    executable::increment_action_idx(executable);
    
    let cap = account::borrow_managed_asset<String, FeeAdminCap>(
        account,
        registry, b"protocol:fee_admin_cap".to_string(),
        version
    );
    
    fee::update_coin_creation_fee(
        fee_manager,
        cap,
        action.coin_type,
        action.new_fee,
        clock,
        ctx
    );
}

/// Execute action to update coin proposal fee
public fun do_update_coin_proposal_fee<Outcome: store, IW: drop, StableType>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<UpdateCoinProposalFee>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    let new_fee_per_outcome = bcs::peel_u64(&mut bcs);
    let action = UpdateCoinProposalFeeAction { coin_type: type_name::get<StableType>(), new_fee_per_outcome };

    // Increment action index
    executable::increment_action_idx(executable);
    
    let cap = account::borrow_managed_asset<String, FeeAdminCap>(
        account,
        registry, b"protocol:fee_admin_cap".to_string(),
        version
    );
    
    fee::update_coin_proposal_fee(
        fee_manager,
        cap,
        action.coin_type,
        action.new_fee_per_outcome,
        clock,
        ctx
    );
}

/// Action to apply pending coin fee configuration after delay
public struct ApplyPendingCoinFeesAction has store, drop {
    coin_type: TypeName,
}

/// Execute action to apply pending coin fees after delay
public fun do_apply_pending_coin_fees<Outcome: store, IW: drop, StableType>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    witness: IW,
    fee_manager: &mut FeeManager,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get spec and validate type BEFORE deserialization
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<ApplyPendingCoinFees>(spec);

    // Deserialize the action data
    let action_data = intents::action_spec_data(spec);
    let mut bcs = bcs::new(*action_data);
    // This action has no parameters
    let action = ApplyPendingCoinFeesAction { coin_type: type_name::get<StableType>() };

    // Increment action index
    executable::increment_action_idx(executable);
    let _ = account;
    let _ = version;
    let _ = ctx;
    
    // No admin cap needed - anyone can apply pending fees after delay
    fee::apply_pending_coin_fees(
        fee_manager,
        action.coin_type,
        clock
    );
}

// === Garbage Collection ===

/// Delete protocol admin action from expired intent
public fun delete_protocol_admin_action(expired: &mut account_protocol::intents::Expired) {
    let action_spec = account_protocol::intents::remove_action_spec(expired);
    let _ = action_spec;
}