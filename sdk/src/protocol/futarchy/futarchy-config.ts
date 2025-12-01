/**
 * Futarchy Configuration Module
 *
 * Pure configuration struct for Futarchy governance systems.
 * This is the configuration object used with Account.
 * All dynamic state and object references are stored as dynamic fields on the Account.
 *
 * FEATURES:
 * - Pure configuration struct (no object references)
 * - Early resolve configuration (proposal duration, stability checks)
 * - DAO state management (operational state, proposals, verification)
 * - Launchpad integration (immutable initial price)
 * - FutarchyOutcome tracking (intent execution metadata)
 *
 * @module futarchy-config
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Futarchy Configuration Static Functions
 *
 * Manages Futarchy DAO configuration including early resolve settings,
 * DAO state, verification, and outcome tracking.
 */
export class FutarchyConfig {
  // ========================================
  // Constants
  // ========================================

  /**
   * Get the TWAP scale factor (1e12)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TWAP scale (u128)
   *
   * @example
   * ```typescript
   * const scale = FutarchyConfig.twapScale(tx, {
   *   futarchyCorePackageId,
   * });
   * ```
   */
  static twapScale(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'twap_scale'
      ),
      arguments: [],
    });
  }

  /**
   * Get the protocol maximum positive threshold (+5%)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Protocol max threshold positive (u128)
   */
  static protocolMaxThresholdPositive(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'protocol_max_threshold_positive'
      ),
      arguments: [],
    });
  }

  /**
   * Get the protocol maximum negative threshold magnitude (5%)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Protocol max threshold negative (u128)
   */
  static protocolMaxThresholdNegative(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'protocol_max_threshold_negative'
      ),
      arguments: [],
    });
  }

  /**
   * Get ACTIVE state constant (0)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Active state constant (u8)
   */
  static stateActive(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'state_active'
      ),
      arguments: [],
    });
  }

  /**
   * Get TERMINATED state constant (1)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Terminated state constant (u8)
   */
  static stateTerminated(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'state_terminated'
      ),
      arguments: [],
    });
  }

  // ========================================
  // Constructor Functions
  // ========================================

  /**
   * Create default early resolve config (disabled by default: min = max)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns EarlyResolveConfig object
   *
   * @example
   * ```typescript
   * const earlyResolveConfig = FutarchyConfig.defaultEarlyResolveConfig(tx, {
   *   futarchyCorePackageId,
   * });
   * ```
   */
  static defaultEarlyResolveConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'default_early_resolve_config'
      ),
      arguments: [],
    });
  }

  /**
   * Create custom early resolve config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns EarlyResolveConfig object
   *
   * @example
   * ```typescript
   * const earlyResolveConfig = FutarchyConfig.newEarlyResolveConfig(tx, {
   *   futarchyCorePackageId,
   *   minProposalDurationMs: 43_200_000n, // 12 hours
   *   maxProposalDurationMs: 172_800_000n, // 48 hours
   *   minWinnerSpread: 50_000_000_000n, // 5%
   *   minTimeSinceLastFlipMs: 14_400_000n, // 4 hours
   *   maxFlipsInWindow: 1n,
   *   flipWindowDurationMs: 86_400_000n, // 24 hours
   *   enableTwapScaling: false,
   *   keeperRewardBps: 10n,
   * });
   * ```
   */
  static newEarlyResolveConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      minProposalDurationMs: bigint;
      maxProposalDurationMs: bigint;
      minWinnerSpread: bigint;
      minTimeSinceLastFlipMs: bigint;
      maxFlipsInWindow: bigint;
      flipWindowDurationMs: bigint;
      enableTwapScaling: boolean;
      keeperRewardBps: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'new_early_resolve_config'
      ),
      arguments: [
        tx.pure.u64(config.minProposalDurationMs),
        tx.pure.u64(config.maxProposalDurationMs),
        tx.pure.u128(config.minWinnerSpread),
        tx.pure.u64(config.minTimeSinceLastFlipMs),
        tx.pure.u64(config.maxFlipsInWindow),
        tx.pure.u64(config.flipWindowDurationMs),
        tx.pure.bool(config.enableTwapScaling),
        tx.pure.u64(config.keeperRewardBps),
      ],
    });
  }

  /**
   * Creates a new pure FutarchyConfig
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns FutarchyConfig object
   *
   * @example
   * ```typescript
   * const futarchyConfig = FutarchyConfig.new(tx, {
   *   futarchyCorePackageId,
   *   assetType: '0x2::sui::SUI',
   *   stableType: '0x123::usdc::USDC',
   *   daoConfig,
   * });
   * ```
   */
  static new(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      assetType: string;
      stableType: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'new'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.daoConfig],
    });
  }

  /**
   * Creates a new DaoState for dynamic storage
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns DaoState object
   */
  static newDaoState(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'new_dao_state'
      ),
      arguments: [],
    });
  }

  /**
   * Create a DaoStateKey (for use in modules that can't directly instantiate it)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns DaoStateKey object
   */
  static newDaoStateKey(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'new_dao_state_key'
      ),
      arguments: [],
    });
  }

  /**
   * Create witness for authorized operations
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ConfigWitness object
   */
  static witness(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'witness'
      ),
      arguments: [],
    });
  }

  // ========================================
  // Getters for FutarchyConfig
  // ========================================

  /**
   * Get asset type
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Asset type (String)
   */
  static assetType(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'asset_type'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get stable type
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Stable type (String)
   */
  static stableType(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'stable_type'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get DAO config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns DaoConfig reference
   */
  static daoConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'dao_config'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get mutable DAO config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable DaoConfig reference
   */
  static daoConfigMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'dao_config_mut'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get outcome win reward
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Outcome win reward (u64)
   */
  static outcomeWinReward(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'outcome_win_reward'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get verification level
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Verification level (u8)
   */
  static verificationLevel(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'verification_level'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get DAO score
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns DAO score (u64)
   */
  static daoScore(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'dao_score'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get admin review text
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Admin review text (String)
   */
  static adminReviewText(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'admin_review_text'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get early resolve config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns EarlyResolveConfig reference
   */
  static earlyResolveConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_config'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  // ========================================
  // Getters for EarlyResolveConfig
  // ========================================

  /**
   * Check if early resolution is enabled (min_duration < max_duration)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if early resolve is enabled
   */
  static earlyResolveEnabled(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_enabled'
      ),
      arguments: [config.earlyResolveConfig],
    });
  }

  /**
   * Get early resolve minimum duration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Min duration in milliseconds (u64)
   */
  static earlyResolveMinDuration(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_min_duration'
      ),
      arguments: [config.earlyResolveConfig],
    });
  }

  /**
   * Get early resolve maximum duration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Max duration in milliseconds (u64)
   */
  static earlyResolveMaxDuration(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_max_duration'
      ),
      arguments: [config.earlyResolveConfig],
    });
  }

  /**
   * Get early resolve minimum spread
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Min spread (u128)
   */
  static earlyResolveMinSpread(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_min_spread'
      ),
      arguments: [config.earlyResolveConfig],
    });
  }

  /**
   * Get early resolve minimum time since flip
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Min time since flip in milliseconds (u64)
   */
  static earlyResolveMinTimeSinceFlip(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_min_time_since_flip'
      ),
      arguments: [config.earlyResolveConfig],
    });
  }

  /**
   * Get early resolve keeper reward basis points
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Keeper reward in basis points (u64)
   */
  static earlyResolveKeeperRewardBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_keeper_reward_bps'
      ),
      arguments: [config.earlyResolveConfig],
    });
  }

  /**
   * Get early resolve max flips in window
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Max flips in window (u64)
   */
  static earlyResolveMaxFlipsInWindow(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_max_flips_in_window'
      ),
      arguments: [config.earlyResolveConfig],
    });
  }

  /**
   * Get early resolve flip window duration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Flip window duration in milliseconds (u64)
   */
  static earlyResolveFlipWindowDuration(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_flip_window_duration'
      ),
      arguments: [config.earlyResolveConfig],
    });
  }

  /**
   * Get early resolve TWAP scaling enabled
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if TWAP scaling is enabled
   */
  static earlyResolveTwapScalingEnabled(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'early_resolve_twap_scaling_enabled'
      ),
      arguments: [config.earlyResolveConfig],
    });
  }

  // ========================================
  // Getters for DaoState
  // ========================================

  /**
   * Get operational state
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Operational state (u8)
   */
  static operationalState(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'operational_state'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Get active proposals count
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Active proposals count (u64)
   */
  static activeProposals(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'active_proposals'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Get total proposals count
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Total proposals count (u64)
   */
  static totalProposals(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'total_proposals'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Get attestation URL
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Attestation URL (String)
   */
  static attestationUrl(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'attestation_url'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Get verification pending flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if verification is pending
   */
  static verificationPending(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'verification_pending'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Check if DAO is operational (can create/accept proposals)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if DAO is operational
   */
  static isOperational(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'is_operational'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Check if DAO is terminated (no new proposals allowed)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if DAO is terminated
   */
  static isTerminated(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'is_terminated'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Assert DAO is not terminated (use before operations that require active state)
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static assertNotTerminated(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'assert_not_terminated'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Get dissolution unlock time (terminated_at + delay)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Dissolution unlock time (Option<u64>)
   */
  static dissolutionUnlockTime(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'dissolution_unlock_time'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Get termination timestamp
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Terminated at timestamp (Option<u64>)
   */
  static terminatedAt(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'terminated_at'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Check if dissolution capability has been created
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if dissolution capability was created
   */
  static dissolutionCapabilityCreated(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'dissolution_capability_created'
      ),
      arguments: [config.daoState],
    });
  }

  // ========================================
  // Setters for DaoState (mutable)
  // ========================================

  /**
   * Set operational state
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setOperationalState(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
      newState: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_operational_state'
      ),
      arguments: [config.daoState, tx.pure.u8(config.newState)],
    });
  }

  /**
   * Set dissolution parameters when terminating DAO
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setDissolutionParams(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
      terminatedAtMs: bigint;
      unlockDelayMs: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_dissolution_params'
      ),
      arguments: [
        config.daoState,
        tx.pure.u64(config.terminatedAtMs),
        tx.pure.u64(config.unlockDelayMs),
      ],
    });
  }

  /**
   * Mark that dissolution capability has been created (one-time flag)
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static markDissolutionCapabilityCreated(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'mark_dissolution_capability_created'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Increment active proposals count
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static incrementActiveProposals(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'increment_active_proposals'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Decrement active proposals count
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static decrementActiveProposals(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'decrement_active_proposals'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Increment total proposals count
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static incrementTotalProposals(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'increment_total_proposals'
      ),
      arguments: [config.daoState],
    });
  }

  /**
   * Set attestation URL
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setAttestationUrl(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
      url: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_attestation_url'
      ),
      arguments: [config.daoState, tx.pure.string(config.url)],
    });
  }

  /**
   * Set verification pending flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setVerificationPending(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
      pending: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_verification_pending'
      ),
      arguments: [config.daoState, tx.pure.bool(config.pending)],
    });
  }

  /**
   * Set verification level
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setVerificationLevel(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      level: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_verification_level'
      ),
      arguments: [config.futarchyConfig, tx.pure.u8(config.level)],
    });
  }

  /**
   * Set DAO score
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setDaoScore(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      score: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_dao_score'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.score)],
    });
  }

  /**
   * Set admin review text
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setAdminReviewText(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      reviewText: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_admin_review_text'
      ),
      arguments: [config.futarchyConfig, tx.pure.string(config.reviewText)],
    });
  }

  /**
   * Set proposal enablement state
   *
   * IMPORTANT: Disabling proposals when in ACTIVE state moves to TERMINATED.
   * TERMINATED state is IRREVERSIBLE - cannot return to ACTIVE.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setProposalsEnabled(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoState: ReturnType<Transaction['moveCall']>;
      enabled: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_proposals_enabled'
      ),
      arguments: [config.daoState, tx.pure.bool(config.enabled)],
    });
  }

  // ========================================
  // Delegated Getters from dao_config
  // ========================================

  /**
   * Get review period in milliseconds (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Review period in milliseconds (u64)
   */
  static reviewPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'review_period_ms'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get trading period in milliseconds (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Trading period in milliseconds (u64)
   */
  static tradingPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'trading_period_ms'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get minimum asset amount (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Minimum asset amount (u64)
   */
  static minAssetAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'min_asset_amount'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get minimum stable amount (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Minimum stable amount (u64)
   */
  static minStableAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'min_stable_amount'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get AMM TWAP start delay (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TWAP start delay in milliseconds (u64)
   */
  static ammTwapStartDelay(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'amm_twap_start_delay'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get AMM TWAP initial observation (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Initial observation (u128)
   */
  static ammTwapInitialObservation(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'amm_twap_initial_observation'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get AMM TWAP step max (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Step max in milliseconds (u64)
   */
  static ammTwapStepMax(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'amm_twap_step_max'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get TWAP threshold (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TWAP threshold (SignedU128)
   */
  static twapThreshold(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'twap_threshold'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get conditional AMM fee in basis points (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Conditional AMM fee in basis points (u64)
   */
  static conditionalAmmFeeBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'conditional_amm_fee_bps'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get spot AMM fee in basis points (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot AMM fee in basis points (u64)
   */
  static spotAmmFeeBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'spot_amm_fee_bps'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get AMM total fee in basis points (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Total AMM fee in basis points (u64)
   */
  static ammTotalFeeBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'amm_total_fee_bps'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get max outcomes (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Max outcomes (u64)
   */
  static maxOutcomes(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'max_outcomes'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get enable premarket reservation lock flag (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if premarket reservation lock is enabled
   */
  static enablePremarketReservationLock(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'enable_premarket_reservation_lock'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get market operation review period in milliseconds (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Market operation review period in milliseconds (u64)
   */
  static marketOpReviewPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'market_op_review_period_ms'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get max AMM swap percent in basis points (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Max AMM swap percent in basis points (u64)
   */
  static maxAmmSwapPercentBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'max_amm_swap_percent_bps'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  /**
   * Get conditional liquidity ratio percent (delegated from dao_config)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Conditional liquidity ratio percent (u64)
   */
  static conditionalLiquidityRatioPercent(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'conditional_liquidity_ratio_percent'
      ),
      arguments: [config.futarchyConfig],
    });
  }

  // ========================================
  // FutarchyOutcome Functions
  // ========================================

  /**
   * Creates a new FutarchyOutcome for intent creation (before proposal exists)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns FutarchyOutcome object
   *
   * @example
   * ```typescript
   * const outcome = FutarchyConfig.newFutarchyOutcome(tx, {
   *   futarchyCorePackageId,
   *   intentKey: 'my-intent-key',
   *   minExecutionTime: 1234567890n,
   * });
   * ```
   */
  static newFutarchyOutcome(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      intentKey: string;
      minExecutionTime: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'new_futarchy_outcome'
      ),
      arguments: [
        tx.pure.string(config.intentKey),
        tx.pure.u64(config.minExecutionTime),
      ],
    });
  }

  /**
   * Public constructor for FutarchyOutcome with all fields
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns FutarchyOutcome object
   */
  static newFutarchyOutcomeFull(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      intentKey: string;
      proposalId: string | null;
      marketId: string | null;
      approved: boolean;
      minExecutionTime: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'new_futarchy_outcome_full'
      ),
      arguments: [
        tx.pure.string(config.intentKey),
        config.proposalId ? tx.pure.option('id', config.proposalId) : tx.pure.option('id', null),
        config.marketId ? tx.pure.option('id', config.marketId) : tx.pure.option('id', null),
        tx.pure.bool(config.approved),
        tx.pure.u64(config.minExecutionTime),
      ],
    });
  }

  /**
   * Updates proposal and market IDs after proposal creation
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setOutcomeProposalAndMarket(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      outcome: ReturnType<Transaction['moveCall']>;
      proposalId: string;
      marketId: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_outcome_proposal_and_market'
      ),
      arguments: [
        config.outcome,
        tx.pure.id(config.proposalId),
        tx.pure.id(config.marketId),
      ],
    });
  }

  /**
   * Marks outcome as approved after proposal passes
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setOutcomeApproved(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      outcome: ReturnType<Transaction['moveCall']>;
      approved: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_outcome_approved'
      ),
      arguments: [config.outcome, tx.pure.bool(config.approved)],
    });
  }

  /**
   * Sets the intent key for an outcome
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setOutcomeIntentKey(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      outcome: ReturnType<Transaction['moveCall']>;
      intentKey: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_outcome_intent_key'
      ),
      arguments: [config.outcome, tx.pure.string(config.intentKey)],
    });
  }

  /**
   * Gets the minimum execution time
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Minimum execution time (u64)
   */
  static outcomeMinExecutionTime(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      outcome: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'outcome_min_execution_time'
      ),
      arguments: [config.outcome],
    });
  }

  // ========================================
  // Setter Functions (delegated to dao_config)
  // ========================================

  /**
   * Set DAO name
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setDaoName(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      name: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_dao_name'
      ),
      arguments: [config.futarchyConfig, tx.pure.string(config.name)],
    });
  }

  /**
   * Set icon URL
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setIconUrl(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      url: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_icon_url'
      ),
      arguments: [config.futarchyConfig, tx.pure.string(config.url)],
    });
  }

  /**
   * Set description
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setDescription(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      desc: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_description'
      ),
      arguments: [config.futarchyConfig, tx.pure.string(config.desc)],
    });
  }

  /**
   * Set minimum asset amount
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setMinAssetAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_min_asset_amount'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.amount)],
    });
  }

  /**
   * Set minimum stable amount
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setMinStableAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_min_stable_amount'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.amount)],
    });
  }

  /**
   * Set review period in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setReviewPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      period: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_review_period_ms'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.period)],
    });
  }

  /**
   * Set trading period in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setTradingPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      period: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_trading_period_ms'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.period)],
    });
  }

  /**
   * Set conditional AMM fee in basis points
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setConditionalAmmFeeBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      fee: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_conditional_amm_fee_bps'
      ),
      arguments: [config.futarchyConfig, tx.pure.u16(config.fee)],
    });
  }

  /**
   * Set spot AMM fee in basis points
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setSpotAmmFeeBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      fee: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_spot_amm_fee_bps'
      ),
      arguments: [config.futarchyConfig, tx.pure.u16(config.fee)],
    });
  }

  /**
   * Set AMM TWAP start delay
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setAmmTwapStartDelay(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      delay: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_amm_twap_start_delay'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.delay)],
    });
  }

  /**
   * Set AMM TWAP step max
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setAmmTwapStepMax(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      max: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_amm_twap_step_max'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.max)],
    });
  }

  /**
   * Set AMM TWAP initial observation
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setAmmTwapInitialObservation(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      obs: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_amm_twap_initial_observation'
      ),
      arguments: [config.futarchyConfig, tx.pure.u128(config.obs)],
    });
  }

  /**
   * Set TWAP threshold
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setTwapThreshold(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      threshold: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_twap_threshold'
      ),
      arguments: [config.futarchyConfig, config.threshold],
    });
  }

  /**
   * Set max outcomes
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setMaxOutcomes(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      max: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_max_outcomes'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.max)],
    });
  }

  /**
   * Set max actions per outcome
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setMaxActionsPerOutcome(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      max: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_max_actions_per_outcome'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.max)],
    });
  }

  /**
   * Set max intents per outcome
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setMaxIntentsPerOutcome(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      max: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_max_intents_per_outcome'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.max)],
    });
  }

  /**
   * Set proposal intent expiry in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setProposalIntentExpiryMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      expiry: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_proposal_intent_expiry_ms'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.expiry)],
    });
  }

  /**
   * Set proposal creation fee
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setProposalCreationFee(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      fee: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_proposal_creation_fee'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.fee)],
    });
  }

  /**
   * Set proposal fee per outcome
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setProposalFeePerOutcome(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      fee: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_proposal_fee_per_outcome'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.fee)],
    });
  }

  /**
   * Set accept new proposals flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setAcceptNewProposals(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      accept: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_accept_new_proposals'
      ),
      arguments: [config.futarchyConfig, tx.pure.bool(config.accept)],
    });
  }

  /**
   * Set enable premarket reservation lock flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setEnablePremarketReservationLock(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      enabled: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_enable_premarket_reservation_lock'
      ),
      arguments: [config.futarchyConfig, tx.pure.bool(config.enabled)],
    });
  }

  /**
   * Set show proposal details flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setShowProposalDetails(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      show: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_show_proposal_details'
      ),
      arguments: [config.futarchyConfig, tx.pure.bool(config.show)],
    });
  }

  /**
   * Set market operation review period in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setMarketOpReviewPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      period: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_market_op_review_period_ms'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.period)],
    });
  }

  /**
   * Set max AMM swap percent in basis points
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setMaxAmmSwapPercentBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      percentBps: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_max_amm_swap_percent_bps'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.percentBps)],
    });
  }

  /**
   * Set conditional liquidity ratio percent
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setConditionalLiquidityRatioPercent(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      ratioPercent: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_conditional_liquidity_ratio_percent'
      ),
      arguments: [config.futarchyConfig, tx.pure.u64(config.ratioPercent)],
    });
  }

  /**
   * Set use outcome index flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setUseOutcomeIndex(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      useIndex: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_use_outcome_index'
      ),
      arguments: [config.futarchyConfig, tx.pure.bool(config.useIndex)],
    });
  }

  /**
   * Set conditional metadata
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setConditionalMetadata(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      metadata: ReturnType<Transaction['moveCall']> | null;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_conditional_metadata'
      ),
      arguments: [
        config.futarchyConfig,
        config.metadata || tx.pure.option('address', null),
      ],
    });
  }

  /**
   * Set early resolve config
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setEarlyResolveConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      earlyResolveConfig: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_early_resolve_config'
      ),
      arguments: [config.futarchyConfig, config.earlyResolveConfig],
    });
  }

  // ========================================
  // Account Creation Functions
  // ========================================

  /**
   * Creates a new account with PackageRegistry validation for use with the Futarchy config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Account object
   */
  static newWithPackageRegistry(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      registry: ReturnType<Transaction['moveCall']>;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'new_with_package_registry'
      ),
      arguments: [config.registry, config.futarchyConfig],
    });
  }

  /**
   * Get mutable access to internal config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable FutarchyConfig reference
   */
  static internalConfigMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
      version: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'internal_config_mut'
      ),
      arguments: [config.account, config.registry, config.version],
    });
  }

  /**
   * Get mutable access to the DaoState stored as a dynamic field on the Account
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable DaoState reference
   */
  static stateMutFromAccount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'state_mut_from_account'
      ),
      arguments: [config.account, config.registry],
    });
  }

  /**
   * Create auth witness for this account config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ConfigWitness object
   */
  static authenticate(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      account: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'authenticate'
      ),
      arguments: [config.account],
    });
  }

  // ========================================
  // Launchpad Initial Price Functions
  // ========================================

  /**
   * Set the launchpad initial price (WRITE-ONCE, IMMUTABLE after set)
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setLaunchpadInitialPrice(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
      price: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'set_launchpad_initial_price'
      ),
      arguments: [config.futarchyConfig, tx.pure.u128(config.price)],
    });
  }

  /**
   * Get the launchpad initial price
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Launchpad initial price (Option<u128>)
   */
  static getLaunchpadInitialPrice(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      futarchyConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'futarchy_config',
        'get_launchpad_initial_price'
      ),
      arguments: [config.futarchyConfig],
    });
  }
}
