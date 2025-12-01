/**
 * Memo Account Actions
 *
 * Generic memo emission actions for the Account Protocol.
 * Provides functionality to emit text memos that can be used for:
 * - Simple text memos: "This is important"
 * - Accept decisions: "Accept" + Some(proposal_id)
 * - Reject decisions: "Reject" + Some(proposal_id)
 * - Comments on objects: "Looks good!" + Some(object_id)
 *
 * Works with any Account type.
 *
 * @module memo
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Memo Account Action Builders
 *
 * Static utilities for building memo actions following the marker → execution pattern.
 *
 * @example Create and execute a memo action
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get marker
 * const marker = Memo.memo(tx, accountActionsPackageId);
 *
 * // Execute memo action
 * Memo.doEmitMemo(tx, {
 *   accountActionsPackageId,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, intentWitness, clock);
 *
 * // Delete expired memo action
 * Memo.deleteMemo(tx, {
 *   accountActionsPackageId,
 * }, expired);
 *
 * // Destroy memo action
 * Memo.destroyEmitMemoAction(tx, {
 *   accountActionsPackageId,
 * }, action);
 * ```
 */
export class Memo {
  // ============================================================================
  // MARKERS (1)
  // ============================================================================

  /**
   * Create a Memo action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The memo marker
   */
  static memo(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'memo', 'memo'),
      arguments: [],
    });
  }

  // ============================================================================
  // EXECUTION (1)
  // ============================================================================

  /**
   * Execute an emit memo action
   * Emits a text memo from the intent specification
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param intentWitness - The intent witness
   * @param clock - The clock object
   */
  static doEmitMemo(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>,
    clock: string
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'memo', 'do_emit_memo'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, intentWitness, tx.object(clock)],
    });
  }

  // ============================================================================
  // DELETION (1)
  // ============================================================================

  /**
   * Delete a memo action from an expired intent
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteMemo(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'memo', 'delete_memo'),
      arguments: [expired],
    });
  }

  // ============================================================================
  // DESTRUCTION (1)
  // ============================================================================

  /**
   * Destroy an EmitMemoAction after serialization
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param action - The EmitMemoAction to destroy
   */
  static destroyEmitMemoAction(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'memo', 'destroy_emit_memo_action'),
      arguments: [action],
    });
  }
}
