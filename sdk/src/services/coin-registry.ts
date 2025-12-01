/**
 * Coin Registry Operations
 *
 * Registry of pre-created "blank" coin types for conditional tokens.
 * Solves the problem that coin types can't be created dynamically in Sui.
 * Allows proposal creators to acquire coin pairs without requiring two transactions.
 *
 * **Workflow:**
 * 1. Users deposit pre-created TreasuryCap/Metadata pairs with a fee
 * 2. Proposal creators acquire these pairs via `takeCoinSet` in their PTB
 * 3. Multiple pairs can be acquired in one transaction for N-outcome proposals
 * 4. Original depositor gets paid the fee when their coin set is taken
 *
 * @module coin-registry
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from './transaction';
import { validateObjectId, validateU64 } from '../utils/validation';

/**
 * Configuration for depositing a coin set
 */
export interface DepositCoinSetConfig {
  /** The coin registry object ID */
  registryId: string;
  /** TreasuryCap object ID for the blank coin type */
  treasuryCap: string;
  /** CoinMetadata object ID for the blank coin type */
  coinMetadata: string;
  /** Fee in SUI MIST to acquire this coin set (max: 10 SUI = 10_000_000_000 MIST) */
  fee: bigint | number;
  /** The coin type (e.g., "0x123::my_coin::MyCoin") */
  coinType: string;
  /** Clock object ID (default: 0x6) */
  clock?: string;
}

/**
 * Configuration for taking a coin set
 */
export interface TakeCoinSetConfig {
  /** The coin registry object ID */
  registryId: string;
  /** ID of the TreasuryCap to acquire */
  capId: string;
  /** Coin<SUI> payment object for the fee */
  feePayment: ReturnType<Transaction['moveCall']>;
  /** The coin type (e.g., "0x123::my_coin::MyCoin") */
  coinType: string;
  /** Clock object ID (default: 0x6) */
  clock?: string;
}

/**
 * Coin Registry SDK Operations
 *
 * Provides TypeScript wrappers for coin registry operations.
 *
 * @example Share a registry
 * ```typescript
 * const tx = new Transaction();
 * CoinRegistry.shareRegistry(tx, {
 *   oneShotUtilsPackageId: '0x...',
 * }, registry);
 * ```
 *
 * @example Deposit a coin set
 * ```typescript
 * const tx = new Transaction();
 * CoinRegistry.depositCoinSet(tx, {
 *   oneShotUtilsPackageId: '0x...',
 * }, {
 *   registryId: '0x...',
 *   treasuryCap: '0x...',
 *   coinMetadata: '0x...',
 *   fee: 1_000_000_000n, // 1 SUI
 *   coinType: '0x123::my_coin::MyCoin',
 * });
 * ```
 *
 * @example Take a coin set (for proposal creation)
 * ```typescript
 * const tx = new Transaction();
 *
 * // Split payment from wallet
 * const [payment] = tx.splitCoins(tx.gas, [totalFee]);
 *
 * // Take coin sets for all outcomes (chained)
 * const remainingPayment1 = CoinRegistry.takeCoinSet(tx, {
 *   oneShotUtilsPackageId: '0x...',
 * }, {
 *   registryId: '0x...',
 *   capId: '0x...cap1',
 *   feePayment: payment,
 *   coinType: '0x123::outcome1::Outcome1',
 * });
 *
 * const remainingPayment2 = CoinRegistry.takeCoinSet(tx, {
 *   oneShotUtilsPackageId: '0x...',
 * }, {
 *   registryId: '0x...',
 *   capId: '0x...cap2',
 *   feePayment: remainingPayment1,
 *   coinType: '0x123::outcome2::Outcome2',
 * });
 *
 * // Return unused payment to sender
 * tx.transferObjects([remainingPayment2], tx.pure.address(senderAddress));
 * ```
 */
export class CoinRegistry {
  // ============================================================================
  // ADMIN / SETUP
  // ============================================================================

