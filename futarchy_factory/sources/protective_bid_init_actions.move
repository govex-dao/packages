// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Init actions for creating Protective Bid during DAO initialization
///
/// This module provides functions for creating protective bids after pool creation.
/// The protective bid uses excess funds (total_raised - min_raise_amount) to create
/// a NAV-based price floor for launchpad tokens.
///
/// Flow:
/// 1. Pool creation init action runs first (returns pool_id)
/// 2. Protective bid init action runs with pool_id
/// 3. Withdraws excess funds from treasury
/// 4. Creates bid with initial snapshots from pool/account state
module futarchy_factory::protective_bid_init_actions;

// === Imports ===

use std::string::{Self, String};
use std::type_name;
use sui::bcs;
use sui::clock::Clock;
use sui::coin;

use account_protocol::{
    account::Account,
    package_registry::PackageRegistry,
    executable::Executable,
    intents,
    bcs_validation,
    action_validation,
};
use account_actions::{
    action_spec_builder,
    currency,
    vault,
};
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_factory::protective_bid::{Self, ProtectiveBid};

// === Constants ===

const DEFAULT_VAULT_NAME: vector<u8> = b"treasury";

// === Errors ===

const EUnsupportedActionVersion: u64 = 1;
const ENoExcessFunds: u64 = 2;
const EInsufficientVaultBalance: u64 = 3;

// === Marker Types ===

/// Marker type for CreateProtectiveBidAction validation
public struct CreateProtectiveBid has drop {}

// === Action Structs ===

/// Action to create protective bid with excess raise funds
public struct CreateProtectiveBidAction has store, copy, drop {
    /// Spot pool ID (from pool creation init action)
    spot_pool_id: ID,
    /// Minimum raise amount (to calculate excess)
    min_raise_amount: u64,
    /// Fee in basis points for the bid
    fee_bps: u64,
    /// Raise ID for linking
    raise_id: ID,
    /// Optional threshold: only create bid wall if treasury > this amount
    /// Set to 0 for default behavior (any excess creates bid wall)
    /// Set to min_raise_amount * 125 / 100 for Solana-style 1.25x threshold
    bid_threshold_amount: u64,
}

// === Spec Builders ===

/// Add CreateProtectiveBidAction to Builder
/// Used for staging actions in launchpad raises via PTB
///
/// NOTE: spot_pool_id should be known at staging time from pool creation spec
/// If pool creation is dynamic, you may need to update this after pool is created
///
/// bid_threshold_amount: Optional threshold for bid wall creation
/// - Set to 0: Any excess creates bid wall (default behavior)
/// - Set to min_raise_amount * 125 / 100: Solana-style 1.25x threshold
///   (only create bid wall if total raised > 1.25x minimum)
public fun add_create_protective_bid_spec(
    builder: &mut action_spec_builder::Builder,
    spot_pool_id: ID,
    min_raise_amount: u64,
    fee_bps: u64,
    raise_id: ID,
    bid_threshold_amount: u64,
) {
    let action = CreateProtectiveBidAction {
        spot_pool_id,
        min_raise_amount,
        fee_bps,
        raise_id,
        bid_threshold_amount,
    };

    let action_data = bcs::to_bytes(&action);

    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<CreateProtectiveBid>(),
        action_data,
        1  // version
    );
    action_spec_builder::add(builder, action_spec);
}

// === Dispatchers ===

/// Execute protective bid creation from a staged action
/// Accepts typed action directly (zero deserialization cost!)
///
/// Returns: (bid_id, excess_amount) - the created bid ID and amount used
public fun dispatch_create_protective_bid<Config: store, RaiseToken: drop, StableCoin: drop, AssetType, StableType, LPType, W: copy + drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    action: &CreateProtectiveBidAction,
    spot_pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    _witness: W,
    clock: &Clock,
    ctx: &mut TxContext,
): (ID, u64) {
    init_create_protective_bid<Config, RaiseToken, StableCoin, AssetType, StableType, LPType, W>(
        account,
        registry,
        action.spot_pool_id,
        action.min_raise_amount,
        action.fee_bps,
        action.raise_id,
        action.bid_threshold_amount,
        spot_pool,
        clock,
        ctx,
    )
}

