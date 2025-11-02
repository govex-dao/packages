// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init wrappers for liquidity actions during DAO creation
///
/// This module provides public functions for creating AMM pools during init.
/// These functions work with unshared Account objects before DAO is shared.
module futarchy_actions::liquidity_init_actions;

use account_actions::vault;
use account_actions::init_actions;
use account_protocol::account::Account;
use account_protocol::package_registry::PackageRegistry;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_operations::lp_token_custody;
use std::string::{Self, String};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::object::{Self, ID};
use sui::tx_context::TxContext;

// === Constants ===
const DEFAULT_VAULT_NAME: vector<u8> = b"treasury";

// === Errors ===
const EInvalidAmount: u64 = 1;
const EInvalidRatio: u64 = 2;

// === Action Structs (for staging/dispatching) ===

/// Action to create AMM pool with minted asset and vault stable
/// Stored directly as typed object (no BCS serialization needed!)
public struct CreatePoolWithMintAction has store, copy, drop {
    vault_name: String,
    asset_amount: u64,
    stable_amount: u64,
    fee_bps: u64,
}

// === Spec Builders (for staging in InitActionSpecs) ===

/// Add CreatePoolWithMintAction to InitActionSpecs
/// Used for staging actions in launchpad raises
public fun add_create_pool_with_mint_spec(
    specs: &mut account_actions::init_action_specs::InitActionSpecs,
    vault_name: String,
    asset_amount: u64,
    stable_amount: u64,
    fee_bps: u64,
) {
    use std::type_name;
    use sui::bcs;

    // Create action struct
    let action = CreatePoolWithMintAction {
        vault_name,
        asset_amount,
        stable_amount,
        fee_bps,
    };

    // Serialize
    let action_data = bcs::to_bytes(&action);

    // Add to specs with type marker
    account_actions::init_action_specs::add_action(
        specs,
        type_name::get<CreatePoolWithMintAction>(),
        action_data
    );
}

// === Dispatchers ===

/// Execute init_create_pool_with_mint from a staged action
/// Accepts typed action directly (zero deserialization cost!)
public fun dispatch_create_pool_with_mint<Config: store, AssetType: drop, StableType: drop, W: copy + drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    action: &CreatePoolWithMintAction,
    witness: W,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    // Execute with the exact parameters from the staged action
    init_create_pool_with_mint<Config, AssetType, StableType, W>(
        account,
        registry,
        action.vault_name,
        action.asset_amount,
        action.stable_amount,
        action.fee_bps,
        witness,
        clock,
        ctx,
    )
}

// === Init Actions ===

/// Create AMM pool during DAO init (before account is shared)
///
/// This function:
/// 1. Creates a new UnifiedSpotPool
/// 2. Adds initial liquidity
/// 3. Shares the pool (makes it public)
/// 4. Deposits LP token to custody AUTOMATICALLY
/// 5. Returns excess coins to treasury vault
///
/// Returns: pool_id for use in subsequent init actions
public fun init_create_pool<Config: store, AssetType: drop, StableType: drop, W: copy + drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    asset_coin: Coin<AssetType>,
    stable_coin: Coin<StableType>,
    fee_bps: u64,
    witness: W,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    // Validate inputs
    assert!(coin::value(&asset_coin) > 0, EInvalidAmount);
    assert!(coin::value(&stable_coin) > 0, EInvalidAmount);
    assert!(fee_bps <= 10000, EInvalidRatio); // Max 100%

    // 1. Create pool
    let mut pool = unified_spot_pool::new<AssetType, StableType>(
        fee_bps,
        option::none(), // No minimum liquidity requirement for init
        clock,
        ctx
    );

    // 2. Add initial liquidity (returns LP token + any excess coins)
    let (lp_token, excess_asset, excess_stable) =
        unified_spot_pool::add_liquidity_and_return(
            &mut pool,
            asset_coin,
            stable_coin,
            0, // min_lp_out = 0 for initial liquidity (no slippage)
            ctx
        );

    // Get pool ID before sharing
    let pool_id = object::id(&pool);

    // 3. Share the pool so it can be accessed by anyone
    unified_spot_pool::share(pool);

    // 4. Deposit LP token to custody (AUTOMATIC STORAGE!)
    lp_token_custody::deposit_lp_token(
        account,
        registry,
        pool_id,
        lp_token,
        witness,
        ctx
    );

    // 5. Return any excess coins to treasury vault
    let vault_name = string::utf8(DEFAULT_VAULT_NAME);

    if (coin::value(&excess_asset) > 0) {
        vault::deposit_approved<Config, AssetType>(
            account,
            registry,
            vault_name,
            excess_asset,
        );
    } else {
        coin::destroy_zero(excess_asset);
    };

    if (coin::value(&excess_stable) > 0) {
        vault::deposit_approved<Config, StableType>(
            account,
            registry,
            vault_name,
            excess_stable,
        );
    } else {
        coin::destroy_zero(excess_stable);
    };

    pool_id
}

