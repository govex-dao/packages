// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Protective Bid Module - Snapshot NAV Floor
///
/// Creates a price floor for launchpad tokens using SNAPSHOT-based NAV.
/// Snapshots taken at creation, updated via permissionless sync_snapshot().
///
/// ══════════════════════════════════════════════════════════════════════════
///                         SNAPSHOT NAV FORMULA
/// ══════════════════════════════════════════════════════════════════════════
///
/// NAV = snapshot_backing / snapshot_circulating
///
/// Snapshots are taken at creation and updated via sync_snapshot().
/// Users CHOOSE whether to trade - if NAV seems wrong, don't sell.
///
/// ══════════════════════════════════════════════════════════════════════════
///                         sell_to_bid FLOW (SIMPLE!)
/// ══════════════════════════════════════════════════════════════════════════
///
/// 1. User calls sell_to_bid(bid, tokens) - just 2 params!
/// 2. NAV = snapshot_backing / snapshot_circulating
/// 3. stable_out = tokens × NAV / PRECISION - fee
/// 4. Pay stable from bid vault → user
/// 5. Store tokens in bid (burned via sync_snapshot)
/// 6. Update snapshots: circulating -= tokens, backing -= stable_out
///
/// ══════════════════════════════════════════════════════════════════════════
///                         sync_snapshot (PERMISSIONLESS)
/// ══════════════════════════════════════════════════════════════════════════
///
/// Anyone can call to:
/// 1. Burn accumulated tokens via currency::public_burn
/// 2. Refresh snapshots from live Account + Pool state
/// 3. Useful after: donations, AMM fee accumulation, external burns
///
/// ══════════════════════════════════════════════════════════════════════════

module futarchy_factory::protective_bid;

// === Imports ===

use sui::coin::{Self, Coin};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::event;

use account_protocol::{
    account::Account,
    package_registry::PackageRegistry,
};
use account_actions::{currency, vault};
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};

// === Errors ===

const EInsufficientBidFunds: u64 = 1;
const EBidInactive: u64 = 2;
const EDeadlineNotReached: u64 = 3;
const ETwapBelowNav: u64 = 4;
const EZeroAmount: u64 = 5;
const EWrongSpotPool: u64 = 6;
const EWrongAccount: u64 = 7;
const EZeroCirculatingSupply: u64 = 8;
const EFeeTooHigh: u64 = 9;
const EZeroOutput: u64 = 10;

// === Constants ===

const RELEASE_DELAY_MS: u64 = 90 * 24 * 60 * 60 * 1000; // 90 days in ms
const PRECISION: u64 = 1_000_000_000; // 9 decimals for price calculations
const MAX_FEE_BPS: u64 = 1000; // 10% max fee
const TREASURY_VAULT_NAME: vector<u8> = b"treasury";

// === Structs ===

/// Protective bid using SNAPSHOT NAV - simple and aggregator-friendly
/// sell_to_bid only needs &mut Bid + tokens (no Account!)
/// sync_snapshot updates from live state (permissionless)
public struct ProtectiveBid<phantom RaiseToken, phantom StableCoin> has key, store {
    id: UID,
    /// ID of the associated raise
    raise_id: ID,
    /// ID of the DAO account (for sync/burn/release operations)
    account_id: ID,
    /// ID of the spot pool (for sync and TWAP)
    spot_pool_id: ID,
    /// Fee in basis points (max 10%)
    fee_bps: u64,
    /// Stable coins available for buying tokens
    stable_vault: Balance<StableCoin>,
    /// Tokens accumulated from sells (burned via sync_snapshot)
    token_vault: Balance<RaiseToken>,
    /// === SNAPSHOT VALUES (updated via sync_snapshot) ===
    /// Snapshot of total backing (stable in system)
    snapshot_backing: u64,
    /// Snapshot of circulating supply
    snapshot_circulating: u64,
    /// === TRACKING ===
    /// Total tokens burned through this bid
    total_tokens_burned: u64,
    /// Total stable paid out
    total_stable_paid: u64,
    /// Fees collected (subtracted from backing)
    fees_collected: u64,
    /// Timestamp when bid can be deactivated (if TWAP > NAV)
    release_deadline_ms: u64,
    /// Whether bid is still active
    active: bool,
}

// === Events ===

public struct ProtectiveBidCreated has copy, drop {
    bid_id: ID,
    raise_id: ID,
    account_id: ID,
    spot_pool_id: ID,
    fee_bps: u64,
    initial_stable: u64,
    initial_nav: u64,
    snapshot_backing: u64,
    snapshot_circulating: u64,
    release_deadline_ms: u64,
}

public struct TokensSoldToBid has copy, drop {
    bid_id: ID,
    seller: address,
    tokens_sold: u64,
    stable_received: u64,
    fee_amount: u64,
    nav_at_sale: u64,
    remaining_stable: u64,
}

