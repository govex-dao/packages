/**
 * Config Init Actions
 *
 * Builders for updating DAO configuration during initialization.
 * Handles trading parameters and TWAP configuration updates.
 *
 * @module config-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

export interface UpdateTradingParamsConfig {
  /** Minimum asset amount for proposals (optional) */
  minAssetAmount?: bigint | number;
  /** Minimum stable amount for proposals (optional) */
  minStableAmount?: bigint | number;
  /** Review period in milliseconds (optional) */
  reviewPeriodMs?: bigint | number;
  /** Trading period in milliseconds (optional) */
  tradingPeriodMs?: bigint | number;
  /** Total AMM fee in basis points (optional) */
  ammTotalFeeBps?: bigint | number;
}

export interface UpdateTwapConfigConfig {
  /** Delay before TWAP tracking starts in ms (optional) */
  startDelay?: bigint | number;
  /** Maximum price change per TWAP step (optional) */
  stepMax?: bigint | number;
  /** Initial TWAP observation value (optional) */
  initialObservation?: bigint;
  /** TWAP threshold for winning outcome (optional - SignedU128) */
  threshold?: ReturnType<Transaction['moveCall']>;
}

/**
 * Config initialization action builders
 *
 * Update DAO trading and TWAP parameters during initialization.
 * Common use case: Override defaults for testing or specific DAO needs.
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Update trading params for testing
 * ConfigInitActions.addUpdateTradingParams(tx, builder, futarchyActionsPkg, {
 *   reviewPeriodMs: 1000, // 1 second
 *   tradingPeriodMs: 60_000, // 1 minute
 * });
 *
 * // Update TWAP config
 * ConfigInitActions.addUpdateTwapConfig(tx, builder, futarchyActionsPkg, {
 *   startDelay: 0,
 * });
 * ```
 */
