/**
 * DAO Operations - High-level DAO account management
 *
 * Provides simple, user-friendly API for managing DAO accounts.
 * Hides all complexity: package IDs, type arguments, version witnesses, etc.
 *
 * @module dao-operations
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { BaseTransactionBuilder, TransactionUtils } from '../../services/transaction';
import { Version } from '../../protocol/futarchy/version';

/**
 * Configuration for DAOOperations
 */
export interface DAOOperationsConfig {
  client: SuiClient;
  accountProtocolPackageId: string;
  futarchyCorePackageId: string;
  packageRegistryId: string;
}

/**
 * Managed object info
 */
export interface ManagedObjectInfo {
  name: string;
  objectId: string;
  objectType: string;
}

/**
 * DAO configuration info
 */
export interface DAOConfigInfo {
  name: string;
  description: string;
  iconUrl: string;
  assetType: string;
  stableType: string;
  tradingPeriodMs: number;
  reviewPeriodMs: number;
  proposalsEnabled: boolean;
}

/**
 * High-level DAO account management operations
 *
 * @example
 * ```typescript
 * // Add managed object
 * const tx = sdk.dao.addManagedObject({
 *   daoId: "0x123...",
 *   name: "team_treasury",
 *   objectId: "0xabc...",
 * });
 *
 * // Get DAO config
 * const config = await sdk.dao.getConfig("0x123...");
 * ```
 */
export class DAOOperations {
  private client: SuiClient;
  private accountProtocolPackageId: string;
  private futarchyCorePackageId: string;
  private packageRegistryId: string;

  constructor(config: DAOOperationsConfig) {
    this.client = config.client;
    this.accountProtocolPackageId = config.accountProtocolPackageId;
    this.futarchyCorePackageId = config.futarchyCorePackageId;
    this.packageRegistryId = config.packageRegistryId;
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

  // ============================================================================
  // MANAGED OBJECTS
  // ============================================================================

  /**
   * Add a managed object to the DAO account
   *
   * Stores an object in the DAO's dynamic fields with a string name key.
   *
   * @param config - Configuration
   * @returns Transaction to execute
   *
   * @example
   * ```typescript
   * const tx = await sdk.dao.addManagedObject({
   *   daoId: "0x123...",
   *   name: "team_multisig",
   *   objectId: "0xabc...",
   * });
   * ```
   */
  async addManagedObject(config: {
    daoId: string;
    name: string;
    objectId: string;
  }): Promise<Transaction> {
    // Auto-fetch objectType from objectId
    const objectType = await this.getObjectType(config.objectId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    // Create version witness
    const versionWitness = Version.current(tx, { futarchyCorePackageId: this.futarchyCorePackageId });

    // Create the string key
    const key = tx.moveCall({
      target: '0x1::string::utf8',
      arguments: [tx.pure.vector('u8', Array.from(new TextEncoder().encode(config.name)))],
    });

    // Add managed asset with String key
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountProtocolPackageId,
        'account',
        'add_managed_asset'
      ),
      typeArguments: ['0x1::string::String', objectType],
      arguments: [
        tx.object(config.daoId),
        tx.object(this.packageRegistryId),
        key,
        tx.object(config.objectId),
        versionWitness,
      ],
    });

