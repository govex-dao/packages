// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// User-facing swap API with optimal routing
///
/// This is where users enter the system. Provides entry functions that:
/// - Calculate optimal routing (direct vs through conditionals)
/// - Execute optimal path to maximize user output
/// - Ensure no-arb constraints are maintained
///
/// NEW ARCHITECTURE: Routing optimization instead of post-swap arbitrage cleanup
///
/// **Incomplete Set Handling:**
/// All spot swaps transfer incomplete sets (ConditionalMarketBalance) directly to recipient.
/// Balance object has Display metadata so shows as basic NFT in wallets.
/// User owns the balance immediately and can redeem after proposal resolves.
/// No wrapper, no shared registry, no crankers - users control their own positions.
///
/// **Entry Functions:**
///
/// **Spot swaps (aggregators/DCA compatible):**
/// 1. swap_spot_stable_to_asset - Returns profit coins + balance object to recipient
/// 2. swap_spot_asset_to_stable - Returns profit coins + balance object to recipient
///
/// Output coins and balance objects transferred directly to recipient (shows as NFT in wallet).
/// Supports DCA bots calling on behalf of users.

module futarchy_markets_operations::swap_entry;

use futarchy_markets_core::arbitrage;
use futarchy_markets_core::proposal::{Self, Proposal};
use futarchy_markets_core::swap_core;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_operations::no_arb_guard;
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_balance::{Self, ConditionalMarketBalance};
use futarchy_markets_primitives::market_state;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::transfer;

// === Errors ===
const EZeroAmount: u64 = 0;

// === Constants ===
const STATE_TRADING: u8 = 2; // Must match proposal.move

// === Spot Swaps with Auto-Arb ===

/// Swap stable → asset in spot market with automatic arbitrage
///
/// **DCA BOT & AGGREGATOR COMPATIBLE** - Supports auto-merge and flexible return modes
///
/// # Arguments
/// * `existing_balance_opt` - Optional balance to merge into (DCA bots: pass previous balance)
/// * `return_balance` - If true: return balance to caller. If false: transfer to recipient
///
/// # Returns
/// * `option::Option<Coin<AssetType>>` - Asset output (Some only when `return_balance=true`)
/// * `option::Option<ConditionalMarketBalance>` - Dust balance (Some only when `return_balance=true`)
///
/// # Use Cases
///
/// **Regular User (one swap):**
/// ```typescript
/// tx.moveCall({
///   arguments: [..., recipient, null, false, ...] // Transfer balance to recipient
/// });
/// ```
///
/// **DCA Bot (100 swaps → 1 NFT):**
/// ```typescript
/// let balance = null;
/// for (let i = 0; i < 100; i++) {
///   const [assetOut, balanceOpt] = tx.moveCall({
///     arguments: [..., botAddress, balance, true, ...] // Return balance to accumulate
///   });
///   balance = balanceOpt;
/// }
/// tx.transferObjects([balance], user); // Final: 1 NFT with all dust!
/// ```
public fun swap_spot_stable_to_asset<AssetType, StableType, LPType>(
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    mut stable_in: Coin<StableType>,
    min_asset_out: u64,
    recipient: address,
    mut existing_balance_opt: option::Option<ConditionalMarketBalance<AssetType, StableType>>,
    return_balance: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): (
    option::Option<Coin<AssetType>>,
    option::Option<ConditionalMarketBalance<AssetType, StableType>>,
) {
    let amount_in = stable_in.value();
    assert!(amount_in > 0, EZeroAmount);

    // Check if proposal is live for optimal routing
    let proposal_state = proposal::state(proposal);

    if (proposal_state == STATE_TRADING) {
        // Direct swap in spot pool
        let asset_out = unified_spot_pool::swap_stable_for_asset(
            spot_pool,
            stable_in,
            min_asset_out,
            clock,
            ctx,
        );

        // Validate slippage on total output
        assert!(asset_out.value() >= min_asset_out, EZeroAmount);

        // CRITICAL: Automatic arbitrage to bring spot price back into conditional range
        // After spot swaps with routing, spot can be outside the safe range. This atomically
        // arbitrages using pool liquidity to rebalance prices without requiring user coins.
        existing_balance_opt =
            arbitrage::auto_rebalance_spot_after_conditional_swaps(
                spot_pool,
                escrow,
                existing_balance_opt,
                clock,
                ctx,
            );

        // Check no-arb guard (ensures swap didn't violate price constraints)
        {
            let market_state = coin_escrow::get_market_state(escrow);
            let pools = market_state::borrow_amm_pools(market_state);
            no_arb_guard::ensure_spot_in_band(spot_pool, pools);
        };

        // Return output
        if (return_balance) {
            (option::some(asset_out), existing_balance_opt)
        } else {
            transfer::public_transfer(asset_out, recipient);
            if (option::is_some(&existing_balance_opt)) {
                transfer::public_transfer(option::extract(&mut existing_balance_opt), recipient);
            };
            option::destroy_none(existing_balance_opt);
            (
                option::none<Coin<AssetType>>(),
                option::none<ConditionalMarketBalance<AssetType, StableType>>(),
            )
        }
    } else {
        // No arb (proposal not trading) - do manual swap
        let asset_out = unified_spot_pool::swap_stable_for_asset(
            spot_pool,
            stable_in,
            min_asset_out,
            clock,
            ctx,
        );

        if (return_balance) {
            // Return coins and existing balance (if any) to caller
            (option::some(asset_out), existing_balance_opt)
        } else {
            // Transfer everything to recipient
            transfer::public_transfer(asset_out, recipient);
            if (option::is_some(&existing_balance_opt)) {
                transfer::public_transfer(option::extract(&mut existing_balance_opt), recipient);
            };
            option::destroy_none(existing_balance_opt);
            (
                option::none<Coin<AssetType>>(),
                option::none<ConditionalMarketBalance<AssetType, StableType>>(),
            )
        }
    }
}

