/**
 * DAO Configuration Module
 *
 * Provides centralized configuration structs and validation for futarchy DAOs.
 * Manages trading parameters, TWAP config, governance settings, metadata,
 * conditional coin config, quota system, and sponsorship configuration.
 *
 * FEATURES:
 * - Trading parameters (liquidity, periods, fees)
 * - TWAP configuration (threshold-based market resolution)
 * - Governance config (outcomes, actions, fees)
 * - Metadata config (name, icon, description)
 * - Conditional coin config (token naming)
 * - Quota config (recurring proposal quotas)
 * - Sponsorship config (team-sponsored proposals)
 *
 * @module dao-config
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * DAO Configuration Static Functions
 *
 * Manages comprehensive DAO configuration including trading, governance,
 * metadata, quotas, and sponsorship settings.
 */
export class DaoConfig {
  // ========================================
  // Constructor Functions
  // ========================================

  /**
   * Create a new trading parameters configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TradingParams object
   *
   * @example
   * ```typescript
   * const tradingParams = DaoConfig.newTradingParams(tx, {
   *   futarchyCorePackageId,
   *   minAssetAmount: 1_000_000n,
   *   minStableAmount: 1_000_000n,
   *   reviewPeriodMs: 86_400_000n, // 24 hours
   *   tradingPeriodMs: 604_800_000n, // 7 days
   *   conditionalAmmFeeBps: 30n, // 0.3%
   *   spotAmmFeeBps: 30n, // 0.3%
   *   marketOpReviewPeriodMs: 0n, // immediate
   *   maxAmmSwapPercentBps: 1000n, // 10%
   *   conditionalLiquidityRatioPercent: 80n, // 80%
   * });
   * ```
   */
  static newTradingParams(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      minAssetAmount: bigint;
      minStableAmount: bigint;
      reviewPeriodMs: bigint;
      tradingPeriodMs: bigint;
      conditionalAmmFeeBps: bigint;
      spotAmmFeeBps: bigint;
      marketOpReviewPeriodMs: bigint;
      maxAmmSwapPercentBps: bigint;
      conditionalLiquidityRatioPercent: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'new_trading_params'
      ),
      arguments: [
        tx.pure.u64(config.minAssetAmount),
        tx.pure.u64(config.minStableAmount),
        tx.pure.u64(config.reviewPeriodMs),
        tx.pure.u64(config.tradingPeriodMs),
        tx.pure.u64(config.conditionalAmmFeeBps),
        tx.pure.u64(config.spotAmmFeeBps),
        tx.pure.u64(config.marketOpReviewPeriodMs),
        tx.pure.u64(config.maxAmmSwapPercentBps),
        tx.pure.u64(config.conditionalLiquidityRatioPercent),
      ],
    });
  }

  /**
   * Create a new TWAP configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TwapConfig object
   *
   * @example
   * ```typescript
   * const twapConfig = DaoConfig.newTwapConfig(tx, {
   *   futarchyCorePackageId,
   *   startDelay: 300_000n, // 5 minutes
   *   stepMax: 300_000n, // 5 minutes
   *   initialObservation: 1_000_000_000_000n,
   *   threshold: signedThresholdValue,
   * });
   * ```
   */
  static newTwapConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      startDelay: bigint;
      stepMax: bigint;
      initialObservation: bigint;
      threshold: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'new_twap_config'
      ),
      arguments: [
        tx.pure.u64(config.startDelay),
        tx.pure.u64(config.stepMax),
        tx.pure.u128(config.initialObservation),
        config.threshold,
      ],
    });
  }

  /**
   * Create a new governance configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns GovernanceConfig object
   *
   * @example
   * ```typescript
   * const govConfig = DaoConfig.newGovernanceConfig(tx, {
   *   futarchyCorePackageId,
   *   maxOutcomes: 5n,
   *   maxActionsPerOutcome: 10n,
   *   proposalCreationFee: 500_000n, // 0.5 tokens
   *   proposalFeePerOutcome: 1_000_000n, // 1.0 tokens
   *   acceptNewProposals: true,
   *   maxIntentsPerOutcome: 10n,
   *   proposalIntentExpiryMs: 86_400_000n, // 24 hours
   *   enablePremarketReservationLock: true,
   *   showProposalDetails: false,
   * });
   * ```
   */
  static newGovernanceConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      maxOutcomes: bigint;
      maxActionsPerOutcome: bigint;
      proposalCreationFee: bigint;
      proposalFeePerOutcome: bigint;
      acceptNewProposals: boolean;
      maxIntentsPerOutcome: bigint;
      proposalIntentExpiryMs: bigint;
      enablePremarketReservationLock: boolean;
      showProposalDetails: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'new_governance_config'
      ),
      arguments: [
        tx.pure.u64(config.maxOutcomes),
        tx.pure.u64(config.maxActionsPerOutcome),
        tx.pure.u64(config.proposalCreationFee),
        tx.pure.u64(config.proposalFeePerOutcome),
        tx.pure.bool(config.acceptNewProposals),
        tx.pure.u64(config.maxIntentsPerOutcome),
        tx.pure.u64(config.proposalIntentExpiryMs),
        tx.pure.bool(config.enablePremarketReservationLock),
        tx.pure.bool(config.showProposalDetails),
      ],
    });
  }

  /**
   * Create a new metadata configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns MetadataConfig object
   *
   * @example
   * ```typescript
   * const metadataConfig = DaoConfig.newMetadataConfig(tx, {
   *   futarchyCorePackageId,
   *   daoName: 'MyDAO',
   *   iconUrl: 'https://example.com/icon.png',
   *   description: 'A decentralized autonomous organization',
   * });
   * ```
   */
  static newMetadataConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoName: string;
      iconUrl: string;
      description: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'new_metadata_config'
      ),
      arguments: [
        tx.pure.string(config.daoName),
        tx.pure.string(config.iconUrl),
        tx.pure.string(config.description),
      ],
    });
  }

  /**
   * Create conditional coin config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ConditionalCoinConfig object
   *
   * @example
   * ```typescript
   * const conditionalCoinConfig = DaoConfig.newConditionalCoinConfig(tx, {
   *   futarchyCorePackageId,
   *   useOutcomeIndex: true,
   *   conditionalMetadata: optionalMetadata, // or null
   * });
   * ```
   */
  static newConditionalCoinConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      useOutcomeIndex: boolean;
      conditionalMetadata: ReturnType<Transaction['moveCall']> | null;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'new_conditional_coin_config'
      ),
      arguments: [
        tx.pure.bool(config.useOutcomeIndex),
        config.conditionalMetadata || tx.pure.option('address', null),
      ],
    });
  }

  /**
   * Create new conditional metadata
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ConditionalMetadata object
   *
   * @example
   * ```typescript
   * const conditionalMetadata = DaoConfig.newConditionalMetadata(tx, {
   *   futarchyCorePackageId,
   *   decimals: 6,
   *   coinNamePrefix: 'c_MYDAO_',
   *   coinIconUrl: 'https://example.com/icon.png',
   * });
   * ```
   */
  static newConditionalMetadata(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      decimals: number;
      coinNamePrefix: string;
      coinIconUrl: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'new_conditional_metadata'
      ),
      arguments: [
        tx.pure.u8(config.decimals),
        tx.pure.string(config.coinNamePrefix),
        tx.pure.string(config.coinIconUrl),
      ],
    });
  }

  /**
   * Create a new quota configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns QuotaConfig object
   *
   * @example
   * ```typescript
   * const quotaConfig = DaoConfig.newQuotaConfig(tx, {
   *   futarchyCorePackageId,
   *   enabled: true,
   *   defaultQuotaAmount: 1n,
   *   defaultQuotaPeriodMs: 2_592_000_000n, // 30 days
   *   defaultReducedFee: 0n,
   * });
   * ```
   */
  static newQuotaConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      enabled: boolean;
      defaultQuotaAmount: bigint;
      defaultQuotaPeriodMs: bigint;
      defaultReducedFee: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'new_quota_config'
      ),
      arguments: [
        tx.pure.bool(config.enabled),
        tx.pure.u64(config.defaultQuotaAmount),
        tx.pure.u64(config.defaultQuotaPeriodMs),
        tx.pure.u64(config.defaultReducedFee),
      ],
    });
  }

  /**
   * Create a new sponsorship configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns SponsorshipConfig object
   *
   * @example
   * ```typescript
   * const sponsorshipConfig = DaoConfig.newSponsorshipConfig(tx, {
   *   futarchyCorePackageId,
   *   enabled: true,
   *   sponsoredThreshold: signedThresholdValue,
   *   waiveAdvancementFees: false,
   *   defaultSponsorQuotaAmount: 1n,
   * });
   * ```
   */
  static newSponsorshipConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      enabled: boolean;
      sponsoredThreshold: ReturnType<Transaction['moveCall']>;
      waiveAdvancementFees: boolean;
      defaultSponsorQuotaAmount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'new_sponsorship_config'
      ),
      arguments: [
        tx.pure.bool(config.enabled),
        config.sponsoredThreshold,
        tx.pure.bool(config.waiveAdvancementFees),
        tx.pure.u64(config.defaultSponsorQuotaAmount),
      ],
    });
  }

  /**
   * Create a complete DAO configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns DaoConfig object
   *
   * @example
   * ```typescript
   * const daoConfig = DaoConfig.newDaoConfig(tx, {
   *   futarchyCorePackageId,
   *   tradingParams,
   *   twapConfig,
   *   governanceConfig,
   *   metadataConfig,
   *   conditionalCoinConfig,
   *   quotaConfig,
   *   sponsorshipConfig,
   * });
   * ```
   */
  static newDaoConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
      twapConfig: ReturnType<Transaction['moveCall']>;
      governanceConfig: ReturnType<Transaction['moveCall']>;
      metadataConfig: ReturnType<Transaction['moveCall']>;
      conditionalCoinConfig: ReturnType<Transaction['moveCall']>;
      quotaConfig: ReturnType<Transaction['moveCall']>;
      sponsorshipConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'new_dao_config'
      ),
      arguments: [
        config.tradingParams,
        config.twapConfig,
        config.governanceConfig,
        config.metadataConfig,
        config.conditionalCoinConfig,
        config.quotaConfig,
        config.sponsorshipConfig,
      ],
    });
  }

  // ========================================
  // Getter Functions - DaoConfig
  // ========================================

  /**
   * Get trading params from DAO config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TradingParams reference
   */
  static tradingParams(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'trading_params'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get TWAP config from DAO config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TwapConfig reference
   */
  static twapConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'twap_config'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get governance config from DAO config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns GovernanceConfig reference
   */
  static governanceConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'governance_config'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get metadata config from DAO config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns MetadataConfig reference
   */
  static metadataConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'metadata_config'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get conditional coin config from DAO config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ConditionalCoinConfig reference
   */
  static conditionalCoinConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_coin_config'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get quota config from DAO config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns QuotaConfig reference
   */
  static quotaConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'quota_config'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get sponsorship config from DAO config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns SponsorshipConfig reference
   */
  static sponsorshipConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'sponsorship_config'
      ),
      arguments: [config.daoConfig],
    });
  }

  // ========================================
  // Getter Functions - TradingParams
  // ========================================

  /**
   * Get minimum asset amount
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Minimum asset amount (u64)
   */
  static minAssetAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'min_asset_amount'
      ),
      arguments: [config.tradingParams],
    });
  }

  /**
   * Get minimum stable amount
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Minimum stable amount (u64)
   */
  static minStableAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'min_stable_amount'
      ),
      arguments: [config.tradingParams],
    });
  }

  /**
   * Get review period in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Review period in milliseconds (u64)
   */
  static reviewPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'review_period_ms'
      ),
      arguments: [config.tradingParams],
    });
  }

  /**
   * Get trading period in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Trading period in milliseconds (u64)
   */
  static tradingPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'trading_period_ms'
      ),
      arguments: [config.tradingParams],
    });
  }

  /**
   * Get conditional AMM fee in basis points
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Conditional AMM fee in basis points (u64)
   */
  static conditionalAmmFeeBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_amm_fee_bps'
      ),
      arguments: [config.tradingParams],
    });
  }

  /**
   * Get spot AMM fee in basis points
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot AMM fee in basis points (u64)
   */
  static spotAmmFeeBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'spot_amm_fee_bps'
      ),
      arguments: [config.tradingParams],
    });
  }

  /**
   * Get market operation review period in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Market operation review period in milliseconds (u64)
   */
  static marketOpReviewPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'market_op_review_period_ms'
      ),
      arguments: [config.tradingParams],
    });
  }

  /**
   * Get max AMM swap percent in basis points
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Max AMM swap percent in basis points (u64)
   */
  static maxAmmSwapPercentBps(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'max_amm_swap_percent_bps'
      ),
      arguments: [config.tradingParams],
    });
  }

  /**
   * Get conditional liquidity ratio percent
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Conditional liquidity ratio percent (u64)
   */
  static conditionalLiquidityRatioPercent(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      tradingParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_liquidity_ratio_percent'
      ),
      arguments: [config.tradingParams],
    });
  }

  // ========================================
  // Getter Functions - TwapConfig
  // ========================================

  /**
   * Get start delay in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Start delay in milliseconds (u64)
   */
  static startDelay(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      twapConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'start_delay'
      ),
      arguments: [config.twapConfig],
    });
  }

  /**
   * Get step max in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Step max in milliseconds (u64)
   */
  static stepMax(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      twapConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'step_max'
      ),
      arguments: [config.twapConfig],
    });
  }

  /**
   * Get initial observation value
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Initial observation (u128)
   */
  static initialObservation(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      twapConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'initial_observation'
      ),
      arguments: [config.twapConfig],
    });
  }

  /**
   * Get threshold (SignedU128)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Threshold (SignedU128)
   */
  static threshold(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      twapConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'threshold'
      ),
      arguments: [config.twapConfig],
    });
  }

  // ========================================
  // Getter Functions - GovernanceConfig
  // ========================================

  /**
   * Get max outcomes
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Max outcomes (u64)
   */
  static maxOutcomes(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      governanceConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'max_outcomes'
      ),
      arguments: [config.governanceConfig],
    });
  }

  /**
   * Get max actions per outcome
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Max actions per outcome (u64)
   */
  static maxActionsPerOutcome(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      governanceConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'max_actions_per_outcome'
      ),
      arguments: [config.governanceConfig],
    });
  }

  /**
   * Get proposal creation fee
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Proposal creation fee (u64)
   */
  static proposalCreationFee(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      governanceConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'proposal_creation_fee'
      ),
      arguments: [config.governanceConfig],
    });
  }

  /**
   * Get proposal fee per outcome
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Proposal fee per outcome (u64)
   */
  static proposalFeePerOutcome(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      governanceConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'proposal_fee_per_outcome'
      ),
      arguments: [config.governanceConfig],
    });
  }

  /**
   * Get accept new proposals flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Accept new proposals (bool)
   */
  static acceptNewProposals(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      governanceConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'accept_new_proposals'
      ),
      arguments: [config.governanceConfig],
    });
  }

  /**
   * Get max intents per outcome
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Max intents per outcome (u64)
   */
  static maxIntentsPerOutcome(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      governanceConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'max_intents_per_outcome'
      ),
      arguments: [config.governanceConfig],
    });
  }

  /**
   * Get proposal intent expiry in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Proposal intent expiry in milliseconds (u64)
   */
  static proposalIntentExpiryMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      governanceConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'proposal_intent_expiry_ms'
      ),
      arguments: [config.governanceConfig],
    });
  }

  /**
   * Get enable premarket reservation lock flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Enable premarket reservation lock (bool)
   */
  static enablePremarketReservationLock(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      governanceConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'enable_premarket_reservation_lock'
      ),
      arguments: [config.governanceConfig],
    });
  }

  /**
   * Get show proposal details flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Show proposal details (bool)
   */
  static showProposalDetails(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      governanceConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'show_proposal_details'
      ),
      arguments: [config.governanceConfig],
    });
  }

  // ========================================
  // Getter Functions - MetadataConfig
  // ========================================

  /**
   * Get DAO name
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns DAO name (AsciiString)
   */
  static daoName(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      metadataConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'dao_name'
      ),
      arguments: [config.metadataConfig],
    });
  }

  /**
   * Get icon URL
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Icon URL (Url)
   */
  static iconUrl(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      metadataConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'icon_url'
      ),
      arguments: [config.metadataConfig],
    });
  }

  /**
   * Get description
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Description (String)
   */
  static description(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      metadataConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'description'
      ),
      arguments: [config.metadataConfig],
    });
  }

  // ========================================
  // Getter Functions - ConditionalCoinConfig
  // ========================================

  /**
   * Get use outcome index flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Use outcome index (bool)
   */
  static useOutcomeIndex(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalCoinConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'use_outcome_index'
      ),
      arguments: [config.conditionalCoinConfig],
    });
  }

  /**
   * Get conditional metadata
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Conditional metadata (Option<ConditionalMetadata>)
   */
  static conditionalMetadata(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalCoinConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_metadata'
      ),
      arguments: [config.conditionalCoinConfig],
    });
  }

  /**
   * Get coin name prefix
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Coin name prefix (Option<AsciiString>)
   */
  static coinNamePrefix(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalCoinConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'coin_name_prefix'
      ),
      arguments: [config.conditionalCoinConfig],
    });
  }

  // ========================================
  // Getter Functions - ConditionalMetadata
  // ========================================

  /**
   * Get decimals from conditional metadata
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Decimals (u8)
   */
  static conditionalMetadataDecimals(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalMetadata: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_metadata_decimals'
      ),
      arguments: [config.conditionalMetadata],
    });
  }

  /**
   * Get coin name prefix from conditional metadata
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Coin name prefix (AsciiString)
   */
  static conditionalMetadataPrefix(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalMetadata: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_metadata_prefix'
      ),
      arguments: [config.conditionalMetadata],
    });
  }

  /**
   * Get icon URL from conditional metadata
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Icon URL (Url)
   */
  static conditionalMetadataIcon(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalMetadata: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_metadata_icon'
      ),
      arguments: [config.conditionalMetadata],
    });
  }

  /**
   * Get decimals from conditional metadata (alternative name)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Decimals (u8)
   */
  static conditionalDecimals(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalMetadata: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_decimals'
      ),
      arguments: [config.conditionalMetadata],
    });
  }

  /**
   * Get coin name prefix from conditional metadata (alternative name)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Coin name prefix (AsciiString)
   */
  static conditionalCoinNamePrefix(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalMetadata: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_coin_name_prefix'
      ),
      arguments: [config.conditionalMetadata],
    });
  }

  /**
   * Get icon URL from conditional metadata (alternative name)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Icon URL (Url)
   */
  static conditionalCoinIconUrl(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalMetadata: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_coin_icon_url'
      ),
      arguments: [config.conditionalMetadata],
    });
  }

  /**
   * Derive conditional metadata from CoinMetadata
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (decimals, name_prefix, icon_url)
   */
  static deriveConditionalMetadataFromCoin(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      coinMetadata: ReturnType<Transaction['moveCall']>;
      coinType: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'derive_conditional_metadata_from_coin'
      ),
      typeArguments: [config.coinType],
      arguments: [config.coinMetadata],
    });
  }

  /**
   * Get conditional metadata from config
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (decimals, name_prefix, icon_url)
   */
  static getConditionalMetadataFromConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      conditionalCoinConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'get_conditional_metadata_from_config'
      ),
      arguments: [config.conditionalCoinConfig],
    });
  }

  // ========================================
  // Getter Functions - QuotaConfig
  // ========================================

  /**
   * Get quota enabled flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Quota enabled (bool)
   */
  static quotaEnabled(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'quota_enabled'
      ),
      arguments: [config.quotaConfig],
    });
  }

  /**
   * Get default quota amount
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default quota amount (u64)
   */
  static defaultQuotaAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_quota_amount'
      ),
      arguments: [config.quotaConfig],
    });
  }

  /**
   * Get default quota period in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default quota period in milliseconds (u64)
   */
  static defaultQuotaPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_quota_period_ms'
      ),
      arguments: [config.quotaConfig],
    });
  }

  /**
   * Get default reduced fee
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default reduced fee (u64)
   */
  static defaultReducedFee(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_reduced_fee'
      ),
      arguments: [config.quotaConfig],
    });
  }

  // ========================================
  // Getter Functions - SponsorshipConfig
  // ========================================

  /**
   * Get sponsorship enabled flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Sponsorship enabled (bool)
   */
  static sponsorshipEnabled(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      sponsorshipConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'sponsorship_enabled'
      ),
      arguments: [config.sponsorshipConfig],
    });
  }

  /**
   * Get sponsored threshold
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Sponsored threshold (SignedU128)
   */
  static sponsoredThreshold(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      sponsorshipConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'sponsored_threshold'
      ),
      arguments: [config.sponsorshipConfig],
    });
  }

  /**
   * Get waive advancement fees flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Waive advancement fees (bool)
   */
  static waiveAdvancementFees(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      sponsorshipConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'waive_advancement_fees'
      ),
      arguments: [config.sponsorshipConfig],
    });
  }

  /**
   * Get default sponsor quota amount
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default sponsor quota amount (u64)
   */
  static defaultSponsorQuotaAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      sponsorshipConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_sponsor_quota_amount'
      ),
      arguments: [config.sponsorshipConfig],
    });
  }

  // ========================================
  // Validation Functions
  // ========================================

  /**
   * Validate config update
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if update is valid
   */
  static validateConfigUpdate(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      currentConfig: ReturnType<Transaction['moveCall']>;
      newConfig: ReturnType<Transaction['moveCall']>;
      activeProposals: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'validate_config_update'
      ),
      arguments: [
        config.currentConfig,
        config.newConfig,
        tx.pure.u64(config.activeProposals),
      ],
    });
  }

  // ========================================
  // Update Functions
  // ========================================

  /**
   * Update trading parameters
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Updated DaoConfig
   */
  static updateTradingParams(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
      newParams: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'update_trading_params'
      ),
      arguments: [config.daoConfig, config.newParams],
    });
  }

  /**
   * Update TWAP configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Updated DaoConfig
   */
  static updateTwapConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
      newTwap: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'update_twap_config'
      ),
      arguments: [config.daoConfig, config.newTwap],
    });
  }

  /**
   * Update governance configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Updated DaoConfig
   */
  static updateGovernanceConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
      newGov: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'update_governance_config'
      ),
      arguments: [config.daoConfig, config.newGov],
    });
  }

  /**
   * Update metadata configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Updated DaoConfig
   */
  static updateMetadataConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
      newMeta: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'update_metadata_config'
      ),
      arguments: [config.daoConfig, config.newMeta],
    });
  }

  /**
   * Update conditional coin configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Updated DaoConfig
   */
  static updateConditionalCoinConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
      newCoinConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'update_conditional_coin_config'
      ),
      arguments: [config.daoConfig, config.newCoinConfig],
    });
  }

  /**
   * Update quota configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Updated DaoConfig
   */
  static updateQuotaConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
      newQuota: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'update_quota_config'
      ),
      arguments: [config.daoConfig, config.newQuota],
    });
  }

  /**
   * Update sponsorship configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Updated DaoConfig
   */
  static updateSponsorshipConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
      newSponsorship: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'update_sponsorship_config'
      ),
      arguments: [config.daoConfig, config.newSponsorship],
    });
  }

  // ========================================
  // Default Configuration Functions
  // ========================================

  /**
   * Get default trading parameters
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default TradingParams
   */
  static defaultTradingParams(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_trading_params'
      ),
      arguments: [],
    });
  }

  /**
   * Get default TWAP configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default TwapConfig
   */
  static defaultTwapConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_twap_config'
      ),
      arguments: [],
    });
  }

  /**
   * Get default governance configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default GovernanceConfig
   */
  static defaultGovernanceConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_governance_config'
      ),
      arguments: [],
    });
  }

  /**
   * Get default conditional coin configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default ConditionalCoinConfig
   */
  static defaultConditionalCoinConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_conditional_coin_config'
      ),
      arguments: [],
    });
  }

  /**
   * Get default quota configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default QuotaConfig
   */
  static defaultQuotaConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_quota_config'
      ),
      arguments: [],
    });
  }

  /**
   * Get default sponsorship configuration
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Default SponsorshipConfig
   */
  static defaultSponsorshipConfig(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'default_sponsorship_config'
      ),
      arguments: [],
    });
  }

  /**
   * Get mutable trading params reference
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable TradingParams reference
   */
  static tradingParamsMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'trading_params_mut'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get mutable TWAP config reference
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable TwapConfig reference
   */
  static twapConfigMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'twap_config_mut'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get mutable governance config reference
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable GovernanceConfig reference
   */
  static governanceConfigMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'governance_config_mut'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get mutable metadata config reference
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable MetadataConfig reference
   */
  static metadataConfigMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'metadata_config_mut'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get mutable conditional coin config reference
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable ConditionalCoinConfig reference
   */
  static conditionalCoinConfigMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'conditional_coin_config_mut'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get mutable quota config reference
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable QuotaConfig reference
   */
  static quotaConfigMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'quota_config_mut'
      ),
      arguments: [config.daoConfig],
    });
  }

  /**
   * Get mutable sponsorship config reference
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable SponsorshipConfig reference
   */
  static sponsorshipConfigMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      daoConfig: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'sponsorship_config_mut'
      ),
      arguments: [config.daoConfig],
    });
  }

  // ========================================
  // Direct Field Setters
  // ========================================

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
      tradingParams: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_min_asset_amount'
      ),
      arguments: [config.tradingParams, tx.pure.u64(config.amount)],
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
      tradingParams: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_min_stable_amount'
      ),
      arguments: [config.tradingParams, tx.pure.u64(config.amount)],
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
      tradingParams: ReturnType<Transaction['moveCall']>;
      period: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_review_period_ms'
      ),
      arguments: [config.tradingParams, tx.pure.u64(config.period)],
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
      tradingParams: ReturnType<Transaction['moveCall']>;
      period: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_trading_period_ms'
      ),
      arguments: [config.tradingParams, tx.pure.u64(config.period)],
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
      tradingParams: ReturnType<Transaction['moveCall']>;
      feeBps: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_conditional_amm_fee_bps'
      ),
      arguments: [config.tradingParams, tx.pure.u64(config.feeBps)],
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
      tradingParams: ReturnType<Transaction['moveCall']>;
      feeBps: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_spot_amm_fee_bps'
      ),
      arguments: [config.tradingParams, tx.pure.u64(config.feeBps)],
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
      tradingParams: ReturnType<Transaction['moveCall']>;
      period: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_market_op_review_period_ms'
      ),
      arguments: [config.tradingParams, tx.pure.u64(config.period)],
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
      tradingParams: ReturnType<Transaction['moveCall']>;
      percentBps: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_max_amm_swap_percent_bps'
      ),
      arguments: [config.tradingParams, tx.pure.u64(config.percentBps)],
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
      tradingParams: ReturnType<Transaction['moveCall']>;
      ratioPercent: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_conditional_liquidity_ratio_percent'
      ),
      arguments: [config.tradingParams, tx.pure.u64(config.ratioPercent)],
    });
  }

  /**
   * Set start delay
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setStartDelay(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      twapConfig: ReturnType<Transaction['moveCall']>;
      delay: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_start_delay'
      ),
      arguments: [config.twapConfig, tx.pure.u64(config.delay)],
    });
  }

  /**
   * Set step max
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setStepMax(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      twapConfig: ReturnType<Transaction['moveCall']>;
      max: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_step_max'
      ),
      arguments: [config.twapConfig, tx.pure.u64(config.max)],
    });
  }

  /**
   * Set initial observation
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setInitialObservation(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      twapConfig: ReturnType<Transaction['moveCall']>;
      obs: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_initial_observation'
      ),
      arguments: [config.twapConfig, tx.pure.u128(config.obs)],
    });
  }

  /**
   * Set threshold
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setThreshold(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      twapConfig: ReturnType<Transaction['moveCall']>;
      threshold: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_threshold'
      ),
      arguments: [config.twapConfig, config.threshold],
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
      governanceConfig: ReturnType<Transaction['moveCall']>;
      max: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_max_outcomes'
      ),
      arguments: [config.governanceConfig, tx.pure.u64(config.max)],
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
      governanceConfig: ReturnType<Transaction['moveCall']>;
      max: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_max_actions_per_outcome'
      ),
      arguments: [config.governanceConfig, tx.pure.u64(config.max)],
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
      governanceConfig: ReturnType<Transaction['moveCall']>;
      fee: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_proposal_creation_fee'
      ),
      arguments: [config.governanceConfig, tx.pure.u64(config.fee)],
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
      governanceConfig: ReturnType<Transaction['moveCall']>;
      fee: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_proposal_fee_per_outcome'
      ),
      arguments: [config.governanceConfig, tx.pure.u64(config.fee)],
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
      governanceConfig: ReturnType<Transaction['moveCall']>;
      accept: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_accept_new_proposals'
      ),
      arguments: [config.governanceConfig, tx.pure.bool(config.accept)],
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
      governanceConfig: ReturnType<Transaction['moveCall']>;
      max: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_max_intents_per_outcome'
      ),
      arguments: [config.governanceConfig, tx.pure.u64(config.max)],
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
      governanceConfig: ReturnType<Transaction['moveCall']>;
      period: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_proposal_intent_expiry_ms'
      ),
      arguments: [config.governanceConfig, tx.pure.u64(config.period)],
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
      governanceConfig: ReturnType<Transaction['moveCall']>;
      enabled: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_enable_premarket_reservation_lock'
      ),
      arguments: [config.governanceConfig, tx.pure.bool(config.enabled)],
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
      governanceConfig: ReturnType<Transaction['moveCall']>;
      show: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_show_proposal_details'
      ),
      arguments: [config.governanceConfig, tx.pure.bool(config.show)],
    });
  }

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
      metadataConfig: ReturnType<Transaction['moveCall']>;
      name: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_dao_name'
      ),
      arguments: [config.metadataConfig, tx.pure.string(config.name)],
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
      metadataConfig: ReturnType<Transaction['moveCall']>;
      url: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_icon_url'
      ),
      arguments: [config.metadataConfig, tx.pure.string(config.url)],
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
      metadataConfig: ReturnType<Transaction['moveCall']>;
      desc: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_description'
      ),
      arguments: [config.metadataConfig, tx.pure.string(config.desc)],
    });
  }

  /**
   * Set DAO name from String
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setDaoNameString(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      metadataConfig: ReturnType<Transaction['moveCall']>;
      name: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_dao_name_string'
      ),
      arguments: [config.metadataConfig, tx.pure.string(config.name)],
    });
  }

  /**
   * Set icon URL from String
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setIconUrlString(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      metadataConfig: ReturnType<Transaction['moveCall']>;
      urlStr: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_icon_url_string'
      ),
      arguments: [config.metadataConfig, tx.pure.string(config.urlStr)],
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
      conditionalCoinConfig: ReturnType<Transaction['moveCall']>;
      metadata: ReturnType<Transaction['moveCall']> | null;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_conditional_metadata'
      ),
      arguments: [
        config.conditionalCoinConfig,
        config.metadata || tx.pure.option('address', null),
      ],
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
      conditionalCoinConfig: ReturnType<Transaction['moveCall']>;
      useIndex: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_use_outcome_index'
      ),
      arguments: [config.conditionalCoinConfig, tx.pure.bool(config.useIndex)],
    });
  }

  /**
   * Set quota enabled flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setQuotaEnabled(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaConfig: ReturnType<Transaction['moveCall']>;
      enabled: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_quota_enabled'
      ),
      arguments: [config.quotaConfig, tx.pure.bool(config.enabled)],
    });
  }

  /**
   * Set default quota amount
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setDefaultQuotaAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaConfig: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_default_quota_amount'
      ),
      arguments: [config.quotaConfig, tx.pure.u64(config.amount)],
    });
  }

  /**
   * Set default quota period in milliseconds
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setDefaultQuotaPeriodMs(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaConfig: ReturnType<Transaction['moveCall']>;
      period: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_default_quota_period_ms'
      ),
      arguments: [config.quotaConfig, tx.pure.u64(config.period)],
    });
  }

  /**
   * Set default reduced fee
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setDefaultReducedFee(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      quotaConfig: ReturnType<Transaction['moveCall']>;
      fee: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_default_reduced_fee'
      ),
      arguments: [config.quotaConfig, tx.pure.u64(config.fee)],
    });
  }

  /**
   * Set sponsorship enabled flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setSponsorshipEnabled(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      sponsorshipConfig: ReturnType<Transaction['moveCall']>;
      enabled: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_sponsorship_enabled'
      ),
      arguments: [config.sponsorshipConfig, tx.pure.bool(config.enabled)],
    });
  }

  /**
   * Set sponsored threshold
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setSponsoredThreshold(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      sponsorshipConfig: ReturnType<Transaction['moveCall']>;
      threshold: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_sponsored_threshold'
      ),
      arguments: [config.sponsorshipConfig, config.threshold],
    });
  }

  /**
   * Set waive advancement fees flag
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setWaiveAdvancementFees(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      sponsorshipConfig: ReturnType<Transaction['moveCall']>;
      waive: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_waive_advancement_fees'
      ),
      arguments: [config.sponsorshipConfig, tx.pure.bool(config.waive)],
    });
  }

  /**
   * Set default sponsor quota amount
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static setDefaultSponsorQuotaAmount(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      sponsorshipConfig: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'dao_config',
        'set_default_sponsor_quota_amount'
      ),
      arguments: [config.sponsorshipConfig, tx.pure.u64(config.amount)],
    });
  }
}
