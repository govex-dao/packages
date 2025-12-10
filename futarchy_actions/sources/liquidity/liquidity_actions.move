// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Liquidity-related actions for futarchy DAOs
///
/// LP tokens are now standard Sui Coins stored in vault.
/// No more lp_token_custody - just vault deposits/withdrawals.
module futarchy_actions::liquidity_actions;

// === Imports ===
use std::string::{Self, String};
use sui::{
    coin::{Self, Coin},
    object::{Self, ID},
    clock::Clock,
    bcs,
};
use account_protocol::{
    account::{Self, Account},
    executable::{Self, Executable},
    executable_resources,
    intents::{Self, Expired},
    version_witness::VersionWitness,
    bcs_validation,
    action_validation,
    package_registry::PackageRegistry,
};
use account_actions::vault;
use futarchy_core::futarchy_config::FutarchyConfig;
use futarchy_core::resource_requests::{Self, ResourceRequest, ResourceReceipt};
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};

// === Action Type Markers ===

public struct AddLiquidity has drop {}
public struct RemoveLiquidity has drop {}
public struct Swap has drop {}

// === Marker Functions ===

public fun add_liquidity_marker(): AddLiquidity { AddLiquidity {} }
public fun remove_liquidity_marker(): RemoveLiquidity { RemoveLiquidity {} }
public fun swap_marker(): Swap { Swap {} }

// === Errors ===
const EInvalidAmount: u64 = 1;
const EPoolMismatch: u64 = 4;
const EInsufficientVaultBalance: u64 = 5;
const EUnsupportedActionVersion: u64 = 8;
const EEmptyResourceName: u64 = 9;

// === Constants ===
const DEFAULT_VAULT_NAME: vector<u8> = b"treasury";

// === Action Structs ===

/// Action to add liquidity to a pool
/// Uses composable pattern: takes coins from executable_resources (put there by VaultSpend actions)
public struct AddLiquidityAction<phantom AssetType, phantom StableType, phantom LPType> has store, drop, copy {
    pool_id: ID,
    asset_amount: u64,
    stable_amount: u64,
    min_lp_out: u64,
    /// Resource name for asset coin in executable_resources (from prior VaultSpend)
    asset_resource_name: String,
    /// Resource name for stable coin in executable_resources (from prior VaultSpend)
    stable_resource_name: String,
}

/// Action to remove liquidity from a pool
/// Uses composable pattern: takes LP coin from executable_resources (put there by VaultSpend action)
public struct RemoveLiquidityAction<phantom AssetType, phantom StableType, phantom LPType> has store, drop, copy {
    pool_id: ID,
    lp_amount: u64,
    min_asset_amount: u64,
    min_stable_amount: u64,
    /// Resource name for LP coin in executable_resources (from prior VaultSpend)
    lp_resource_name: String,
}

/// Action to perform a swap in the pool
/// Uses composable pattern: takes input coin from executable_resources (put there by VaultSpend action)
public struct SwapAction<phantom AssetType, phantom StableType, phantom LPType> has store, drop, copy {
    pool_id: ID,
    swap_asset: bool, // true = swap asset for stable, false = swap stable for asset
    amount_in: u64,
    min_amount_out: u64,
    /// Resource name for input coin in executable_resources (from prior VaultSpend)
    input_resource_name: String,
}

// === Execution Functions ===

