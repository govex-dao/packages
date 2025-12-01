/**
 * Executable Resources Module
 *
 * Minimal resource handling for intent execution. Actions attach resources to a Bag
 * on Executable, take what they need during execution, and ensure the Bag is empty
 * when complete.
 *
 * PATTERN:
 * 1. Create intent (actions are pure data)
 * 2. At execution: attach Bag of resources to Executable
 * 3. Actions take what they need from the Bag
 * 4. Bag must be empty when execution completes
 *
 * @module executable-resources
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Executable Resources Static Functions
 *
 * Provides resource bag management for intent execution.
 */
export class ExecutableResources {
  /**
   * Provision a coin into executable's resource bag
   *
   * Call this before/during execution to provide resources.
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ExecutableResources.provideCoin(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   coinType: '0x2::sui::SUI',
   *   executableUid,
   *   name: 'payment',
   *   coin,
   * });
   * ```
   */
  static provideCoin(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      coinType: string;
      executableUid: ReturnType<Transaction['moveCall']>;
      name: string;
      coin: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'executable_resources',
        'provide_coin'
      ),
      typeArguments: [config.actionType, config.coinType],
      arguments: [
        config.executableUid,
        tx.pure.string(config.name),
        config.coin,
      ],
    });
  }

  /**
   * Take a coin from executable's resource bag
   *
   * Actions call this to get resources they need.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Coin<CoinType> object
   *
   * @example
   * ```typescript
   * const coin = ExecutableResources.takeCoin(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   coinType: '0x2::sui::SUI',
   *   executableUid,
   *   name: 'payment',
   * });
   * ```
   */
  static takeCoin(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      coinType: string;
      executableUid: ReturnType<Transaction['moveCall']>;
      name: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'executable_resources',
        'take_coin'
      ),
      typeArguments: [config.actionType, config.coinType],
      arguments: [
        config.executableUid,
        tx.pure.string(config.name),
      ],
    });
  }

  /**
   * Check if a coin resource exists
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if resource exists
   *
   * @example
   * ```typescript
   * const exists = ExecutableResources.hasCoin(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   coinType: '0x2::sui::SUI',
   *   executableUid,
   *   name: 'payment',
   * });
   * ```
   */
  static hasCoin(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      coinType: string;
      executableUid: ReturnType<Transaction['moveCall']>;
      name: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'executable_resources',
        'has_coin'
      ),
      typeArguments: [config.actionType, config.coinType],
      arguments: [
        config.executableUid,
        tx.pure.string(config.name),
      ],
    });
  }

  /**
   * Destroy resource bag (must be empty)
   *
   * Call this after execution completes. Aborts if bag is not empty.
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ExecutableResources.destroyResources(tx, {
   *   futarchyCorePackageId,
   *   executableUid,
   * });
   * ```
   */
  static destroyResources(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      executableUid: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'executable_resources',
        'destroy_resources'
      ),
      arguments: [config.executableUid],
    });
  }
}
