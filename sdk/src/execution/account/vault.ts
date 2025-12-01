/**
 * Vault Account Actions
 *
 * The vault module provides secure storage and management of multiple coin types within an Account.
 * It supports permissionless deposits for approved tokens, streams for time-based vesting,
 * and various withdrawal mechanisms.
 *
 * Features:
 * - Multi-coin storage with dynamic balance tracking
 * - Permissionless deposits for approved coin types (revenue/donations)
 * - Iteration-based vesting streams with cliff periods
 * - Stream management (create, cancel, withdraw)
 * - Coin type approval system for DAO treasury management
 * - Initialization support for DAO creation
 *
 * Portions of this module are derived from the account.tech Move Framework project
 * and remain licensed under the Apache License, Version 2.0.
 *
 * @module vault
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Vault Account Action Builders
 *
 * Static utilities for building vault actions following the marker → execution pattern.
 *
 * @example Vault operations
 * ```typescript
 * const tx = new Transaction();
 *
 * // Open a vault
 * Vault.open(tx, {
 *   accountActionsPackageId,
 *   configType,
 * }, auth, account, registry, vaultName);
 *
 * // Deposit coins with auth
 * Vault.deposit(tx, {
 *   accountActionsPackageId,
 *   configType,
 *   coinType,
 * }, auth, account, registry, vaultName, coin);
 *
 * // Deposit approved coins (permissionless)
 * Vault.depositApproved(tx, {
 *   accountActionsPackageId,
 *   configType,
 *   coinType,
 * }, account, registry, vaultName, coin);
 *
 * // Withdraw coins
 * const coin = Vault.spend(tx, {
 *   accountActionsPackageId,
 *   configType,
 *   coinType,
 * }, auth, account, registry, vaultName, amount);
 *
 * // Approve coin type for permissionless deposits
 * Vault.approveCoinType(tx, {
 *   accountActionsPackageId,
 *   configType,
 *   coinType,
 * }, auth, account, registry, vaultName);
 *
 * // Create a vesting stream
 * const streamId = Vault.createStream(tx, {
 *   accountActionsPackageId,
 *   configType,
 *   coinType,
 * }, auth, account, registry, vaultName, beneficiary, amountPerIteration,
 *   startTime, iterationsTotal, iterationPeriodMs, cliffTime, claimWindowMs,
 *   maxPerWithdrawal, isTransferable, isCancellable, clock);
 *
 * // Execute actions from intent
 * Vault.doDeposit(tx, {
 *   accountActionsPackageId,
 *   configType,
 *   outcomeType,
 *   coinType,
 *   intentWitnessType,
 * }, executable, account, registry, coin, versionWitness, intentWitness);
 * ```
 */
export class Vault {
  // ============================================================================
  // MARKERS (6)
  // ============================================================================

