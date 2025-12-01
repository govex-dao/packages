/**
 * Protocol Admin Actions
 *
 * Protocol-level admin actions for managing the futarchy protocol through its own DAO.
 * Allows the protocol's owner DAO to control factory admin functions, fee management,
 * and validator functions.
 *
 * Categories:
 * - Factory Management (pause, disable, stable types)
 * - Fee Management (DAO creation, proposals, verification)
 * - Coin-specific Fee Configuration
 * - Validator Management (verification levels)
 *
 * @module protocol-admin-actions
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Protocol Admin Action Builders
 *
 * Static utilities for building protocol-level governance actions.
 * These follow the marker → constructor → execution pattern.
 *
 * @example Pause factory
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get marker
 * const marker = ProtocolAdminActions.setFactoryPausedMarker(tx, govActionsPackageId);
 *
 * // Create action
 * const action = ProtocolAdminActions.newSetFactoryPaused(tx, {
 *   governanceActionsPackageId: govActionsPackageId,
 *   paused: true,
 * });
 *
 * // Execute in PTB
 * ProtocolAdminActions.doSetFactoryPaused(tx, {
 *   governanceActionsPackageId: govActionsPackageId,
 *   daoId,
 *   registryId,
 *   factoryId,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, versionWitness, intentWitness);
 * ```
 */
export class ProtocolAdminActions {
  // ============================================================================
  // FACTORY MANAGEMENT - Markers (4)
  // ============================================================================

