/**
 * Action Validation Module
 *
 * Type validation for action specifications in intents. Ensures that actions match
 * their expected types at runtime.
 *
 * @module action-validation
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Action Validation Static Functions
 *
 * Validates that action specs match expected types.
 */
export class ActionValidation {
  /**
   * Assert that an action spec matches the expected action type
   *
   * Validates that the action type in the spec matches the type T.
   * Aborts with EActionTypeMismatch if types don't match.
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ActionValidation.assertActionType(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::ActionType',
   *   actionSpec,
   * });
   * ```
   */
  static assertActionType(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      actionSpec: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'action_validation',
        'assert_action_type'
      ),
      typeArguments: [config.actionType],
      arguments: [config.actionSpec],
    });
  }
}
