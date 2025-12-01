/**
 * Arbitrage Core Module
 *
 * Complex arbitrage logic extracted from arbitrage_executor.
 * All the hard algorithmic stuff lives here. Per-N wrappers just call these with explicit types.
 *
 * AUDITOR: This is where the real arbitrage algorithms are.
 *
 * Key Functions:
 * - Profit validation before execution
 * - Spot pool swaps (asset ↔ stable)
 * - Quantum minting (deposit once, mint N conditional tokens)
 * - Complete set burning (burn N conditionals, withdraw spot)
 * - Conditional token burning with withdrawal
 *
 * @module arbitrage-core
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Arbitrage Core Static Functions
 *
 * Low-level arbitrage primitives used by high-level arbitrage executors.
 */
export class ArbitrageCore {
  /**
   * Validate arbitrage is profitable before execution
   *
   * Calculates expected profit and asserts it meets minimum threshold.
   * Returns expected profit as u128 for use in subsequent operations.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Expected profit (u128)
   */
  static validateProfitable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      arbAmount: bigint;
      minProfitOut: bigint;
      isSpotSwapStableToAsset: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'validate_profitable'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spotPool,
        config.escrow,
        tx.pure.u64(config.arbAmount),
        tx.pure.u64(config.minProfitOut),
        tx.pure.bool(config.isSpotSwapStableToAsset),
      ],
    });
  }

  /**
   * Swap stable → asset in spot pool
   *
   * Used in arbitrage when spot stable is cheaper than conditional stable.
   * No intermediate minimum (atomic execution).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Asset coin
   */
  static spotSwapStableToAsset(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      stableForArb: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'spot_swap_stable_to_asset'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spotPool,
        config.stableForArb,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Swap asset → stable in spot pool
   *
   * Used in arbitrage when spot asset is cheaper than conditional asset.
   * No intermediate minimum (atomic execution).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Stable coin
   */
  static spotSwapAssetToStable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      assetForArb: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'spot_swap_asset_to_stable'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spotPool,
        config.assetForArb,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Deposit asset ONCE for quantum minting N conditional assets
   *
   * Quantum minting: Deposit spot asset once, get conditional assets for ALL outcomes.
   * This is the "complete set minting" primitive.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositAssetForQuantumMint(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      escrow: ReturnType<Transaction['moveCall']>;
      asset: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'deposit_asset_for_quantum_mint'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.escrow, config.asset],
    });
  }

  /**
   * Deposit stable ONCE for quantum minting N conditional stables
   *
   * Quantum minting: Deposit spot stable once, get conditional stables for ALL outcomes.
   * This is the "complete set minting" primitive.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositStableForQuantumMint(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      escrow: ReturnType<Transaction['moveCall']>;
      stable: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'deposit_stable_for_quantum_mint'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.escrow, config.stable],
    });
  }

  /**
   * Find minimum value across coins
   *
   * Used to determine complete set size (minimum across all outcomes).
   * Returns the smallest coin amount in the vector.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Minimum amount (u64)
   */
  static findMinValue(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      coinType: string;
      coins: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'find_min_value'),
      typeArguments: [config.coinType],
      arguments: [config.coins],
    });
  }

  /**
   * Withdraw spot stable after burning complete sets
   *
   * Used after burning complete sets to extract the underlying spot stable.
   * Part of the arbitrage profit extraction flow.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot stable coin
   */
  static withdrawStable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      escrow: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'withdraw_stable'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.escrow, tx.pure.u64(config.amount)],
    });
  }

  /**
   * Withdraw spot asset after burning complete sets
   *
   * Used after burning complete sets to extract the underlying spot asset.
   * Part of the arbitrage profit extraction flow.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot asset coin
   */
  static withdrawAsset(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      escrow: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'withdraw_asset'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.escrow, tx.pure.u64(config.amount)],
    });
  }

  /**
   * Burn conditional asset and withdraw spot asset
   *
   * Used in conditional arbitrage to convert conditional → spot.
   * Burns conditional token, withdraws equivalent spot asset from escrow.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot asset coin
   */
  static burnAndWithdrawConditionalAsset(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      conditionalAssetType: string;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      conditional: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'burn_and_withdraw_conditional_asset'),
      typeArguments: [config.assetType, config.stableType, config.conditionalAssetType],
      arguments: [
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        config.conditional,
      ],
    });
  }

  /**
   * Burn conditional stable and withdraw spot stable
   *
   * Used in conditional arbitrage to convert conditional → spot.
   * Burns conditional token, withdraws equivalent spot stable from escrow.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot stable coin
   */
  static burnAndWithdrawConditionalStable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      conditionalStableType: string;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      conditional: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_core', 'burn_and_withdraw_conditional_stable'),
      typeArguments: [config.assetType, config.stableType, config.conditionalStableType],
      arguments: [
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        config.conditional,
      ],
    });
  }
}