/// Swap asset → stable in spot market with automatic arbitrage
///
/// **DCA BOT & AGGREGATOR COMPATIBLE** - Supports auto-merge and flexible return modes
///
/// # Arguments
/// * `existing_balance_opt` - Optional balance to merge into (DCA bots: pass previous balance)
/// * `return_balance` - If true: return balance to caller. If false: transfer to recipient
///
/// # Returns
/// * `option::Option<Coin<StableType>>` - Stable output (Some only when `return_balance=true`)
/// * `option::Option<ConditionalMarketBalance>` - Dust balance (Some only when `return_balance=true`)
///
/// # Use Cases
///
/// **Regular User (one swap):**
/// ```typescript
/// tx.moveCall({
///   arguments: [..., recipient, null, false, ...] // Transfer balance to recipient
/// });
/// ```
///
/// **DCA Bot (100 swaps → 1 NFT):**
/// ```typescript
/// let balance = null;
/// for (let i = 0; i < 100; i++) {
///   const [stableOut, balanceOpt] = tx.moveCall({
///     arguments: [..., botAddress, balance, true, ...] // Return balance to accumulate
///   });
///   balance = balanceOpt;
/// }
/// tx.transferObjects([balance], user); // Final: 1 NFT with all dust!
/// ```
public fun swap_spot_asset_to_stable<AssetType, StableType, LPType>(
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    mut asset_in: Coin<AssetType>,
    min_stable_out: u64,
    recipient: address,
    mut existing_balance_opt: option::Option<ConditionalMarketBalance<AssetType, StableType>>,
    return_balance: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): (
    option::Option<Coin<StableType>>,
    option::Option<ConditionalMarketBalance<AssetType, StableType>>,
) {
    let amount_in = asset_in.value();
    assert!(amount_in > 0, EZeroAmount);

    // Check if proposal is live for optimal routing
    let proposal_state = proposal::state(proposal);

    if (proposal_state == STATE_TRADING) {
        // Direct swap in spot pool
        let stable_out = unified_spot_pool::swap_asset_for_stable(
            spot_pool,
            asset_in,
            min_stable_out,
            clock,
            ctx,
        );

        // Validate slippage on total output
        assert!(stable_out.value() >= min_stable_out, EZeroAmount);

        // CRITICAL: Automatic arbitrage to bring spot price back into conditional range
        // After spot swaps with routing, spot can be outside the safe range. This atomically
        // arbitrages using pool liquidity to rebalance prices without requiring user coins.
        existing_balance_opt =
            arbitrage::auto_rebalance_spot_after_conditional_swaps(
                spot_pool,
                escrow,
                existing_balance_opt,
                clock,
                ctx,
            );

        // Check no-arb guard (ensures swap didn't violate price constraints)
        {
            let market_state = coin_escrow::get_market_state(escrow);
            let pools = market_state::borrow_amm_pools(market_state);
            no_arb_guard::ensure_spot_in_band(spot_pool, pools);
        };

        // Return output
        if (return_balance) {
            (option::some(stable_out), existing_balance_opt)
        } else {
            transfer::public_transfer(stable_out, recipient);
            if (option::is_some(&existing_balance_opt)) {
                transfer::public_transfer(option::extract(&mut existing_balance_opt), recipient);
            };
            option::destroy_none(existing_balance_opt);
            (
                option::none<Coin<StableType>>(),
                option::none<ConditionalMarketBalance<AssetType, StableType>>(),
            )
        }
    } else {
        // No arb (proposal not trading) - do manual swap
        let stable_out = unified_spot_pool::swap_asset_for_stable(
            spot_pool,
            asset_in,
            min_stable_out,
            clock,
            ctx,
        );

        if (return_balance) {
            // Return coins and existing balance (if any) to caller
            (option::some(stable_out), existing_balance_opt)
        } else {
            // Transfer everything to recipient
            transfer::public_transfer(stable_out, recipient);
            if (option::is_some(&existing_balance_opt)) {
                transfer::public_transfer(option::extract(&mut existing_balance_opt), recipient);
            };
            option::destroy_none(existing_balance_opt);
            (
                option::none<Coin<StableType>>(),
                option::none<ConditionalMarketBalance<AssetType, StableType>>(),
            )
        }
    }
}

