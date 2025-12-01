/**
 * Version Module
 *
 * Version tracking for the futarchy package. Manages version witnesses for protocol upgrades.
 *
 * @module version
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Version Static Functions
 *
 * Provides version tracking and witnesses for protocol upgrades.
 */
export class Version {
  /**
   * Get the current version witness
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns VersionWitness object
   *
   * @example
   * ```typescript
   * const versionWitness = Version.current(tx, {
   *   futarchyCorePackageId,
   * });
   * ```
   */
  static current(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'version',
        'current'
      ),
    });
  }

  /**
   * Get the version number
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Version number (u64)
   *
   * @example
   * ```typescript
   * const versionNumber = Version.get(tx, {
   *   futarchyCorePackageId,
   * });
   * ```
   */
  static get(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'version',
        'get'
      ),
    });
  }
}
