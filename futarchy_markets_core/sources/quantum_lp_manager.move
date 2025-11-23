// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Simplified Quantum LP Management
///
/// Single LP token level with DAO-configured liquidity splitting:
/// - Withdrawals allowed if they don't violate minimum liquidity in conditional AMMs
/// - If withdrawal blocked, LP auto-locked until proposal ends
/// - Quantum split ratio controlled by DAO config (10-90%), with safety cap from conditional capacity
/// - No manual split/redeem - all automatic
module futarchy_markets_core::quantum_lp_manager;

use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool, LPToken};
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm;
use futarchy_markets_primitives::market_state::{Self, MarketState};
use futarchy_one_shot_utils::math;
use sui::clock::Clock;
use sui::coin;

// === Constants ===
const MINIMUM_LIQUIDITY_BUFFER: u64 = 1000; // Minimum liquidity to maintain in each AMM

// === Withdrawal Check ===

/// Check if LP withdrawal would violate minimum liquidity in ANY conditional AMM
/// Returns (can_withdraw, min_violating_amm_index)
public fun would_violate_minimum_liquidity<AssetType, StableType>(
    lp_token: &LPToken<AssetType, StableType>,
    spot_pool: &UnifiedSpotPool<AssetType, StableType>,
    market_state: &MarketState,
): (bool, Option<u8>) {
    let lp_amount = unified_spot_pool::lp_token_amount(lp_token);
    let total_lp_supply = unified_spot_pool::lp_supply(spot_pool);

    if (lp_amount == 0 || total_lp_supply == 0) {
        return (true, option::none())
    };

    // Check each conditional AMM
    let pools = market_state::borrow_amm_pools(market_state);
    let mut i = 0;
    while (i < pools.length()) {
        let pool = &pools[i];
        let (asset_reserve, stable_reserve) = conditional_amm::get_reserves(pool);
        let cond_lp_supply = conditional_amm::get_lp_supply(pool);

        if (cond_lp_supply > 0) {
            // Calculate proportional withdrawal from this conditional AMM
            let asset_out = math::mul_div_to_64(lp_amount, asset_reserve, cond_lp_supply);
            let stable_out = math::mul_div_to_64(lp_amount, stable_reserve, cond_lp_supply);

            // Check if remaining would be below minimum
            let remaining_asset = asset_reserve - asset_out;
            let remaining_stable = stable_reserve - stable_out;

            if (
                remaining_asset < MINIMUM_LIQUIDITY_BUFFER ||
                remaining_stable < MINIMUM_LIQUIDITY_BUFFER
            ) {
                return (false, option::some((i as u8)))
            };
        };

        i = i + 1;
    };

    (true, option::none())
}

/// Attempt to withdraw LP with minimum liquidity check
/// If withdrawal would violate minimum, LP is locked in proposal and set to withdraw mode
/// Returns: (can_withdraw_now, proposal_id_if_locked)
public fun check_and_lock_if_needed<AssetType, StableType>(
    lp_token: &mut LPToken<AssetType, StableType>,
    spot_pool: &UnifiedSpotPool<AssetType, StableType>,
    market_state: &MarketState,
    proposal_id: ID,
): (bool, Option<ID>) {
    // Check if already locked
    if (unified_spot_pool::is_locked_in_proposal(lp_token)) {
        let locked_proposal = unified_spot_pool::get_locked_proposal(lp_token);
        return (false, locked_proposal)
    };

    // Check if withdrawal would violate minimum liquidity
    let (can_withdraw, _violating_amm) = would_violate_minimum_liquidity(
        lp_token,
        spot_pool,
        market_state,
    );

    if (can_withdraw) {
        // Withdrawal allowed
        (true, option::none())
    } else {
        // Lock in proposal and set withdraw mode
        unified_spot_pool::lock_in_proposal(lp_token, proposal_id);
        unified_spot_pool::set_withdraw_mode(lp_token, true);
        (false, option::some(proposal_id))
    }
}

// === Auto-Participation Logic ===

/// Quantum split with configurable ratio
/// x% stays in spot pool, (100-x)% quantum splits to ALL conditional pools
/// Enforces 6-hour gap between proposals and blocks LP operations during proposals
public fun auto_quantum_split_on_proposal_start<AssetType, StableType>(
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    proposal_id: ID,
    conditional_liquidity_ratio_percent: u64, // Percent to quantum split (0-100)
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Check 6-hour gap since last proposal ended
    unified_spot_pool::check_proposal_gap(spot_pool, clock);

    // Mark proposal as active - this blocks all LP operations
    unified_spot_pool::set_active_proposal(spot_pool, proposal_id);

    // Get total reserves to calculate split amounts
    let (total_asset, total_stable) = unified_spot_pool::get_reserves(spot_pool);

    // Calculate how much to quantum split
    let asset_to_split = math::mul_div_to_64(total_asset, conditional_liquidity_ratio_percent, 100);
    let stable_to_split = math::mul_div_to_64(
        total_stable,
        conditional_liquidity_ratio_percent,
        100,
    );

    if (asset_to_split == 0 || stable_to_split == 0) {
        // Nothing to split - clear active proposal and return
        unified_spot_pool::clear_active_proposal(spot_pool, clock);
        return
    };

    // Remove only the split amounts from spot pool (rest stays for trading)
    let (asset_balance, stable_balance) = unified_spot_pool::split_reserves_for_quantum(
        spot_pool,
        asset_to_split,
        stable_to_split,
    );

    // Deposit to escrow as quantum backing and update supplies for all outcomes
    // CRITICAL: Must use lp_deposit_quantum (not deposit_spot_liquidity) to maintain
    // the quantum invariant: escrow == supply + wrapped for each outcome.
    // This function atomically deposits, tracks LP backing, and updates supplies.
    let (_deposited_asset, _deposited_stable) = coin_escrow::lp_deposit_quantum(
        escrow,
        asset_balance,
        stable_balance,
    );

    // Get market_state for pool mutations
    let market_state = coin_escrow::get_market_state_mut(escrow);

    // Quantum replicate: EACH pool gets the FULL amount (not divided!)
    // 100 spot backing → 100 conditional in EACH outcome (quantum expansion)
    let pools = market_state::borrow_amm_pools_mut(market_state);
    let asset_per_pool = asset_to_split;
    let stable_per_pool = stable_to_split;

    let mut i = 0;
    while (i < pools.length()) {
        let pool = &mut pools[i];

        // Add liquidity to conditional AMM - divided equally among all pools
        let _lp_amount = conditional_amm::add_liquidity_proportional(
            pool,
            asset_per_pool,
            stable_per_pool,
            0, // min_lp_out
            clock,
            ctx,
        );

        i = i + 1;
    };
}

