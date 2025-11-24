/**
 * Access Control Init Actions
 *
 * Builders for access control operations during initialization/intent staging.
 * Handles borrowing and returning account resources.
 *
 * @module access-control-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Access control initialization action builders
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Borrow access control
 * AccessControlInitActions.addBorrow(tx, builder, actionsPackageId);
 *
 * // Return access control
 * AccessControlInitActions.addReturn(tx, builder, actionsPackageId);
 * ```
 */
export class AccessControlInitActions {
  /**
   * Add action to borrow access control
   *
   * Borrows access to a resource from the account.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   */
  static addBorrow(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::access_control_init_actions::add_borrow_spec`,
      arguments: [builder],
    });
  }

  /**
   * Add action to return access control
   *
   * Returns borrowed access to the account.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   */
  static addReturn(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::access_control_init_actions::add_return_spec`,
      arguments: [builder],
    });
  }
}
