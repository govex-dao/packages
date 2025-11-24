/**
 * Quota Init Actions
 *
 * Builders for quota management during initialization/intent staging.
 * Handles setting user quotas for proposal creation.
 *
 * @module quota-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Quota initialization action builders
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Set quotas for specific users
 * QuotaInitActions.addSetQuotas(tx, builder, futarchyActionsPackageId, {
 *   users: ['0xUSER1', '0xUSER2'],
 *   quotaAmount: 10,
 *   quotaPeriodMs: 86400000, // 1 day
 *   reducedFee: 500000000, // 0.5 SUI
 *   sponsorQuotaAmount: 5,
 * });
 * ```
 */
export class QuotaInitActions {
  /**
   * Add action to set quotas for users
   *
   * Configures proposal quotas for specified users.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Quota configuration
   */
  static addSetQuotas(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      users: string[];
      quotaAmount: bigint | number;
      quotaPeriodMs: bigint | number;
      reducedFee: bigint | number;
      sponsorQuotaAmount: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::quota_init_actions::add_set_quotas_spec`,
      arguments: [
        builder,
        tx.makeMoveVec({
          type: 'address',
          elements: config.users.map(u => tx.pure.address(u)),
        }),
        tx.pure.u64(config.quotaAmount),
        tx.pure.u64(config.quotaPeriodMs),
        tx.pure.u64(config.reducedFee),
        tx.pure.u64(config.sponsorQuotaAmount),
      ],
    });
  }
}
