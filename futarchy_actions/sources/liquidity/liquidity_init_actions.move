// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init wrappers for liquidity actions during DAO creation
///
/// This module provides public functions for creating AMM pools during init.
/// These functions work with unshared Account objects before DAO is shared.
module futarchy_actions::liquidity_init_actions;

use account_actions::{vault, init_actions, version};
use account_protocol::{
    account::{Self as account_mod, Account},
    package_registry::PackageRegistry,
    executable::{Self as executable_mod, Executable},
    intents,
    version_witness::VersionWitness,
    bcs_validation,
    action_validation,
};
use futarchy_core::futarchy_config;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use std::option;
use std::string::{Self, String};
use sui::bcs;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::object::{Self, ID};
use sui::tx_context::TxContext;

// === Constants ===
const DEFAULT_VAULT_NAME: vector<u8> = b"treasury";

// === Errors ===
const EInvalidAmount: u64 = 1;
const EInvalidRatio: u64 = 2;
const EUnsupportedActionVersion: u64 = 3;

// === Marker Types (for action validation) ===

/// Marker type for CreatePoolWithMintAction validation
public struct CreatePoolWithMint has drop {}

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

    // CRITICAL: Use marker type (not action struct type) for validation
    account_actions::init_action_specs::add_action(
        specs,
        type_name::with_defining_ids<CreatePoolWithMint>(),
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

// === Intent Execution (for PTB executor pattern) ===

/// Execute pool creation from Intent during launchpad initialization
/// Follows 3-layer action execution pattern (see IMPORTANT_ACTION_EXECUTION_PATTERN.md)
///
/// This function is called from PTB executor after begin_execution:
/// 1. begin_execution() creates Executable hot potato
/// 2. PTB calls do_init_* functions in sequence (including this one)
/// 3. finalize_execution() confirms the executable
public fun do_init_create_pool_with_mint<Config: store, Outcome: store, AssetType: drop, StableType: drop, IW: copy + drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    clock: &Clock,
    _version_witness: VersionWitness,
    _intent_witness: IW,
    ctx: &mut TxContext,
): ID {
    // 1. Assert account ownership
    executable.intent().assert_is_account(account.addr());

    // 2. Get current ActionSpec from Executable
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // 3. CRITICAL: Validate action type (using marker type)
    action_validation::assert_action_type<CreatePoolWithMint>(spec);

    // 4. Check version
    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // 5. Deserialize CreatePoolWithMintAction from BCS bytes
    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);
    let vault_name = string::utf8(bcs::peel_vec_u8(&mut reader));
    let asset_amount = bcs::peel_u64(&mut reader);
    let stable_amount = bcs::peel_u64(&mut reader);
    let fee_bps = bcs::peel_u64(&mut reader);

    // 6. Validate all bytes consumed (security check)
    bcs_validation::validate_all_bytes_consumed(reader);

    // 7. Execute with deserialized params
    let pool_id = init_create_pool_with_mint<Config, AssetType, StableType, IW>(
        account,
        registry,
        vault_name,
        asset_amount,
        stable_amount,
        fee_bps,
        _intent_witness,
        clock,
        ctx,
    );

    // 8. Increment action index
    executable_mod::increment_action_idx(executable);

    pool_id
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

    // 1. Get DAO config to read conditional_liquidity_ratio_percent
    let config = account_mod::config(account);
    let conditional_liquidity_ratio_percent = futarchy_config::conditional_liquidity_ratio_percent(config);

    // 2. Create pool with FULL FUTARCHY FEATURES
    let mut pool = unified_spot_pool::new<AssetType, StableType>(
        fee_bps,
        option::none(), // No dynamic fee schedule
        5000, // oracle_conditional_threshold_bps (50%)
        conditional_liquidity_ratio_percent, // From DAO config!
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

    // 4. Store LP token in account as managed asset (AUTOMATIC STORAGE!)
    let token_id = object::id(&lp_token);
    account_mod::add_managed_asset(
        account,
        registry,
        token_id, // Use token_id directly as key
        lp_token,
        version::current(),
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

    // 3. Get DAO config to read conditional_liquidity_ratio_percent
    let config = account_mod::config(account);
    let conditional_liquidity_ratio_percent = futarchy_config::conditional_liquidity_ratio_percent(config);

    // 4. Create pool with FULL FUTARCHY FEATURES
    let mut pool = unified_spot_pool::new<AssetType, StableType>(
        fee_bps,
        option::none(), // No dynamic fee schedule
        5000, // oracle_conditional_threshold_bps (50%)
        conditional_liquidity_ratio_percent, // From DAO config!
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

    // 6. Store LP token in account as managed asset (DAO OWNS THE LP!)
    let token_id = object::id(&lp_token);
    account_mod::add_managed_asset(
        account,
        registry,
        token_id, // Use token_id directly as key
        lp_token,
        version::current(),
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

    // Store LP token in account as managed asset
    let token_id = object::id(&lp_token);
    account_mod::add_managed_asset(
        account,
        registry,
        token_id, // Use token_id directly as key
        lp_token,
        version::current(),
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
