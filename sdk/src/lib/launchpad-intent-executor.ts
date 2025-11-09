/**
 * Launchpad Intent Executor Operations
 *
 * Helpers for executing intents created from successful/failed launchpad raises.
 * These are used in the PTB pattern for intent execution.
 *
 * @module launchpad-intent-executor
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from './transaction';

/**
 * LaunchpadIntentExecutor operations for executing raised intents
 *
 * These functions are typically used in PTBs to execute the init actions
 * staged during launchpad creation.
 *
 * @example Execute launchpad intent
 * ```typescript
 * const tx = new Transaction();
 *
 * // Step 1: Begin execution
 * const executable = tx.moveCall({
 *   target: `${launchpadPkg}::launchpad_intent_executor::begin_execution`,
 *   typeArguments: [assetType, stableType],
 *   arguments: [raiseId, accountId, registryId, clock],
 * });
 *
 * // Step 2: Execute actions (stream creation, etc.)
 * tx.moveCall({
 *   target: `${accountActionsPkg}::vault::do_init_create_stream`,
 *   typeArguments: [configType, outcomeType, coinType, intentType],
 *   arguments: [executable, accountId, registryId, clock, versionWitness, intentWitness],
 * });
 *
 * // Step 3: Finalize execution
 * tx.moveCall({
 *   target: `${launchpadPkg}::launchpad_intent_executor::finalize_execution`,
 *   typeArguments: [assetType, stableType],
 *   arguments: [raiseId, accountId, executable, clock],
 * });
 * ```
 */
export class LaunchpadIntentExecutor {
  /**
   * Begin execution of launchpad intent (Step 1 of 3)
   *
   * Creates an Executable hot potato that must be consumed by finalize_execution.
   * Between begin and finalize, you can call do_init_* actions.
   *
   * @param tx - Transaction to add the call to
   * @param config - Execution configuration
   * @returns TransactionArgument for the Executable hot potato
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * const executable = LaunchpadIntentExecutor.beginExecution(tx, {
   *   raiseId,
   *   accountId,
   *   registryId,
   *   assetType,
   *   stableType,
   *   clock: '0x6',
   * });
   * ```
   */
  static beginExecution(
    tx: Transaction,
    config: {
      launchpadPackageId: string;
      raiseId: string;
      accountId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.launchpadPackageId,
        'launchpad_intent_executor',
        'begin_execution'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.raiseId), // raise
        tx.object(config.accountId), // account
        tx.object(config.registryId), // registry
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }

  /**
   * Finalize execution of launchpad intent (Step 3 of 3)
   *
   * Consumes the Executable hot potato and confirms all actions were executed.
   *
   * @param tx - Transaction to add the call to
   * @param config - Execution configuration
   * @param executable - The Executable hot potato from beginExecution
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * // After begin_execution and do_init_* calls
   * LaunchpadIntentExecutor.finalizeExecution(tx, {
   *   raiseId,
   *   accountId,
   *   assetType,
   *   stableType,
   *   clock: '0x6',
   * }, executable);
   * ```
   */
  static finalizeExecution(
    tx: Transaction,
    config: {
      launchpadPackageId: string;
      raiseId: string;
      accountId: string;
      assetType: string;
      stableType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.launchpadPackageId,
        'launchpad_intent_executor',
        'finalize_execution'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.raiseId), // raise
        tx.object(config.accountId), // account
        executable, // executable
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }
}

/**
 * LaunchpadOutcome helpers
 *
 * Utilities for working with LaunchpadOutcome witnesses used in intent execution.
 */
export class LaunchpadOutcome {
  /**
   * Create a new LaunchpadOutcome witness
   *
   * @param tx - Transaction
   * @param raiseId - Raise object ID
   * @returns TransactionArgument for LaunchpadOutcome
   */
  static new(
    tx: Transaction,
    launchpadPackageId: string,
    raiseId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        launchpadPackageId,
        'launchpad_outcome',
        'new'
      ),
      arguments: [tx.object(raiseId)],
    });
  }

  /**
   * Get raise_id from LaunchpadOutcome
   *
   * @param tx - Transaction
   * @param outcome - LaunchpadOutcome witness
   * @returns TransactionArgument for raise_id
   */
  static getRaiseId(
    tx: Transaction,
    launchpadPackageId: string,
    outcome: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        launchpadPackageId,
        'launchpad_outcome',
        'raise_id'
      ),
      arguments: [outcome],
    });
  }
}
