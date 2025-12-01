/**
 * Futarchy TWAP Oracle Operations
 *
 * Time-Weighted Average Price oracle for futarchy markets.
 * Tracks price history and calculates TWAP for proposal resolution.
 *
 * Used to determine winning outcome based on market prices.
 *
 * @module futarchy-twap-oracle
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Futarchy TWAP Oracle Static Functions
 *
 * Manage TWAP recording and calculation for futarchy markets.
 *
 * @example Create new oracle
 * ```typescript
 * const oracle = FutarchyTwapOracle.newOracle(tx, {
 *   marketsPackageId,
 *   initialPrice: 1_000_000_000n, // $1
 *   twapStartDelay: 300_000n, // 5 min
 *   twapStepMax: 3600_000n, // 1 hour max step
 * });
 * ```
 */
export class FutarchyTwapOracle {
  /**
   * Create new TWAP oracle
   *
   * Initializes oracle with configuration for TWAP calculation.
   *
   * @param tx - Transaction
   * @param config - Oracle configuration
   * @returns TWAPOracle object
   *
   * @example
   * ```typescript
   * const oracle = FutarchyTwapOracle.newOracle(tx, {
   *   marketsPackageId,
   *   initialPrice: 1_000_000_000n, // $1 initial price
   *   twapStartDelay: 300_000n, // 5 minutes delay before TWAP starts
   *   twapStepMax: 3600_000n, // 1 hour maximum step size
   * });
   * ```
   */
  static newOracle(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      initialPrice: bigint;
      twapStartDelay: bigint;
      twapStepMax: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'futarchy_twap_oracle',
        'new_oracle'
      ),
      arguments: [
        tx.pure.u128(config.initialPrice),
        tx.pure.u64(config.twapStartDelay),
        tx.pure.u64(config.twapStepMax),
      ],
    });
  }

  /**
   * Write price observation to oracle
   *
   * Records new price at current timestamp.
   * Updates cumulative price for TWAP calculation.
   *
   * @param tx - Transaction
   * @param config - Observation configuration
   */
  static writeObservation(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      price: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'futarchy_twap_oracle',
        'write_observation'
      ),
      arguments: [config.oracle, tx.pure.u128(config.price), tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get Time-Weighted Average Price
   *
   * Calculates TWAP from recorded observations.
   *
   * @param tx - Transaction
   * @param config - TWAP query configuration
   * @returns TWAP value as u128
   *
   * @example
   * ```typescript
   * const twap = FutarchyTwapOracle.getTwap(tx, {
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
        'futarchy_twap_oracle',
        'get_twap'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Set oracle start time
   *
   * Configures when TWAP calculation should begin.
   * Called during market initialization.
   *
   * @param tx - Transaction
   * @param config - Start time configuration
   */
  static setOracleStartTime(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      oracle: ReturnType<Transaction['moveCall']>;
      startTime: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'futarchy_twap_oracle',
        'set_oracle_start_time'
      ),
      arguments: [config.oracle, tx.pure.u64(config.startTime)],
    });
  }

  /**
   * Check if TWAP is valid
   *
   * Returns true if oracle has sufficient observations for TWAP.
   *
   * @returns True if TWAP can be calculated
   */
  static isTwapValid(
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
        'futarchy_twap_oracle',
        'is_twap_valid'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  // ============================================================================
  // Query Functions
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
      target: TransactionUtils.buildTarget(marketsPackageId, 'futarchy_twap_oracle', 'last_price'),
      arguments: [oracle],
    });
  }

  /**
   * Get last observation timestamp
   *
   * @returns Timestamp of most recent observation (milliseconds)
   */
  static lastTimestamp(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'futarchy_twap_oracle',
        'last_timestamp'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get oracle configuration
   *
   * @returns Oracle config struct
   */
  static config(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'futarchy_twap_oracle', 'config'),
      arguments: [oracle],
    });
  }

  /**
   * Get market start time
   *
   * @returns Timestamp when market started (milliseconds)
   */
  static marketStartTime(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'futarchy_twap_oracle',
        'market_start_time'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get TWAP initialization price
   *
   * @returns Initial price used for TWAP calculation
   */
  static twapInitializationPrice(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'futarchy_twap_oracle',
        'twap_initialization_price'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get total cumulative price
   *
   * @returns Cumulative price sum for TWAP calculation
   */
  static totalCumulativePrice(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'futarchy_twap_oracle',
        'total_cumulative_price'
      ),
      arguments: [oracle],
    });
  }

  /**
   * Get oracle object ID
   */
  static id(
    tx: Transaction,
    marketsPackageId: string,
    oracle: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'futarchy_twap_oracle', 'id'),
      arguments: [oracle],
    });
  }

  // ============================================================================
  // Debug Functions (for testing/diagnostics)
  // ============================================================================

  /**
   * Print oracle state (debug)
   *
   * Emits event with current oracle state.
   */
  static debugPrintState(
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
        'futarchy_twap_oracle',
        'debug_print_state'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get oracle state (debug)
   *
   * Returns detailed oracle state for debugging.
   *
   * @returns Oracle state struct
   */
  static debugGetState(
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
        'futarchy_twap_oracle',
        'debug_get_state'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get full oracle state (debug)
   *
   * Returns complete oracle state including all fields.
   *
   * @returns Full state struct
   */
  static debugGetFullState(
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
        'futarchy_twap_oracle',
        'debug_get_full_state'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get window TWAP (debug)
   *
   * Calculates TWAP for specific time window.
   *
   * @returns TWAP value for window
   */
  static debugGetWindowTwap(
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
        'futarchy_twap_oracle',
        'debug_get_window_twap'
      ),
      arguments: [config.oracle, tx.object(config.clock || '0x6')],
    });
  }
}
