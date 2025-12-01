/**
 * Currency Account Actions
 *
 * Authenticated users can lock a TreasuryCap in the Account to restrict minting and burning operations,
 * as well as modifying the CoinMetadata.
 *
 * Provides functionality to:
 * - Lock treasury caps with configurable rules
 * - Mint and burn coins with permission controls
 * - Update coin metadata (symbol, name, description, icon)
 * - Disable specific currency operations permanently
 * - Remove treasury caps and metadata during initialization
 *
 * Portions of this module are derived from the account.tech Move Framework project
 * and remain licensed under the Apache License, Version 2.0.
 *
 * @module currency
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Currency Account Action Builders
 *
 * Static utilities for building currency actions following the marker → execution pattern.
 *
 * @example Lock a treasury cap
 * ```typescript
 * const tx = new Transaction();
 *
 * // Lock treasury cap with auth
 * Currency.lockCap(tx, {
 *   accountActionsPackageId,
 *   coinType,
 * }, auth, account, registry, treasuryCap, maxSupply);
 *
 * // Get markers
 * const lockCapMarker = Currency.currencyLockCap(tx, accountActionsPackageId);
 * const disableMarker = Currency.currencyDisable(tx, accountActionsPackageId);
 * const mintMarker = Currency.currencyMint(tx, accountActionsPackageId);
 * const burnMarker = Currency.currencyBurn(tx, accountActionsPackageId);
 * const updateMarker = Currency.currencyUpdate(tx, accountActionsPackageId);
 *
 * // Get keys
 * const treasuryCapKey = Currency.treasuryCapKey(tx, {
 *   accountActionsPackageId,
 *   coinType,
 * });
 * const metadataKey = Currency.coinMetadataKey(tx, {
 *   accountActionsPackageId,
 *   coinType,
 * });
 * const rulesKey = Currency.currencyRulesKey(tx, {
 *   accountActionsPackageId,
 *   coinType,
 * });
 *
 * // Execute disable action
 * Currency.doDisable(tx, {
 *   accountActionsPackageId,
 *   outcomeType,
 *   coinType,
 *   intentWitnessType,
 * }, executable, account, registry, versionWitness, intentWitness);
 *
 * // Execute mint action
 * const coin = Currency.doMint(tx, {
 *   accountActionsPackageId,
 *   outcomeType,
 *   coinType,
 *   intentWitnessType,
 * }, executable, account, registry, versionWitness, intentWitness);
 *
 * // Execute burn action
 * Currency.doBurn(tx, {
 *   accountActionsPackageId,
 *   outcomeType,
 *   coinType,
 *   intentWitnessType,
 * }, executable, account, registry, coin, versionWitness, intentWitness);
 *
 * // Execute update action
 * Currency.doUpdate(tx, {
 *   accountActionsPackageId,
 *   outcomeType,
 *   coinType,
 *   intentWitnessType,
 * }, executable, account, registry, metadata, versionWitness, intentWitness);
 * ```
 */
export class Currency {
  // ============================================================================
  // MARKERS (5)
  // ============================================================================

