/**
 * Action Spec Builder Utilities
 *
 * Provides type-safe utilities for building ActionSpecs in PTBs for:
 * - Launchpad success/failure intents
 * - Proposal outcome actions
 * - DAO initialization actions
 *
 * @module action-spec-builder
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Create a new empty ActionSpec builder
 *
 * This is the starting point for building action specifications.
 * Add actions to it using action-specific builder functions, then
 * pass it to staging functions like stage_success_intent().
 *
 * @param tx - Transaction to add the builder to
 * @param actionsPackageId - Package ID for AccountActions
 * @returns TransactionObjectArgument for the builder
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Now add actions to the builder
 * StreamInitActions.addCreateStream(tx, builder, {...});
 * ```
 */
export class ActionSpecBuilder {
  /**
   * Create a new empty ActionSpec builder
   */
  static new(
    tx: Transaction,
    actionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: `${actionsPackageId}::action_spec_builder::new`,
      arguments: [],
    });
  }

  /**
   * Convert builder to vector of ActionSpecs
   *
   * Use this when you need to pass specs to proposal outcome setters.
   *
   * @param tx - Transaction
   * @param actionsPackageId - Package ID for AccountActions
   * @param builder - ActionSpec builder
   * @returns Vector of ActionSpecs
   */
  static intoVector(
    tx: Transaction,
    actionsPackageId: string,
    builder: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: `${actionsPackageId}::action_spec_builder::into_vector`,
      arguments: [builder],
    });
  }
}
