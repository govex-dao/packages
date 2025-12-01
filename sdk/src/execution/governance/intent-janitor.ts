/**
 * Intent Janitor Operations
 *
 * Public cleanup functions for expired intents. Sui's storage rebate system
 * naturally incentivizes cleanup - cleaners get the storage deposit back when
 * deleting objects.
 *
 * @module intent-janitor
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { TransactionUtils } from '../../services/transaction';

/**
 * Intent Janitor operations
 *
 * Cleanup utilities for expired intents with storage rebate incentives.
 *
 * @example Clean up expired intents
 * ```typescript
 * const tx = sdk.intentJanitor.cleanupExpiredFutarchyIntents({
 *   daoId,
 *   registryId,
 *   maxToClean: 10,
 * });
 * // Cleaner receives storage rebate as reward
 * await client.signAndExecuteTransaction({ transaction: tx, signer });
 * ```
 */
export class IntentJanitorOperations {
  private client: SuiClient;
  private governanceActionsPackageId: string;

  constructor(client: SuiClient, governanceActionsPackageId: string) {
    this.client = client;
    this.governanceActionsPackageId = governanceActionsPackageId;
  }

  /**
   * Clean up expired FutarchyOutcome intents with storage rebate rewards
   *
   * Cleans up expired governance intents and rewards the caller with
   * storage rebates. This is a public good - anyone can call this
   * and earn rewards.
   *
   * @param config - Cleanup configuration
   * @returns Transaction for cleanup
   *
   * @example
   * ```typescript
   * const tx = sdk.intentJanitor.cleanupExpiredFutarchyIntents({
   *   governanceActionsPackageId,
   *   daoId: "0xdao...",
   *   registryId: "0xregistry...",
   *   maxToClean: 10,
   * });
   * ```
   */
  cleanupExpiredFutarchyIntents(config: {
    governanceActionsPackageId: string;
    daoId: string;
    registryId: string;
    maxToClean: number;
    clock?: string;
  }): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governanceActionsPackageId,
        'intent_janitor',
        'cleanup_expired_futarchy_intents'
      ),
      arguments: [
        tx.object(config.daoId), // account
        tx.object(config.registryId), // registry
        tx.pure.u64(config.maxToClean), // max_to_clean
        tx.object(config.clock || '0x6'), // clock
      ],
    });

    return tx;
  }

  /**
   * Clean up ALL expired intents during normal operations (no reward)
   *
   * This is typically called automatically during other operations.
   * Unlike cleanupExpiredFutarchyIntents, this does NOT provide
   * storage rebate rewards.
   *
   * @param config - Cleanup configuration
   * @returns Transaction for cleanup
   *
   * @example
   * ```typescript
   * const tx = sdk.intentJanitor.cleanupAllExpiredIntents({
   *   governanceActionsPackageId,
   *   daoId,
   *   registryId,
   * });
   * ```
   */
  cleanupAllExpiredIntents(config: {
    governanceActionsPackageId: string;
    daoId: string;
    registryId: string;
    clock?: string;
  }): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governanceActionsPackageId,
        'intent_janitor',
        'cleanup_all_expired_intents'
      ),
      arguments: [
        tx.object(config.daoId), // account
        tx.object(config.registryId), // registry
        tx.object(config.clock || '0x6'), // clock
      ],
    });

    return tx;
  }

  /**
   * Check if maintenance is needed
   *
   * View function to check if the DAO has expired intents that need cleanup.
   * Emits MaintenanceNeeded event if cleanup is required.
   *
   * @param daoId - DAO account ID
   * @param registryId - Package registry ID
   * @param clock - Clock object ID
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * await sdk.intentJanitor.checkMaintenanceNeeded(
   *   daoId,
   *   registryId
   * );
   * // Check transaction events for MaintenanceNeeded
   * ```
   */
  async checkMaintenanceNeeded(
    daoId: string,
    registryId: string,
    clock: string = '0x6'
  ): Promise<void> {
    await this.client.devInspectTransactionBlock({
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      transactionBlock: (() => {
        const tx = new Transaction();
        tx.moveCall({
          target: TransactionUtils.buildTarget(
            this.governanceActionsPackageId,
            'intent_janitor',
            'check_maintenance_needed'
          ),
          arguments: [tx.object(daoId), tx.object(registryId), tx.object(clock)],
        });
        return tx;
      })(),
    });
  }
}