// === CONDITIONAL SWAP BATCHING ===
//
// PTB-based conditional swap batching for advanced traders.
// Allows chaining multiple conditional swaps, then settling at the end.
//
// Hot potato pattern ensures complete set closure.
//
// Flow:
// 1. begin_conditional_swaps() → creates ConditionalSwapBatch hot potato
// 2. swap_in_batch() × N → accumulates swaps in balance (chainable)
// 3. finalize_conditional_swaps() → closes complete sets, returns profit + incomplete set balance
//
// ============================================================================

/// Hot potato for batching conditional swaps in PTB
/// NO abilities = MUST be consumed in same transaction
///
/// This forces users to call finalize_conditional_swaps() at end of PTB,
/// which closes complete sets and returns profit. Cannot store between transactions.
public struct ConditionalSwapBatch<phantom AssetType, phantom StableType> {
    balance: ConditionalMarketBalance<AssetType, StableType>,
    market_id: ID,
}

/// Step 1: Begin a conditional swap batch (returns hot potato)
///
/// Creates hot potato with empty balance. Must be consumed by finalize_conditional_swaps().
///
/// # Example PTB Flow
/// ```typescript
/// const batch = tx.moveCall({
///   target: '${PKG}::swap_entry::begin_conditional_swaps',
///   typeArguments: [AssetType, StableType],
///   arguments: [escrow]
/// });
///
/// // Chain swaps...
/// const batch2 = tx.moveCall({
///   target: '${PKG}::swap_entry::swap_in_batch',
///   arguments: [batch, session, escrow, ...] // Returns modified hot potato
/// });
///
/// // Must finalize at end
/// tx.moveCall({
///   target: '${PKG}::swap_entry::finalize_conditional_swaps',
///   arguments: [batch2, ...]
/// });
/// ```
public fun begin_conditional_swaps<AssetType, StableType>(
    escrow: &TokenEscrow<AssetType, StableType>,
    ctx: &mut TxContext,
): ConditionalSwapBatch<AssetType, StableType> {
    // Get market info
    let market_state = coin_escrow::get_market_state(escrow);
    market_state::assert_trading_active(market_state);

    let market_id = market_state::market_id(market_state);
    let outcome_count = market_state::outcome_count(market_state);

    // Create empty balance
    let balance = conditional_balance::new<AssetType, StableType>(
        market_id,
        (outcome_count as u8),
        ctx,
    );

    // Return hot potato (NO abilities = must consume)
    ConditionalSwapBatch {
        balance,
        market_id,
    }
}

