/**
 * Access Control Account Actions
 *
 * Developers can restrict access to functions in their own package with a Cap that can be locked into an Account.
 * The Cap can be borrowed upon approval and used in other move calls within the same ptb before being returned.
 *
 * The Cap pattern uses the object type as a proof of access, the object ID is never checked.
 * Therefore, only one Cap of a given type can be locked into the Smart Account.
 * And any Cap of that type can be returned to the Smart Account after being borrowed.
 *
 * A good practice to follow is to use a different Cap type for each function that needs to be restricted.
 *
 * Portions of this module are derived from the account.tech Move Framework project
 * and remain licensed under the Apache License, Version 2.0.
 *
 * @module access-control
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Access Control Account Action Builders
 *
 * Static utilities for building access control actions following the marker → execution pattern.
 * Supports capability storage, borrowing, and returning for fine-grained access control.
 *
 * @example Lock and borrow capability
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get markers
 * const storeMarker = AccessControl.accessControlStore(tx, accountActionsPackageId);
 * const borrowMarker = AccessControl.accessControlBorrow(tx, accountActionsPackageId);
 * const returnMarker = AccessControl.accessControlReturn(tx, accountActionsPackageId);
 *
 * // Lock capability
 * AccessControl.lockCap(tx, {
 *   accountActionsPackageId,
 *   capType,
 * }, auth, account, registry, cap);
 *
 * // Borrow capability
 * AccessControl.doBorrow(tx, {
 *   accountActionsPackageId,
 *   capType,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, account, registry, versionWitness, intentWitness);
 *
 * // Return capability
 * AccessControl.doReturn(tx, {
 *   accountActionsPackageId,
 *   capType,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, account, registry, cap, versionWitness, intentWitness);
 * ```
 */
export class AccessControl {
  // ============================================================================
  // MARKERS (3)
  // ============================================================================

  /**
   * Create an AccessControlStore action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The access control store marker
   */
  static accessControlStore(tx: Transaction, config: { accountActionsPackageId: string }): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'access_control_store'),
      arguments: [],
    });
  }

  /**
   * Create an AccessControlBorrow action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The access control borrow marker
   */
  static accessControlBorrow(tx: Transaction, config: { accountActionsPackageId: string }): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'access_control_borrow'),
      arguments: [],
    });
  }

  /**
   * Create an AccessControlReturn action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The access control return marker
   */
  static accessControlReturn(tx: Transaction, config: { accountActionsPackageId: string }): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'access_control_return'),
      arguments: [],
    });
  }

  // ============================================================================
  // STORAGE (1)
  // ============================================================================

  /**
   * Lock a capability in the account
   * Authenticated user can lock a Cap, the Cap must have at least store ability.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.capType - The capability type parameter (Cap: key + store)
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param cap - The capability to lock
   */
  static lockCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      capType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    cap: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'lock_cap'),
      typeArguments: [config.capType],
      arguments: [auth, account, registry, cap],
    });
  }

  /**
   * Lock capability during initialization - works on unshared Accounts
   * Store any capability in the Account during creation.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.capType - The capability type parameter (Cap: key + store)
   * @param account - The account object
   * @param registry - The package registry object
   * @param cap - The capability to lock
   */
  static doLockCapUnshared(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      capType: string;
    },
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    cap: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'do_lock_cap_unshared'),
      typeArguments: [config.capType],
      arguments: [account, registry, cap],
    });
  }

  /**
   * Check if a capability is locked for a given type
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.capType - The capability type parameter
   * @param account - The account object
   * @returns Boolean indicating if the capability is locked
   */
  static hasLock(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      capType: string;
    },
    account: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'has_lock'),
      typeArguments: [config.capType],
      arguments: [account],
    });
  }

  // ============================================================================
  // DESTRUCTION (2)
  // ============================================================================

  /**
   * Destroy a BorrowAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.capType - The capability type parameter
   * @param action - The BorrowAction to destroy
   */
  static destroyBorrowAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      capType: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'destroy_borrow_action'),
      typeArguments: [config.capType],
      arguments: [action],
    });
  }

  /**
   * Destroy a ReturnAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.capType - The capability type parameter
   * @param action - The ReturnAction to destroy
   */
  static destroyReturnAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      capType: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'destroy_return_action'),
      typeArguments: [config.capType],
      arguments: [action],
    });
  }

  // ============================================================================
  // BORROWING (3)
  // ============================================================================

  /**
   * Borrow a capability from the account
   * Processes a BorrowAction and returns the Cap for use in the transaction.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.capType - The capability type parameter (Cap: key + store)
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   * @returns The borrowed capability
   */
  static doBorrow(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      capType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'do_borrow'),
      typeArguments: [config.outcomeType, config.capType, config.intentWitnessType],
      arguments: [executable, account, registry, versionWitness, intentWitness],
    });
  }

  /**
   * Delete a BorrowAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.capType - The capability type parameter
   * @param expired - The expired intent object
   */
  static deleteBorrow(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      capType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'delete_borrow'),
      typeArguments: [config.capType],
      arguments: [expired],
    });
  }

  // ============================================================================
  // RETURNING (2)
  // ============================================================================

  /**
   * Return a borrowed capability to the account
   * Returns a Cap to the Account and validates the ReturnAction.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.capType - The capability type parameter (Cap: key + store)
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param cap - The capability to return
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doReturn(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      capType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    cap: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'do_return'),
      typeArguments: [config.outcomeType, config.capType, config.intentWitnessType],
      arguments: [executable, account, registry, cap, versionWitness, intentWitness],
    });
  }

  /**
   * Delete a ReturnAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.capType - The capability type parameter
   * @param expired - The expired intent object
   */
  static deleteReturn(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      capType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'access_control', 'delete_return'),
      typeArguments: [config.capType],
      arguments: [expired],
    });
  }
}