    return tx;
  }

  /**
   * Remove a managed object from the DAO account
   *
   * @param config - Configuration
   * @returns Transaction that returns the removed object
   *
   * @example
   * ```typescript
   * const tx = sdk.dao.removeManagedObject({
   *   daoId: "0x123...",
   *   name: "team_multisig",
   *   objectType: "0x2::coin::Coin<0x2::sui::SUI>",
   * });
   * ```
   */
  removeManagedObject(config: {
    daoId: string;
    name: string;
    objectType: string;
  }): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    // Create version witness
    const versionWitness = Version.current(tx, { futarchyCorePackageId: this.futarchyCorePackageId });

    // Create the string key
    const key = tx.moveCall({
      target: '0x1::string::utf8',
      arguments: [tx.pure.vector('u8', Array.from(new TextEncoder().encode(config.name)))],
    });

    // Remove managed asset
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountProtocolPackageId,
        'account',
        'remove_managed_asset'
      ),
      typeArguments: ['0x1::string::String', config.objectType],
      arguments: [
        tx.object(config.daoId),
        tx.object(this.packageRegistryId),
        key,
        versionWitness,
      ],
    });

    return tx;
  }

  /**
   * Borrow a managed object (read-only reference)
   *
   * Returns the object for use in the same transaction.
   *
   * @param config - Configuration
   * @returns Transaction with the borrowed object reference
   */
  borrowManagedObject(config: {
    daoId: string;
    name: string;
    objectType: string;
  }): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    // Create version witness
    const versionWitness = Version.current(tx, { futarchyCorePackageId: this.futarchyCorePackageId });

    // Create the string key
    const key = tx.moveCall({
      target: '0x1::string::utf8',
      arguments: [tx.pure.vector('u8', Array.from(new TextEncoder().encode(config.name)))],
    });

    // Borrow managed asset
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountProtocolPackageId,
        'account',
        'borrow_managed_asset'
      ),
      typeArguments: ['0x1::string::String', config.objectType],
      arguments: [
        tx.object(config.daoId),
        tx.object(this.packageRegistryId),
        key,
        versionWitness,
      ],
    });

    return tx;
  }

  // ============================================================================
  // OBJECT DEPOSITS (keep/receive pattern)
  // ============================================================================

  /**
   * Deposit an object to the DAO account
   *
   * Uses the "keep" pattern to store objects with tracking.
   *
   * @param config - Configuration
   * @returns Transaction to execute
   *
   * @example
   * ```typescript
   * const tx = await sdk.dao.depositObject({
   *   daoId: "0x123...",
   *   objectId: "0xabc...",
   * });
   * ```
   */
  async depositObject(config: {
    daoId: string;
    objectId: string;
  }): Promise<Transaction> {
    // Auto-fetch objectType from objectId
    const objectType = await this.getObjectType(config.objectId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    // Use keep to deposit with tracking
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountProtocolPackageId,
        'account',
        'keep'
      ),
      typeArguments: [objectType],
      arguments: [
        tx.object(config.daoId),
        tx.object(config.objectId),
      ],
    });

    return tx;
  }

  /**
   * Withdraw an object from the DAO account
   *
   * Uses the "receive" pattern to withdraw tracked objects.
   * Requires proper authorization (typically via governance proposal).
   *
   * @param config - Configuration
   * @returns Transaction with the withdrawn object
   */
  async withdrawObject(config: {
    daoId: string;
    objectId: string;
    recipient: string;
  }): Promise<Transaction> {
    // Auto-fetch objectType from objectId
    const objectType = await this.getObjectType(config.objectId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    // Create version witness
    const versionWitness = Version.current(tx, { futarchyCorePackageId: this.futarchyCorePackageId });

    // Receive the object
    const received = tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountProtocolPackageId,
        'account',
        'receive'
      ),
      typeArguments: [objectType],
      arguments: [
        tx.object(config.daoId),
        tx.object(this.packageRegistryId),
        tx.receivingRef({
          objectId: config.objectId,
          version: '0', // Will be resolved
          digest: '', // Will be resolved
        }),
        versionWitness,
      ],
    });

    // Transfer to recipient
    tx.transferObjects([received], config.recipient);

    return tx;
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Configure object deposit settings for the DAO
   *
   * @param config - Configuration
   * @returns Transaction to execute
   *
   * @example
   * ```typescript
   * const tx = sdk.dao.configureDeposits({
   *   daoId: "0x123...",
   *   enabled: true,
   *   maxObjects: 1000,
   * });
   * ```
   */
  configureDeposits(config: {
    daoId: string;
    enabled: boolean;
    maxObjects?: number;
    resetCounter?: boolean;
  }): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    // This requires auth - typically done via governance proposal
    // For now, provide the low-level call structure
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountProtocolPackageId,
        'account',
        'configure_object_deposits'
      ),
      typeArguments: [`${this.futarchyCorePackageId}::futarchy_config::FutarchyConfig`],
      arguments: [
        tx.object(config.daoId),
        tx.pure.bool(config.enabled),
        tx.pure.option('u128', config.maxObjects ? BigInt(config.maxObjects) : null),
        tx.pure.bool(config.resetCounter ?? false),
      ],
    });

    return tx;
  }

  /**
   * Add a type to the DAO's whitelist
   *
   * Whitelisted types can be deposited without restriction.
   *
   * @param config - Configuration
   * @returns Transaction to execute
   */
  addToWhitelist(config: {
    daoId: string;
    typeToWhitelist: string;
  }): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountProtocolPackageId,
        'account',
        'manage_type_whitelist'
      ),
      typeArguments: [
        `${this.futarchyCorePackageId}::futarchy_config::FutarchyConfig`,
        config.typeToWhitelist,
      ],
      arguments: [
        tx.object(config.daoId),
        tx.pure.bool(true), // add = true
      ],
    });

    return tx;
  }

  /**
   * Remove a type from the DAO's whitelist
   *
   * @param config - Configuration
   * @returns Transaction to execute
   */
  removeFromWhitelist(config: {
    daoId: string;
    typeToRemove: string;
  }): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountProtocolPackageId,
        'account',
        'manage_type_whitelist'
      ),
      typeArguments: [
        `${this.futarchyCorePackageId}::futarchy_config::FutarchyConfig`,
        config.typeToRemove,
      ],
      arguments: [
        tx.object(config.daoId),
        tx.pure.bool(false), // add = false (remove)
      ],
    });

    return tx;
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get DAO configuration
   *
   * @param daoId - DAO account ID
   * @returns DAO configuration info
   *
   * @example
   * ```typescript
   * const config = await sdk.dao.getConfig("0x123...");
   * console.log(config.name, config.tradingPeriodMs);
   * ```
   */
  async getConfig(daoId: string): Promise<DAOConfigInfo> {
    const obj = await this.client.getObject({
      id: daoId,
      options: { showContent: true },
    });

    if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
      throw new Error(`DAO not found: ${daoId}`);
    }

    const fields = obj.data.content.fields as any;
    const metadata = fields.metadata?.fields || {};
    const config = fields.config?.fields || {};

    return {
      name: metadata.name || '',
      description: metadata.description || '',
      iconUrl: metadata.icon_url || '',
      assetType: '', // Would need type info
      stableType: '',
      tradingPeriodMs: Number(config.trading_period_ms || 0),
      reviewPeriodMs: Number(config.review_period_ms || 0),
      proposalsEnabled: config.proposals_enabled !== false,
    };
  }

  /**
   * Check if a managed object exists
   *
   * @param daoId - DAO account ID
   * @param name - Object name
   * @returns True if object exists
   */
  async hasManagedObject(daoId: string, name: string): Promise<boolean> {
    // Use devInspect to check existence
    const tx = new Transaction();

    const key = tx.moveCall({
      target: '0x1::string::utf8',
      arguments: [tx.pure.vector('u8', Array.from(new TextEncoder().encode(name)))],
    });

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountProtocolPackageId,
        'account',
        'has_managed_data'
      ),
      typeArguments: ['0x1::string::String'],
      arguments: [
        tx.object(daoId),
        key,
      ],
    });

    try {
      const result = await this.client.devInspectTransactionBlock({
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
        transactionBlock: tx,
      });

      if (result.results && result.results[0]?.returnValues) {
        return result.results[0].returnValues[0][0][0] === 1;
      }
    } catch {
      // Ignore errors
    }

    return false;
  }

  /**
   * Get the object tracker state
   *
   * @param daoId - DAO account ID
   * @returns Tracker state info
   */
  async getObjectTrackerState(daoId: string): Promise<{
    depositsEnabled: boolean;
    currentCount: number;
    maxObjects: number;
  }> {
    const obj = await this.client.getObject({
      id: daoId,
      options: { showContent: true },
    });

    if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
      throw new Error(`DAO not found: ${daoId}`);
    }

    const fields = obj.data.content.fields as any;
    const tracker = fields.object_tracker?.fields || {};

    return {
      depositsEnabled: tracker.deposits_enabled !== false,
      currentCount: Number(tracker.current_count || 0),
      maxObjects: Number(tracker.max_objects || 0),
    };
  }
}
