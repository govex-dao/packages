/**
 * PCW TWAP Oracle Operations
 *
 * Price-Cumulative-Weighted Time-Weighted Average Price oracle.
 * Advanced TWAP implementation with checkpointing and movement limits.
 *
 * Used for spot pools and general price tracking.
 *
 * @module pcw-twap-oracle
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * PCW TWAP Oracle Static Functions
 *
 * Manage advanced TWAP oracle with checkpointing.
 *
 * @example Create new PCW oracle
 * ```typescript
 * const oracle = PCWTwapOracle.newDefault(tx, {
 *   marketsPackageId,
 *   initialPrice: 1_000_000_000n, // $1
 *   clock: '0x6',
 * });
 * ```
 */
export class PCWTwapOracle {
  // ============================================================================
  // Creation
  // ============================================================================

  /**
   * Create new PCW TWAP oracle with default parameters
   *
   * Uses standard configuration:
   * - 7 day window size
   * - 10% max movement per update
   *
   * @param tx - Transaction
   * @param config - Oracle configuration
   * @returns PCW_TWAP_Oracle object
   *
   * @example
   * ```typescript
   * const oracle = PCWTwapOracle.newDefault(tx, {
   *   marketsPackageId,
   *   initialPrice: 1_000_000_000n, // $1
   *   clock: '0x6',
   * });
   * ```
   */
  static newDefault(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      initialPrice: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'new_default'
      ),
      arguments: [tx.pure.u128(config.initialPrice), tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Create new PCW TWAP oracle with custom parameters
   *
   * @param tx - Transaction
   * @param config - Oracle configuration
   * @returns PCW_TWAP_Oracle object
   *
   * @example
   * ```typescript
   * const oracle = PCWTwapOracle.new(tx, {
   *   marketsPackageId,
   *   initialPrice: 1_000_000_000n, // $1
   *   windowSizeMs: 7 * 24 * 60 * 60 * 1000n, // 7 days
   *   maxMovementPpm: 100_000n, // 10%
   *   clock: '0x6',
   * });
   * ```
   */
  static new(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      initialPrice: bigint;
      windowSizeMs: bigint;
      maxMovementPpm: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsPackageId, 'PCW_TWAP_oracle', 'new'),
      arguments: [
        tx.pure.u128(config.initialPrice),
        tx.pure.u64(config.windowSizeMs),
        tx.pure.u64(config.maxMovementPpm),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Update Functions
  // ============================================================================

  /**
   * Update oracle with new price observation
   *
   * Records new price and updates cumulative values.
   * Automatically commits checkpoint if needed.
   *
   * @param tx - Transaction
   * @param config - Update configuration
   */
  static update(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      newPrice: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsPackageId, 'PCW_TWAP_oracle', 'update'),
      arguments: [config.oracle, tx.pure.u128(config.newPrice), tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Try to commit checkpoint
   *
   * Commits checkpoint if conditions are met.
   * Returns true if checkpoint was committed.
   *
   * @returns True if checkpoint committed
   */
  static tryCommitCheckpoint(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'try_commit_checkpoint'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Force commit checkpoint
   *
   * Always commits checkpoint regardless of conditions.
   */
  static forceCommitCheckpoint(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'force_commit_checkpoint'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Backfill oracle from conditional oracle
   *
   * Initializes PCW oracle using data from conditional oracle.
   * Used during market creation.
   */
  static backfillFromConditional(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      pcwOracle: ReturnType<Transaction['moveCall']>;
      conditionalOracle: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'backfill_from_conditional'
      ),
      arguments: [
        config.pcwOracle,
        config.conditionalOracle,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // TWAP Query Functions
  // ============================================================================

  /**
   * Get current TWAP
   *
   * Returns time-weighted average price over window.
   *
   * @param tx - Transaction
   * @param config - Query configuration
   * @returns TWAP value as u128
   *
   * @example
   * ```typescript
   * const twap = PCWTwapOracle.getTwap(tx, {
   *   marketsPackageId,
   *   oracle,
   *   clock: '0x6',
   * });
   * ```
   */
  static getTwap(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'get_twap'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get window TWAP
   *
   * Calculate TWAP for specific time window.
   *
   * @returns TWAP for window
   */
  static getWindowTwap(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'get_window_twap'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get 90-day TWAP
   *
   * Calculate TWAP over 90-day period.
   *
   * @returns 90-day TWAP
   */
  static getNinetyDayTwap(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'get_ninety_day_twap'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Check if oracle is ready
   *
   * Returns true if oracle has sufficient data for TWAP.
   *
   * @returns True if TWAP can be calculated
   */
  static isReady(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsPackageId, 'PCW_TWAP_oracle', 'is_ready'),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get last finalized TWAP
   *
   * Returns most recent committed TWAP checkpoint.
   *
   * @returns Last finalized TWAP value
   */
  static lastFinalizedTwap(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'PCW_TWAP_oracle',
        'last_finalized_twap'
      ),
      arguments: [oracle],
    });
  }

  // ============================================================================
  // Configuration Queries
  // ============================================================================

  /**
   * Get window size in milliseconds
   *
   * @returns Window size for TWAP calculation
   */
  static windowSizeMs(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'PCW_TWAP_oracle',
        'window_size_ms'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get maximum movement in parts per million
   *
   * @returns Max price movement allowed per update (ppm)
   */
  static maxMovementPpm(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'PCW_TWAP_oracle',
        'max_movement_ppm'
      ),
      arguments: [oracle],
    });
  }

  // ============================================================================
  // State Queries
  // ============================================================================

  /**
   * Get last recorded price
   *
   * @returns Most recent price observation
   */
  static lastPrice(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'PCW_TWAP_oracle', 'last_price'),
      arguments: [oracle],
    });
  }

  /**
   * Get last update timestamp
   *
   * @returns Timestamp of most recent update (milliseconds)
   */
  static lastUpdate(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'PCW_TWAP_oracle', 'last_update'),
      arguments: [oracle],
    });
  }

  /**
   * Get last update timestamp (alias)
   */
  static getLastUpdate(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'PCW_TWAP_oracle',
        'get_last_update'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get initialization timestamp
   *
   * @returns Timestamp when oracle was created (milliseconds)
   */
  static initializedAt(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'PCW_TWAP_oracle',
        'initialized_at'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get initialization timestamp (alias)
   */
  static getInitializedAt(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'PCW_TWAP_oracle',
        'get_initialized_at'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get cumulative total
   *
   * @returns Total cumulative price for TWAP calculation
   */
  static cumulativeTotal(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'PCW_TWAP_oracle',
        'cumulative_total'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get cumulative total (alias)
   */
  static getCumulativeTotal(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'PCW_TWAP_oracle',
        'get_cumulative_total'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get cumulative price at specific time
   *
   * @returns Cumulative price value
   */
  static getCumulativePrice(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      timestamp: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'get_cumulative_price'
      ),
      arguments: [config.oracle, tx.pure.u64(config.timestamp)],
    });
  }

  /**
   * Project cumulative arithmetic to future time
   *
   * Extrapolates cumulative price to specified timestamp.
   *
   * @returns Projected cumulative price
   */
  static projectedCumulativeArithmeticTo(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      timestamp: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'projected_cumulative_arithmetic_to'
      ),
      arguments: [config.oracle, tx.pure.u64(config.timestamp)],
    });
  }

  /**
   * Get checkpoint at or before timestamp
   *
   * Finds most recent checkpoint at or before given time.
   *
   * @returns Checkpoint data
   */
  static checkpointAtOrBefore(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      timestamp: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'checkpoint_at_or_before'
      ),
      arguments: [config.oracle, tx.pure.u64(config.timestamp)],
    });
  }

  /**
   * Get window start time
   *
   * Calculate start of TWAP window.
   *
   * @returns Window start timestamp
   */
  static getWindowStart(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'PCW_TWAP_oracle',
        'get_window_start'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }
}
