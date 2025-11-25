// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Unified arbitrage module that works for ANY outcome count
///
/// This module eliminates type explosion by using balance-based operations.
/// ONE arbitrage function works for 2, 3, 4, 5, or 200 outcomes.
///
/// Key innovation: Loops over outcomes using balance indices instead of
/// requiring N type parameters.

module futarchy_markets_core::arbitrage;

use futarchy_markets_core::arbitrage_math;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm;
use futarchy_markets_primitives::conditional_balance::{Self, ConditionalMarketBalance};
use futarchy_markets_primitives::market_state;
use std::option;
use sui::clock::Clock;
use sui::coin;

// === Main Arbitrage Function ===

/// Automatic arbitrage after conditional swaps to bring spot price back into safe range
///
/// After users swap in conditional pools, spot price can drift outside the conditional price range.
/// This function atomically arbitrages using pool liquidity (no user coins required) to bring
/// spot price back into equilibrium.
///
/// **CRITICAL**: This function does NOT modify the main escrow. It moves reserves between
/// spot pool and conditional pools using quantum split/recombine semantics:
/// 1. Take from spot pool reserves
/// 2. Quantum split to conditional pool reserves
/// 3. Swap in each conditional pool
/// 4. Quantum recombine from conditional pools
/// 5. Return to spot pool reserves
///
/// Uses ternary search to find the globally optimal arbitrage amount in a single call.
///
/// **PTB-COMPATIBLE!** Returns balance for chaining in programmable transactions.
/// **DCA PLATFORM READY!** Supports isolated balances per user with auto-merge.
///
/// # Arguments
/// * `existing_balance_opt` - Optional existing balance to merge into
///   - None = Create new balance object
///   - Some(balance) = Merge dust into existing balance
///
/// # Returns
/// * Option<ConditionalMarketBalance> - Some(balance) if arbitrage ran or existing balance provided, None otherwise
/// * Use in PTB: Pass return value to next call's `existing_balance_opt`
public fun auto_rebalance_spot_after_conditional_swaps<AssetType, StableType>(
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    mut existing_balance_opt: option::Option<ConditionalMarketBalance<AssetType, StableType>>,
    _clock: &Clock,
    ctx: &mut TxContext,
): option::Option<ConditionalMarketBalance<AssetType, StableType>> {
    // Get market info and compute optimal arbitrage using FEELESS math
    // (internal arbitrage doesn't charge fees - just moving liquidity between pools)
    let (arb_amount, is_cond_to_spot, market_id, outcome_count) = {
        let market_state = coin_escrow::get_market_state(escrow);
        let pools = market_state::borrow_amm_pools(market_state);

        // Use feeless computation since internal arbitrage has no fees
        let (arb_amount, is_cond_to_spot) = arbitrage_math::compute_optimal_arbitrage_feeless(
            spot_pool,
            pools,
        );

        let market_id = market_state::market_id(market_state);
        let outcome_count = market_state::outcome_count(market_state);

        (arb_amount, is_cond_to_spot, market_id, outcome_count)
    };

    // If no profitable arbitrage found, return existing balance or None
    if (arb_amount == 0) {
        return existing_balance_opt
    };

    // Get spot pool reserves to check if we have enough
    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(spot_pool);

    // Execute arbitrage based on direction
    // is_cond_to_spot=true: Buy from conditional pools, recombine, sell to spot
    // is_cond_to_spot=false: Buy from spot, split, sell to conditional pools
    let result_balance = if (is_cond_to_spot) {
        // Direction: Conditional price too LOW (cond asset is cheap)
        // Action: Buy asset from conditional pools using stable
        // Flow: spot stable → cond stable → cond asset → spot asset

        // Safety check: spot pool needs enough stable
        if (spot_stable < arb_amount) {
            return existing_balance_opt
        };

        // 1. Take stable from spot pool and deposit to escrow
        // CRITICAL: Must update supplies to maintain quantum invariant
        let stable_taken = unified_spot_pool::take_stable_for_arbitrage(spot_pool, arb_amount);
        coin_escrow::deposit_spot_liquidity(escrow, sui::balance::zero<AssetType>(), stable_taken);
        // Immediately decrement LP backing - arbitrage is internal, not LP deposit
        coin_escrow::decrement_lp_backing(escrow, 0, arb_amount);
        // Update supplies to maintain invariant: escrow == supply + wrapped
        coin_escrow::increment_supplies_for_all_outcomes(escrow, 0, arb_amount);

        // 2-5. Do all pool operations in one block
        let (asset_outs, min_asset) = {
            let market_state = coin_escrow::get_market_state_mut(escrow);
            let pools_mut = market_state::borrow_amm_pools_mut(market_state);

            // 2. Quantum split: inject stable into each conditional pool
            let mut i = 0u64;
            while (i < outcome_count) {
                let pool = &mut pools_mut[i];
                conditional_amm::inject_reserves_for_arbitrage(pool, 0, arb_amount);
                i = i + 1;
            };

            // 3. Swap in each conditional pool: stable → asset
            // Use swap_from_injected to avoid double-counting (input already injected)
            let mut asset_outs: vector<u64> = vector[];
            i = 0;
            while (i < outcome_count) {
                let pool = &mut pools_mut[i];
                let asset_out = conditional_amm::swap_from_injected_stable_to_asset(
                    pool,
                    arb_amount,
                );
                vector::push_back(&mut asset_outs, asset_out);
                i = i + 1;
            };

            // 4. Find minimum asset out
            let mut min_asset = *vector::borrow(&asset_outs, 0);
            i = 1;
            while (i < outcome_count) {
                let asset_out = *vector::borrow(&asset_outs, i);
                if (asset_out < min_asset) {
                    min_asset = asset_out;
                };
                i = i + 1;
            };

            // 5. Quantum recombine: extract min_asset from each conditional pool
            i = 0;
            while (i < outcome_count) {
                let pool = &mut pools_mut[i];
                conditional_amm::extract_reserves_for_arbitrage(pool, min_asset, 0);
                i = i + 1;
            };

            (asset_outs, min_asset)
        };

        // 6. Withdraw asset from escrow and return to spot pool
        // Decrement supplies by minimum (what we actually withdraw)
        coin_escrow::decrement_supplies_for_all_outcomes(escrow, min_asset, 0);
        let asset_coin = coin_escrow::withdraw_asset_balance(escrow, min_asset, ctx);
        unified_spot_pool::return_asset_from_arbitrage(spot_pool, coin::into_balance(asset_coin));

        // 7. Create dust balance with extra asset per outcome
        // CRITICAL: For sum-based invariant, we need to:
        // - Decrement supply by extra (dust) amount per outcome
        // - Increment wrapped by dust amount (so dust can be unwrapped later)
        let mut dust_balance = conditional_balance::new<AssetType, StableType>(
            market_id,
            (outcome_count as u8),
            ctx,
        );
        let mut i = 0u64;
        while (i < outcome_count) {
            let asset_out = *vector::borrow(&asset_outs, i);
            let dust = asset_out - min_asset;
            if (dust > 0) {
                // Decrement supply for this outcome's extra
                coin_escrow::decrement_supply_for_outcome(escrow, i, true, dust);
                // Increment wrapped so dust can be used in balance operations
                coin_escrow::increment_wrapped_balance(escrow, i, true, dust);
                // Add to balance tracker
                conditional_balance::add_to_balance(&mut dust_balance, (i as u8), true, dust);
            };
            i = i + 1;
        };

        dust_balance
    } else {
        // Direction: Spot price too LOW (spot asset is cheap)
        // Action: Sell asset from spot to conditional pools for stable
        // Flow: spot asset → cond asset → cond stable → spot stable

        // Safety check: spot pool needs enough asset
        if (spot_asset < arb_amount) {
            return existing_balance_opt
        };

        // 1. Take asset from spot pool and deposit to escrow
        // CRITICAL: Must update supplies to maintain quantum invariant
        let asset_taken = unified_spot_pool::take_asset_for_arbitrage(spot_pool, arb_amount);
        coin_escrow::deposit_spot_liquidity(escrow, asset_taken, sui::balance::zero<StableType>());
        // Immediately decrement LP backing - arbitrage is internal, not LP deposit
        coin_escrow::decrement_lp_backing(escrow, arb_amount, 0);
        // Update supplies to maintain invariant: escrow == supply + wrapped
        coin_escrow::increment_supplies_for_all_outcomes(escrow, arb_amount, 0);

        // 2-5. Do all pool operations in one block
        let (stable_outs, min_stable) = {
            let market_state = coin_escrow::get_market_state_mut(escrow);
            let pools_mut = market_state::borrow_amm_pools_mut(market_state);

            // 2. Quantum split: inject asset into each conditional pool
            let mut i = 0u64;
            while (i < outcome_count) {
                let pool = &mut pools_mut[i];
                conditional_amm::inject_reserves_for_arbitrage(pool, arb_amount, 0);
                i = i + 1;
            };

            // 3. Swap in each conditional pool: asset → stable
            // Use swap_from_injected to avoid double-counting (input already injected)
            let mut stable_outs: vector<u64> = vector[];
            i = 0;
            while (i < outcome_count) {
                let pool = &mut pools_mut[i];
                let stable_out = conditional_amm::swap_from_injected_asset_to_stable(
                    pool,
                    arb_amount,
                );
                vector::push_back(&mut stable_outs, stable_out);
                i = i + 1;
            };

            // 4. Find minimum stable out
            let mut min_stable = *vector::borrow(&stable_outs, 0);
            i = 1;
            while (i < outcome_count) {
                let stable_out = *vector::borrow(&stable_outs, i);
                if (stable_out < min_stable) {
                    min_stable = stable_out;
                };
                i = i + 1;
            };

            // 5. Quantum recombine: extract min_stable from each conditional pool
            i = 0;
            while (i < outcome_count) {
                let pool = &mut pools_mut[i];
                conditional_amm::extract_reserves_for_arbitrage(pool, 0, min_stable);
                i = i + 1;
            };

            (stable_outs, min_stable)
        };

        // 6. Withdraw stable from escrow and return to spot pool
        // Decrement supplies by minimum (what we actually withdraw)
        coin_escrow::decrement_supplies_for_all_outcomes(escrow, 0, min_stable);
        let stable_coin = coin_escrow::withdraw_stable_balance(escrow, min_stable, ctx);
        unified_spot_pool::return_stable_from_arbitrage(spot_pool, coin::into_balance(stable_coin));

        // 7. Create dust balance with extra stable per outcome
        // CRITICAL: For sum-based invariant, we need to:
        // - Decrement supply by extra (dust) amount per outcome
        // - Increment wrapped by dust amount (so dust can be unwrapped later)
        let mut dust_balance = conditional_balance::new<AssetType, StableType>(
            market_id,
            (outcome_count as u8),
            ctx,
        );
        let mut i = 0u64;
        while (i < outcome_count) {
            let stable_out = *vector::borrow(&stable_outs, i);
            let dust = stable_out - min_stable;
            if (dust > 0) {
                // Decrement supply for this outcome's extra
                coin_escrow::decrement_supply_for_outcome(escrow, i, false, dust);
                // Increment wrapped so dust can be used in balance operations
                coin_escrow::increment_wrapped_balance(escrow, i, false, dust);
                // Add to balance tracker
                conditional_balance::add_to_balance(&mut dust_balance, (i as u8), false, dust);
            };
            i = i + 1;
        };

        dust_balance
    };

    // Merge dust into existing balance if provided
    let final_balance = if (option::is_some(&existing_balance_opt)) {
        let mut existing = option::extract(&mut existing_balance_opt);
        conditional_balance::merge(&mut existing, result_balance);
        existing
    } else {
        result_balance
    };
    option::destroy_none(existing_balance_opt);

    // Validate quantum invariant after arbitrage to catch any supply tracking errors
    coin_escrow::assert_quantum_invariant(escrow);

    option::some(final_balance)
}