  /**
   * Share a CoinRegistry to make it publicly accessible
   *
   * This is a one-time setup function. After sharing, anyone can deposit
   * coin sets into the registry and anyone can acquire them.
   *
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.oneShotUtilsPackageId - The futarchy_one_shot_utils package ID
   * @param registry - The CoinRegistry object to share
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   * const registry = CoinRegistry.createRegistry(tx, config);
   * CoinRegistry.shareRegistry(tx, config, registry);
   * ```
   */
  static shareRegistry(
    tx: Transaction,
    config: {
      oneShotUtilsPackageId: string;
    },
    registry: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.oneShotUtilsPackageId, 'coin_registry', 'share_registry'),
      arguments: [registry],
    });
  }

  // ============================================================================
  // DEPOSIT FUNCTIONS
  // ============================================================================

  /**
   * Deposit a TreasuryCap/Metadata pair into the registry
   *
   * **Requirements:**
   * - Coin supply must be zero (no minted coins)
   * - Metadata must be empty (name, symbol, description, icon all empty)
   * - Fee must be <= 10 SUI (10_000_000_000 MIST)
   * - Registry must not be full (max 100,000 coin sets)
   *
   * **Process:**
   * 1. Transfers ownership of TreasuryCap and CoinMetadata to registry
   * 2. Sets the fee required to acquire this coin set
   * 3. When taken, depositor receives the fee payment
   *
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.oneShotUtilsPackageId - The futarchy_one_shot_utils package ID
   * @param depositConfig - Deposit configuration
   *
   * @throws {Error} If validation fails (object IDs, fee amount)
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * CoinRegistry.depositCoinSet(tx, {
   *   oneShotUtilsPackageId: '0x...',
   * }, {
   *   registryId: '0x...',
   *   treasuryCap: '0x...', // Your blank TreasuryCap
   *   coinMetadata: '0x...', // Your blank CoinMetadata
   *   fee: 2_000_000_000n, // 2 SUI
   *   coinType: '0x123::blank_coin::BlankCoin',
   * });
   * ```
   */
  static depositCoinSet(
    tx: Transaction,
    config: {
      oneShotUtilsPackageId: string;
    },
    depositConfig: DepositCoinSetConfig
  ): void {
    // Validate inputs
    validateObjectId(depositConfig.registryId, 'registryId');
    validateObjectId(depositConfig.treasuryCap, 'treasuryCap');
    validateObjectId(depositConfig.coinMetadata, 'coinMetadata');
    validateU64(depositConfig.fee, 'fee');

    const clock = depositConfig.clock || '0x6';

    tx.moveCall({
      target: TransactionUtils.buildTarget(config.oneShotUtilsPackageId, 'coin_registry', 'deposit_coin_set_entry'),
      typeArguments: [depositConfig.coinType],
      arguments: [
        tx.object(depositConfig.registryId),
        tx.object(depositConfig.treasuryCap),
        tx.object(depositConfig.coinMetadata),
        tx.pure.u64(depositConfig.fee),
        tx.object(clock),
      ],
    });
  }

  // ============================================================================
  // TAKE FUNCTIONS
  // ============================================================================

  /**
   * Take a coin set from the registry (acquire TreasuryCap/Metadata pair)
   *
   * **Critical for optimized proposal creation:**
   * - Call this N times in a PTB to acquire N conditional token pairs
   * - Returns remaining payment coin for chaining multiple takes
   * - TreasuryCap and CoinMetadata are transferred to transaction sender
   * - Fee is paid to original depositor
   *
   * **Workflow:**
   * 1. Split total payment from gas or another coin
   * 2. Call takeCoinSet for first outcome → get remaining payment
   * 3. Pass remaining payment to takeCoinSet for second outcome → get remaining payment
   * 4. Repeat for all N outcomes
   * 5. Transfer unused payment back to sender
   *
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.oneShotUtilsPackageId - The futarchy_one_shot_utils package ID
   * @param takeConfig - Take configuration
   * @returns Remaining payment coin (Coin<SUI>) for chaining
   *
   * @throws {Error} If validation fails or insufficient payment
   *
   * @example Single take
   * ```typescript
   * const tx = new Transaction();
   *
   * const [payment] = tx.splitCoins(tx.gas, [1_000_000_000]); // 1 SUI
   *
   * const remainingPayment = CoinRegistry.takeCoinSet(tx, {
   *   oneShotUtilsPackageId: '0x...',
   * }, {
   *   registryId: '0x...',
   *   capId: '0x...treasury_cap_id',
   *   feePayment: payment,
   *   coinType: '0x123::outcome::Outcome',
   * });
   *
   * // Transfer unused payment back
   * tx.transferObjects([remainingPayment], tx.pure.address(myAddress));
   * ```
   *
   * @example Multiple takes (N-outcome proposal)
   * ```typescript
   * const tx = new Transaction();
   *
   * // Calculate total: fee1 + fee2 + fee3
   * const totalFee = 3_000_000_000n; // 3 SUI
   * const [payment] = tx.splitCoins(tx.gas, [totalFee]);
   *
   * // Take first outcome's coin set
   * const remaining1 = CoinRegistry.takeCoinSet(tx, config, {
   *   registryId,
   *   capId: capId1,
   *   feePayment: payment,
   *   coinType: 'outcome1_type',
   * });
   *
   * // Take second outcome's coin set (chain remaining payment)
   * const remaining2 = CoinRegistry.takeCoinSet(tx, config, {
   *   registryId,
   *   capId: capId2,
   *   feePayment: remaining1,
   *   coinType: 'outcome2_type',
   * });
   *
   * // Take third outcome's coin set
   * const remaining3 = CoinRegistry.takeCoinSet(tx, config, {
   *   registryId,
   *   capId: capId3,
   *   feePayment: remaining2,
   *   coinType: 'outcome3_type',
   * });
   *
   * // Return any leftover
   * tx.transferObjects([remaining3], tx.pure.address(myAddress));
   *
   * // Now use the acquired TreasuryCaps in proposal creation...
   * ```
   */
  static takeCoinSet(
    tx: Transaction,
    config: {
      oneShotUtilsPackageId: string;
    },
    takeConfig: TakeCoinSetConfig
  ): ReturnType<Transaction['moveCall']> {
    // Validate inputs
    validateObjectId(takeConfig.registryId, 'registryId');
    validateObjectId(takeConfig.capId, 'capId');

    const clock = takeConfig.clock || '0x6';

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.oneShotUtilsPackageId, 'coin_registry', 'take_coin_set'),
      typeArguments: [takeConfig.coinType],
      arguments: [
        tx.object(takeConfig.registryId),
        tx.pure.id(takeConfig.capId),
        takeConfig.feePayment,
        tx.object(clock),
      ],
    });
  }

  // ============================================================================
  // VIEW FUNCTIONS
  // ============================================================================

  /**
   * Get total number of coin sets available in the registry
   *
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.oneShotUtilsPackageId - The futarchy_one_shot_utils package ID
   * @param registryId - The coin registry object ID
   * @returns Total count of available coin sets
   */
  static totalSets(
    tx: Transaction,
    config: {
      oneShotUtilsPackageId: string;
    },
    registryId: string
  ): ReturnType<Transaction['moveCall']> {
    validateObjectId(registryId, 'registryId');

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.oneShotUtilsPackageId, 'coin_registry', 'total_sets'),
      arguments: [tx.object(registryId)],
    });
  }

  /**
   * Check if a specific coin set is available
   *
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.oneShotUtilsPackageId - The futarchy_one_shot_utils package ID
   * @param registryId - The coin registry object ID
   * @param capId - The TreasuryCap ID to check
   * @returns Boolean indicating if the coin set exists
   */
  static hasCoinSet(
    tx: Transaction,
    config: {
      oneShotUtilsPackageId: string;
    },
    registryId: string,
    capId: string
  ): ReturnType<Transaction['moveCall']> {
    validateObjectId(registryId, 'registryId');
    validateObjectId(capId, 'capId');

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.oneShotUtilsPackageId, 'coin_registry', 'has_coin_set'),
      arguments: [tx.object(registryId), tx.pure.id(capId)],
    });
  }

  /**
   * Get the fee required to acquire a specific coin set
   *
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.oneShotUtilsPackageId - The futarchy_one_shot_utils package ID
   * @param registryId - The coin registry object ID
   * @param capId - The TreasuryCap ID
   * @param coinType - The coin type
   * @returns Fee amount in SUI MIST
   */
  static getFee(
    tx: Transaction,
    config: {
      oneShotUtilsPackageId: string;
    },
    registryId: string,
    capId: string,
    coinType: string
  ): ReturnType<Transaction['moveCall']> {
    validateObjectId(registryId, 'registryId');
    validateObjectId(capId, 'capId');

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.oneShotUtilsPackageId, 'coin_registry', 'get_fee'),
      typeArguments: [coinType],
      arguments: [tx.object(registryId), tx.pure.id(capId)],
    });
  }

  /**
   * Get the owner (depositor) of a specific coin set
   *
   * The owner will receive the fee payment when the coin set is taken.
   *
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.oneShotUtilsPackageId - The futarchy_one_shot_utils package ID
   * @param registryId - The coin registry object ID
   * @param capId - The TreasuryCap ID
   * @param coinType - The coin type
   * @returns Address of the coin set owner
   */
  static getOwner(
    tx: Transaction,
    config: {
      oneShotUtilsPackageId: string;
    },
    registryId: string,
    capId: string,
    coinType: string
  ): ReturnType<Transaction['moveCall']> {
    validateObjectId(registryId, 'registryId');
    validateObjectId(capId, 'capId');

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.oneShotUtilsPackageId, 'coin_registry', 'get_owner'),
      typeArguments: [coinType],
      arguments: [tx.object(registryId), tx.pure.id(capId)],
    });
  }
}