public struct SnapshotSynced has copy, drop {
    bid_id: ID,
    tokens_burned: u64,
    old_backing: u64,
    new_backing: u64,
    old_circulating: u64,
    new_circulating: u64,
    new_nav: u64,
}

public struct BidReleased has copy, drop {
    bid_id: ID,
    stable_to_treasury: u64,
    final_tokens_burned: u64,
    final_fees_collected: u64,
}

// === Public Functions ===

/// Create a new protective bid with initial snapshots
/// Called after pool creation when we know AMM state
public(package) fun create<RaiseToken, StableCoin>(
    raise_id: ID,
    account_id: ID,
    spot_pool_id: ID,
    fee_bps: u64,
    stable: Balance<StableCoin>,
    snapshot_backing: u64,
    snapshot_circulating: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): ProtectiveBid<RaiseToken, StableCoin> {
    // Validate inputs
    assert!(fee_bps <= MAX_FEE_BPS, EFeeTooHigh);
    assert!(snapshot_circulating > 0, EZeroCirculatingSupply);

    let initial_stable = stable.value();
    let release_deadline_ms = clock.timestamp_ms() + RELEASE_DELAY_MS;

    // Calculate initial NAV
    let initial_nav = ((snapshot_backing as u128) * (PRECISION as u128)
        / (snapshot_circulating as u128)) as u64;

    let bid = ProtectiveBid {
        id: object::new(ctx),
        raise_id,
        account_id,
        spot_pool_id,
        fee_bps,
        stable_vault: stable,
        token_vault: balance::zero(),
        snapshot_backing,
        snapshot_circulating,
        total_tokens_burned: 0,
        total_stable_paid: 0,
        fees_collected: 0,
        release_deadline_ms,
        active: true,
    };

    event::emit(ProtectiveBidCreated {
        bid_id: object::id(&bid),
        raise_id,
        account_id,
        spot_pool_id,
        fee_bps,
        initial_stable,
        initial_nav,
        snapshot_backing,
        snapshot_circulating,
        release_deadline_ms,
    });

    bid
}

/// Sell tokens to the protective bid at snapshot NAV price
/// SIMPLE: Only needs &mut Bid + tokens - no Account required!
/// Aggregator-friendly: just pass the bid object
public fun sell_to_bid<RaiseToken, StableCoin>(
    bid: &mut ProtectiveBid<RaiseToken, StableCoin>,
    tokens: Coin<RaiseToken>,
    ctx: &mut TxContext,
): Coin<StableCoin> {
    assert!(bid.active, EBidInactive);

    let token_amount = tokens.value();
    assert!(token_amount > 0, EZeroAmount);
    assert!(bid.snapshot_circulating > 0, EZeroCirculatingSupply);

    // Calculate NAV from snapshots
    let nav = ((bid.snapshot_backing as u128) * (PRECISION as u128)
        / (bid.snapshot_circulating as u128)) as u64;

    // Calculate stable output with fee
    let gross_stable = ((token_amount as u128) * (nav as u128) / (PRECISION as u128)) as u64;
    let fee_amount = (gross_stable * bid.fee_bps) / 10000;
    let stable_out = gross_stable - fee_amount;

    // Prevent zero-output sells (protects users from dust loss)
    assert!(stable_out > 0, EZeroOutput);
    assert!(stable_out <= bid.stable_vault.value(), EInsufficientBidFunds);

    // Store tokens in vault (burned later via sync_snapshot)
    bid.token_vault.join(tokens.into_balance());

    // Update snapshots immediately (tokens removed from circulation, stable removed from backing)
    bid.snapshot_circulating = bid.snapshot_circulating - token_amount;
    bid.snapshot_backing = if (bid.snapshot_backing > stable_out) {
        bid.snapshot_backing - stable_out
    } else {
        0
    };

    // Update tracking
    bid.total_stable_paid = bid.total_stable_paid + stable_out;
    bid.fees_collected = bid.fees_collected + fee_amount;

    // Pay out stable (fee stays in vault)
    let stable_balance = bid.stable_vault.split(stable_out);

    event::emit(TokensSoldToBid {
        bid_id: object::id(bid),
        seller: ctx.sender(),
        tokens_sold: token_amount,
        stable_received: stable_out,
        fee_amount,
        nav_at_sale: nav,
        remaining_stable: bid.stable_vault.value(),
    });

    coin::from_balance(stable_balance, ctx)
}

