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

  /**
   * Add action to mint tokens
   *
   * Mints new tokens using the DAO's TreasuryCap.
   * Note: The coin type is determined at execution time, not staging.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param amount - Amount to mint
   */
  static addMint(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    amount: bigint | number
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::currency_init_actions::add_mint_spec`,
      arguments: [
        builder,
        tx.pure.u64(amount),
      ],
    });
  }

  /**
   * Add action to burn tokens
   *
   * Burns tokens using the DAO's TreasuryCap.
   * Note: The coin type and source is determined at execution time, not staging.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param amount - Amount to burn
   */
  static addBurn(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    amount: bigint | number
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::currency_init_actions::add_burn_spec`,
      arguments: [
        builder,
        tx.pure.u64(amount),
      ],
    });
  }

  /**
   * Add action to disable currency capabilities
   *
   * Permanently disables specific currency operations.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Disable configuration
   */
  static addDisable(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      mint: boolean;
      burn: boolean;
      updateSymbol: boolean;
      updateName: boolean;
      updateDescription: boolean;
      updateIconUrl: boolean;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::currency_init_actions::add_disable_spec`,
      arguments: [
        builder,
        tx.pure.bool(config.mint),
        tx.pure.bool(config.burn),
        tx.pure.bool(config.updateSymbol),
        tx.pure.bool(config.updateName),
        tx.pure.bool(config.updateDescription),
        tx.pure.bool(config.updateIconUrl),
      ],
    });
  }

  /**
   * Add action to update coin metadata
   *
   * Updates the coin's symbol, name, description, or icon URL.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Update configuration
   */
  static addUpdate(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      symbol?: string;
      name?: string;
      description?: string;
      iconUrl?: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::currency_init_actions::add_update_spec`,
      arguments: [
        builder,
        tx.pure.option('vector<u8>', config.symbol ? Array.from(new TextEncoder().encode(config.symbol)) : null),
        tx.pure.option('vector<u8>', config.name ? Array.from(new TextEncoder().encode(config.name)) : null),
        tx.pure.option('vector<u8>', config.description ? Array.from(new TextEncoder().encode(config.description)) : null),
        tx.pure.option('vector<u8>', config.iconUrl ? Array.from(new TextEncoder().encode(config.iconUrl)) : null),
      ],
    });
  }
}
