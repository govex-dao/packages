// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init wrappers for liquidity actions during DAO creation
///
/// This module provides public functions for creating AMM pools during init.
/// These functions work with unshared Account objects before DAO is shared.
///
/// LP tokens are now standard Sui Coins. Pool creation requires:
/// - TreasuryCap<LPType> with zero supply
/// - CoinMetadata<LPType> with name/symbol = "GOVEX_LP_TOKEN"
module futarchy_actions::liquidity_init_actions;

use account_actions::{vault, version, init_actions};
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
use std::string::{Self, String};
use sui::bcs;
use sui::clock::Clock;
use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};

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

// === Spec Builders (for PTB construction) ===

/// Add CreatePoolWithMintAction to Builder
/// Used for staging actions in launchpad raises via PTB
public fun add_create_pool_with_mint_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    vault_name: String,
    asset_amount: u64,
    stable_amount: u64,
    fee_bps: u64,
) {
    use account_actions::action_spec_builder;
    use std::type_name;

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
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<CreatePoolWithMint>(),
        action_data,
        1  // version
    );
    action_spec_builder::add(builder, action_spec);
}

// === Dispatchers ===

/// Execute init_create_pool_with_mint from a staged action
/// Accepts typed action directly (zero deserialization cost!)
public fun dispatch_create_pool_with_mint<Config: store, AssetType: drop, StableType: drop, LPType: drop, W: copy + drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    action: &CreatePoolWithMintAction,
    lp_treasury_cap: TreasuryCap<LPType>,
    lp_metadata: &CoinMetadata<LPType>,
    witness: W,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    // Execute with the exact parameters from the staged action
    init_create_pool_with_mint<Config, AssetType, StableType, LPType, W>(
        account,
        registry,
        action.vault_name,
        action.asset_amount,
        action.stable_amount,
        action.fee_bps,
        lp_treasury_cap,
        lp_metadata,
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
public fun do_init_create_pool_with_mint<Config: store, Outcome: store, AssetType: drop, StableType: drop, LPType: drop, IW: copy + drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    lp_treasury_cap: TreasuryCap<LPType>,
    lp_metadata: &CoinMetadata<LPType>,
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
    let pool_id = init_create_pool_with_mint<Config, AssetType, StableType, LPType, IW>(
        account,
        registry,
        vault_name,
        asset_amount,
        stable_amount,
        fee_bps,
        lp_treasury_cap,
        lp_metadata,
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
/// 1. Creates a new UnifiedSpotPool with Coin-based LP tokens
/// 2. Adds initial liquidity
/// 3. Shares the pool (makes it public)
/// 4. Deposits LP coin to vault AUTOMATICALLY
/// 5. Returns excess coins to treasury vault
///
/// Requires:
/// - TreasuryCap<LPType> with zero supply
/// - CoinMetadata<LPType> with name/symbol = "GOVEX_LP_TOKEN"
///
/// Returns: pool_id for use in subsequent init actions
public fun init_create_pool<Config: store, AssetType: drop, StableType: drop, LPType: drop, W: copy + drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    asset_coin: Coin<AssetType>,
    stable_coin: Coin<StableType>,
    lp_treasury_cap: TreasuryCap<LPType>,
    lp_metadata: &CoinMetadata<LPType>,
    fee_bps: u64,
    _witness: W,
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

    // 2. Create pool with FULL FUTARCHY FEATURES + Coin-based LP
    // Pool validates LP coin metadata (name/symbol = "GOVEX_LP_TOKEN", supply = 0)
    let mut pool = unified_spot_pool::new<AssetType, StableType, LPType>(
        lp_treasury_cap,
        lp_metadata,
        fee_bps,
        option::none(), // No dynamic fee schedule
        5000, // oracle_conditional_threshold_bps (50%)
        conditional_liquidity_ratio_percent, // From DAO config!
        clock,
        ctx
    );

    // 3. Add initial liquidity (returns LP coin + any excess coins)
    let (lp_coin, excess_asset, excess_stable) =
        unified_spot_pool::add_liquidity(
            &mut pool,
            asset_coin,
            stable_coin,
            0, // min_lp_out = 0 for initial liquidity (no slippage)
            ctx
        );

    // Get pool ID before sharing
    let pool_id = object::id(&pool);

    // 4. Share the pool so it can be accessed by anyone
    unified_spot_pool::share(pool);

    // 5. Store LP coin in vault (standard Coin storage!)
    // Use init_vault_deposit since account is still unshared during pool creation
    let vault_name = string::utf8(DEFAULT_VAULT_NAME);
    init_actions::init_vault_deposit<Config, LPType>(
        account,
        registry,
        vault_name,
        lp_coin,
        ctx,
    );

    // 6. Return any excess coins to treasury vault
    if (coin::value(&excess_asset) > 0) {
        init_actions::init_vault_deposit<Config, AssetType>(
            account,
            registry,
            vault_name,
            excess_asset,
            ctx,
        );
    } else {
        coin::destroy_zero(excess_asset);
    };

    if (coin::value(&excess_stable) > 0) {
        init_actions::init_vault_deposit<Config, StableType>(
            account,
            registry,
            vault_name,
            excess_stable,
            ctx,
        );
    } else {
        coin::destroy_zero(excess_stable);
    };

    pool_id
}

/// Create AMM pool during DAO init with minted asset tokens
///
/// This variant mints new asset tokens from TreasuryCap and uses stable from vault.
/// Requires:
/// - TreasuryCap<LPType> with zero supply
/// - CoinMetadata<LPType> with name/symbol = "GOVEX_LP_TOKEN"
public fun init_create_pool_with_mint<Config: store, AssetType: drop, StableType: drop, LPType: drop, W: copy + drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    vault_name: String,
    asset_amount: u64,
    stable_amount: u64,
    fee_bps: u64,
    lp_treasury_cap: TreasuryCap<LPType>,
    lp_metadata: &CoinMetadata<LPType>,
    witness: W,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    use account_actions::currency;

    // Validate inputs
    assert!(asset_amount > 0 && stable_amount > 0, EInvalidAmount);
    assert!(fee_bps <= 10000, EInvalidRatio);

    // 1. Mint asset tokens from TreasuryCap
    let asset_treasury_cap = currency::borrow_treasury_cap_mut<AssetType>(account, registry);
    let asset_coin = coin::mint<AssetType>(asset_treasury_cap, asset_amount, ctx);

    // 2. Withdraw stable from vault (permissionless for approved coin types)
    let dao_address = account.addr();
    let stable_coin = vault::withdraw_permissionless<Config, StableType>(
        account,
        registry,
        dao_address,
        vault_name,
        stable_amount,
        ctx,
    );

    // 3. Create pool with LP coin infrastructure
    init_create_pool<Config, AssetType, StableType, LPType, W>(
        account,
        registry,
        asset_coin,
        stable_coin,
        lp_treasury_cap,
        lp_metadata,
        fee_bps,
        witness,
        clock,
        ctx,
    )
}

// === Garbage Collection ===

/// Delete create pool with mint action from expired intent
public fun delete_create_pool_with_mint(expired: &mut intents::Expired) {
    let action_spec = intents::remove_action_spec(expired);
    let action_data = intents::action_spec_action_data(action_spec);
    let mut reader = bcs::new(action_data);
    reader.peel_vec_u8(); // vault_name
    reader.peel_u64(); // asset_amount
    reader.peel_u64(); // stable_amount
    reader.peel_u64(); // fee_bps
    let _ = reader.into_remainder_bytes();
}
