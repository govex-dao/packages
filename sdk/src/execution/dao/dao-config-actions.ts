/**
 * DAO Configuration Actions
 *
 * Comprehensive configuration management for futarchy DAOs. Allows DAOs to govern
 * their own settings through proposals including trading parameters, metadata, TWAP
 * configuration, governance rules, and sponsorship settings.
 *
 * @module dao-config-actions
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * DAO Configuration Action Builders
 *
 * Static utilities for building DAO configuration governance actions.
 * These follow the marker → constructor → execution pattern.
 *
 * @example Update DAO name
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get marker
 * const marker = DAOConfigActions.updateNameMarker(tx, futarchyActionsPackageId);
 *
 * // Create action
 * const action = DAOConfigActions.newUpdateName(tx, {
 *   futarchyActionsPackageId,
 *   newName: "SuperDAO v2",
 * });
 *
 * // Execute in PTB (after proposal passes)
 * DAOConfigActions.doUpdateName(tx, {
 *   futarchyActionsPackageId,
 *   daoId,
 *   registryId,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, versionWitness, intentWitness);
 * ```
 */
export class DAOConfigActions {
  // ============================================================================
  // CORE CONFIGURATION - Markers (6)
  // ============================================================================

  static setProposalsEnabledMarker(tx: Transaction, futarchyActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'set_proposals_enabled_marker'),
      arguments: [],
    });
  }

  static terminateDaoMarker(tx: Transaction, futarchyActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'terminate_dao_marker'),
      arguments: [],
    });
  }

  static updateNameMarker(tx: Transaction, futarchyActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'update_name_marker'),
      arguments: [],
    });
  }

  static tradingParamsUpdateMarker(tx: Transaction, futarchyActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'trading_params_update_marker'),
      arguments: [],
    });
  }

  static metadataUpdateMarker(tx: Transaction, futarchyActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'metadata_update_marker'),
      arguments: [],
    });
  }

  static twapConfigUpdateMarker(tx: Transaction, futarchyActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'twap_config_update_marker'),
      arguments: [],
    });
  }

  static governanceUpdateMarker(tx: Transaction, futarchyActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'governance_update_marker'),
      arguments: [],
    });
  }

  static sponsorshipConfigUpdateMarker(tx: Transaction, futarchyActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'sponsorship_config_update_marker'),
      arguments: [],
    });
  }

  // ============================================================================
  // CORE CONFIGURATION - Constructors (8)
  // ============================================================================

  static newSetProposalsEnabled(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      enabled: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'new_set_proposals_enabled_action'),
      arguments: [tx.pure.bool(config.enabled)],
    });
  }

  static newUpdateName(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      newName: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'new_update_name_action'),
      arguments: [tx.pure.string(config.newName)],
    });
  }

  static newTradingParamsUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      minAssetAmount: bigint;
      minStableAmount: bigint;
      reviewPeriodMs: bigint;
      tradingPeriodMs: bigint;
      ammTotalFeeBps: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'new_trading_params_update_action'),
      arguments: [
        tx.pure.u64(config.minAssetAmount),
        tx.pure.u64(config.minStableAmount),
        tx.pure.u64(config.reviewPeriodMs),
        tx.pure.u64(config.tradingPeriodMs),
        tx.pure.u64(config.ammTotalFeeBps),
      ],
    });
  }

  static newMetadataUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoName: string;
      iconUrl: string;
      description: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'new_metadata_update_action'),
      arguments: [
        tx.pure.string(config.daoName),
        tx.pure.string(config.iconUrl),
        tx.pure.string(config.description),
      ],
    });
  }

  static newTwapConfigUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      startDelay: bigint;
      stepMax: bigint;
      initialObservation: bigint;
      threshold: bigint; // Signed value
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'new_twap_config_update_action'),
      arguments: [
        tx.pure.u64(config.startDelay),
        tx.pure.u64(config.stepMax),
        tx.pure.u128(config.initialObservation),
        tx.pure.u128(config.threshold), // SignedU128
      ],
    });
  }

  static newGovernanceUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      maxOutcomes: bigint;
      maxActionsPerOutcome: bigint;
      requiredBondAmount: bigint;
      maxIntentsPerOutcome: bigint;
      proposalIntentExpiryMs: bigint;
      optimisticChallengeFee: bigint;
      optimisticChallengePeriodMs: bigint;
      proposalCreationFee: bigint;
      proposalFeePerOutcome: bigint;
      acceptNewProposals: boolean;
      enablePremarketReservationLock: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'new_governance_update_action'),
      arguments: [
        tx.pure.u64(config.maxOutcomes),
        tx.pure.u64(config.maxActionsPerOutcome),
        tx.pure.u64(config.requiredBondAmount),
        tx.pure.u64(config.maxIntentsPerOutcome),
        tx.pure.u64(config.proposalIntentExpiryMs),
        tx.pure.u64(config.optimisticChallengeFee),
        tx.pure.u64(config.optimisticChallengePeriodMs),
        tx.pure.u64(config.proposalCreationFee),
        tx.pure.u64(config.proposalFeePerOutcome),
        tx.pure.bool(config.acceptNewProposals),
        tx.pure.bool(config.enablePremarketReservationLock),
      ],
    });
  }

  static newSponsorshipConfigUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      enabled: boolean;
      sponsoredThreshold: bigint;
      waiveAdvancementFees: boolean;
      defaultSponsorQuotaAmount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'new_sponsorship_config_update_action'),
      arguments: [
        tx.pure.bool(config.enabled),
        tx.pure.u128(config.sponsoredThreshold),
        tx.pure.bool(config.waiveAdvancementFees),
        tx.pure.u64(config.defaultSponsorQuotaAmount),
      ],
    });
  }

  static newMetadataTableUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      keys: string[];
      values: string[];
      keysToRemove: string[];
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'new_metadata_table_update_action'),
      arguments: [
        tx.pure.vector('string', config.keys),
        tx.pure.vector('string', config.values),
        tx.pure.vector('string', config.keysToRemove),
      ],
    });
  }

  // ============================================================================
  // CORE CONFIGURATION - Execution (8)
  // ============================================================================

  static doSetProposalsEnabled(
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
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'do_set_proposals_enabled'),
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

  static doTerminateDao(
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
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'do_terminate_dao'),
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

  static doUpdateName(
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
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'do_update_name'),
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

  static doUpdateTradingParams(
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
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'do_update_trading_params'),
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

  static doUpdateMetadata(
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
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'do_update_metadata'),
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

  static doUpdateTwapConfig(
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
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'do_update_twap_config'),
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

  static doUpdateGovernance(
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
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'do_update_governance'),
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

  static doUpdateSponsorshipConfig(
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
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'do_update_sponsorship_config'),
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

  // ===================================================================
  // Getter Functions
  // ===================================================================

  /**
   * Get proposals enabled value from SetProposalsEnabledAction
   */
  static getProposalsEnabled(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'get_proposals_enabled'),
      arguments: [action],
    });
  }

  /**
   * Get new name from UpdateNameAction
   */
  static getNewName(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'get_new_name'),
      arguments: [action],
    });
  }

  /**
   * Get trading params fields from TradingParamsUpdateAction
   */
  static getTradingParamsFields(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'get_trading_params_fields'),
      arguments: [action],
    });
  }

  /**
   * Get metadata fields from MetadataUpdateAction
   */
  static getMetadataFields(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'get_metadata_fields'),
      arguments: [action],
    });
  }

  /**
   * Get TWAP config fields from TwapConfigUpdateAction
   */
  static getTwapConfigFields(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'get_twap_config_fields'),
      arguments: [action],
    });
  }

  /**
   * Get governance fields from GovernanceUpdateAction
   */
  static getGovernanceFields(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'get_governance_fields'),
      arguments: [action],
    });
  }

  /**
   * Get metadata table fields from MetadataTableUpdateAction
   */
  static getMetadataTableFields(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'get_metadata_table_fields'),
      arguments: [action],
    });
  }

  // ===================================================================
  // Destroy Functions
  // ===================================================================

  /**
   * Destroy SetProposalsEnabledAction
   */
  static destroySetProposalsEnabled(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'destroy_set_proposals_enabled'),
      arguments: [action],
    });
  }

  /**
   * Destroy UpdateNameAction
   */
  static destroyUpdateName(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'destroy_update_name'),
      arguments: [action],
    });
  }

  /**
   * Destroy TradingParamsUpdateAction
   */
  static destroyTradingParamsUpdate(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'destroy_trading_params_update'),
      arguments: [action],
    });
  }

  /**
   * Destroy MetadataUpdateAction
   */
  static destroyMetadataUpdate(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'destroy_metadata_update'),
      arguments: [action],
    });
  }

  /**
   * Destroy TwapConfigUpdateAction
   */
  static destroyTwapConfigUpdate(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'destroy_twap_config_update'),
      arguments: [action],
    });
  }

  /**
   * Destroy GovernanceUpdateAction
   */
  static destroyGovernanceUpdate(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'destroy_governance_update'),
      arguments: [action],
    });
  }

  /**
   * Destroy MetadataTableUpdateAction
   */
  static destroyMetadataTableUpdate(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'destroy_metadata_table_update'),
      arguments: [action],
    });
  }

  /**
   * Destroy SponsorshipConfigUpdateAction
   */
  static destroySponsorshipConfigUpdate(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'config_actions', 'destroy_sponsorship_config_update'),
      arguments: [action],
    });
  }

  // ===================================================================
  // Delete Functions (Expired Intent Cleanup)
  // ===================================================================

  /**
   * Delete SetProposalsEnabled action from expired intent
   */
  static deleteSetProposalsEnabled(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_set_proposals_enabled'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }

  /**
   * Delete UpdateName action from expired intent
   */
  static deleteUpdateName(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_update_name'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }

  /**
   * Delete TradingParamsUpdate action from expired intent
   */
  static deleteTradingParamsUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_trading_params_update'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }

  /**
   * Delete MetadataUpdate action from expired intent
   */
  static deleteMetadataUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_metadata_update'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }

  /**
   * Delete TwapConfigUpdate action from expired intent
   */
  static deleteTwapConfigUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_twap_config_update'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }

  /**
   * Delete GovernanceUpdate action from expired intent
   */
  static deleteGovernanceUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_governance_update'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }

  /**
   * Delete MetadataTableUpdate action from expired intent
   */
  static deleteMetadataTableUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_metadata_table_update'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }

  /**
   * Delete QueueParamsUpdate action from expired intent
   */
  static deleteQueueParamsUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_queue_params_update'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }

  /**
   * Delete SponsorshipConfigUpdate action from expired intent
   */
  static deleteSponsorshipConfigUpdate(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_sponsorship_config_update'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }

  /**
   * Delete ConfigAction from expired intent (generic cleanup)
   */
  static deleteConfigAction(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      configType: string;
    },
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.futarchyActionsPackageId, 'config_actions', 'delete_config_action'),
      typeArguments: [config.configType],
      arguments: [expired],
    });
  }
}