/// Create AMM pool during DAO init with minted asset and stable from vault
///
/// This function:
/// 1. Mints new asset tokens using the DAO's treasury cap
/// 2. Withdraws stable coins from the DAO's vault (raised from launchpad)
/// 3. Creates a new UnifiedSpotPool
/// 4. Adds initial liquidity
/// 5. Shares the pool (makes it public)
/// 6. Deposits LP token to custody AUTOMATICALLY (DAO-owned LP!)
/// 7. Returns excess coins to treasury vault
///
/// Returns: pool_id for use in subsequent init actions
public fun init_create_pool_with_mint<Config: store, AssetType: drop, StableType: drop, W: copy + drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    vault_name: string::String,
    asset_amount: u64,
    stable_amount: u64,
    fee_bps: u64,
    witness: W,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    // Validate inputs
    assert!(asset_amount > 0, EInvalidAmount);
    assert!(stable_amount > 0, EInvalidAmount);
    assert!(fee_bps <= 10000, EInvalidRatio); // Max 100%

    // 1. Mint asset tokens from DAO treasury cap
    let asset_coin = account_actions::init_actions::init_mint_to_coin<Config, AssetType>(
        account,
        registry,
        asset_amount,
        ctx
    );

    // 2. Withdraw stable coins from DAO vault (raised funds from launchpad)
    let stable_coin = account_actions::init_actions::init_vault_spend<Config, StableType>(
        account,
        registry,
        vault_name,
        stable_amount,
        ctx
    );

    // 3. Create pool
    let mut pool = unified_spot_pool::new<AssetType, StableType>(
        fee_bps,
        option::none(), // No minimum liquidity requirement for init
        clock,
        ctx
    );

    // 4. Add initial liquidity (returns LP token + any excess coins)
    let (lp_token, excess_asset, excess_stable) =
        unified_spot_pool::add_liquidity_and_return(
            &mut pool,
            asset_coin,
            stable_coin,
            0, // min_lp_out = 0 for initial liquidity (no slippage)
            ctx
        );

    // Get pool ID before sharing
    let pool_id = object::id(&pool);

    // 5. Share the pool so it can be accessed by anyone
    unified_spot_pool::share(pool);

    // 6. Deposit LP token to custody (DAO OWNS THE LP!)
    lp_token_custody::deposit_lp_token(
        account,
        registry,
        pool_id,
        lp_token,
        witness,
        ctx
    );

    // 7. Return any excess coins to treasury vault
    if (coin::value(&excess_asset) > 0) {
        vault::deposit_approved<Config, AssetType>(
            account,
            registry,
            vault_name,
            excess_asset,
        );
    } else {
        coin::destroy_zero(excess_asset);
    };

    if (coin::value(&excess_stable) > 0) {
        vault::deposit_approved<Config, StableType>(
            account,
            registry,
            vault_name,
            excess_stable,
        );
    } else {
        coin::destroy_zero(excess_stable);
    };

    pool_id
}

/// Add liquidity to an existing pool during DAO init
///
/// Similar to init_create_pool but for adding to existing pools.
/// LP token is automatically deposited to custody.
public fun init_add_liquidity<Config: store, AssetType: drop, StableType: drop, W: copy + drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    pool: &mut UnifiedSpotPool<AssetType, StableType>,
    asset_coin: Coin<AssetType>,
    stable_coin: Coin<StableType>,
    min_lp_out: u64,
    witness: W,
    ctx: &mut TxContext,
) {
    // Validate inputs
    assert!(coin::value(&asset_coin) > 0, EInvalidAmount);
    assert!(coin::value(&stable_coin) > 0, EInvalidAmount);

    let pool_id = object::id(pool);

    // Add liquidity (returns LP token + excess coins)
    let (lp_token, excess_asset, excess_stable) =
        unified_spot_pool::add_liquidity_and_return(
            pool,
            asset_coin,
            stable_coin,
            min_lp_out,
            ctx
        );

    // Deposit LP token to custody
    lp_token_custody::deposit_lp_token(
        account,
        registry,
        pool_id,
        lp_token,
        witness,
        ctx
    );

    // Return excess to vault
    let vault_name = string::utf8(DEFAULT_VAULT_NAME);

    if (coin::value(&excess_asset) > 0) {
        vault::deposit_approved<Config, AssetType>(
            account,
            registry,
            vault_name,
            excess_asset,
        );
    } else {
        coin::destroy_zero(excess_asset);
    };

    if (coin::value(&excess_stable) > 0) {
        vault::deposit_approved<Config, StableType>(
            account,
            registry,
            vault_name,
            excess_stable,
        );
    } else {
        coin::destroy_zero(excess_stable);
    };
}
