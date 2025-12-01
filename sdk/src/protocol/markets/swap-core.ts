/**
 * Swap Core Module
 *
 * Core swap primitives (building blocks).
 * Internal library providing low-level swap functions used by other modules.
 *
 * Users don't call this directly - use swap_entry.move instead.
 *
 * Hot potato pattern ensures session validation:
 * 1. begin_swap_session() - creates SwapSession hot potato
 * 2. swap_*() - validates session, performs swaps
 * 3. finalize_swap_session() - consumes hot potato
 *
 * @module swap-core
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Swap Core Static Functions
 *
 * Low-level swap functions with session management.
 */
export class SwapCore {
  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Begin a swap session (creates hot potato)
   *
   * Must be called before any swaps in a PTB.
   * Creates a hot potato that must be consumed by finalizeSwapSession().
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns SwapSession hot potato
   */
  static beginSwapSession(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      escrow: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'swap_core', 'begin_swap_session'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.escrow],
    });
  }

  /**
   * Finalize swap session (consumes hot potato)
   *
   * Must be called at end of PTB to consume the SwapSession.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static finalizeSwapSession(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      session: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'swap_core', 'finalize_swap_session'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.session, config.escrow],
    });
  }

  // ============================================================================
  // Core Swap Functions (Typed Coins)
  // ============================================================================

  /**
   * Swap conditional asset coins to conditional stable coins
   *
   * Uses TreasuryCap system: burn input → AMM calculation → mint output.
   * Requires valid SwapSession to ensure metrics are updated at end of PTB.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Conditional stable coin
   */
  static swapAssetToStable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      assetConditionalCoin: string;
      stableConditionalCoin: string;
      session: ReturnType<Transaction['moveCall']>;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      assetIn: ReturnType<Transaction['moveCall']>;
      minAmountOut: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'swap_core', 'swap_asset_to_stable'),
      typeArguments: [config.assetType, config.stableType, config.assetConditionalCoin, config.stableConditionalCoin],
      arguments: [
        config.session,
        config.proposal,
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        config.assetIn,
        tx.pure.u64(config.minAmountOut),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Swap conditional stable coins to conditional asset coins
   *
   * Requires valid SwapSession to ensure metrics are updated at end of PTB.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Conditional asset coin
   */
  static swapStableToAsset(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      assetConditionalCoin: string;
      stableConditionalCoin: string;
      session: ReturnType<Transaction['moveCall']>;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      stableIn: ReturnType<Transaction['moveCall']>;
      minAmountOut: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'swap_core', 'swap_stable_to_asset'),
      typeArguments: [config.assetType, config.stableType, config.assetConditionalCoin, config.stableConditionalCoin],
      arguments: [
        config.session,
        config.proposal,
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        config.stableIn,
        tx.pure.u64(config.minAmountOut),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Balance-Based Swap Functions
  // ============================================================================

  /**
   * Swap from balance: conditional asset → conditional stable
   *
   * Works for ANY outcome count by operating on balance indices.
   * No conditional coin type parameters needed!
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Amount out (u64)
   */
  static swapBalanceAssetToStable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      session: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      balance: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
      amountIn: bigint;
      minAmountOut: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'swap_core', 'swap_balance_asset_to_stable'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.session,
        config.escrow,
        config.balance,
        tx.pure.u8(config.outcomeIdx),
        tx.pure.u64(config.amountIn),
        tx.pure.u64(config.minAmountOut),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Swap from balance: conditional stable → conditional asset
   *
   * Works for ANY outcome count by operating on balance indices.
   * No conditional coin type parameters needed!
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Amount out (u64)
   */
  static swapBalanceStableToAsset(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      session: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      balance: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
      amountIn: bigint;
      minAmountOut: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'swap_core', 'swap_balance_stable_to_asset'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.session,
        config.escrow,
        config.balance,
        tx.pure.u8(config.outcomeIdx),
        tx.pure.u64(config.amountIn),
        tx.pure.u64(config.minAmountOut),
        tx.object(config.clock || '0x6'),
      ],
    });
  }
}