// === Complete Set Burn Helpers ===

/// Burns complete set of asset from balance and withdraws spot asset from escrow
///
/// Used when user has accumulated conditional tokens across all outcomes and wants to
/// close their position by burning complete sets and receiving spot coins.
public fun burn_complete_set_and_withdraw_asset<AssetType, StableType>(
    balance: &mut ConditionalMarketBalance<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    amount: u64,
    ctx: &mut TxContext,
): sui::coin::Coin<AssetType> {
    // Burn the complete set from balance (subtracts from all outcomes)
    let market_state = coin_escrow::get_market_state(escrow);
    let outcome_count = market_state::outcome_count(market_state);

    let mut i = 0u64;
    while (i < outcome_count) {
        conditional_balance::sub_from_balance(balance, (i as u8), true, amount);
        // CRITICAL: Decrement wrapped balance tracking for each outcome
        // The amounts were in a balance object (tracked as wrapped), now being burned
        coin_escrow::decrement_wrapped_balance(escrow, i, true, amount);
        i = i + 1;
    };

    // Withdraw spot asset from escrow and decrement user backing
    let asset_coin = coin_escrow::withdraw_asset_balance(escrow, amount, ctx);
    coin_escrow::decrement_user_backing(escrow, amount);
    asset_coin
}

/// Burns complete set of stable from balance and withdraws spot stable from escrow
///
/// Used when user has accumulated conditional tokens across all outcomes and wants to
/// close their position by burning complete sets and receiving spot coins.
public fun burn_complete_set_and_withdraw_stable<AssetType, StableType>(
    balance: &mut ConditionalMarketBalance<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    amount: u64,
    ctx: &mut TxContext,
): sui::coin::Coin<StableType> {
    // Burn the complete set from balance (subtracts from all outcomes)
    let market_state = coin_escrow::get_market_state(escrow);
    let outcome_count = market_state::outcome_count(market_state);

    let mut i = 0u64;
    while (i < outcome_count) {
        conditional_balance::sub_from_balance(balance, (i as u8), false, amount);
        // CRITICAL: Decrement wrapped balance tracking for each outcome
        // The amounts were in a balance object (tracked as wrapped), now being burned
        coin_escrow::decrement_wrapped_balance(escrow, i, false, amount);
        i = i + 1;
    };

    // Withdraw spot stable from escrow and decrement user backing
    let stable_coin = coin_escrow::withdraw_stable_balance(escrow, amount, ctx);
    coin_escrow::decrement_user_backing(escrow, amount);
    stable_coin
}
