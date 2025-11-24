/**
 * Memo Init Actions
 *
 * Builders for memo operations during initialization/intent staging.
 *
 * @module memo-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Memo initialization action builders
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * MemoInitActions.addEmitMemo(tx, builder, actionsPackageId, {
 *   memo: 'DAO treasury operation completed',
 * });
 * ```
 */
export class MemoInitActions {
  /**
   * Add action to emit a memo event
   *
   * Emits an on-chain memo event for record-keeping.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Memo configuration
   */
  static addEmitMemo(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      memo: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::memo_init_actions::add_emit_memo_spec`,
      arguments: [
        builder,
        tx.pure.string(config.memo),
      ],
    });
  }
}
