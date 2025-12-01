/**
 * Transfer Operations - High-level transfer management
 *
 * Provides simple API for transferring objects and coins from DAO.
 *
 * @module transfer-operations
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { BaseTransactionBuilder, TransactionUtils } from '../../services/transaction';

/**
 * Configuration for TransferOperations
 */
export interface TransferOperationsConfig {
  client: SuiClient;
  accountActionsPackageId: string;
  futarchyCorePackageId: string;
  packageRegistryId: string;
}

/**
 * High-level transfer operations
 *
 * @example
 * ```typescript
 * // Transfer object from DAO
 * const tx = sdk.transfer.transferObject({
 *   daoId: "0x123...",
 *   objectId: "0xabc...",
 *   objectType: "0x2::coin::Coin<0x2::sui::SUI>",
 *   recipient: "0xdef...",
 * });
 * ```
 */
export class TransferOperations {
  private client: SuiClient;
  private accountActionsPackageId: string;
  private packageRegistryId: string;
  private configType: string;

  constructor(config: TransferOperationsConfig) {
    this.client = config.client;
    this.accountActionsPackageId = config.accountActionsPackageId;
    this.packageRegistryId = config.packageRegistryId;
    this.configType = `${config.futarchyCorePackageId}::futarchy_config::FutarchyConfig`;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Get object type from an object ID
   */
  private async getObjectType(objectId: string): Promise<string> {
    const obj = await this.client.getObject({
      id: objectId,
      options: { showType: true },
    });

    if (!obj.data?.type) {
      throw new Error(`Could not determine type for object: ${objectId}`);
    }

    return obj.data.type;
  }

  /**
   * Transfer object from DAO to recipient
   *
   * Note: This requires authorization (typically via governance proposal).
   *
   * @param config - Transfer configuration
   * @returns Transaction to execute
   */
  async transferObject(config: {
    daoId: string;
    objectId: string;
    recipient: string;
  }): Promise<Transaction> {
    // Auto-fetch objectType from objectId
    const objectType = await this.getObjectType(config.objectId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountActionsPackageId,
        'transfer',
        'transfer_to_address'
      ),
      typeArguments: [this.configType, objectType],
      arguments: [
        tx.object(config.daoId),
        tx.object(this.packageRegistryId),
        tx.object(config.objectId),
        tx.pure.address(config.recipient),
      ],
    });

    return tx;
  }

  /**
   * Share an object (make it shared instead of owned)
   *
   * @param config - Share configuration
   * @returns Transaction to execute
   */
  async shareObject(config: {
    daoId: string;
    objectId: string;
  }): Promise<Transaction> {
    // Auto-fetch objectType from objectId
    const objectType = await this.getObjectType(config.objectId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountActionsPackageId,
        'transfer',
        'share_object'
      ),
      typeArguments: [this.configType, objectType],
      arguments: [
        tx.object(config.daoId),
        tx.object(this.packageRegistryId),
        tx.object(config.objectId),
      ],
    });

    return tx;
  }
}
