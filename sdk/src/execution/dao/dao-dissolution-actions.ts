/**
 * DAO Dissolution Actions
 *
 * DAO dissolution and redemption system. Allows terminated DAOs to create
 * dissolution capabilities that enable proportional redemption of DAO assets.
 *
 * After a DAO is terminated, token holders can redeem their tokens for a
 * proportional share of the DAO's treasury across all vaults.
 *
 * @module dao-dissolution-actions
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { TransactionUtils } from '../../services/transaction';

/**
 * DAO Dissolution operations
 *
 * Manages DAO dissolution capabilities and token redemption.
 *
 * @example Create dissolution capability and redeem
 * ```typescript
 * // Step 1: DAO gets terminated via governance
 * // ...
 *
 * // Step 2: Create dissolution capability
 * const tx1 = sdk.daoDissolution.createCapabilityIfTerminated({
 *   daoId,
 *   registryId,
 *   assetType,
 * });
 *
 * // Step 3: Redeem tokens (after unlock period)
 * const tx2 = sdk.daoDissolution.redeem({
 *   capabilityId,
 *   daoId,
 *   registryId,
 *   assetCoins: "0xcoin1,0xcoin2",
 *   vaultName: "treasury",
 *   assetType,
 *   redeemCoinType: "0x2::sui::SUI",
 * });
 * ```
 */
export class DAODissolutionOperations {
  private client: SuiClient;
  private futarchyActionsPackageId: string;

  constructor(client: SuiClient, futarchyActionsPackageId: string) {
    this.client = client;
    this.futarchyActionsPackageId = futarchyActionsPackageId;
  }