/// Execute add liquidity with type validation
public fun do_add_liquidity<AssetType: drop, StableType: drop, LPType: drop, Outcome: store>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    _version: VersionWitness,
    ctx: &mut TxContext,
): ResourceRequest<AddLiquidityAction<AssetType, StableType, LPType>> {
    executable::intent(executable).assert_is_account(account.addr());

    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<AddLiquidity>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);

    let mut reader = bcs::new(*action_data);
    let pool_id = object::id_from_address(bcs::peel_address(&mut reader));
    let asset_amount = bcs::peel_u64(&mut reader);
    let stable_amount = bcs::peel_u64(&mut reader);
    let min_lp_out = bcs::peel_u64(&mut reader);
    let asset_resource_name = string::utf8(bcs::peel_vec_u8(&mut reader));
    let stable_resource_name = string::utf8(bcs::peel_vec_u8(&mut reader));
    bcs_validation::validate_all_bytes_consumed(reader);

    // Note: Vault balance checks removed - coins are now provided via executable_resources
    // from prior VaultSpend actions which already validated and withdrew from vault

    let action = AddLiquidityAction<AssetType, StableType, LPType> {
        pool_id,
        asset_amount,
        stable_amount,
        min_lp_out,
        asset_resource_name,
        stable_resource_name,
    };

    executable::increment_action_idx(executable);

    let mut request = resource_requests::new_request<AddLiquidityAction<AssetType, StableType, LPType>>(ctx);
    resource_requests::add_context(&mut request, string::utf8(b"account_id"), object::id(account));
    request
}

/// Fulfill add liquidity request
/// Takes coins from executable_resources (put there by prior VaultSpend actions)
/// LP coin is deposited directly to vault
public fun fulfill_add_liquidity<AssetType: drop, StableType: drop, LPType: drop, Outcome: store>(
    request: ResourceRequest<AddLiquidityAction<AssetType, StableType, LPType>>,
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    ctx: &mut TxContext,
): ResourceReceipt<AddLiquidityAction<AssetType, StableType, LPType>> {
    let action: AddLiquidityAction<AssetType, StableType, LPType> =
        resource_requests::extract_action(request);

    assert!(action.pool_id == object::id(pool), EPoolMismatch);

    // Take coins from executable_resources (put there by prior VaultSpend actions)
    let asset_coin: Coin<AssetType> = executable_resources::take_object(
        executable::uid_mut(executable),
        action.asset_resource_name,
    );

    let stable_coin: Coin<StableType> = executable_resources::take_object(
        executable::uid_mut(executable),
        action.stable_resource_name,
    );

    // Add liquidity to pool
    let (lp_coin, excess_asset, excess_stable) = unified_spot_pool::add_liquidity(
        pool,
        asset_coin,
        stable_coin,
        action.min_lp_out,
        ctx,
    );

    // Deposit LP coin to vault
    let vault_name = string::utf8(DEFAULT_VAULT_NAME);
    vault::deposit_approved<FutarchyConfig, LPType>(
        account,
        registry,
        vault_name,
        lp_coin,
    );

    // Return excess coins to vault
    if (coin::value(&excess_asset) > 0) {
        vault::deposit_approved<FutarchyConfig, AssetType>(
            account,
            registry,
            vault_name,
            excess_asset,
        );
    } else {
        coin::destroy_zero(excess_asset);
    };

    if (coin::value(&excess_stable) > 0) {
        vault::deposit_approved<FutarchyConfig, StableType>(
            account,
            registry,
            vault_name,
            excess_stable,
        );
    } else {
        coin::destroy_zero(excess_stable);
    };

    resource_requests::create_receipt(action)
}

/// Execute remove liquidity with type validation
public fun do_remove_liquidity<AssetType: drop, StableType: drop, LPType: drop, Outcome: store>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    _version: VersionWitness,
    ctx: &mut TxContext,
): ResourceRequest<RemoveLiquidityAction<AssetType, StableType, LPType>> {
    executable::intent(executable).assert_is_account(account.addr());

    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<RemoveLiquidity>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);

    let mut reader = bcs::new(*action_data);
    let pool_id = object::id_from_address(bcs::peel_address(&mut reader));
    let lp_amount = bcs::peel_u64(&mut reader);
    let min_asset_amount = bcs::peel_u64(&mut reader);
    let min_stable_amount = bcs::peel_u64(&mut reader);
    let lp_resource_name = string::utf8(bcs::peel_vec_u8(&mut reader));
    bcs_validation::validate_all_bytes_consumed(reader);

    assert!(lp_amount > 0, EInvalidAmount);

    let action = RemoveLiquidityAction<AssetType, StableType, LPType> {
        pool_id,
        lp_amount,
        min_asset_amount,
        min_stable_amount,
        lp_resource_name,
    };

    executable::increment_action_idx(executable);

    resource_requests::new_resource_request(action, ctx)
}