  /**
   * Create a VaultDeposit action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The vault deposit marker
   */
  static vaultDeposit(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'vault', 'vault_deposit'),
      arguments: [],
    });
  }

  /**
   * Create a VaultSpend action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The vault spend marker
   */
  static vaultSpend(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'vault', 'vault_spend'),
      arguments: [],
    });
  }

  /**
   * Create a VaultApproveCoinType action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The vault approve coin type marker
   */
  static vaultApproveCoinType(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'vault', 'vault_approve_coin_type'),
      arguments: [],
    });
  }

  /**
   * Create a VaultRemoveApprovedCoinType action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The vault remove approved coin type marker
   */
  static vaultRemoveApprovedCoinType(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'vault', 'vault_remove_approved_coin_type'),
      arguments: [],
    });
  }

  /**
   * Create a CancelStream action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The cancel stream marker
   */
  static cancelStream(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'vault', 'cancel_stream'),
      arguments: [],
    });
  }

  /**
   * Create a CreateStream action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The create stream marker
   */
  static createStream(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'vault', 'create_stream'),
      arguments: [],
    });
  }

  // ============================================================================
  // PUBLIC OPERATIONS (10)
  // ============================================================================

  /**
   * Open a new vault with authenticated access
   * Creates a new vault for storing multiple coin types
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param auth - The authentication object
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   */
  static open(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    name: string
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'open'),
      typeArguments: [config.configType],
      arguments: [auth, tx.object(account), tx.object(registry), tx.pure.string(name)],
    });
  }

  /**
   * Deposit coins into a vault with authenticated access
   * Deposits coins owned by an authorized address into the vault
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param auth - The authentication object
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   * @param coin - The coin to deposit
   */
  static deposit(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    name: string,
    coin: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'deposit'),
      typeArguments: [config.configType, config.coinType],
      arguments: [auth, tx.object(account), tx.object(registry), tx.pure.string(name), coin],
    });
  }

  /**
   * Permissionless deposit for approved coin types
   * Anyone can deposit coins of types that have been approved by governance
   * Enables revenue/donations for common tokens (SUI, USDC, etc.)
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   * @param coin - The coin to deposit
   */
  static depositApproved(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    account: string,
    registry: string,
    name: string,
    coin: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'deposit_approved'),
      typeArguments: [config.configType, config.coinType],
      arguments: [tx.object(account), tx.object(registry), tx.pure.string(name), coin],
    });
  }

  /**
   * Withdraw coins from vault with authenticated access
   * Auth-based withdrawal outside of intent execution
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param auth - The authentication object
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   * @param amount - The amount to withdraw
   * @returns The withdrawn coin
   */
  static spend(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    name: string,
    amount: string | number
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'spend'),
      typeArguments: [config.configType, config.coinType],
      arguments: [auth, tx.object(account), tx.object(registry), tx.pure.string(name), tx.pure.u64(amount)],
    });
  }

  /**
   * Approve a coin type for permissionless deposits
   * After approval, anyone can deposit this coin type to the vault
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param auth - The authentication object
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   */
  static approveCoinType(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    name: string
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'approve_coin_type'),
      typeArguments: [config.configType, config.coinType],
      arguments: [auth, tx.object(account), tx.object(registry), tx.pure.string(name)],
    });
  }

  /**
   * Remove approval for a coin type
   * Prevents future permissionless deposits of this type
   * Does not affect existing balances
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param auth - The authentication object
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   */
  static removeApprovedCoinType(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    name: string
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'remove_approved_coin_type'),
      typeArguments: [config.configType, config.coinType],
      arguments: [auth, tx.object(account), tx.object(registry), tx.pure.string(name)],
    });
  }

  /**
   * Close the vault if empty
   * Destroys the vault structure after verifying it contains no balances or streams
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param auth - The authentication object
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   */
  static close(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    name: string
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'close'),
      typeArguments: [config.configType],
      arguments: [auth, tx.object(account), tx.object(registry), tx.pure.string(name)],
    });
  }

  /**
   * Create a new iteration-based vesting stream in the vault
   * Streams support discrete unlock events with optional claim windows
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param auth - The authentication object
   * @param account - The account object
   * @param registry - The package registry object
   * @param vaultName - The vault name
   * @param beneficiary - The primary beneficiary address
   * @param amountPerIteration - Tokens that unlock per iteration
   * @param startTime - Stream start timestamp in milliseconds
   * @param iterationsTotal - Total number of unlock events
   * @param iterationPeriodMs - Time between unlocks in milliseconds
   * @param cliffTime - Optional cliff timestamp (Option)
   * @param claimWindowMs - Optional claim window in milliseconds (Option)
   * @param maxPerWithdrawal - Maximum amount per withdrawal (0 = unlimited)
   * @param isTransferable - Whether the stream can be transferred
   * @param isCancellable - Whether the stream can be cancelled
   * @param clock - The clock object
   * @returns The created stream ID
   */
  static createStreamAuth(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    vaultName: string,
    beneficiary: string,
    amountPerIteration: string | number,
    startTime: string | number,
    iterationsTotal: string | number,
    iterationPeriodMs: string | number,
    cliffTime: ReturnType<Transaction['moveCall']>,
    claimWindowMs: ReturnType<Transaction['moveCall']>,
    maxPerWithdrawal: string | number,
    isTransferable: boolean,
    isCancellable: boolean,
    clock: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'create_stream'),
      typeArguments: [config.configType, config.coinType],
      arguments: [
        auth,
        tx.object(account),
        tx.object(registry),
        tx.pure.string(vaultName),
        tx.pure.address(beneficiary),
        tx.pure.u64(amountPerIteration),
        tx.pure.u64(startTime),
        tx.pure.u64(iterationsTotal),
        tx.pure.u64(iterationPeriodMs),
        cliffTime,
        claimWindowMs,
        tx.pure.u64(maxPerWithdrawal),
        tx.pure.bool(isTransferable),
        tx.pure.bool(isCancellable),
        tx.object(clock),
      ],
    });
  }

  /**
   * Cancel a stream and return unused funds
   * Calculates vested vs unvested amounts and refunds accordingly
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param auth - The authentication object
   * @param account - The account object
   * @param registry - The package registry object
   * @param vaultName - The vault name
   * @param streamId - The stream ID to cancel
   * @param clock - The clock object
   * @returns Tuple of (refund coin, refund amount)
   */
  static cancelStreamAuth(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: string,
    registry: string,
    vaultName: string,
    streamId: string,
    clock: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'cancel_stream'),
      typeArguments: [config.configType, config.coinType],
      arguments: [
        auth,
        tx.object(account),
        tx.object(registry),
        tx.pure.string(vaultName),
        tx.pure.id(streamId),
        tx.object(clock),
      ],
    });
  }

  /**
   * Withdraw from a stream (permissionless for beneficiaries)
   * Only beneficiaries can withdraw vested amounts
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param vaultName - The vault name
   * @param streamId - The stream ID to withdraw from
   * @param amount - The amount to withdraw
   * @param clock - The clock object
   * @returns The withdrawn coin
   */
  static withdrawFromStream(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    account: string,
    registry: string,
    vaultName: string,
    streamId: string,
    amount: string | number,
    clock: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'withdraw_from_stream'),
      typeArguments: [config.configType, config.coinType],
      arguments: [
        tx.object(account),
        tx.object(registry),
        tx.pure.string(vaultName),
        tx.pure.id(streamId),
        tx.pure.u64(amount),
        tx.object(clock),
      ],
    });
  }

  // ============================================================================
  // QUERIES (9)
  // ============================================================================

  /**
   * Get the balance of a specific coin type in the vault
   * Returns 0 if vault or coin type doesn't exist
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   * @returns The balance of the coin type
   */
  static balance(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    account: string,
    registry: string,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'balance'),
      typeArguments: [config.configType, config.coinType],
      arguments: [tx.object(account), tx.object(registry), tx.pure.string(name)],
    });
  }

  /**
   * Check if a vault exists
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param name - The vault name
   * @returns True if the vault exists
   */
  static hasVault(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    account: string,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'has_vault'),
      arguments: [tx.object(account), tx.pure.string(name)],
    });
  }

  /**
   * Borrow a reference to the vault
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   * @returns Reference to the vault
   */
  static borrowVault(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    account: string,
    registry: string,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'borrow_vault'),
      arguments: [tx.object(account), tx.object(registry), tx.pure.string(name)],
    });
  }

  /**
   * Get the number of coin types in the vault
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param vault - The vault reference
   * @returns The number of coin types
   */
  static size(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    vault: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'size'),
      arguments: [vault],
    });
  }

  /**
   * Check if a coin type exists in the vault
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param vault - The vault reference
   * @returns True if the coin type exists
   */
  static coinTypeExists(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    vault: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'coin_type_exists'),
      typeArguments: [config.coinType],
      arguments: [vault],
    });
  }

  /**
   * Get the value of a coin type in the vault
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param vault - The vault reference
   * @returns The value of the coin type
   */
  static coinTypeValue(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    vault: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'coin_type_value'),
      typeArguments: [config.coinType],
      arguments: [vault],
    });
  }

  /**
   * Check if a coin type is approved for permissionless deposits
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param config.coinType - The coin type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The vault name
   * @returns True if the coin type is approved
   */
  static isCoinTypeApproved(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
      coinType: string;
    },
    account: string,
    registry: string,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'is_coin_type_approved'),
      typeArguments: [config.configType, config.coinType],
      arguments: [tx.object(account), tx.object(registry), tx.pure.string(name)],
    });
  }

  /**
   * Calculate how much can be claimed from a stream
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param vaultName - The vault name
   * @param streamId - The stream ID
   * @param clock - The clock object
   * @returns The claimable amount
   */
  static calculateClaimable(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    account: string,
    registry: string,
    vaultName: string,
    streamId: string,
    clock: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'calculate_claimable'),
      typeArguments: [config.configType],
      arguments: [tx.object(account), tx.object(registry), tx.pure.string(vaultName), tx.pure.id(streamId), tx.object(clock)],
    });
  }

  /**
   * Get stream information
   * Returns: (beneficiary, amount_per_iteration, claimed_amount, start_time, iterations_total, iteration_period_ms, is_cancellable)
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param vaultName - The vault name
   * @param streamId - The stream ID
   * @returns Tuple of stream information
   */
  static streamInfo(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    account: string,
    registry: string,
    vaultName: string,
    streamId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'stream_info'),
      typeArguments: [config.configType],
      arguments: [tx.object(account), tx.object(registry), tx.pure.string(vaultName), tx.pure.id(streamId)],
    });
  }

  /**
   * Check if a stream exists
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param vaultName - The vault name
   * @param streamId - The stream ID
   * @returns True if the stream exists
   */
  static hasStream(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    account: string,
    registry: string,
    vaultName: string,
    streamId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'has_stream'),
      arguments: [tx.object(account), tx.object(registry), tx.pure.string(vaultName), tx.pure.id(streamId)],
    });
  }

  // ============================================================================
  // DO FUNCTIONS (6)
  // ============================================================================

  /**
   * Process a DepositAction and deposit a coin to the vault
   * Used within intent execution
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
   * @param coin - The coin to deposit
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doDeposit(
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
    coin: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'do_deposit'),
      typeArguments: [config.configType, config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), coin, versionWitness, intentWitness],
    });
  }

  /**
   * Process a SpendAction and take a coin from the vault
   * Supports spend_all flag to withdraw entire balance
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
   * @returns The withdrawn coin
   */
  static doSpend(
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
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'do_spend'),
      typeArguments: [config.configType, config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), versionWitness, intentWitness],
    });
  }

  /**
   * Execute cancel stream action from intent
   * Reads CancelStreamAction from Executable and cancels stream
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
   * @param vaultName - The vault name
   * @param clock - The clock object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   * @returns Tuple of (refund coin, refund amount)
   */
  static doCancelStream(
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
    vaultName: string,
    clock: string,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'do_cancel_stream'),
      typeArguments: [config.configType, config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(account),
        tx.object(registry),
        tx.pure.string(vaultName),
        tx.object(clock),
        versionWitness,
        intentWitness,
      ],
    });
  }

  /**
   * Process an ApproveCoinTypeAction and approve the coin type
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
  static doApproveCoinType(
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
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'do_approve_coin_type'),
      typeArguments: [config.configType, config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), versionWitness, intentWitness],
    });
  }

  /**
   * Process a RemoveApprovedCoinTypeAction and remove the coin type approval
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
  static doRemoveApprovedCoinType(
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
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'do_remove_approved_coin_type'),
      typeArguments: [config.configType, config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), versionWitness, intentWitness],
    });
  }

  /**
   * Execute create_stream from Intent during initialization
   * Reads CreateStreamAction from Executable and creates stream
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
   * @param clock - The clock object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   * @returns The created stream ID
   */
  static doInitCreateStream(
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
    clock: string,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'do_init_create_stream'),
      typeArguments: [config.configType, config.outcomeType, config.coinType, config.intentWitnessType],
      arguments: [executable, tx.object(account), tx.object(registry), tx.object(clock), versionWitness, intentWitness],
    });
  }

  // ============================================================================
  // DELETE FUNCTIONS (5)
  // ============================================================================

  /**
   * Delete a DepositAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param expired - The expired intent object
   */
  static deleteDeposit(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'delete_deposit'),
      typeArguments: [config.coinType],
      arguments: [expired],
    });
  }

  /**
   * Delete a SpendAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param expired - The expired intent object
   */
  static deleteSpend(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'delete_spend'),
      typeArguments: [config.coinType],
      arguments: [expired],
    });
  }

  /**
   * Delete a CancelStreamAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteCancelStream(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'delete_cancel_stream'),
      arguments: [expired],
    });
  }

  /**
   * Delete an ApproveCoinTypeAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param expired - The expired intent object
   */
  static deleteApproveCoinType(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'delete_approve_coin_type'),
      typeArguments: [config.coinType],
      arguments: [expired],
    });
  }

  /**
   * Delete a RemoveApprovedCoinTypeAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param expired - The expired intent object
   */
  static deleteRemoveApprovedCoinType(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'delete_remove_approved_coin_type'),
      typeArguments: [config.coinType],
      arguments: [expired],
    });
  }

  /**
   * Delete a ToggleStreamPauseAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteToggleStreamPause(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'delete_toggle_stream_pause'),
      arguments: [expired],
    });
  }

  /**
   * Delete a ToggleStreamFreezeAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteToggleStreamFreeze(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'delete_toggle_stream_freeze'),
      arguments: [expired],
    });
  }

  // ============================================================================
  // DESTRUCTION (5)
  // ============================================================================

  /**
   * Destroy a DepositAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param action - The DepositAction to destroy
   */
  static destroyDepositAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'destroy_deposit_action'),
      typeArguments: [config.coinType],
      arguments: [action],
    });
  }

  /**
   * Destroy a SpendAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param action - The SpendAction to destroy
   */
  static destroySpendAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'destroy_spend_action'),
      typeArguments: [config.coinType],
      arguments: [action],
    });
  }

  /**
   * Destroy a CancelStreamAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param action - The CancelStreamAction to destroy
   */
  static destroyCancelStreamAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'destroy_cancel_stream_action'),
      arguments: [action],
    });
  }

  /**
   * Destroy an ApproveCoinTypeAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param action - The ApproveCoinTypeAction to destroy
   */
  static destroyApproveCoinTypeAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'destroy_approve_coin_type_action'),
      typeArguments: [config.coinType],
      arguments: [action],
    });
  }

  /**
   * Destroy a RemoveApprovedCoinTypeAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.coinType - The coin type parameter
   * @param action - The RemoveApprovedCoinTypeAction to destroy
   */
  static destroyRemoveApprovedCoinTypeAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      coinType: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'destroy_remove_approved_coin_type_action'),
      typeArguments: [config.coinType],
      arguments: [action],
    });
  }

  // ============================================================================
  // UTILITIES (3)
  // ============================================================================

  /**
   * Get the default vault name for standard operations
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @returns The default vault name ("Main Vault")
   */
  static defaultVaultName(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'default_vault_name'),
      arguments: [],
    });
  }

  /**
   * Calculate currently claimable amount from a stream
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param vault - The vault reference
   * @param streamId - The stream ID
   * @param clock - The clock object
   * @returns The currently claimable amount
   */
  static streamClaimableNow(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    vault: ReturnType<Transaction['moveCall']>,
    streamId: string,
    clock: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'stream_claimable_now'),
      arguments: [vault, tx.pure.id(streamId), tx.object(clock)],
    });
  }

  /**
   * Get next vesting time for an iteration-based stream
   * Returns the timestamp when the next iteration will unlock
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param vault - The vault reference
   * @param streamId - The stream ID
   * @param clock - The clock object
   * @returns Optional timestamp of next vesting
   */
  static streamNextVestTime(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    vault: ReturnType<Transaction['moveCall']>,
    streamId: string,
    clock: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'vault', 'stream_next_vest_time'),
      arguments: [vault, tx.pure.id(streamId), tx.object(clock)],
    });
  }
}