/// Step 2: Swap in batch (consumes and returns hot potato)
///
/// Wraps coin → swaps in balance → unwraps to coin → returns modified hot potato
///
/// Can be called N times in a PTB to chain swaps across multiple outcomes.
/// Each call mutates the balance in the hot potato and returns it for next call.
///
/// # Arguments
/// * `batch` - Hot potato from begin_conditional_swaps or previous swap_in_batch
/// * `session` - SwapSession hot potato (from swap_core::begin_swap_session)
/// * `outcome_index` - Which outcome to swap in (0, 1, 2, ...)
/// * `coin_in` - Input coin (conditional asset or stable)
/// * `is_asset_to_stable` - true = swap asset→stable, false = swap stable→asset
/// * `min_amount_out` - Minimum output amount (slippage protection)
///
/// # Returns
/// Modified hot potato (pass to next swap_in_batch or finalize_conditional_swaps)
///
/// # Type Parameters
/// * `InputCoin` - Type of input conditional coin
/// * `OutputCoin` - Type of output conditional coin
///
/// # Example
/// ```typescript
/// // Swap in outcome 0: stable → asset
/// let batch = tx.moveCall({
///   target: '${PKG}::swap_entry::swap_in_batch',
///   typeArguments: [AssetType, StableType, Cond0Stable, Cond0Asset],
///   arguments: [batch, session, escrow, 0, stableCoin, false, minOut, clock]
/// });
///
/// // Swap in outcome 1: asset → stable
/// batch = tx.moveCall({
///   target: '${PKG}::swap_entry::swap_in_batch',
///   typeArguments: [AssetType, StableType, Cond1Asset, Cond1Stable],
///   arguments: [batch, session, escrow, 1, assetCoin, true, minOut, clock]
/// });
/// ```
public fun swap_in_batch<AssetType, StableType, InputCoin, OutputCoin>(
    mut batch: ConditionalSwapBatch<AssetType, StableType>,
    session: &swap_core::SwapSession,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    outcome_index: u8,
    coin_in: Coin<InputCoin>,
    is_asset_to_stable: bool,
    min_amount_out: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): (ConditionalSwapBatch<AssetType, StableType>, Coin<OutputCoin>) {
    let amount_in = coin_in.value();
    assert!(amount_in > 0, EZeroAmount);

    // Validate market still active
    let market_state = coin_escrow::get_market_state(escrow);
    market_state::assert_trading_active(market_state);

    // Wrap coin → balance
    conditional_balance::wrap_coin<AssetType, StableType, InputCoin>(
        &mut batch.balance,
        escrow,
        coin_in,
        outcome_index,
        is_asset_to_stable, // is_asset = matches input type (asset→stable: burn asset, stable→asset: burn stable)
    );

    // Swap in balance (balance-based swap works for ANY outcome count!)
    let _amount_out = if (is_asset_to_stable) {
        swap_core::swap_balance_asset_to_stable<AssetType, StableType>(
            session,
            escrow,
            &mut batch.balance,
            outcome_index,
            amount_in,
            min_amount_out,
            clock,
            ctx,
        )
    } else {
        swap_core::swap_balance_stable_to_asset<AssetType, StableType>(
            session,
            escrow,
            &mut batch.balance,
            outcome_index,
            amount_in,
            min_amount_out,
            clock,
            ctx,
        )
    };

    // Unwrap balance → coin
    let coin_out = conditional_balance::unwrap_to_coin<AssetType, StableType, OutputCoin>(
        &mut batch.balance,
        escrow,
        outcome_index,
        !is_asset_to_stable, // is_asset = matches output type (asset→stable: mint stable, stable→asset: mint asset)
        ctx,
    );

    // Return modified hot potato and output coin
    (batch, coin_out)
}