/// Fulfill remove liquidity request
/// Takes LP coin from executable_resources (put there by prior VaultSpend action)
/// Burns LP, deposits returned coins to vault
public fun fulfill_remove_liquidity<AssetType: drop, StableType: drop, LPType: drop, Outcome: store>(
    request: ResourceRequest<RemoveLiquidityAction<AssetType, StableType, LPType>>,
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    ctx: &mut TxContext,
): ResourceReceipt<RemoveLiquidityAction<AssetType, StableType, LPType>> {
    let action: RemoveLiquidityAction<AssetType, StableType, LPType> =
        resource_requests::extract_action(request);

    assert!(action.pool_id == object::id(pool), EPoolMismatch);

    // Take LP coin from executable_resources (put there by prior VaultSpend action)
    let lp_coin: Coin<LPType> = executable_resources::take_object(
        executable::uid_mut(executable),
        action.lp_resource_name,
    );

    // Remove liquidity from pool (burns LP coin)
    let (asset_coin, stable_coin) = unified_spot_pool::remove_liquidity(
        pool,
        lp_coin,
        action.min_asset_amount,
        action.min_stable_amount,
        ctx,
    );

    // Deposit returned coins to vault
    let vault_name = string::utf8(DEFAULT_VAULT_NAME);
    vault::deposit_approved<FutarchyConfig, AssetType>(
        account,
        registry,
        vault_name,
        asset_coin,
    );
    vault::deposit_approved<FutarchyConfig, StableType>(
        account,
        registry,
        vault_name,
        stable_coin,
    );

    resource_requests::create_receipt(action)
}

/// Execute a swap action
public fun do_swap<AssetType: drop, StableType: drop, LPType: drop, Outcome: store>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    _version: VersionWitness,
    ctx: &mut TxContext,
): ResourceRequest<SwapAction<AssetType, StableType, LPType>> {
    executable::intent(executable).assert_is_account(account.addr());

    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    action_validation::assert_action_type<Swap>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);

    let mut reader = bcs::new(*action_data);
    let pool_id = object::id_from_address(bcs::peel_address(&mut reader));
    let swap_asset = bcs::peel_bool(&mut reader);
    let amount_in = bcs::peel_u64(&mut reader);
    let min_amount_out = bcs::peel_u64(&mut reader);
    let input_resource_name = string::utf8(bcs::peel_vec_u8(&mut reader));
    bcs_validation::validate_all_bytes_consumed(reader);

    assert!(amount_in > 0, EInvalidAmount);

    let action = SwapAction<AssetType, StableType, LPType> {
        pool_id,
        swap_asset,
        amount_in,
        min_amount_out,
        input_resource_name,
    };

    executable::increment_action_idx(executable);

    let mut request = resource_requests::new_request<SwapAction<AssetType, StableType, LPType>>(ctx);
    resource_requests::add_context(&mut request, string::utf8(b"pool_id"), pool_id);
    request
}

/// Fulfill swap request
/// Takes input coin from executable_resources (put there by prior VaultSpend action)
public fun fulfill_swap<AssetType: drop, StableType: drop, LPType: drop, Outcome: store>(
    request: ResourceRequest<SwapAction<AssetType, StableType, LPType>>,
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
    ctx: &mut TxContext,
): ResourceReceipt<SwapAction<AssetType, StableType, LPType>> {
    let action: SwapAction<AssetType, StableType, LPType> =
        resource_requests::extract_action(request);

    assert!(action.pool_id == object::id(pool), EPoolMismatch);

    let vault_name = string::utf8(DEFAULT_VAULT_NAME);

    if (action.swap_asset) {
        // Swap asset for stable
        // Take asset coin from executable_resources (put there by prior VaultSpend action)
        let asset_coin: Coin<AssetType> = executable_resources::take_object(
            executable::uid_mut(executable),
            action.input_resource_name,
        );

        let stable_coin = unified_spot_pool::swap_asset_for_stable(
            pool,
            asset_coin,
            action.min_amount_out,
            clock,
            ctx,
        );

        vault::deposit_approved<FutarchyConfig, StableType>(
            account,
            registry,
            vault_name,
            stable_coin,
        );
    } else {
        // Swap stable for asset
        // Take stable coin from executable_resources (put there by prior VaultSpend action)
        let stable_coin: Coin<StableType> = executable_resources::take_object(
            executable::uid_mut(executable),
            action.input_resource_name,
        );

        let asset_coin = unified_spot_pool::swap_stable_for_asset(
            pool,
            stable_coin,
            action.min_amount_out,
            clock,
            ctx,
        );

        vault::deposit_approved<FutarchyConfig, AssetType>(
            account,
            registry,
            vault_name,
            asset_coin,
        );
    };

    resource_requests::create_receipt(action)
}

