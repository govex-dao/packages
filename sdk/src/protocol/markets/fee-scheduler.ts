/**
 * Fee Scheduler Operations
 *
 * Dynamic AMM fee scheduling with linear decay from high launch fees to spot fees.
 * Supports MEV protection with fees up to 99% that decay linearly over 0-24 hours.
 *
 * After decay period ends, pool uses permanent spot fee (e.g., 0.3%).
 *
 * @module fee-scheduler
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Fee Scheduler Static Functions
 *
 * Configure and query dynamic fee schedules for conditional AMM pools.
 *
 * @example Create launch schedule with 99% fee decaying to 0.3% over 1 hour
 * ```typescript
 * const schedule = FeeScheduler.newSchedule(tx, {
 *   marketsPackageId,
 *   initialFeeBps: 9900n, // 99%
 *   durationMs: 3600000n, // 1 hour
 * });
 * ```
 */
export class FeeScheduler {
  /**
   * Create new fee schedule with linear decay
   *
   * Schedules linear decay from high initial MEV fee (0-99%) to pool's base spot fee.
   * After decay period ends, pool permanently uses its base spot_amm_fee_bps.
   *
   * **Constraints:**
   * - initial_fee_bps must be <= 9900 (99% maximum - DAO policy)
   * - duration_ms must be <= 86,400,000 (24 hours maximum)
   * - If duration_ms is 0, MEV protection is skipped entirely
   * - If initial_fee_bps is 0, effectively no MEV protection
   *
   * **Decay Formula:**
   * fee(t) = initial_fee_bps - (initial_fee_bps - final_fee_bps) * (t / duration_ms)
   *
   * @param tx - Transaction
   * @param config - Fee schedule configuration
   * @returns FeeSchedule struct
   *
   * @example 99% fee decaying to spot over 1 hour
   * ```typescript
   * const schedule = FeeScheduler.newSchedule(tx, {
   *   marketsPackageId,
   *   initialFeeBps: 9900n, // 99%
   *   durationMs: 3_600_000n, // 1 hour
   * });
   * ```
   *
   * @example No MEV protection (use spot fee immediately)
   * ```typescript
   * const schedule = FeeScheduler.newSchedule(tx, {
   *   marketsPackageId,
   *   initialFeeBps: 30n, // 0.3%
   *   durationMs: 0n, // No decay
   * });
   * ```
   */
  static newSchedule(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      initialFeeBps: bigint;
      durationMs: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'fee_scheduler',
        'new_schedule'
      ),
      arguments: [tx.pure.u64(config.initialFeeBps), tx.pure.u64(config.durationMs)],
    });
  }

  /**
   * Calculate current fee based on elapsed time and pool's base fee
   *
   * Uses LINEAR decay (simple, fast, predictable).
   *
   * **Edge cases:**
   * - t = 0: return initial_fee_bps (max MEV protection)
   * - t >= duration: return final_fee_bps (spot fee)
   * - duration = 0: skip MEV, always return final_fee_bps
   *
   * @param tx - Transaction
   * @param config - Fee calculation configuration
   * @returns Current fee in basis points (u64)
   *
   * @example Calculate current fee
   * ```typescript
   * const currentFee = FeeScheduler.getCurrentFee(tx, {
   *   marketsPackageId,
   *   schedule,
   *   finalFeeBps: 30n, // 0.3% spot fee
   *   startTime: launchTimestamp,
   *   currentTime: nowTimestamp,
   * });
   * ```
   */
  static getCurrentFee(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      schedule: ReturnType<Transaction['moveCall']>;
      finalFeeBps: bigint;
      startTime: bigint;
      currentTime: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'fee_scheduler',
        'get_current_fee'
      ),
      arguments: [
        config.schedule,
        tx.pure.u64(config.finalFeeBps),
        tx.pure.u64(config.startTime),
        tx.pure.u64(config.currentTime),
      ],
    });
  }

  /**
   * Get default launch schedule
   *
   * Returns recommended fee schedule for new pool launches:
   * - 99% initial fee for maximum MEV protection
   * - 1 hour decay period
   *
   * @returns FeeSchedule with 9900 bps initial, 3600000 ms duration
   */
  static defaultLaunchSchedule(
    tx: Transaction,
    marketsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'fee_scheduler',
        'default_launch_schedule'
      ),
      arguments: [],
    });
  }

  /**
   * Get initial fee from schedule
   *
   * @returns Initial fee in basis points
   */
  static initialFeeBps(
    tx: Transaction,
    marketsPackageId: string,
    schedule: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'fee_scheduler',
        'initial_fee_bps'
      ),
      arguments: [schedule],
    });
  }

  /**
   * Get duration from schedule
   *
   * @returns Duration in milliseconds
   */
  static durationMs(
    tx: Transaction,
    marketsPackageId: string,
    schedule: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'fee_scheduler', 'duration_ms'),
      arguments: [schedule],
    });
  }

  /**
   * Get maximum allowed initial fee (constant)
   *
   * @returns 9900 (99%)
   */
  static maxInitialFeeBps(
    tx: Transaction,
    marketsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'fee_scheduler',
        'max_initial_fee_bps'
      ),
      arguments: [],
    });
  }

  /**
   * Get maximum allowed duration (constant)
   *
   * @returns 86,400,000 (24 hours in milliseconds)
   */
  static maxDurationMs(
    tx: Transaction,
    marketsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'fee_scheduler',
        'max_duration_ms'
      ),
      arguments: [],
    });
  }

  /**
   * Get fee scale constant (basis points scale)
   *
   * @returns 10000 (100% in basis points)
   */
  static feeScale(
    tx: Transaction,
    marketsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'fee_scheduler', 'fee_scale'),
      arguments: [],
    });
  }
}