  static setFactoryPausedMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'set_factory_paused_marker'),
      arguments: [],
    });
  }

  static disableFactoryPermanentlyMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'disable_factory_permanently_marker'),
      arguments: [],
    });
  }

  static addStableTypeMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'add_stable_type_marker'),
      arguments: [],
    });
  }

  static removeStableTypeMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'remove_stable_type_marker'),
      arguments: [],
    });
  }

  // ============================================================================
  // FEE MANAGEMENT - Markers (7)
  // ============================================================================

  static updateDaoCreationFeeMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'update_dao_creation_fee_marker'),
      arguments: [],
    });
  }

  static updateProposalFeeMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'update_proposal_fee_marker'),
      arguments: [],
    });
  }

  static updateVerificationFeeMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'update_verification_fee_marker'),
      arguments: [],
    });
  }

  static withdrawFeesToTreasuryMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'withdraw_fees_to_treasury_marker'),
      arguments: [],
    });
  }

  static addVerificationLevelMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'add_verification_level_marker'),
      arguments: [],
    });
  }

  static removeVerificationLevelMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'remove_verification_level_marker'),
      arguments: [],
    });
  }

  // ============================================================================
  // COIN FEE CONFIG - Markers (3)
  // ============================================================================

  static addCoinFeeConfigMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'add_coin_fee_config_marker'),
      arguments: [],
    });
  }

  static updateCoinCreationFeeMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'update_coin_creation_fee_marker'),
      arguments: [],
    });
  }

  static updateCoinProposalFeeMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'update_coin_proposal_fee_marker'),
      arguments: [],
    });
  }

  static applyPendingCoinFeesMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'apply_pending_coin_fees_marker'),
      arguments: [],
    });
  }

  // ============================================================================
  // FACTORY MANAGEMENT - Constructors (4)
  // ============================================================================

  static newSetFactoryPaused(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      paused: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_set_factory_paused'),
      arguments: [tx.pure.bool(config.paused)],
    });
  }

  static newDisableFactoryPermanently(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'protocol_admin_actions', 'new_disable_factory_permanently'),
      arguments: [],
    });
  }

  static newAddStableType(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      stableType: string; // Full type path
    }
  ): ReturnType<Transaction['moveCall']> {
    // Create TypeName for stable type
    const typeName = tx.moveCall({
      target: '0x1::type_name::get',
      typeArguments: [config.stableType],
      arguments: [],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_add_stable_type'),
      arguments: [typeName],
    });
  }

  static newRemoveStableType(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      stableType: string; // Full type path
    }
  ): ReturnType<Transaction['moveCall']> {
    const typeName = tx.moveCall({
      target: '0x1::type_name::get',
      typeArguments: [config.stableType],
      arguments: [],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_remove_stable_type'),
      arguments: [typeName],
    });
  }

  // ============================================================================
  // FEE MANAGEMENT - Constructors (6)
  // ============================================================================

  static newUpdateDaoCreationFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      newFee: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_update_dao_creation_fee'),
      arguments: [tx.pure.u64(config.newFee)],
    });
  }

  static newUpdateProposalFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      newFeePerOutcome: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_update_proposal_fee'),
      arguments: [tx.pure.u64(config.newFeePerOutcome)],
    });
  }

  static newUpdateVerificationFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      level: number;
      newFee: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_update_verification_fee'),
      arguments: [tx.pure.u8(config.level), tx.pure.u64(config.newFee)],
    });
  }

  static newAddVerificationLevel(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      level: number;
      fee: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_add_verification_level'),
      arguments: [tx.pure.u8(config.level), tx.pure.u64(config.fee)],
    });
  }

  static newRemoveVerificationLevel(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      level: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_remove_verification_level'),
      arguments: [tx.pure.u8(config.level)],
    });
  }

  static newWithdrawFeesToTreasury(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      amount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_withdraw_fees_to_treasury'),
      arguments: [tx.pure.u64(config.amount)],
    });
  }

  // ============================================================================
  // COIN FEE CONFIG - Constructors (4)
  // ============================================================================

  static newAddCoinFeeConfig(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      coinType: string; // Full type path
      decimals: number;
      daoCreationFee: bigint;
      proposalFeePerOutcome: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    const typeName = tx.moveCall({
      target: '0x1::type_name::get',
      typeArguments: [config.coinType],
      arguments: [],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_add_coin_fee_config'),
      arguments: [typeName, tx.pure.u8(config.decimals), tx.pure.u64(config.daoCreationFee), tx.pure.u64(config.proposalFeePerOutcome)],
    });
  }

  static newUpdateCoinCreationFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      coinType: string;
      newFee: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    const typeName = tx.moveCall({
      target: '0x1::type_name::get',
      typeArguments: [config.coinType],
      arguments: [],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_update_coin_creation_fee'),
      arguments: [typeName, tx.pure.u64(config.newFee)],
    });
  }

  static newUpdateCoinProposalFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      coinType: string;
      newFeePerOutcome: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    const typeName = tx.moveCall({
      target: '0x1::type_name::get',
      typeArguments: [config.coinType],
      arguments: [],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_update_coin_proposal_fee'),
      arguments: [typeName, tx.pure.u64(config.newFeePerOutcome)],
    });
  }

  static newApplyPendingCoinFees(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      coinType: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    const typeName = tx.moveCall({
      target: '0x1::type_name::get',
      typeArguments: [config.coinType],
      arguments: [],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'new_apply_pending_coin_fees'),
      arguments: [typeName],
    });
  }

  // ============================================================================
  // FACTORY MANAGEMENT - Execution (4)
  // ============================================================================

  static doSetFactoryPaused(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      factoryId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_set_factory_paused'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.factoryId),
      ],
    });
  }

  static doDisableFactoryPermanently(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      factoryId: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_disable_factory_permanently'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.factoryId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doAddStableType(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      factoryId: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_add_stable_type'),
      typeArguments: [config.outcomeType, config.intentWitnessType, config.stableType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.factoryId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doRemoveStableType(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      factoryId: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_remove_stable_type'),
      typeArguments: [config.outcomeType, config.intentWitnessType, config.stableType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.factoryId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // FEE MANAGEMENT - Execution (6)
  // ============================================================================

  static doUpdateDaoCreationFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_update_dao_creation_fee'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doUpdateProposalFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_update_proposal_fee'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doUpdateVerificationFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_update_verification_fee'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doAddVerificationLevel(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_add_verification_level'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doRemoveVerificationLevel(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_remove_verification_level'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doWithdrawFeesToTreasury(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_withdraw_fees_to_treasury'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // COIN FEE CONFIG - Execution (4)
  // ============================================================================

  static doAddCoinFeeConfig(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_add_coin_fee_config'),
      typeArguments: [config.outcomeType, config.intentWitnessType, config.stableType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doUpdateCoinCreationFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_update_coin_creation_fee'),
      typeArguments: [config.outcomeType, config.intentWitnessType, config.stableType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doUpdateCoinProposalFee(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_update_coin_proposal_fee'),
      typeArguments: [config.outcomeType, config.intentWitnessType, config.stableType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doApplyPendingCoinFees(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      feeManagerId: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'protocol_admin_actions', 'do_apply_pending_coin_fees'),
      typeArguments: [config.outcomeType, config.intentWitnessType, config.stableType],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.feeManagerId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }
}