/// Sync snapshot from live state (PERMISSIONLESS)
/// Burns accumulated tokens and refreshes snapshots
/// Call after: donations to treasury, AMM fee accumulation, external events
public fun sync_snapshot<Config: store, RaiseToken: drop, StableCoin: drop, AssetType, StableType, LPType>(
    bid: &mut ProtectiveBid<RaiseToken, StableCoin>,
    account: &mut Account,
    spot_pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    registry: &PackageRegistry,
    ctx: &mut TxContext,
) {
    assert!(bid.active, EBidInactive);
    assert!(object::id(account) == bid.account_id, EWrongAccount);
    assert!(object::id(spot_pool) == bid.spot_pool_id, EWrongSpotPool);

    let old_backing = bid.snapshot_backing;
    let old_circulating = bid.snapshot_circulating;

    // 1. Burn accumulated tokens
    let tokens_to_burn = bid.token_vault.value();
    if (tokens_to_burn > 0) {
        let tokens = coin::from_balance(bid.token_vault.withdraw_all(), ctx);
        currency::public_burn<Config, RaiseToken>(account, registry, tokens);
        bid.total_tokens_burned = bid.total_tokens_burned + tokens_to_burn;
    };

    // 2. Read live state
    let (tokens_in_amm, stable_in_amm) = unified_spot_pool::get_reserves(spot_pool);

    let stable_in_treasury = vault::balance<Config, StableCoin>(
        account,
        registry,
        std::string::utf8(TREASURY_VAULT_NAME),
    );
    let tokens_in_treasury = vault::balance<Config, RaiseToken>(
        account,
        registry,
        std::string::utf8(TREASURY_VAULT_NAME),
    );

    // Get live total supply (reflects burns)
    let total_supply = currency::coin_type_supply<RaiseToken>(account, registry);

    // 3. Calculate new snapshots
    // Backing = AMM stable + treasury stable + bid stable - fees
    let total_backing = stable_in_amm + stable_in_treasury + bid.stable_vault.value();
    let new_backing = if (total_backing > bid.fees_collected) {
        total_backing - bid.fees_collected
    } else {
        0
    };

    // Circulating = total supply - treasury - AMM - pending burn in bid
    let non_circulating = tokens_in_treasury + tokens_in_amm + bid.token_vault.value();
    let new_circulating = if (total_supply > non_circulating) {
        total_supply - non_circulating
    } else {
        1 // Avoid zero to prevent division errors
    };

    // 4. Update snapshots
    bid.snapshot_backing = new_backing;
    bid.snapshot_circulating = new_circulating;

    // Calculate new NAV for event
    let new_nav = ((new_backing as u128) * (PRECISION as u128)
        / (new_circulating as u128)) as u64;

    event::emit(SnapshotSynced {
        bid_id: object::id(bid),
        tokens_burned: tokens_to_burn,
        old_backing,
        new_backing,
        old_circulating,
        new_circulating,
        new_nav,
    });
}

/// Try to release funds TO DAO TREASURY (permissionless)
/// Succeeds if: 90 days passed AND spot TWAP > NAV
/// Funds go to DAO treasury, NOT to caller
public fun try_release<Config: store, RaiseToken: drop, StableCoin: drop, AssetType, StableType, LPType>(
    bid: &mut ProtectiveBid<RaiseToken, StableCoin>,
    account: &mut Account,
    spot_pool: &UnifiedSpotPool<AssetType, StableType, LPType>,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(bid.active, EBidInactive);
    assert!(clock.timestamp_ms() >= bid.release_deadline_ms, EDeadlineNotReached);
    assert!(object::id(account) == bid.account_id, EWrongAccount);
    assert!(object::id(spot_pool) == bid.spot_pool_id, EWrongSpotPool);

    // Get current NAV from snapshot
    let nav = if (bid.snapshot_circulating > 0) {
        ((bid.snapshot_backing as u128) * (PRECISION as u128)
            / (bid.snapshot_circulating as u128)) as u64
    } else {
        PRECISION
    };

    // Get TWAP from spot pool oracle (scaled 1e12)
    let twap_1e12 = unified_spot_pool::get_geometric_twap(spot_pool, clock);
    let current_twap = convert_twap_to_nav_scale(twap_1e12);

    // TWAP must be above NAV to release
    assert!(current_twap > nav, ETwapBelowNav);

    // Burn any pending tokens first
    let tokens_to_burn = bid.token_vault.value();
    if (tokens_to_burn > 0) {
        let tokens = coin::from_balance(bid.token_vault.withdraw_all(), ctx);
        currency::public_burn<Config, RaiseToken>(account, registry, tokens);
        bid.total_tokens_burned = bid.total_tokens_burned + tokens_to_burn;
    };

    // Release all remaining stable TO DAO TREASURY (not caller!)
    // Uses deposit_approved - stable coin type should be pre-approved by factory
    let remaining = bid.stable_vault.value();
    if (remaining > 0) {
        let stable_coin = coin::from_balance(bid.stable_vault.withdraw_all(), ctx);
        vault::deposit_approved<Config, StableCoin>(
            account,
            registry,
            std::string::utf8(TREASURY_VAULT_NAME),
            stable_coin,
        );
    };

    bid.active = false;

    event::emit(BidReleased {
        bid_id: object::id(bid),
        stable_to_treasury: remaining,
        final_tokens_burned: bid.total_tokens_burned,
        final_fees_collected: bid.fees_collected,
    });
}