  /**
   * Create a CurrencyLockCap action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The currency lock cap marker
   */
  static currencyLockCap(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'currency', 'currency_lock_cap'),
      arguments: [],
    });
  }

  /**
   * Create a CurrencyDisable action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The currency disable marker
   */
  static currencyDisable(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'currency', 'currency_disable'),
      arguments: [],
    });
  }

  /**
   * Create a CurrencyMint action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The currency mint marker
   */
  static currencyMint(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'currency', 'currency_mint'),
      arguments: [],
    });
  }

  /**
   * Create a CurrencyBurn action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The currency burn marker
   */
  static currencyBurn(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'currency', 'currency_burn'),
      arguments: [],
    });
  }

  /**
   * Create a CurrencyUpdate action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The currency update marker
   */
  static currencyUpdate(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'currency', 'currency_update'),
      arguments: [],
    });
  }

  // ============================================================================
  // KEYS (3)
  // ============================================================================

  /**
   * Create a TreasuryCapKey witness for PTB execution
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @returns The treasury cap key witness
   */
  static treasuryCapKey(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'treasury_cap_key'),
      typeArguments: [config.coinType],
      arguments: [],
    });
  }

  /**
   * Create a CoinMetadataKey witness for PTB execution
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @returns The coin metadata key witness
   */
  static coinMetadataKey(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'coin_metadata_key'),
      typeArguments: [config.coinType],
      arguments: [],
    });
  }

  /**
   * Create a CurrencyRulesKey witness for PTB execution
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @returns The currency rules key witness
   */
  static currencyRulesKey(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'currency_rules_key'),
      typeArguments: [config.coinType],
      arguments: [],
    });
  }

  // ============================================================================
  // CONSTRUCTION (1)
  // ============================================================================

  /**
   * Create a new CurrencyRules instance
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param maxSupply - Optional maximum supply limit
   * @param canMint - Whether minting is allowed
   * @param canBurn - Whether burning is allowed
   * @param canUpdateSymbol - Whether symbol updates are allowed
   * @param canUpdateName - Whether name updates are allowed
   * @param canUpdateDescription - Whether description updates are allowed
   * @param canUpdateIcon - Whether icon updates are allowed
   * @returns The new CurrencyRules instance
   */
  static newCurrencyRules(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    maxSupply: ReturnType<Transaction['moveCall']>,
    canMint: boolean,
    canBurn: boolean,
    canUpdateSymbol: boolean,
    canUpdateName: boolean,
    canUpdateDescription: boolean,
    canUpdateIcon: boolean
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'new_currency_rules'),
      typeArguments: [config.coinType],
      arguments: [
        maxSupply,
        tx.pure.bool(canMint),
        tx.pure.bool(canBurn),
        tx.pure.bool(canUpdateSymbol),
        tx.pure.bool(canUpdateName),
        tx.pure.bool(canUpdateDescription),
        tx.pure.bool(canUpdateIcon),
      ],
    });
  }

  // ============================================================================
  // PUBLIC OPERATIONS (5)
  // ============================================================================

  /**
   * Lock a TreasuryCap in the Account with authenticated access
   * Authenticated users can lock a TreasuryCap to restrict minting and burning
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param auth - The authentication object
   * @param account - The account object
   * @param registry - The package registry object
   * @param treasuryCap - The TreasuryCap to lock
   * @param maxSupply - Optional maximum supply limit
   */
  static lockCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    treasuryCap: ReturnType<Transaction['moveCall']>,
    maxSupply: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'lock_cap'),
      typeArguments: [config.coinType],
      arguments: [auth, tx.object(account), tx.object(registry), treasuryCap, maxSupply],
    });
  }

  /**
   * Borrow a mutable reference to the TreasuryCap for a given coin type
   * Used by oracle mints and other patterns that need direct cap access
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @returns Mutable reference to the TreasuryCap
   */
  static borrowTreasuryCapMut(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    account: string,
    registry: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'borrow_treasury_cap_mut'),
      typeArguments: [config.coinType],
      arguments: [tx.object(account), tx.object(registry)],
    });
  }

  /**
   * Borrow the CurrencyRules for a given coin type
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @returns Immutable reference to the CurrencyRules
   */
  static borrowRules(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    account: string,
    registry: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'borrow_rules'),
      typeArguments: [config.coinType],
      arguments: [tx.object(account), tx.object(registry)],
    });
  }

  /**
   * Read metadata from a CoinMetadata object
   * Simple helper to extract all metadata fields in one call
   * Returns: (decimals, symbol, name, description, icon_url)
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param metadata - The CoinMetadata object
   * @returns Tuple of (decimals, symbol, name, description, icon_url)
   */
  static readCoinMetadata(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    metadata: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'read_coin_metadata'),
      typeArguments: [config.coinType],
      arguments: [tx.object(metadata)],
    });
  }

  /**
   * Anyone can burn coins they own if enabled
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param coin - The coin to burn
   */
  static publicBurn(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    account: string,
    registry: string,
    coin: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'public_burn'),
      typeArguments: [config.configType, config.coinType],
      arguments: [tx.object(account), tx.object(registry), coin],
    });
  }

  // ============================================================================
  // GETTERS (9)
  // ============================================================================

  /**
   * Check if a TreasuryCap exists for a given coin type
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param account - The account object
   * @returns True if the TreasuryCap exists
   */
  static hasCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    account: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'has_cap'),
      typeArguments: [config.coinType],
      arguments: [tx.object(account)],
    });
  }

  /**
   * Get the total supply of a given coin type
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @returns The total supply
   */
  static coinTypeSupply(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    account: string,
    registry: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'coin_type_supply'),
      typeArguments: [config.coinType],
      arguments: [tx.object(account), tx.object(registry)],
    });
  }

  /**
   * Get the maximum supply of a given coin type from CurrencyRules
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param lock - The CurrencyRules object
   * @returns Optional maximum supply
   */
  static maxSupply(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    lock: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'max_supply'),
      typeArguments: [config.coinType],
      arguments: [lock],
    });
  }

  /**
   * Get the total amount minted of a given coin type from CurrencyRules
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param lock - The CurrencyRules object
   * @returns The total amount minted
   */
  static totalMinted(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    lock: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'total_minted'),
      typeArguments: [config.coinType],
      arguments: [lock],
    });
  }

  /**
   * Get the total amount burned of a given coin type from CurrencyRules
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param lock - The CurrencyRules object
   * @returns The total amount burned
   */
  static totalBurned(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    lock: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'total_burned'),
      typeArguments: [config.coinType],
      arguments: [lock],
    });
  }

  /**
   * Check if the coin type can mint
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param lock - The CurrencyRules object
   * @returns True if minting is allowed
   */
  static canMint(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    lock: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'can_mint'),
      typeArguments: [config.coinType],
      arguments: [lock],
    });
  }

  /**
   * Check if the coin type can burn
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param lock - The CurrencyRules object
   * @returns True if burning is allowed
   */
  static canBurn(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    lock: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'can_burn'),
      typeArguments: [config.coinType],
      arguments: [lock],
    });
  }

  /**
   * Check if the coin type can update the symbol
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param lock - The CurrencyRules object
   * @returns True if symbol updates are allowed
   */
  static canUpdateSymbol(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    lock: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'can_update_symbol'),
      typeArguments: [config.coinType],
      arguments: [lock],
    });
  }

  /**
   * Check if the coin type can update the name
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param lock - The CurrencyRules object
   * @returns True if name updates are allowed
   */
  static canUpdateName(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    lock: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'can_update_name'),
      typeArguments: [config.coinType],
      arguments: [lock],
    });
  }

  /**
   * Check if the coin type can update the description
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param lock - The CurrencyRules object
   * @returns True if description updates are allowed
   */
  static canUpdateDescription(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    lock: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'can_update_description'),
      typeArguments: [config.coinType],
      arguments: [lock],
    });
  }

  /**
   * Check if the coin type can update the icon
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param lock - The CurrencyRules object
   * @returns True if icon updates are allowed
   */
  static canUpdateIcon(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    lock: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'can_update_icon'),
      typeArguments: [config.coinType],
      arguments: [lock],
    });
  }

  // ============================================================================
  // DO FUNCTIONS (4)
  // ============================================================================

  /**
   * Process a DisableAction and disable the permissions marked as true
   * Disabled permissions cannot be re-enabled
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.coinType - The coin type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doDisable(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      coinType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'do_disable'),
      typeArguments: [config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), versionWitness, intentWitness],
    });
  }

  /**
   * Process an UpdateAction and update the CoinMetadata
   * Updates symbol, name, description, and/or icon based on permissions
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.coinType - The coin type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param metadata - The CoinMetadata object to update
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doUpdate(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      coinType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    metadata: string,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'do_update'),
      typeArguments: [config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), tx.object(metadata), versionWitness, intentWitness],
    });
  }

  /**
   * Process a MintAction, mint and return new coins
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.coinType - The coin type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   * @returns The minted coin
   */
  static doMint(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      coinType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'do_mint'),
      typeArguments: [config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), versionWitness, intentWitness],
    });
  }

  /**
   * Process a BurnAction and burn coins
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.coinType - The coin type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param coin - The coin to burn
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doBurn(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      coinType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    coin: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'do_burn'),
      typeArguments: [config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), coin, versionWitness, intentWitness],
    });
  }

  // ============================================================================
  // DELETE FUNCTIONS (4)
  // ============================================================================

  /**
   * Delete a DisableAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param expired - The expired intent object
   */
  static deleteDisable(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'delete_disable'),
      typeArguments: [config.coinType],
      arguments: [expired],
    });
  }

  /**
   * Delete an UpdateAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param expired - The expired intent object
   */
  static deleteUpdate(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'delete_update'),
      typeArguments: [config.coinType],
      arguments: [expired],
    });
  }

  /**
   * Delete a MintAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param expired - The expired intent object
   */
  static deleteMint(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'delete_mint'),
      typeArguments: [config.coinType],
      arguments: [expired],
    });
  }

  /**
   * Delete a BurnAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param expired - The expired intent object
   */
  static deleteBurn(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'delete_burn'),
      typeArguments: [config.coinType],
      arguments: [expired],
    });
  }

  // ============================================================================
  // DESTRUCTION (2)
  // ============================================================================

  /**
   * Destroy a MintAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param action - The MintAction to destroy
   */
  static destroyMintAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'destroy_mint_action'),
      typeArguments: [config.coinType],
      arguments: [action],
    });
  }

  /**
   * Destroy a BurnAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param action - The BurnAction to destroy
   */
  static destroyBurnAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'destroy_burn_action'),
      typeArguments: [config.coinType],
      arguments: [action],
    });
  }

  // ============================================================================
  // INIT FUNCTIONS (2)
  // ============================================================================

  /**
   * Remove TreasuryCap from Account during initialization and return to recipient
   * Used when a launchpad raise fails and we need to return the cap to creator
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.outcomeType - The outcome type parameter
   * @param config.coinType - The coin type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doInitRemoveTreasuryCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      outcomeType: string;
      coinType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'do_init_remove_treasury_cap'),
      typeArguments: [config.configType, config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), versionWitness, intentWitness],
    });
  }

  /**
   * Remove CoinMetadata from Account during initialization and return to recipient
   * Used when a launchpad raise fails and we need to return the metadata to creator
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.outcomeType - The outcome type parameter
   * @param config.keyType - The key type parameter (e.g., CoinMetadataKey<CoinType>)
   * @param config.coinType - The coin type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param key - The key witness for the metadata
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doInitRemoveMetadata(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      outcomeType: string;
      keyType: string;
      coinType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    key: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'currency', 'do_init_remove_metadata'),
      typeArguments: [config.configType, config.outcomeType, config.keyType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), key, versionWitness, intentWitness],
    });
  }
}