// === Intent Execution ===

/// Execute protective bid creation from Intent during launchpad initialization
/// Follows 3-layer action execution pattern
///
/// This function is called from PTB executor after begin_execution:
/// 1. begin_execution() creates Executable hot potato
/// 2. PTB calls do_init_* functions in sequence (pool first, then this)
/// 3. finalize_execution() confirms the executable
///
/// Returns: (bid_id, excess_amount)
public fun do_init_create_protective_bid<Config: store, Outcome: store, RaiseToken: drop, StableCoin: drop, AssetType, StableType, LPType, IW: copy + drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    spot_pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
    _intent_witness: IW,
    ctx: &mut TxContext,
): (ID, u64) {
    // 1. Assert account ownership
    executable.intent().assert_is_account(account.addr());

    // 2. Get current ActionSpec from Executable
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // 3. Validate action type
    action_validation::assert_action_type<CreateProtectiveBid>(spec);

    // 4. Check version
    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // 5. Deserialize action data
    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);
    let spot_pool_id = object::id_from_bytes(bcs::peel_vec_u8(&mut reader));
    let min_raise_amount = bcs::peel_u64(&mut reader);
    let fee_bps = bcs::peel_u64(&mut reader);
    let raise_id = object::id_from_bytes(bcs::peel_vec_u8(&mut reader));
    let bid_threshold_amount = bcs::peel_u64(&mut reader);

    // 6. Validate all bytes consumed
    bcs_validation::validate_all_bytes_consumed(reader);

    // 7. Execute
    let (bid_id, excess_amount) = init_create_protective_bid<Config, RaiseToken, StableCoin, AssetType, StableType, LPType, IW>(
        account,
        registry,
        spot_pool_id,
        min_raise_amount,
        fee_bps,
        raise_id,
        bid_threshold_amount,
        spot_pool,
        clock,
        ctx,
    );

    // 8. Increment action index
    executable.increment_action_idx();

    (bid_id, excess_amount)
}

// === Init Actions ===

