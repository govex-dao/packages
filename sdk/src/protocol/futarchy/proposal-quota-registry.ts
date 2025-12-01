/**
 * Proposal Quota Registry Module
 *
 * Manages recurring proposal quotas for allowlisted addresses. Tracks usage across
 * time periods with reduced fees and supports sponsorship quotas.
 *
 * FEATURES:
 * - Recurring quotas (N proposals per period at reduced fee)
 * - Period alignment (no drift)
 * - Batch operations for multiple users
 * - Sponsorship quota support
 *
 * @module proposal-quota-registry
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Proposal Quota Registry Static Functions
 *
 * Manages proposal quotas and sponsorship quotas for DAOs.
 */
export class ProposalQuotaRegistry {
  /**
   * Create a new quota registry for a DAO
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ProposalQuotaRegistry object
   *
   * @example
   * ```typescript
   * const registry = ProposalQuotaRegistry.new(tx, {
   *   futarchyCorePackageId,
   *   daoId,
   * });
   * ```
   */
  static new(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'new'
      ),
      arguments: [tx.pure.id(config.daoId)],
    });
  }

  /**
   * Set quotas for multiple users (batch operation)
   *
   * Pass quota_amount = 0 to remove quotas.
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ProposalQuotaRegistry.setQuotas(tx, {
   *   futarchyCorePackageId,
   *   registry,
   *   daoId,
   *   users: ['0xUSER1', '0xUSER2'],
   *   quotaAmount: 10n, // 10 proposals per period
   *   quotaPeriodMs: 2_592_000_000n, // 30 days
   *   reducedFee: 0n, // Free
   *   clock: '0x6',
   * });
   * ```
   */
  static setQuotas(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      daoId: string;
      users: string[];
      quotaAmount: bigint;
      quotaPeriodMs: bigint;
      reducedFee: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'set_quotas'
      ),
      arguments: [
        config.registry,
        tx.pure.id(config.daoId),
        tx.pure.vector('address', config.users),
        tx.pure.u64(config.quotaAmount),
        tx.pure.u64(config.quotaPeriodMs),
        tx.pure.u64(config.reducedFee),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Check quota availability (read-only, no state mutation)
   *
   * Returns (has_quota, reduced_fee).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (bool, u64) for quota availability and reduced fee
   *
   * @example
   * ```typescript
   * const [hasQuota, reducedFee] = ProposalQuotaRegistry.checkQuotaAvailable(tx, {
   *   futarchyCorePackageId,
   *   registry,
   *   daoId,
   *   user: '0xUSER',
   *   clock: '0x6',
   * });
   * ```
   */
  static checkQuotaAvailable(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      daoId: string;
      user: string;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'check_quota_available'
      ),
      arguments: [
        config.registry,
        tx.pure.id(config.daoId),
        tx.pure.address(config.user),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Use one quota slot (called AFTER proposal succeeds)
   *
   * This prevents quota loss if proposal creation fails.
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ProposalQuotaRegistry.useQuota(tx, {
   *   futarchyCorePackageId,
   *   registry,
   *   daoId,
   *   user: '0xUSER',
   *   clock: '0x6',
   * });
   * ```
   */
  static useQuota(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      daoId: string;
      user: string;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'use_quota'
      ),
      arguments: [
        config.registry,
        tx.pure.id(config.daoId),
        tx.pure.address(config.user),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Refund one quota slot when proposal is evicted
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ProposalQuotaRegistry.refundQuota(tx, {
   *   futarchyCorePackageId,
   *   registry,
   *   daoId,
   *   user: '0xUSER',
   *   clock: '0x6',
   * });
   * ```
   */
  static refundQuota(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      daoId: string;
      user: string;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'refund_quota'
      ),
      arguments: [
        config.registry,
        tx.pure.id(config.daoId),
        tx.pure.address(config.user),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Set sponsorship quotas for multiple users
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ProposalQuotaRegistry.setSponsorQuotas(tx, {
   *   futarchyCorePackageId,
   *   registry,
   *   daoId,
   *   users: ['0xSPONSOR1', '0xSPONSOR2'],
   *   sponsorQuotaAmount: 5n, // 5 sponsorships per period
   *   clock: '0x6',
   * });
   * ```
   */
  static setSponsorQuotas(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      daoId: string;
      users: string[];
      sponsorQuotaAmount: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'set_sponsor_quotas'
      ),
      arguments: [
        config.registry,
        tx.pure.id(config.daoId),
        tx.pure.vector('address', config.users),
        tx.pure.u64(config.sponsorQuotaAmount),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Check sponsorship quota availability
   *
   * Returns (has_quota, remaining).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (bool, u64) for quota availability and remaining count
   *
   * @example
   * ```typescript
   * const [hasQuota, remaining] = ProposalQuotaRegistry.checkSponsorQuotaAvailable(tx, {
   *   futarchyCorePackageId,
   *   registry,
   *   daoId,
   *   sponsor: '0xSPONSOR',
   *   clock: '0x6',
   * });
   * ```
   */
  static checkSponsorQuotaAvailable(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      daoId: string;
      sponsor: string;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'check_sponsor_quota_available'
      ),
      arguments: [
        config.registry,
        tx.pure.id(config.daoId),
        tx.pure.address(config.sponsor),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Use one sponsorship quota slot
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ProposalQuotaRegistry.useSponsorQuota(tx, {
   *   futarchyCorePackageId,
   *   registry,
   *   daoId,
   *   sponsor: '0xSPONSOR',
   *   proposalId,
   *   clock: '0x6',
   * });
   * ```
   */
  static useSponsorQuota(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      daoId: string;
      sponsor: string;
      proposalId: string;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'use_sponsor_quota'
      ),
      arguments: [
        config.registry,
        tx.pure.id(config.daoId),
        tx.pure.address(config.sponsor),
        tx.pure.id(config.proposalId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Refund one sponsorship quota slot
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ProposalQuotaRegistry.refundSponsorQuota(tx, {
   *   futarchyCorePackageId,
   *   registry,
   *   daoId,
   *   sponsor: '0xSPONSOR',
   *   proposalId,
   *   clock: '0x6',
   * });
   * ```
   */
  static refundSponsorQuota(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      daoId: string;
      sponsor: string;
      proposalId: string;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'refund_sponsor_quota'
      ),
      arguments: [
        config.registry,
        tx.pure.id(config.daoId),
        tx.pure.address(config.sponsor),
        tx.pure.id(config.proposalId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Get quota status with remaining count
   *
   * Returns (has_quota, quota_amount, remaining).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (bool, u64, u64) for quota status
   *
   * @example
   * ```typescript
   * const [hasQuota, quotaAmount, remaining] = ProposalQuotaRegistry.getQuotaStatus(tx, {
   *   futarchyCorePackageId,
   *   registry,
   *   user: '0xUSER',
   *   clock: '0x6',
   * });
   * ```
   */
  static getQuotaStatus(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      user: string;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'get_quota_status'
      ),
      arguments: [
        config.registry,
        tx.pure.address(config.user),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Get DAO ID
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns DAO ID
   */
  static daoId(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'dao_id'
      ),
      arguments: [config.registry],
    });
  }

  /**
   * Check if user has any quota
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if user has quota
   */
  static hasQuota(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      user: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'has_quota'
      ),
      arguments: [
        config.registry,
        tx.pure.address(config.user),
      ],
    });
  }

  // QuotaInfo Getters

  /**
   * Get quota amount from QuotaInfo
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Quota amount (u64)
   */
  static quotaAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaInfo: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'quota_amount'
      ),
      arguments: [config.quotaInfo],
    });
  }

  /**
   * Get quota period in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Quota period in milliseconds (u64)
   */
  static quotaPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaInfo: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'quota_period_ms'
      ),
      arguments: [config.quotaInfo],
    });
  }

  /**
   * Get reduced fee
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Reduced fee (u64)
   */
  static reducedFee(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaInfo: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'reduced_fee'
      ),
      arguments: [config.quotaInfo],
    });
  }

  /**
   * Get period start timestamp
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Period start timestamp in milliseconds (u64)
   */
  static periodStartMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaInfo: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'period_start_ms'
      ),
      arguments: [config.quotaInfo],
    });
  }

  /**
   * Get usage in current period
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Usage count (u64)
   */
  static usedInPeriod(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaInfo: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'used_in_period'
      ),
      arguments: [config.quotaInfo],
    });
  }

  /**
   * Get sponsor quota amount
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Sponsor quota amount (u64)
   */
  static sponsorQuotaAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaInfo: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'sponsor_quota_amount'
      ),
      arguments: [config.quotaInfo],
    });
  }

  /**
   * Get sponsor quota used
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Sponsor quota used (u64)
   */
  static sponsorQuotaUsed(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaInfo: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'sponsor_quota_used'
      ),
      arguments: [config.quotaInfo],
    });
  }

  /**
   * Get sponsor period start timestamp
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Sponsor period start timestamp in milliseconds (u64)
   */
  static sponsorPeriodStartMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaInfo: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'proposal_quota_registry',
        'sponsor_period_start_ms'
      ),
      arguments: [config.quotaInfo],
    });
  }
}
