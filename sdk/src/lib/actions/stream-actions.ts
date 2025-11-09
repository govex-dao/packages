/**
 * Stream Init Actions
 *
 * Builders for creating vesting streams during DAO initialization.
 * Streams release tokens over time with configurable unlock schedules.
 *
 * @module stream-actions
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

export interface CreateStreamConfig {
  /** Vault name to stream from (e.g., "treasury") */
  vaultName: string;
  /** Beneficiary address who receives the stream */
  beneficiary: string;
  /** Amount unlocked per iteration */
  amountPerIteration: bigint | number;
  /** Unix timestamp (ms) when stream starts */
  startTime: number;
  /** Total number of unlock events */
  iterationsTotal: bigint | number;
  /** Time between unlocks in milliseconds */
  iterationPeriodMs: bigint | number;
  /** Optional cliff time (no claims before this) - Unix timestamp (ms) */
  cliffTime?: number;
  /** Optional claim window (use-or-lose period per iteration) - in milliseconds */
  claimWindowMs?: number;
  /** Maximum amount claimable per withdrawal */
  maxPerWithdrawal: bigint | number;
  /** Whether stream can be transferred to another address */
  isTransferable: boolean;
  /** Whether stream can be cancelled by DAO */
  isCancellable: boolean;
}

/**
 * Stream initialization action builders
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Add vesting stream
 * StreamInitActions.addCreateStream(tx, builder, actionsPackageId, {
 *   vaultName: "treasury",
 *   beneficiary: "0xBENEFICIARY",
 *   amountPerIteration: 1_000_000_000n, // 1 token per month
 *   startTime: Date.now() + 86400000, // Start in 1 day
 *   iterationsTotal: 12n, // 12 months
 *   iterationPeriodMs: 2_592_000_000n, // 30 days
 *   maxPerWithdrawal: 1_000_000_000n,
 *   isTransferable: true,
 *   isCancellable: true,
 * });
 *
 * // Stage in launchpad
 * tx.moveCall({
 *   target: `${launchpadPkg}::launchpad::stage_success_intent`,
 *   typeArguments: [assetType, stableType],
 *   arguments: [raiseId, registryId, creatorCapId, builder, clock],
 * });
 * ```
 */
export class StreamInitActions {
  /**
   * Add a stream creation action to the builder
   *
   * Creates a vesting stream that releases tokens over time.
   * Common use cases:
   * - Team vesting (4 year vest with 1 year cliff)
   * - Investor vesting
   * - Treasury distributions
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder from ActionSpecBuilder.new()
   * @param actionsPackageId - Package ID for AccountActions
   * @param config - Stream configuration
   *
   * @example
   * ```typescript
   * // 12-month linear vesting starting in 1 hour
   * StreamInitActions.addCreateStream(tx, builder, actionsPackageId, {
   *   vaultName: "treasury",
   *   beneficiary: teamAddress,
   *   amountPerIteration: totalAmount / 12n,
   *   startTime: Date.now() + 3600000, // 1 hour from now
   *   iterationsTotal: 12n,
   *   iterationPeriodMs: 2_592_000_000n, // 30 days
   *   cliffTime: Date.now() + 31_536_000_000, // 1 year cliff
   *   maxPerWithdrawal: totalAmount / 12n,
   *   isTransferable: false, // Non-transferable
   *   isCancellable: true, // DAO can cancel
   * });
   * ```
   */
  static addCreateStream(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: CreateStreamConfig
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::stream_init_actions::add_create_stream_spec`,
      arguments: [
        builder, // &mut Builder
        tx.pure.string(config.vaultName),
        tx.pure(bcs.Address.serialize(config.beneficiary).toBytes()),
        tx.pure.u64(config.amountPerIteration),
        tx.pure.u64(config.startTime),
        tx.pure.u64(config.iterationsTotal),
        tx.pure.u64(config.iterationPeriodMs),
        tx.pure.option('u64', config.cliffTime ?? null),
        tx.pure.option('u64', config.claimWindowMs ?? null),
        tx.pure.u64(config.maxPerWithdrawal),
        tx.pure.bool(config.isTransferable),
        tx.pure.bool(config.isCancellable),
      ],
    });
  }

  /**
   * Helper: Calculate amount per iteration for linear vesting
   *
   * @param totalAmount - Total amount to vest
   * @param iterations - Number of unlock periods
   * @returns Amount to release per iteration
   *
   * @example
   * ```typescript
   * const perMonth = StreamInitActions.calculatePerIteration(
   *   1_000_000_000_000n, // 1000 tokens
   *   12n // Over 12 months
   * ); // Returns 83_333_333_333n (~83.33 tokens per month)
   * ```
   */
  static calculatePerIteration(
    totalAmount: bigint,
    iterations: bigint
  ): bigint {
    return totalAmount / iterations;
  }

  /**
   * Helper: Calculate start time relative to now
   *
   * @param offsetMs - Milliseconds from now
   * @returns Unix timestamp (ms)
   *
   * @example
   * ```typescript
   * const startTime = StreamInitActions.startAfter(
   *   7 * 24 * 60 * 60 * 1000 // 1 week from now
   * );
   * ```
   */
  static startAfter(offsetMs: number): number {
    return Date.now() + offsetMs;
  }

  /**
   * Common period constants (in milliseconds)
   */
  static readonly PERIODS = {
    HOUR: 3_600_000,
    DAY: 86_400_000,
    WEEK: 604_800_000,
    MONTH: 2_592_000_000, // 30 days
    YEAR: 31_536_000_000, // 365 days
  };
}