// === Cleanup Functions ===

public fun delete_add_liquidity<AssetType, StableType, LPType>(expired: &mut Expired) {
    let _action_spec = intents::remove_action_spec(expired);
}

public fun delete_remove_liquidity<AssetType, StableType, LPType>(expired: &mut Expired) {
    let _action_spec = intents::remove_action_spec(expired);
}

public fun delete_swap<AssetType, StableType, LPType>(expired: &mut Expired) {
    let _action_spec = intents::remove_action_spec(expired);
}

// === Constructor Functions ===

public fun new_add_liquidity_action<AssetType, StableType, LPType>(
    pool_id: ID,
    asset_amount: u64,
    stable_amount: u64,
    min_lp_out: u64,
    asset_resource_name: String,
    stable_resource_name: String,
): AddLiquidityAction<AssetType, StableType, LPType> {
    assert!(asset_amount > 0, EInvalidAmount);
    assert!(stable_amount > 0, EInvalidAmount);
    assert!(asset_resource_name.length() > 0, EEmptyResourceName);
    assert!(stable_resource_name.length() > 0, EEmptyResourceName);

    AddLiquidityAction {
        pool_id,
        asset_amount,
        stable_amount,
        min_lp_out,
        asset_resource_name,
        stable_resource_name,
    }
}

public fun new_remove_liquidity_action<AssetType, StableType, LPType>(
    pool_id: ID,
    lp_amount: u64,
    min_asset_amount: u64,
    min_stable_amount: u64,
    lp_resource_name: String,
): RemoveLiquidityAction<AssetType, StableType, LPType> {
    assert!(lp_amount > 0, EInvalidAmount);
    assert!(lp_resource_name.length() > 0, EEmptyResourceName);

    RemoveLiquidityAction {
        pool_id,
        lp_amount,
        min_asset_amount,
        min_stable_amount,
        lp_resource_name,
    }
}

public fun new_swap_action<AssetType, StableType, LPType>(
    pool_id: ID,
    swap_asset: bool,
    amount_in: u64,
    min_amount_out: u64,
    input_resource_name: String,
): SwapAction<AssetType, StableType, LPType> {
    assert!(amount_in > 0, EInvalidAmount);
    assert!(input_resource_name.length() > 0, EEmptyResourceName);

    SwapAction {
        pool_id,
        swap_asset,
        amount_in,
        min_amount_out,
        input_resource_name,
    }
}

// === Getter Functions ===

public fun get_pool_id<AssetType, StableType, LPType>(
    action: &AddLiquidityAction<AssetType, StableType, LPType>
): ID {
    action.pool_id
}

public fun get_asset_amount<AssetType, StableType, LPType>(
    action: &AddLiquidityAction<AssetType, StableType, LPType>
): u64 {
    action.asset_amount
}

public fun get_stable_amount<AssetType, StableType, LPType>(
    action: &AddLiquidityAction<AssetType, StableType, LPType>
): u64 {
    action.stable_amount
}

public fun get_min_lp_amount<AssetType, StableType, LPType>(
    action: &AddLiquidityAction<AssetType, StableType, LPType>
): u64 {
    action.min_lp_out
}
