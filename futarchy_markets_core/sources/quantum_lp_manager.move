// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Simplified Quantum LP Management
///
/// With Coin-based LP tokens, management is simpler:
/// - LP operations blocked during active proposals via pool.active_proposal_id
/// - Quantum split ratio controlled by DAO config (10-90%)
/// - No per-LP-token locking needed - pool-level blocking is sufficient
module futarchy_markets_core::quantum_lp_manager;

use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm;
use futarchy_markets_primitives::market_state;
use futarchy_one_shot_utils::math;
use sui::clock::Clock;
use sui::coin;

// === Auto-Participation Logic ===

/// Quantum split with configurable ratio
/// x% stays in spot pool, (100-x)% quantum splits to ALL conditional pools
/// Enforces 12-hour exponential decay gap between proposals and blocks LP operations during proposals
/// Gap fee decays from u64::MAX to 0 over 12 hours (30-minute half-life)
/// Use unified_spot_pool::get_proposal_gap_fee() to retrieve the current gap fee
public fun auto_quantum_split_on_proposal_start<AssetType, StableType, LPType>(
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    proposal_id: ID,
    conditional_liquidity_ratio_percent: u64, // Percent to quantum split (0-100)
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Check proposal gap - blocks immediate re-proposals, allows after first half-life (30 min)
    // Gap fee available via unified_spot_pool::get_proposal_gap_fee() for optional charging
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

        // Add liquidity to conditional AMM
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
public fun auto_redeem_on_proposal_end_from_escrow<AssetType, StableType, LPType>(
    winning_outcome: u64,
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get market_state and empty winning conditional pool (reserves only, not protocol fees)
    let (asset_amount, stable_amount) = {
        let market_state = coin_escrow::get_market_state_mut(escrow);
        let pool_mut = market_state::get_pool_mut_by_outcome(market_state, (winning_outcome as u8));

        // Get AMM reserves (original liquidity + LP fees)
        conditional_amm::empty_all_amm_liquidity(
            pool_mut,
            ctx,
        )
    };

    // Total to withdraw from escrow = AMM reserves only (no protocol fees)
    let total_asset = asset_amount;
    let total_stable = stable_amount;

    // SAFETY: Cap withdrawals at LP backing to preserve user redemptions
    let lp_asset = coin_escrow::get_lp_deposited_asset(escrow);
    let lp_stable = coin_escrow::get_lp_deposited_stable(escrow);
    let escrow_asset = coin_escrow::get_escrowed_asset_balance(escrow);
    let escrow_stable = coin_escrow::get_escrowed_stable_balance(escrow);

    // Get user deposits to ensure we leave enough for redemptions
    let user_total_buffer = coin_escrow::get_user_deposited_total(escrow);

    // Cap at minimum of: requested amount, LP backing, escrow balance minus user buffer
    let withdraw_asset = {
        let amt = if (total_asset > lp_asset) { lp_asset } else { total_asset };
        let amt = if (amt > escrow_asset) { escrow_asset } else { amt };
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