// === View Functions ===

/// Get current NAV from snapshots
public fun current_nav<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    if (bid.snapshot_circulating == 0) {
        PRECISION
    } else {
        ((bid.snapshot_backing as u128) * (PRECISION as u128)
            / (bid.snapshot_circulating as u128)) as u64
    }
}

/// Quote how much stable you'd get for selling tokens
public fun quote_sell<RT, SC>(bid: &ProtectiveBid<RT, SC>, token_amount: u64): u64 {
    if (!bid.active) return 0;
    if (token_amount == 0) return 0;
    if (bid.snapshot_circulating == 0) return 0;

    let nav = current_nav(bid);
    let gross_stable = ((token_amount as u128) * (nav as u128) / (PRECISION as u128)) as u64;
    let fee_amount = (gross_stable * bid.fee_bps) / 10000;
    let stable_out = gross_stable - fee_amount;

    if (stable_out > bid.stable_vault.value()) {
        0
    } else {
        stable_out
    }
}

/// Get remaining stable in bid vault
public fun remaining_stable<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    bid.stable_vault.value()
}

/// Get pending tokens (waiting to be burned via sync)
public fun pending_tokens<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    bid.token_vault.value()
}

/// Get snapshot backing
public fun snapshot_backing<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    bid.snapshot_backing
}

/// Get snapshot circulating
public fun snapshot_circulating<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    bid.snapshot_circulating
}

/// Get fee in basis points
public fun fee_bps<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    bid.fee_bps
}

/// Get total tokens burned
public fun total_tokens_burned<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    bid.total_tokens_burned
}

/// Get total stable paid out
public fun total_stable_paid<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    bid.total_stable_paid
}

/// Get fees collected
public fun fees_collected<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    bid.fees_collected
}

/// Get release deadline
public fun release_deadline_ms<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    bid.release_deadline_ms
}

/// Check if active
public fun is_active<RT, SC>(bid: &ProtectiveBid<RT, SC>): bool {
    bid.active
}

/// Get raise ID
public fun raise_id<RT, SC>(bid: &ProtectiveBid<RT, SC>): ID {
    bid.raise_id
}

/// Get account ID
public fun account_id<RT, SC>(bid: &ProtectiveBid<RT, SC>): ID {
    bid.account_id
}

/// Get spot pool ID
public fun spot_pool_id<RT, SC>(bid: &ProtectiveBid<RT, SC>): ID {
    bid.spot_pool_id
}

/// Get the precision constant
public fun precision(): u64 {
    PRECISION
}

/// Max tokens that can be sold (based on remaining stable and current NAV)
public fun max_sellable_tokens<RT, SC>(bid: &ProtectiveBid<RT, SC>): u64 {
    let nav = current_nav(bid);
    if (nav == 0) return 0;

    let remaining = bid.stable_vault.value();
    // tokens = stable * PRECISION / nav
    ((remaining as u128) * (PRECISION as u128) / (nav as u128)) as u64
}

// === Internal Functions ===

/// Convert TWAP from oracle scale (1e12) to NAV scale (1e9)
fun convert_twap_to_nav_scale(twap_1e12: u128): u64 {
    let result = twap_1e12 / 1000;
    if (result > (std::u64::max_value!() as u128)) {
        std::u64::max_value!()
    } else {
        (result as u64)
    }
}

// === Test Functions ===

#[test_only]
public fun create_for_testing<RaiseToken, StableCoin>(
    raise_id: ID,
    account_id: ID,
    spot_pool_id: ID,
    fee_bps: u64,
    stable: Balance<StableCoin>,
    snapshot_backing: u64,
    snapshot_circulating: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): ProtectiveBid<RaiseToken, StableCoin> {
    create(raise_id, account_id, spot_pool_id, fee_bps, stable, snapshot_backing, snapshot_circulating, clock, ctx)
}

#[test_only]
public fun destroy_for_testing<RaiseToken, StableCoin>(
    bid: ProtectiveBid<RaiseToken, StableCoin>,
) {
    let ProtectiveBid {
        id,
        raise_id: _,
        account_id: _,
        spot_pool_id: _,
        fee_bps: _,
        stable_vault,
        token_vault,
        snapshot_backing: _,
        snapshot_circulating: _,
        total_tokens_burned: _,
        total_stable_paid: _,
        fees_collected: _,
        release_deadline_ms: _,
        active: _,
    } = bid;
    object::delete(id);
    balance::destroy_for_testing(stable_vault);
    balance::destroy_for_testing(token_vault);
}