/// Create protective bid during DAO init (before account is shared)
///
/// This function:
/// 1. Checks if treasury exceeds threshold (if set) or min_raise_amount
/// 2. Calculates excess = treasury_balance - min_raise_amount
/// 3. Withdraws excess from treasury vault
/// 4. Calculates initial snapshots (backing, circulating)
/// 5. Creates and shares the protective bid
///
/// Requirements:
/// - Pool must already be created (need reserves for snapshot)
/// - Treasury must exceed threshold (or min_raise if threshold=0)
///
/// bid_threshold_amount behavior:
/// - 0: Create bid wall if treasury > min_raise_amount (any excess)
/// - > 0: Only create bid wall if treasury > bid_threshold_amount
///   Example: For Solana-style 1.25x threshold, set to min_raise * 125 / 100
///
/// Returns: (bid_id, excess_amount)
public fun init_create_protective_bid<Config: store, RaiseToken: drop, StableCoin: drop, AssetType, StableType, LPType, W: copy + drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    spot_pool_id: ID,
    min_raise_amount: u64,
    fee_bps: u64,
    raise_id: ID,
    bid_threshold_amount: u64,
    spot_pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    clock: &Clock,
    ctx: &mut TxContext,
): (ID, u64) {
    // Validate spot pool ID matches
    assert!(object::id(spot_pool) == spot_pool_id, EUnsupportedActionVersion);

    let vault_name = string::utf8(DEFAULT_VAULT_NAME);
    let account_id = object::id(account);
    let dao_address = account.addr();

    // 1. Get current treasury stable balance
    let treasury_stable = vault::balance<Config, StableCoin>(account, registry, vault_name);

    // 2. Determine threshold for bid wall creation
    // If bid_threshold_amount is set, use it; otherwise use min_raise_amount
    let threshold = if (bid_threshold_amount > 0) {
        bid_threshold_amount
    } else {
        min_raise_amount
    };

    // 3. Check if treasury exceeds threshold
    if (treasury_stable <= threshold) {
        // Below threshold - no bid wall created
        // This handles both:
        // - Default: treasury <= min_raise (no excess)
        // - 1.25x mode: treasury <= 1.25 * min_raise (not enough excess)
        return (object::id_from_address(@0x0), 0)
    };

    // 4. Calculate excess (always based on min_raise_amount, not threshold)
    // Excess = what goes to bid wall = treasury - min_raise
    let excess_amount = treasury_stable - min_raise_amount;

    // 5. Withdraw excess from treasury
    let excess_coin = vault::withdraw_permissionless<Config, StableCoin>(
        account,
        registry,
        dao_address,
        vault_name,
        excess_amount,
        ctx,
    );

    // 6. Calculate initial snapshots
    // Get pool reserves
    let (tokens_in_amm, stable_in_amm) = unified_spot_pool::get_reserves(spot_pool);

    // Get treasury balances (after withdrawal)
    let stable_in_treasury = vault::balance<Config, StableCoin>(account, registry, vault_name);
    let tokens_in_treasury = vault::balance<Config, RaiseToken>(account, registry, vault_name);

    // Get total supply
    let total_supply = currency::coin_type_supply<RaiseToken>(account, registry);

    // Backing = AMM stable + treasury stable + bid stable (excess)
    let snapshot_backing = stable_in_amm + stable_in_treasury + excess_amount;

    // Circulating = total supply - treasury tokens - AMM tokens
    let non_circulating = tokens_in_treasury + tokens_in_amm;
    let snapshot_circulating = if (total_supply > non_circulating) {
        total_supply - non_circulating
    } else {
        1 // Avoid zero to prevent division errors
    };

    // 7. Create protective bid
    let bid = protective_bid::create<RaiseToken, StableCoin>(
        raise_id,
        account_id,
        spot_pool_id,
        fee_bps,
        excess_coin.into_balance(),
        snapshot_backing,
        snapshot_circulating,
        clock,
        ctx,
    );

    let bid_id = object::id(&bid);

    // 8. Share the bid
    sui::transfer::public_share_object(bid);

    (bid_id, excess_amount)
}

// === Garbage Collection ===

/// Delete protective bid action from expired intent
public fun delete_create_protective_bid(expired: &mut intents::Expired) {
    let action_spec = intents::remove_action_spec(expired);
    let action_data = intents::action_spec_action_data(action_spec);
    let mut reader = bcs::new(action_data);
    reader.peel_vec_u8(); // spot_pool_id
    reader.peel_u64(); // min_raise_amount
    reader.peel_u64(); // fee_bps
    reader.peel_vec_u8(); // raise_id
    reader.peel_u64(); // bid_threshold_amount
    let _ = reader.into_remainder_bytes();
}

// === View Functions ===

/// Get the spot pool ID from an action
public fun action_spot_pool_id(action: &CreateProtectiveBidAction): ID {
    action.spot_pool_id
}

/// Get the min raise amount from an action
public fun action_min_raise_amount(action: &CreateProtectiveBidAction): u64 {
    action.min_raise_amount
}

/// Get the fee bps from an action
public fun action_fee_bps(action: &CreateProtectiveBidAction): u64 {
    action.fee_bps
}

/// Get the raise ID from an action
public fun action_raise_id(action: &CreateProtectiveBidAction): ID {
    action.raise_id
}

/// Get the bid threshold amount from an action
/// Returns 0 if default behavior (any excess creates bid), or threshold amount for 1.25x behavior
public fun action_bid_threshold_amount(action: &CreateProtectiveBidAction): u64 {
    action.bid_threshold_amount
}