/// Step 3: Finalize conditional swaps (consumes hot potato)
///
/// Closes complete sets from accumulated balance, withdraws spot coins as profit,
/// and transfers to recipient. Returns remaining incomplete set as ConditionalMarketBalance
/// for professional traders to manage their own positions.
///
/// This MUST be called at end of PTB to consume hot potato.
///
/// # Arguments
/// * `batch` - Hot potato from swap_in_batch (final state)
/// * `spot_pool` - Spot pool (for no-arb guard, NOT for swapping)
/// * `proposal` - Proposal object
/// * `escrow` - Token escrow
/// * `session` - SwapSession hot potato (consumed here)
/// * `recipient` - Who receives profit and incomplete set
/// * `clock` - Clock object
///
/// # Flow
/// 1. Find minimum balance across outcomes (complete set limit)
/// 2. Burn complete sets → withdraw spot coins
/// 3. Transfer profit to recipient
/// 4. Transfer incomplete set balance to recipient (for pro traders to manage)
/// 5. Finalize session (updates early resolve metrics ONCE)
///
/// # Example PTB
/// ```typescript
/// tx.moveCall({
///   target: '${PKG}::swap_entry::finalize_conditional_swaps',
///   typeArguments: [AssetType, StableType],
///   arguments: [batch, spot_pool, proposal, escrow, session, recipient, clock]
/// });
/// ```
public fun finalize_conditional_swaps<AssetType, StableType, LPType>(
    batch: ConditionalSwapBatch<AssetType, StableType>,
    spot_pool: &mut UnifiedSpotPool<AssetType, StableType, LPType>,
    _proposal: &mut Proposal<AssetType, StableType>,
    escrow: &mut TokenEscrow<AssetType, StableType>,
    session: swap_core::SwapSession,
    recipient: address,
    _clock: &Clock,
    ctx: &mut TxContext,
) {
    // Destructure hot potato
    let ConditionalSwapBatch { mut balance, market_id: _ } = batch;

    // Find minimum balances (complete set limits)
    let min_asset = conditional_balance::find_min_balance(&balance, true);
    let min_stable = conditional_balance::find_min_balance(&balance, false);

    // Burn complete sets and withdraw spot coins
    let spot_asset = if (min_asset > 0) {
        arbitrage::burn_complete_set_and_withdraw_asset<AssetType, StableType>(
            &mut balance,
            escrow,
            min_asset,
            ctx,
        )
    } else {
        coin::zero<AssetType>(ctx)
    };

    let spot_stable = if (min_stable > 0) {
        arbitrage::burn_complete_set_and_withdraw_stable<AssetType, StableType>(
            &mut balance,
            escrow,
            min_stable,
            ctx,
        )
    } else {
        coin::zero<StableType>(ctx)
    };

    // Finalize session
    swap_core::finalize_swap_session(session, escrow);

    // CRITICAL: Automatic arbitrage to bring spot price back into conditional range
    // After conditional swaps, spot can be outside the safe range. This atomically
    // arbitrages using pool liquidity to rebalance prices without requiring user coins.
    let mut balance_opt = arbitrage::auto_rebalance_spot_after_conditional_swaps(
        spot_pool,
        escrow,
        option::some(balance),
        _clock,
        ctx,
    );
    // Extract balance (must exist since we passed Some)
    balance = option::extract(&mut balance_opt);
    option::destroy_none(balance_opt);

    // Ensure no-arb band is respected after batch swaps + auto-arb
    let market_state = coin_escrow::get_market_state(escrow);
    let pools = market_state::borrow_amm_pools(market_state);
    no_arb_guard::ensure_spot_in_band(spot_pool, pools);

    // Transfer spot profit to recipient
    if (spot_asset.value() > 0) {
        transfer::public_transfer(spot_asset, recipient);
    } else {
        coin::destroy_zero(spot_asset);
    };

    if (spot_stable.value() > 0) {
        transfer::public_transfer(spot_stable, recipient);
    } else {
        coin::destroy_zero(spot_stable);
    };

    // Transfer incomplete set balance to recipient (for pro traders to manage)
    // They can choose to:
    // - Hold and wait for proposal resolution
    // - Rebalance positions across outcomes
    // - Sell to market makers
    // - Store in registry themselves if desired
    transfer::public_transfer(balance, recipient);
}
