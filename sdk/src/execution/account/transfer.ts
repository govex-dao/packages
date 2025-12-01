/**
 * Transfer Account Actions
 *
 * Account actions for transferring assets owned or managed by the account.
 * Provides functionality to transfer objects to recipients or the transaction sender.
 * The intents can implement transfers for any action type (e.g. owned or vault).
 *
 * Portions of this module are derived from the account.tech Move Framework project
 * and remain licensed under the Apache License, Version 2.0.
 *
 * @module transfer
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Transfer Account Action Builders
 *
 * Static utilities for building transfer actions following the marker → execution pattern.
 *
 * @example Transfer object to recipient
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get markers
 * const transferMarker = Transfer.transferObject(tx, accountActionsPackageId);
 * const toSenderMarker = Transfer.transferToSender(tx, accountActionsPackageId);
 *
 * // Execute transfer
 * Transfer.doTransfer(tx, {
 *   accountActionsPackageId,
 *   objectType,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, intentWitness, object);
 *
 * // Transfer unshared object during initialization
 * Transfer.doTransferUnshared(tx, {
 *   accountActionsPackageId,
 *   objectType,
 * }, object, recipient);
 *
 * // Transfer to transaction sender
 * Transfer.doTransferToSender(tx, {
 *   accountActionsPackageId,
 *   objectType,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, intentWitness, object);
 *
 * // Delete expired transfer action
 * Transfer.deleteTransfer(tx, {
 *   accountActionsPackageId,
 * }, expired);
 *
 * // Delete expired transfer to sender action
 * Transfer.deleteTransferToSender(tx, {
 *   accountActionsPackageId,
 * }, expired);
 *
 * // Destroy transfer action
 * Transfer.destroyTransferAction(tx, {
 *   accountActionsPackageId,
 * }, action);
 *
 * // Destroy transfer to sender action
 * Transfer.destroyTransferToSenderAction(tx, {
 *   accountActionsPackageId,
 * }, action);
 * ```
 */
export class Transfer {
  // ============================================================================
  // MARKERS (2)
  // ============================================================================

  /**
   * Create a TransferObject action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The transfer object marker
   */
  static transferObject(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'transfer', 'transfer_object'),
      arguments: [],
    });
  }

  /**
   * Create a TransferToSender action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The transfer to sender marker
   */
  static transferToSender(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'transfer', 'transfer_to_sender'),
      arguments: [],
    });
  }

  // ============================================================================
  // EXECUTION (3)
  // ============================================================================

  /**
   * Process a TransferAction and transfer an object to a recipient
   * Used in combination with other actions (like WithdrawAction) to transfer objects
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.objectType - The object type parameter (T: key + store)
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param intentWitness - The intent witness
   * @param object - The object to transfer
   */
  static doTransfer(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      objectType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>,
    object: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'transfer', 'do_transfer'),
      typeArguments: [config.outcomeType, config.objectType, config.intentWitnessType],
      arguments: [executable, object, intentWitness],
    });
  }

  /**
   * Transfer object during initialization - works on unshared Accounts
   * Directly transfers an object to a recipient during DAO creation.
   * SAFETY: This function can be called during initialization to transfer
   * objects that were created as part of the DAO setup.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.objectType - The object type parameter (T: key + store)
   * @param object - The object to transfer
   * @param recipient - The recipient address
   */
  static doTransferUnshared(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      objectType: string;
    },
    object: ReturnType<Transaction['moveCall']>,
    recipient: string
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'transfer', 'do_transfer_unshared'),
      typeArguments: [config.objectType],
      arguments: [object, tx.pure.address(recipient)],
    });
  }

  /**
   * Process a TransferToSenderAction and transfer an object to the transaction sender
   * Perfect for crank fees and similar use cases
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.objectType - The object type parameter (T: key + store)
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param intentWitness - The intent witness
   * @param object - The object to transfer
   */
  static doTransferToSender(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      objectType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>,
    object: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'transfer', 'do_transfer_to_sender'),
      typeArguments: [config.outcomeType, config.objectType, config.intentWitnessType],
      arguments: [executable, object, intentWitness],
    });
  }

  // ============================================================================
  // DELETION (2)
  // ============================================================================

  /**
   * Delete a TransferAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteTransfer(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'transfer', 'delete_transfer'),
      arguments: [expired],
    });
  }

  /**
   * Delete a TransferToSenderAction from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteTransferToSender(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'transfer', 'delete_transfer_to_sender'),
      arguments: [expired],
    });
  }

  // ============================================================================
  // DESTRUCTION (2)
  // ============================================================================

  /**
   * Destroy a TransferAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param action - The TransferAction to destroy
   */
  static destroyTransferAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'transfer', 'destroy_transfer_action'),
      arguments: [action],
    });
  }

  /**
   * Destroy a TransferToSenderAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param action - The TransferToSenderAction to destroy
   */
  static destroyTransferToSenderAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'transfer', 'destroy_transfer_to_sender_action'),
      arguments: [action],
    });
  }
}