export class ConfigInitActions {
  /**
   * Add action to update trading parameters
   *
   * Updates the DAO's trading configuration. Only provided values are updated;
   * null/undefined values keep their defaults.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Trading params to update
   *
   * @example
   * ```typescript
   * // Set fast trading for testing
   * ConfigInitActions.addUpdateTradingParams(tx, builder, futarchyActionsPkg, {
   *   reviewPeriodMs: 1000,
   *   tradingPeriodMs: 60_000,
   * });
   * ```
   */
  static addUpdateTradingParams(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: UpdateTradingParamsConfig
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_update_trading_params_spec`,
      arguments: [
        builder,
        tx.pure.option('u64', config.minAssetAmount ?? null),
        tx.pure.option('u64', config.minStableAmount ?? null),
        tx.pure.option('u64', config.reviewPeriodMs ?? null),
        tx.pure.option('u64', config.tradingPeriodMs ?? null),
        tx.pure.option('u64', config.ammTotalFeeBps ?? null),
      ],
    });
  }

  /**
   * Add action to update TWAP configuration
   *
   * Updates the DAO's TWAP oracle configuration. Used for determining
   * proposal outcomes based on time-weighted average prices.
   *
   * Note: For threshold, you need to create a SignedU128 wrapped in Option.
   * Use createThresholdOption() helper for this.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - TWAP config to update
   *
   * @example
   * ```typescript
   * // Set zero threshold for testing
   * const threshold = ConfigInitActions.createThresholdOption(
   *   tx, typesPackageId, 0n
   * );
   *
   * ConfigInitActions.addUpdateTwapConfig(tx, builder, futarchyActionsPkg, {
   *   startDelay: 0,
   *   threshold,
   * });
   * ```
   */
  static addUpdateTwapConfig(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: UpdateTwapConfigConfig
  ): void {
    // If no threshold provided, create None option
    const thresholdArg = config.threshold ?? tx.moveCall({
      target: '0x1::option::none',
      typeArguments: [`${futarchyActionsPackageId.split('::')[0]}::signed::SignedU128`],
      arguments: [],
    });

    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_update_twap_config_spec`,
      arguments: [
        builder,
        tx.pure.option('u64', config.startDelay ?? null),
        tx.pure.option('u64', config.stepMax ?? null),
        tx.pure.option('u128', config.initialObservation ?? null),
        thresholdArg,
      ],
    });
  }

  /**
   * Helper: Create SignedU128 threshold wrapped in Option::some
   *
   * Used for setting TWAP threshold in addUpdateTwapConfig.
   *
   * @param tx - Transaction
   * @param typesPackageId - Package ID for futarchy_types
   * @param value - Threshold value (0 for immediate resolution)
   * @returns Option<SignedU128> for threshold parameter
   *
   * @example
   * ```typescript
   * const threshold = ConfigInitActions.createThresholdOption(tx, typesPackageId, 0n);
   * ```
   */
  static createThresholdOption(
    tx: Transaction,
    typesPackageId: string,
    value: bigint
  ): ReturnType<Transaction['moveCall']> {
    const signedValue = tx.moveCall({
      target: `${typesPackageId}::signed::from_u128`,
      arguments: [tx.pure.u128(value)],
    });

    return tx.moveCall({
      target: '0x1::option::some',
      typeArguments: [`${typesPackageId}::signed::SignedU128`],
      arguments: [signedValue],
    });
  }

  /**
   * Add action to update metadata table
   *
   * Updates key-value pairs in the DAO's metadata table.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Metadata update configuration
   */
  static addUpdateMetadataTable(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      keys: string[];
      values: string[];
      keysToRemove: string[];
    }
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_update_metadata_table_spec`,
      arguments: [
        builder,
        tx.makeMoveVec({
          type: '0x1::string::String',
          elements: config.keys.map(k => tx.pure.string(k)),
        }),
        tx.makeMoveVec({
          type: '0x1::string::String',
          elements: config.values.map(v => tx.pure.string(v)),
        }),
        tx.makeMoveVec({
          type: '0x1::string::String',
          elements: config.keysToRemove.map(k => tx.pure.string(k)),
        }),
      ],
    });
  }

  /**
   * Add action to set proposals enabled/disabled
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Configuration
   */
  static addSetProposalsEnabled(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      enabled: boolean;
    }
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_set_proposals_enabled_spec`,
      arguments: [
        builder,
        tx.pure.bool(config.enabled),
      ],
    });
  }

  /**
   * Add action to terminate DAO
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   */
  static addTerminateDao(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_terminate_dao_spec`,
      arguments: [builder],
    });
  }

  /**
   * Add action to update DAO name
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Configuration
   */
  static addUpdateName(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      newName: string;
    }
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_update_name_spec`,
      arguments: [
        builder,
        tx.pure.string(config.newName),
      ],
    });
  }

  /**
   * Add action to update DAO metadata
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Configuration
   */
  static addUpdateMetadata(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      description?: string;
      imageUrl?: string;
      externalUrl?: string;
    }
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_update_metadata_spec`,
      arguments: [
        builder,
        tx.pure.option('string', config.description ?? null),
        tx.pure.option('string', config.imageUrl ?? null),
        tx.pure.option('string', config.externalUrl ?? null),
      ],
    });
  }

  /**
   * Add action to update governance configuration
   *
   * Updates DAO governance parameters. Only provided values are updated.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Governance configuration
   */
  static addUpdateGovernance(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      maxOutcomes?: bigint | number;
      maxActionsPerOutcome?: bigint | number;
      requiredBondAmount?: bigint | number;
      maxIntentsPerOutcome?: bigint | number;
      proposalIntentExpiryMs?: bigint | number;
      optimisticChallengeFee?: bigint | number;
      optimisticChallengePeriodMs?: bigint | number;
      proposalCreationFee?: bigint | number;
      proposalFeePerOutcome?: bigint | number;
      acceptNewProposals?: boolean;
      enablePremarketReservationLock?: boolean;
      showProposalDetails?: boolean;
    }
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_update_governance_spec`,
      arguments: [
        builder,
        tx.pure.option('u64', config.maxOutcomes ?? null),
        tx.pure.option('u64', config.maxActionsPerOutcome ?? null),
        tx.pure.option('u64', config.requiredBondAmount ?? null),
        tx.pure.option('u64', config.maxIntentsPerOutcome ?? null),
        tx.pure.option('u64', config.proposalIntentExpiryMs ?? null),
        tx.pure.option('u64', config.optimisticChallengeFee ?? null),
        tx.pure.option('u64', config.optimisticChallengePeriodMs ?? null),
        tx.pure.option('u64', config.proposalCreationFee ?? null),
        tx.pure.option('u64', config.proposalFeePerOutcome ?? null),
        tx.pure.option('bool', config.acceptNewProposals ?? null),
        tx.pure.option('bool', config.enablePremarketReservationLock ?? null),
        tx.pure.option('bool', config.showProposalDetails ?? null),
      ],
    });
  }

  /**
   * Add action to update sponsorship configuration
   *
   * Updates DAO sponsorship parameters.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Sponsorship configuration
   */
  static addUpdateSponsorshipConfig(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      enabled?: boolean;
      sponsoredThreshold?: ReturnType<Transaction['moveCall']>;
      waiveAdvancementFees?: boolean;
      defaultSponsorQuotaAmount?: bigint | number;
    }
  ): void {
    // Create None options for SignedU128 if not provided
    const thresholdArg = config.sponsoredThreshold ?? tx.moveCall({
      target: '0x1::option::none',
      typeArguments: [`${futarchyActionsPackageId.split('::')[0]}::signed::SignedU128`],
      arguments: [],
    });

    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_update_sponsorship_config_spec`,
      arguments: [
        builder,
        tx.pure.option('bool', config.enabled ?? null),
        thresholdArg,
        tx.pure.option('bool', config.waiveAdvancementFees ?? null),
        tx.pure.option('u64', config.defaultSponsorQuotaAmount ?? null),
      ],
    });
  }

  /**
   * Helper: Create SignedU128 threshold wrapped in Option::some for sponsorship
   *
   * @param tx - Transaction
   * @param typesPackageId - Package ID for futarchy_types
   * @param value - Threshold value
   * @returns Option<SignedU128> for threshold parameter
   */
  static createSponsoredThresholdOption(
    tx: Transaction,
    typesPackageId: string,
    value: bigint
  ): ReturnType<Transaction['moveCall']> {
    const signedValue = tx.moveCall({
      target: `${typesPackageId}::signed::from_u128`,
      arguments: [tx.pure.u128(value)],
    });

    return tx.moveCall({
      target: '0x1::option::some',
      typeArguments: [`${typesPackageId}::signed::SignedU128`],
      arguments: [signedValue],
    });
  }

  /**
   * Add action to update conditional metadata
   *
   * Updates DAO conditional metadata configuration.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Conditional metadata configuration
   */
  static addUpdateConditionalMetadata(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      useOutcomeIndex?: boolean;
      conditionalMetadata?: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    // Create None for nested Option<Option<ConditionalMetadata>> if not provided
    const metadataArg = config.conditionalMetadata ?? tx.moveCall({
      target: '0x1::option::none',
      typeArguments: [`0x1::option::Option<${futarchyActionsPackageId.split('::')[0]}::dao_config::ConditionalMetadata>`],
      arguments: [],
    });

    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_update_conditional_metadata_spec`,
      arguments: [
        builder,
        tx.pure.option('bool', config.useOutcomeIndex ?? null),
        metadataArg,
      ],
    });
  }

  /**
   * Add action for batch config update
   *
   * Applies multiple config actions in a single batch.
   * Note: Requires BCS-serialized ConfigAction struct.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Batch config configuration
   */
  static addBatchConfig(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      configAction: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::config_init_actions::add_batch_config_spec`,
      arguments: [
        builder,
        config.configAction,
      ],
    });
  }
}
