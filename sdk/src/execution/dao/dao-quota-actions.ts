/**
 * DAO Quota Actions
 *
 * Quota management for futarchy DAOs. Allows DAOs to set recurring proposal quotas
 * for specific addresses (team members, contributors). Quota holders can create
 * proposals at reduced fees or with automatic sponsorship.
 *
 * @module dao-quota-actions
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * DAO Quota Action Builders
 *
 * Static utilities for building quota management governance actions.
 *
 * @example Set quotas for team
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get marker
 * const marker = DAOQuotaActions.setQuotasMarker(tx, futarchyActionsPackageId);
 *
 * // Create action
 * const action = DAOQuotaActions.newSetQuotas(tx, {
 *   futarchyActionsPackageId,
 *   users: ["0xalice...", "0xbob..."],
 *   quotaAmount: 10n, // 10 proposals per period
 *   quotaPeriodMs: 30 * 24 * 60 * 60 * 1000n, // 30 days
 *   reducedFee: 0n, // Free proposals
 *   sponsorQuotaAmount: 5n, // 5 sponsorships per period
 * });
 *
 * // Execute in PTB
 * DAOQuotaActions.doSetQuotas(tx, {
 *   futarchyActionsPackageId,
 *   daoId,
 *   registryId,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, versionWitness, intentWitness);
 * ```
 */
export class DAOQuotaActions {
  // ============================================================================
  // Marker
  // ============================================================================

  static setQuotasMarker(tx: Transaction, futarchyActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'quota_actions', 'set_quotas_marker'),
      arguments: [],
    });
  }

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Create SetQuotas action
   *
   * @param tx - Transaction
   * @param config - Quota configuration
   * @returns TransactionArgument for SetQuotasAction
   *
   * @example
   * ```typescript
   * const action = DAOQuotaActions.newSetQuotas(tx, {
   *   futarchyActionsPackageId,
   *   users: ["0xalice...", "0xbob...", "0xcharlie..."],
   *   quotaAmount: 10n, // 10 proposals per period
   *   quotaPeriodMs: 30 * 24 * 60 * 60 * 1000n, // 30 days
   *   reducedFee: 100000n, // Reduced fee in stable coin units
   *   sponsorQuotaAmount: 5n, // Can sponsor 5 proposals per period
   * });
   * ```
   */
  static newSetQuotas(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      users: string[]; // Array of addresses
      quotaAmount: bigint; // Number of proposals per period
      quotaPeriodMs: bigint; // Period duration in milliseconds
      reducedFee: bigint; // Fee amount (0 for free)
      sponsorQuotaAmount: bigint; // Number of sponsorships per period
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'quota_actions', 'new_set_quotas'),
      arguments: [
        tx.pure.vector('address', config.users),
        tx.pure.u64(config.quotaAmount),
        tx.pure.u64(config.quotaPeriodMs),
        tx.pure.u64(config.reducedFee),
        tx.pure.u64(config.sponsorQuotaAmount),
      ],
    });
  }

  // ============================================================================
  // Execution
  // ============================================================================

  /**
   * Execute SetQuotas action in PTB
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @param executable - Executable hot potato
   * @param versionWitness - Version witness
   * @param intentWitness - Intent witness
   *
   * @example
   * ```typescript
   * DAOQuotaActions.doSetQuotas(tx, {
   *   futarchyActionsPackageId,
   *   daoId: "0xdao...",
   *   registryId: "0xregistry...",
   *   outcomeType: "0xabc::outcome::Type",
   *   intentWitnessType: "0xabc::witness::Type",
   * }, executable, versionWitness, intentWitness);
   * ```
   */
  static doSetQuotas(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      registryId: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'quota_actions', 'do_set_quotas'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Getter Functions
  // ============================================================================

  /**
   * Get users list from SetQuotasAction
   */
  static getUsers(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'quota_actions', 'users'),
      arguments: [action],
    });
  }

  /**
   * Get quota amount from SetQuotasAction
   */
  static getQuotaAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'quota_actions', 'quota_amount'),
      arguments: [action],
    });
  }

  /**
   * Get quota period in milliseconds from SetQuotasAction
   */
  static getQuotaPeriodMs(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'quota_actions', 'quota_period_ms'),
      arguments: [action],
    });
  }

  /**
   * Get reduced fee from SetQuotasAction
   */
  static getReducedFee(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'quota_actions', 'reduced_fee'),
      arguments: [action],
    });
  }

  /**
   * Get sponsor quota amount from SetQuotasAction
   */
  static getSponsorQuotaAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'quota_actions', 'sponsor_quota_amount'),
      arguments: [action],
    });
  }

  // ============================================================================
  // Delete Functions (Expired Intent Cleanup)
  // ============================================================================

  /**
   * Delete SetQuotas action from expired intent
   */
  static deleteSetQuotas(
    tx: Transaction,
    futarchyActionsPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'quota_actions', 'delete_set_quotas'),
      arguments: [expired],
    });
  }
}
