/**
 * No-Arbitrage Band Enforcement
 *
 * Prevents arbitrage loops by ensuring spot price stays within bounds
 * implied by conditional market prices and fees.
 *
 * Mathematical invariant enforced:
 * floor ≤ P_spot ≤ ceiling
 *
 * where:
 * - floor = (1 - f_s) * min_i[(1 - f_i) * p_i]
 * - ceiling = (1/(1 - f_s)) * Σ_i[p_i/(1 - f_i)]
 *
 * @module no-arb-guard
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../../services/transaction';

/**
 * No-Arbitrage Guard Static Functions
 *
 * Enforces no-arbitrage bands to prevent circular arbitrage.
 *
 * @example Check no-arb band
 * ```typescript
 * const [isInBand, price, floor, ceiling] = NoArbGuard.checkSpotInBand(tx, {
 *   marketsOperationsPackageId,
 *   assetType,
 *   stableType,
 *   spotPool,
 *   conditionalPools,
 * });
 * ```
 */
export class NoArbGuard {
  /**
   * Compute instantaneous no-arb floor/ceiling for spot price
   *
   * Returns minimum and maximum spot price that prevent arbitrage.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (floor, ceiling) both on PRICE_SCALE (1e12)
   *
   * @example
   * ```typescript
   * const [floor, ceiling] = NoArbGuard.computeNoarbBand(tx, {
   *   marketsOperationsPackageId,
   *   assetType,
   *   stableType,
   *   spotPool,
   *   conditionalPools,
   * });
   * ```
   */
  static computeNoarbBand(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      conditionalPools: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'no_arb_guard',
        'compute_noarb_band'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spotPool, config.conditionalPools],
    });
  }

  /**
   * Ensure spot price is within no-arb band
   *
   * Reverts if spot price violates the no-arb band.
   * Call after auto-arb to verify no arbitrage loop exists.
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @throws If spot price is below floor (enables Spot→Cond→Spot arb)
   * @throws If spot price is above ceiling (enables Cond→Spot→Cond arb)
   */
  static ensureSpotInBand(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      conditionalPools: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'no_arb_guard',
        'ensure_spot_in_band'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spotPool, config.conditionalPools],
    });
  }

  /**
   * Check if spot price is within band without reverting
   *
   * Safe version that returns result instead of reverting.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (is_in_band, current_price, floor, ceiling)
   *
   * @example
   * ```typescript
   * const [isInBand, price, floor, ceiling] = NoArbGuard.checkSpotInBand(tx, {
   *   marketsOperationsPackageId,
   *   assetType,
   *   stableType,
   *   spotPool,
   *   conditionalPools,
   * });
   * ```
   */
  static checkSpotInBand(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      conditionalPools: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'no_arb_guard',
        'check_spot_in_band'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spotPool, config.conditionalPools],
    });
  }
}