  /**
   * Create dissolution capability if DAO is terminated
   *
   * Can only be called after a DAO has been terminated via governance.
   * Creates a DissolutionCapability that enables proportional redemption.
   *
   * @param config - Configuration
   * @returns Transaction
   *
   * @example
   * ```typescript
   * const tx = sdk.daoDissolution.createCapabilityIfTerminated({
   *   futarchyActionsPackageId,
   *   daoId: "0xdao...",
   *   registryId: "0xregistry...",
   *   assetType: "0x2::sui::SUI",
   * });
   * await client.signAndExecuteTransaction({ transaction: tx, signer });
   * ```
   */
  createCapabilityIfTerminated(config: {
    futarchyActionsPackageId: string;
    daoId: string;
    registryId: string;
    assetType: string;
  }): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'dissolution_actions',
        'create_capability_if_terminated'
      ),
      typeArguments: [config.assetType],
      arguments: [tx.object(config.daoId), tx.object(config.registryId)],
    });

    return tx;
  }

  /**
   * Redeem DAO tokens for proportional treasury share
   *
   * Burns asset tokens and returns a proportional share of the specified
   * vault's coins. Can redeem from any vault type.
   *
   * Requirements:
   * - Capability must be unlocked (after unlock period)
   * - Must have asset tokens to burn
   *
   * @param config - Redemption configuration
   * @param assetCoins - Asset coin object IDs to burn
   * @returns Transaction
   *
   * @example
   * ```typescript
   * const tx = sdk.daoDissolution.redeem({
   *   futarchyActionsPackageId,
   *   capabilityId: "0xcap...",
   *   daoId: "0xdao...",
   *   registryId: "0xregistry...",
   *   vaultName: "treasury",
   *   assetType: "0x2::sui::SUI",
   *   redeemCoinType: "0x2::sui::SUI",
   * }, ["0xcoin1...", "0xcoin2..."]);
   *
   * // Returns coins proportional to burned tokens
   * await client.signAndExecuteTransaction({ transaction: tx, signer });
   * ```
   */
  redeem(
    config: {
      futarchyActionsPackageId: string;
      capabilityId: string;
      daoId: string;
      registryId: string;
      vaultName: string;
      configType: string; // Full config type
      assetType: string;
      redeemCoinType: string; // Type of coin to redeem from vault
      clock?: string;
    },
    assetCoins: string[] // Coin object IDs to burn
  ): Transaction {
    const tx = new Transaction();

    // Merge asset coins if multiple
    let assetCoinArg;
    if (assetCoins.length === 0) {
      throw new Error('Must provide at least one asset coin to redeem');
    } else if (assetCoins.length === 1) {
      assetCoinArg = tx.object(assetCoins[0]);
    } else {
      const primaryCoin = tx.object(assetCoins[0]);
      const coinsToMerge = assetCoins.slice(1).map((id) => tx.object(id));
      tx.mergeCoins(primaryCoin, coinsToMerge);
      assetCoinArg = primaryCoin;
    }

    // Convert to vector for Move call
    const assetCoinsVector = tx.makeMoveVec({
      type: config.assetType,
      elements: [assetCoinArg],
    });

    const redeemed = tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'dissolution_actions',
        'redeem'
      ),
      typeArguments: [config.configType, config.assetType, config.redeemCoinType],
      arguments: [
        tx.object(config.capabilityId), // capability
        tx.object(config.daoId), // account
        tx.object(config.registryId), // registry
        assetCoinsVector, // asset_coins
        tx.pure.string(config.vaultName), // vault_name
        tx.object(config.clock || '0x6'), // clock
      ],
    });

    // Transfer redeemed coins to sender
    tx.transferObjects([redeemed], tx.pure.address('${signer}'));

    return tx;
  }

  /**
   * Check if DAO has dissolution capability
   *
   * @param daoAddress - DAO account address
   * @returns Promise<boolean> - True if capability exists
   *
   * @example
   * ```typescript
   * const hasCap = await sdk.daoDissolution.hasCapability("0xdao...");
   * if (hasCap) {
   *   console.log("Dissolution capability exists");
   * }
   * ```
   */
  async hasCapability(daoAddress: string): Promise<boolean> {
    const result = await this.client.devInspectTransactionBlock({
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      transactionBlock: (() => {
        const tx = new Transaction();
        tx.moveCall({
          target: TransactionUtils.buildTarget(
            this.futarchyActionsPackageId,
            'dissolution_actions',
            'has_capability'
          ),
          arguments: [tx.pure.address(daoAddress)],
        });
        return tx;
      })(),
    });

    if (result.results && result.results[0]?.returnValues) {
      const value = result.results[0].returnValues[0];
      return value[0][0] === 1;
    }

    return false;
  }

  /**
   * Get dissolution capability info
   *
   * @param capabilityId - Capability object ID
   * @returns Promise with capability info
   *
   * @example
   * ```typescript
   * const info = await sdk.daoDissolution.getCapabilityInfo("0xcap...");
   * console.log(`DAO: ${info.daoAddress}`);
   * console.log(`Total supply: ${info.totalSupply}`);
   * console.log(`Unlocks at: ${new Date(Number(info.unlockTime))}`);
   * ```
   */
  async getCapabilityInfo(capabilityId: string): Promise<{
    daoAddress: string;
    totalSupply: bigint;
    createdAt: bigint;
    unlockTime: bigint;
  }> {
    const result = await this.client.devInspectTransactionBlock({
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      transactionBlock: (() => {
        const tx = new Transaction();
        tx.moveCall({
          target: TransactionUtils.buildTarget(
            this.futarchyActionsPackageId,
            'dissolution_actions',
            'capability_info'
          ),
          arguments: [tx.object(capabilityId)],
        });
        return tx;
      })(),
    });

    if (result.results && result.results[0]?.returnValues) {
      const values = result.results[0].returnValues;
      return {
        daoAddress: '0x' + Buffer.from(values[0][0]).toString('hex').slice(-40),
        totalSupply: BigInt('0x' + Buffer.from(values[1][0]).toString('hex')),
        createdAt: BigInt('0x' + Buffer.from(values[2][0]).toString('hex')),
        unlockTime: BigInt('0x' + Buffer.from(values[3][0]).toString('hex')),
      };
    }

    throw new Error('Failed to get capability info');
  }

  /**
   * Check if capability is unlocked
   *
   * @param capabilityId - Capability object ID
   * @param clock - Clock object ID
   * @returns Promise<boolean> - True if unlocked
   *
   * @example
   * ```typescript
   * const unlocked = await sdk.daoDissolution.isUnlocked("0xcap...");
   * if (unlocked) {
   *   console.log("Can redeem now!");
   * } else {
   *   console.log("Still locked, wait for unlock period");
   * }
   * ```
   */
  async isUnlocked(capabilityId: string, clock: string = '0x6'): Promise<boolean> {
    const result = await this.client.devInspectTransactionBlock({
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      transactionBlock: (() => {
        const tx = new Transaction();
        tx.moveCall({
          target: TransactionUtils.buildTarget(
            this.futarchyActionsPackageId,
            'dissolution_actions',
            'is_unlocked'
          ),
          arguments: [tx.object(capabilityId), tx.object(clock)],
        });
        return tx;
      })(),
    });

    if (result.results && result.results[0]?.returnValues) {
      const value = result.results[0].returnValues[0];
      return value[0][0] === 1;
    }

    return false;
  }
}

/**
 * DAO Dissolution Action Builders (for governance)
 *
 * Static utilities for building dissolution governance actions.
 *
 * @example Create dissolution capability via governance
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get marker
 * const marker = DAODissolutionActions.createDissolutionCapabilityMarker(tx, pkg);
 *
 * // Create action
 * const action = DAODissolutionActions.newCreateDissolutionCapability(tx, {
 *   futarchyActionsPackageId: pkg,
 *   assetType,
 * });
 *
 * // Execute in PTB
 * DAODissolutionActions.doCreateDissolutionCapability(tx, {
 *   futarchyActionsPackageId: pkg,
 *   daoId,
 *   registryId,
 *   assetType,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, versionWitness, intentWitness);
 * ```
 */
export class DAODissolutionActions {
  static createDissolutionCapabilityMarker(
    tx: Transaction,
    futarchyActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        futarchyActionsPackageId,
        'dissolution_actions',
        'create_dissolution_capability_marker'
      ),
      arguments: [],
    });
  }

  static newCreateDissolutionCapability(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      assetType: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'dissolution_actions',
        'new_create_dissolution_capability'
      ),
      typeArguments: [config.assetType],
      arguments: [],
    });
  }

  static doCreateDissolutionCapability(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      registryId: string;
      assetType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'dissolution_actions',
        'do_create_dissolution_capability'
      ),
      typeArguments: [config.assetType, config.outcomeType, config.intentWitnessType],
      arguments: [executable, tx.object(config.daoId), tx.object(config.registryId), versionWitness, intentWitness],
    });
  }
}
