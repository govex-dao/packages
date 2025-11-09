/**
 * Currency Init Actions
 *
 * Builders for currency/treasury management actions during DAO initialization.
 * Handles TreasuryCap and CoinMetadata operations.
 *
 * @module currency-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Currency initialization action builders
 *
 * These actions manage the DAO's currency capabilities:
 * - Lock/unlock TreasuryCap (mint authority)
 * - Store/return CoinMetadata
 *
 * Common use case: Return caps to creator if launchpad raise fails
 *
 * @example
 * ```typescript
 * // Failure spec: Return caps if raise fails
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * CurrencyInitActions.addReturnTreasuryCap(tx, builder, actionsPackageId, {
 *   recipient: creatorAddress,
 * });
 *
 * CurrencyInitActions.addReturnMetadata(tx, builder, actionsPackageId, {
 *   recipient: creatorAddress,
 * });
 *
 * // Stage as failure intent
 * tx.moveCall({
 *   target: `${launchpadPkg}::launchpad::stage_failure_intent`,
 *   typeArguments: [assetType, stableType],
 *   arguments: [raiseId, registryId, creatorCapId, builder, clock],
 * });
 * ```
 */
export class CurrencyInitActions {
  /**
   * Add action to return TreasuryCap to an address
   *
   * Use this in failure specs to return minting authority to the creator
   * if the raise fails. The TreasuryCap will be transferred from the DAO's
   * custody back to the specified recipient.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for AccountActions
   * @param config - Return configuration
   *
   * @example
   * ```typescript
   * // Return treasury cap to creator if raise fails
   * CurrencyInitActions.addReturnTreasuryCap(tx, builder, actionsPackageId, {
   *   recipient: creatorAddress,
   * });
   * ```
   */
  static addReturnTreasuryCap(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      /** Address to receive the TreasuryCap */
      recipient: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::currency_init_actions::add_return_treasury_cap_spec`,
      arguments: [
        builder, // &mut Builder
        tx.pure.address(config.recipient),
      ],
    });
  }

  /**
   * Add action to return CoinMetadata to an address
   *
   * Use this in failure specs to return coin metadata to the creator
   * if the raise fails. The CoinMetadata will be transferred from the DAO's
   * custody back to the specified recipient.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for AccountActions
   * @param config - Return configuration
   *
   * @example
   * ```typescript
   * // Return metadata to creator if raise fails
   * CurrencyInitActions.addReturnMetadata(tx, builder, actionsPackageId, {
   *   recipient: creatorAddress,
   * });
   * ```
   */
  static addReturnMetadata(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      /** Address to receive the CoinMetadata */
      recipient: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::currency_init_actions::add_return_metadata_spec`,
      arguments: [
        builder, // &mut Builder
        tx.pure.address(config.recipient),
      ],
    });
  }

  /**
   * Add action to lock TreasuryCap in DAO custody
   *
   * Locks the TreasuryCap so it can only be accessed via governance proposals.
   * This is typically done during DAO creation to ensure decentralized control
   * over token minting.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for AccountActions
   *
   * @example
   * ```typescript
   * // Lock treasury cap in DAO (common for success specs)
   * CurrencyInitActions.addLockTreasuryCap(tx, builder, actionsPackageId);
   * ```
   */
  static addLockTreasuryCap(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::currency_init_actions::add_lock_treasury_cap_spec`,
      arguments: [
        builder, // &mut Builder
      ],
    });
  }

  /**
   * Add action to store CoinMetadata in DAO custody
   *
   * Stores the CoinMetadata in the DAO for governance-controlled access.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for AccountActions
   *
   * @example
   * ```typescript
   * // Store metadata in DAO (common for success specs)
   * CurrencyInitActions.addStoreMetadata(tx, builder, actionsPackageId);
   * ```
   */
  static addStoreMetadata(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::currency_init_actions::add_store_metadata_spec`,
      arguments: [
        builder, // &mut Builder
      ],
    });
  }
}