/// Simplified recombination - returns system liquidity from winning conditional pool back to spot
/// Clears active_proposal_id to unblock LP operations and records proposal end time
/// Returns only AMM reserves (LP fees included), NOT protocol fees.
///
/// IMPORTANT: Protocol fees are collected separately via collect_protocol_fees() in
/// liquidity_interact.move. They go to the FeeManager, not back to LPs.
///
/// Due to quantum model, pool reserves can grow beyond escrow backing through
/// user trades. We cap withdrawals at escrow balance to prevent failures. User deposits
/// remain in escrow for their redemptions.
public fun auto_redeem_on_proposal_end_from_escrow<AssetType, StableType>(
    winning_outcome: u64,
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get market_state and empty winning conditional pool (reserves only, not protocol fees)
    let (asset_amount, stable_amount) = {
        let market_state = coin_escrow::get_market_state_mut(escrow);
        let pool_mut = market_state::get_pool_mut_by_outcome(market_state, (winning_outcome as u8));

        // Get AMM reserves (original liquidity + LP fees)
        // Protocol fees are NOT included - they're collected separately
        conditional_amm::empty_all_amm_liquidity(
            pool_mut,
            ctx,
        )
    };

    // Total to withdraw from escrow = AMM reserves only (no protocol fees)
    let total_asset = asset_amount;
    let total_stable = stable_amount;

    // SAFETY: Cap withdrawals at LP backing to preserve user redemptions
    // The LP deposited a specific amount via quantum split - we return at most that amount.
    // User deposits remain in escrow for their redemptions.
    // Also cap at escrow balance for safety (should never exceed LP backing + user backing).
    let lp_asset = coin_escrow::get_lp_deposited_asset(escrow);
    let lp_stable = coin_escrow::get_lp_deposited_stable(escrow);
    let escrow_asset = coin_escrow::get_escrowed_asset_balance(escrow);
    let escrow_stable = coin_escrow::get_escrowed_stable_balance(escrow);

    // Get user deposits to ensure we leave enough for redemptions
    // Users can swap between types (deposit stable, redeem asset), so we track
    // total deposits and reserve that much of EACH type for safety.
    let user_total_buffer = coin_escrow::get_user_deposited_total(escrow);

    // Cap at minimum of: requested amount, LP backing, escrow balance minus user buffer
    let withdraw_asset = {
        let amt = if (total_asset > lp_asset) { lp_asset } else { total_asset };
        let amt = if (amt > escrow_asset) { escrow_asset } else { amt };
        // Ensure we leave enough for user redemptions (cross-type swaps possible)
        let max_withdraw = if (escrow_asset > user_total_buffer) {
            escrow_asset - user_total_buffer
        } else {
            0
        };
        if (amt > max_withdraw) { max_withdraw } else { amt }
    };
    let withdraw_stable = {
        let amt = if (total_stable > lp_stable) { lp_stable } else { total_stable };
        let amt = if (amt > escrow_stable) { escrow_stable } else { amt };
        // Ensure we leave enough for user redemptions (cross-type swaps possible)
        let max_withdraw = if (escrow_stable > user_total_buffer) {
            escrow_stable - user_total_buffer
        } else {
            0
        };
        if (amt > max_withdraw) { max_withdraw } else { amt }
    };

    // Withdraw capped amounts from escrow
    let asset_coin = coin_escrow::withdraw_asset_balance(escrow, withdraw_asset, ctx);
    let stable_coin = coin_escrow::withdraw_stable_balance(escrow, withdraw_stable, ctx);

    // Decrement LP backing tracking
    coin_escrow::decrement_lp_backing(escrow, withdraw_asset, withdraw_stable);

    // Add liquidity back to spot pool
    unified_spot_pool::add_liquidity_from_quantum_redeem(
        spot_pool,
        coin::into_balance(asset_coin),
        coin::into_balance(stable_coin),
    );

    // Clear active_proposal_id and record end time - this unblocks LP operations
    unified_spot_pool::clear_active_proposal(spot_pool, clock);
}

// Old entry functions for bucket-based withdrawal removed
// LP operations now blocked during proposals - users must wait
