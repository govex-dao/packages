/**
 * Liquidity Initialize Module
 *
 * Methods to initialize AMM liquidity using TreasuryCap-based conditional coins.
 * Assumes TreasuryCaps have been registered with escrow before calling.
 *
 * @module liquidity-initialize
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Liquidity Initialize Static Functions
 *
 * Create outcome markets with initial liquidity.
 */
export class LiquidityInitialize {
  /**
   * Create outcome markets using TreasuryCap-based conditional coins
   *
   * IMPORTANT: TreasuryCaps must be registered with escrow BEFORE calling this function.
   * The caller (PTB) must have called register_conditional_caps() N times before this.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Vector of LiquidityPool objects
   *
   * @example
   * ```typescript
   * const pools = LiquidityInitialize.createOutcomeMarkets(tx, {
   *   marketsCorePackageId,
   *   assetType,
   *   stableType,
   *   escrow,
   *   outcomeCount: 2,
   *   assetAmounts: [10_000_000_000n, 10_000_000_000n],
   *   stableAmounts: [10_000_000_000n, 10_000_000_000n],
   *   twapStartDelay: 300_000n, // 5 minutes
   *   twapInitialObservation: 1_000_000_000_000n, // $1
   *   twapStepMax: 3_600_000n, // 1 hour
   *   ammTotalFeeBps: 30n, // 0.3%
   *   initialAsset: assetBalance,
   *   initialStable: stableBalance,
   *   clock: '0x6',
   * });
   * ```
   */
  static createOutcomeMarkets(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeCount: bigint;
      assetAmounts: bigint[];
      stableAmounts: bigint[];
      twapStartDelay: bigint;
      twapInitialObservation: bigint;
      twapStepMax: bigint;
      ammTotalFeeBps: bigint;
      initialAsset: ReturnType<Transaction['moveCall']>;
      initialStable: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsCorePackageId,
        'liquidity_initialize',
        'create_outcome_markets'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.escrow,
        tx.pure.u64(config.outcomeCount),
        tx.pure.vector('u64', config.assetAmounts.map(a => Number(a))),
        tx.pure.vector('u64', config.stableAmounts.map(s => Number(s))),
        tx.pure.u64(config.twapStartDelay),
        tx.pure.u128(config.twapInitialObservation),
        tx.pure.u64(config.twapStepMax),
        tx.pure.u64(config.ammTotalFeeBps),
        config.initialAsset,
        config.initialStable,
        tx.object(config.clock || '0x6'),
      ],
    });
  }
}
