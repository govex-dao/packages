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

  // ============================================================================
  // Do Init Actions (Step 2 - Execute specific action types)
  // ============================================================================

  /**
   * Execute stream creation action
   *
   * @param tx - Transaction
   * @param config - Execution configuration
   */
  static doInitCreateStream(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      futarchyCorePackageId: string;
      launchpadPackageId: string;
      executable: ReturnType<Transaction['moveCall']>;
      accountId: string;
      registryId: string;
      coinType: string;
      versionWitness: ReturnType<Transaction['moveCall']>;
      intentWitness: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: `${config.accountActionsPackageId}::vault::do_init_create_stream`,
      typeArguments: [
        `${config.futarchyCorePackageId}::futarchy_config::FutarchyConfig`,
        `${config.launchpadPackageId}::launchpad_outcome::LaunchpadOutcome`,
        config.coinType,
        `${config.launchpadPackageId}::launchpad::LaunchpadIntent`,
      ],
      arguments: [
        config.executable,
        tx.object(config.accountId),
        tx.object(config.registryId),
        tx.object(config.clock || '0x6'),
        config.versionWitness,
        config.intentWitness,
      ],
    });
  }

  /**
   * Execute pool creation with mint action
   *
   * @param tx - Transaction
   * @param config - Execution configuration
   */
  static doInitCreatePoolWithMint(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      futarchyCorePackageId: string;
      launchpadPackageId: string;
      executable: ReturnType<Transaction['moveCall']>;
      accountId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      versionWitness: ReturnType<Transaction['moveCall']>;
      intentWitness: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: `${config.futarchyActionsPackageId}::liquidity_init_actions::do_init_create_pool_with_mint`,
      typeArguments: [
        `${config.futarchyCorePackageId}::futarchy_config::FutarchyConfig`,
        `${config.launchpadPackageId}::launchpad_outcome::LaunchpadOutcome`,
        config.assetType,
        config.stableType,
        `${config.launchpadPackageId}::launchpad::LaunchpadIntent`,
      ],
      arguments: [
        config.executable,
        tx.object(config.accountId),
        tx.object(config.registryId),
        tx.object(config.clock || '0x6'),
        config.versionWitness,
        config.intentWitness,
      ],
    });
  }

  /**
   * Execute trading params update action
   *
   * @param tx - Transaction
   * @param config - Execution configuration
   */
  static doUpdateTradingParams(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      launchpadPackageId: string;
      executable: ReturnType<Transaction['moveCall']>;
      accountId: string;
      registryId: string;
      versionWitness: ReturnType<Transaction['moveCall']>;
      intentWitness: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: `${config.futarchyActionsPackageId}::config_actions::do_update_trading_params`,
      typeArguments: [
        `${config.launchpadPackageId}::launchpad_outcome::LaunchpadOutcome`,
        `${config.launchpadPackageId}::launchpad::LaunchpadIntent`,
      ],
      arguments: [
        config.executable,
        tx.object(config.accountId),
        tx.object(config.registryId),
        config.versionWitness,
        config.intentWitness,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Execute TWAP config update action
   *
   * @param tx - Transaction
   * @param config - Execution configuration
   */
  static doUpdateTwapConfig(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      launchpadPackageId: string;
      executable: ReturnType<Transaction['moveCall']>;
      accountId: string;
      registryId: string;
      versionWitness: ReturnType<Transaction['moveCall']>;
      intentWitness: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: `${config.futarchyActionsPackageId}::config_actions::do_update_twap_config`,
      typeArguments: [
        `${config.launchpadPackageId}::launchpad_outcome::LaunchpadOutcome`,
        `${config.launchpadPackageId}::launchpad::LaunchpadIntent`,
      ],
      arguments: [
        config.executable,
        tx.object(config.accountId),
        tx.object(config.registryId),
        config.versionWitness,
        config.intentWitness,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Execute return treasury cap action (for failure path)
   *
   * @param tx - Transaction
   * @param config - Execution configuration
   */
  static doInitReturnTreasuryCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      futarchyCorePackageId: string;
      launchpadPackageId: string;
      executable: ReturnType<Transaction['moveCall']>;
      accountId: string;
      registryId: string;
      coinType: string;
      versionWitness: ReturnType<Transaction['moveCall']>;
      intentWitness: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: `${config.accountActionsPackageId}::currency::do_init_remove_treasury_cap`,
      typeArguments: [
        `${config.futarchyCorePackageId}::futarchy_config::FutarchyConfig`,
        `${config.launchpadPackageId}::launchpad_outcome::LaunchpadOutcome`,
        config.coinType,
        `${config.launchpadPackageId}::launchpad::LaunchpadIntent`,
      ],
      arguments: [
        config.executable,
        tx.object(config.accountId),
        tx.object(config.registryId),
        config.versionWitness,
        config.intentWitness,
      ],
    });
  }

  /**
   * Get version witness for action execution
   *
   * @param tx - Transaction
   * @param accountActionsPackageId - Package ID
   * @returns VersionWitness
   */
  static getVersionWitness(
    tx: Transaction,
    accountActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: `${accountActionsPackageId}::version::current`,
      arguments: [],
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
