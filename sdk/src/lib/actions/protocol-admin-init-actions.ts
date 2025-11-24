/**
 * Protocol Admin Init Actions
 *
 * Builders for protocol administration during initialization/intent staging.
 * Handles factory management, fees, stable types, and verification levels.
 *
 * @module protocol-admin-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Protocol administration initialization action builders
 *
 * These actions are for protocol-level governance, typically used by
 * the protocol DAO to manage factory settings and fee structures.
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Update DAO creation fee
 * ProtocolAdminInitActions.addUpdateDaoCreationFee(tx, builder, govActionsPackageId, {
 *   newFee: 1_000_000_000n, // 1 SUI
 * });
 * ```
 */
export class ProtocolAdminInitActions {
  /**
   * Add action to pause/unpause the factory
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addSetFactoryPaused(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      paused: boolean;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_set_factory_paused_spec`,
      arguments: [
        builder,
        tx.pure.bool(config.paused),
      ],
    });
  }

  /**
   * Add action to permanently disable the factory
   *
   * WARNING: This is irreversible!
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   */
  static addDisableFactoryPermanently(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_disable_factory_permanently_spec`,
      arguments: [builder],
    });
  }

  /**
   * Add action to add an allowed stable type
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addAddStableType(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      stableType: string;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_add_stable_type_spec`,
      typeArguments: [config.stableType],
      arguments: [builder],
    });
  }

  /**
   * Add action to remove an allowed stable type
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addRemoveStableType(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      stableType: string;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_remove_stable_type_spec`,
      typeArguments: [config.stableType],
      arguments: [builder],
    });
  }

  /**
   * Add action to update DAO creation fee
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addUpdateDaoCreationFee(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      newFee: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_update_dao_creation_fee_spec`,
      arguments: [
        builder,
        tx.pure.u64(config.newFee),
      ],
    });
  }

  /**
   * Add action to update proposal fee
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addUpdateProposalFee(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      newFeePerOutcome: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_update_proposal_fee_spec`,
      arguments: [
        builder,
        tx.pure.u64(config.newFeePerOutcome),
      ],
    });
  }

  /**
   * Add action to update verification fee for a level
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addUpdateVerificationFee(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      level: number;
      newFee: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_update_verification_fee_spec`,
      arguments: [
        builder,
        tx.pure.u8(config.level),
        tx.pure.u64(config.newFee),
      ],
    });
  }

  /**
   * Add action to add a new verification level
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addAddVerificationLevel(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      level: number;
      fee: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_add_verification_level_spec`,
      arguments: [
        builder,
        tx.pure.u8(config.level),
        tx.pure.u64(config.fee),
      ],
    });
  }

  /**
   * Add action to remove a verification level
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addRemoveVerificationLevel(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      level: number;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_remove_verification_level_spec`,
      arguments: [
        builder,
        tx.pure.u8(config.level),
      ],
    });
  }

  /**
   * Add action to withdraw protocol fees to treasury
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addWithdrawFeesToTreasury(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      coinType: string;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_withdraw_fees_to_treasury_spec`,
      typeArguments: [config.coinType],
      arguments: [builder],
    });
  }

  /**
   * Add action to add coin fee configuration
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addAddCoinFeeConfig(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      coinType: string;
      creationFee: bigint | number;
      proposalFeePerOutcome: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_add_coin_fee_config_spec`,
      typeArguments: [config.coinType],
      arguments: [
        builder,
        tx.pure.u64(config.creationFee),
        tx.pure.u64(config.proposalFeePerOutcome),
      ],
    });
  }

  /**
   * Add action to update coin creation fee
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addUpdateCoinCreationFee(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      coinType: string;
      newFee: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_update_coin_creation_fee_spec`,
      typeArguments: [config.coinType],
      arguments: [
        builder,
        tx.pure.u64(config.newFee),
      ],
    });
  }

  /**
   * Add action to update coin proposal fee
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addUpdateCoinProposalFee(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      coinType: string;
      newFeePerOutcome: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_update_coin_proposal_fee_spec`,
      typeArguments: [config.coinType],
      arguments: [
        builder,
        tx.pure.u64(config.newFeePerOutcome),
      ],
    });
  }

  /**
   * Add action to apply pending coin fees
   *
   * Applies any pending fee updates after the delay period.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addApplyPendingCoinFees(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      coinType: string;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::protocol_admin_init_actions::add_apply_pending_coin_fees_spec`,
      typeArguments: [config.coinType],
      arguments: [builder],
    });
  }
}
