/**
 * Dissolution Init Actions
 *
 * Builders for DAO dissolution operations during initialization/intent staging.
 *
 * @module dissolution-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Dissolution initialization action builders
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Create dissolution capability
 * DissolutionInitActions.addCreateDissolutionCapability(tx, builder, futarchyActionsPackageId, {
 *   assetType: '0xPACKAGE::token::TOKEN',
 * });
 * ```
 */
export class DissolutionInitActions {
  /**
   * Add action to create dissolution capability
   *
   * Creates a capability that allows dissolving the DAO.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Configuration
   */
  static addCreateDissolutionCapability(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      assetType: string;
    }
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::dissolution_init_actions::add_create_dissolution_capability_spec`,
      typeArguments: [config.assetType],
      arguments: [builder],
    });
  }
}
