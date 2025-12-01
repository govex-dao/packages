/**
 * Fee Module
 *
 * Manages all fees earned by the protocol and provides admin fee withdrawal interface.
 *
 * Fee Types:
 * - DAO creation fee (SUI)
 * - Proposal creation fee (SUI, per-outcome)
 * - Launchpad creation fee (SUI)
 * - Verification fees (SUI, per-level)
 * - AMM fees (StableType, AssetType balances)
 *
 * Features:
 * - Dynamic verification levels with custom fees
 * - Coin-specific fee configurations
 * - Fee update delays (6 months for increases)
 * - 10x cap on fee increases from baseline
 * - Baseline resets after 6 months
 *
 * @module fee
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Fee Static Functions
 *
 * Protocol fee management and withdrawal.
 */
export class Fee {
  // ============================================================================
  // Fee Collection Functions
  // ============================================================================

  /**
   * Collect DAO creation fee
   *
   * Deposits SUI payment for creating a new DAO.
   * Emits DAOCreationFeeCollected event.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositDaoCreationPayment(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      payment: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'deposit_dao_creation_payment'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.payment,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Collect launchpad creation fee
   *
   * Deposits SUI payment for creating a new launchpad.
   * Emits LaunchpadCreationFeeCollected event.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositLaunchpadCreationPayment(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      payment: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'deposit_launchpad_creation_payment'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.payment,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Collect proposal creation fee
   *
   * Deposits SUI payment for creating a new proposal.
   * Fee = proposal_creation_fee_per_outcome * outcome_count
   * Emits ProposalCreationFeeCollected event.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositProposalCreationPayment(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      payment: ReturnType<Transaction['moveCall']>;
      outcomeCount: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'deposit_proposal_creation_payment'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.payment,
        tx.pure.u64(config.outcomeCount),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Collect verification fee for a specific level
   *
   * Deposits SUI payment for package verification at specified level.
   * Emits VerificationFeeCollected event.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositVerificationPayment(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      payment: ReturnType<Transaction['moveCall']>;
      verificationLevel: number; // u8
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'deposit_verification_payment'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.payment,
        tx.pure.u8(config.verificationLevel),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Admin Fee Withdrawal Functions
  // ============================================================================

  /**
   * Withdraw all SUI fees
   *
   * Admin function to withdraw all collected SUI fees.
   * Emits FeesWithdrawn event.
   *
   * @deprecated This function references removed Move code. Use withdraw_fees_as_coin<SUI> instead.
   * @param tx - Transaction
   * @param config - Configuration
   */
  static withdrawAllFees(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'withdraw_all_fees'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Admin Fee Configuration Functions
  // ============================================================================

  /**
   * Update DAO creation fee
   *
   * Admin function to update fee for creating new DAOs.
   * Emits DAOCreationFeeUpdated event.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static updateDaoCreationFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      newFee: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'update_dao_creation_fee'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.pure.u64(config.newFee),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Update proposal creation fee
   *
   * Admin function to update fee per outcome for creating proposals.
   * Emits ProposalCreationFeeUpdated event.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static updateProposalCreationFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      newFeePerOutcome: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'update_proposal_creation_fee'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.pure.u64(config.newFeePerOutcome),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Update launchpad creation fee
   *
   * Admin function to update fee for creating launchpads.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static updateLaunchpadCreationFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      newFee: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'update_launchpad_creation_fee'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.pure.u64(config.newFee),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Add a new verification level
   *
   * Admin function to add a new verification level with associated fee.
   * Emits VerificationLevelAdded event.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static addVerificationLevel(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      level: number; // u8
      fee: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'add_verification_level'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.pure.u8(config.level),
        tx.pure.u64(config.fee),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Remove a verification level
   *
   * Admin function to remove an existing verification level.
   * Emits VerificationLevelRemoved event.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static removeVerificationLevel(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      level: number; // u8
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'remove_verification_level'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.pure.u8(config.level),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Update verification fee for a specific level
   *
   * Admin function to update the fee for an existing verification level.
   * Emits VerificationFeeUpdated event.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static updateVerificationFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      level: number; // u8
      newFee: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'update_verification_fee'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.pure.u8(config.level),
        tx.pure.u64(config.newFee),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // AMM Fee Functions
  // ============================================================================

  /**
   * Deposit stable token fees from AMM swaps
   *
   * Collects stable coin fees generated by AMM operations.
   * Emits FeesCollected event.
   *
   * @deprecated This function references removed Move code. Use deposit_fees_with_proposal instead.
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositStableFees(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      stableType: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      fees: ReturnType<Transaction['moveCall']>;
      proposalId: string;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'deposit_stable_fees'),
      typeArguments: [config.stableType],
      arguments: [
        config.feeManager,
        config.fees,
        tx.object(config.proposalId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Deposit asset token fees from AMM swaps
   *
   * Collects asset coin fees generated by AMM operations.
   * Emits FeesCollected event (same event for both asset and stable).
   *
   * @deprecated This function references removed Move code. Use deposit_fees_with_proposal instead.
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositAssetFees(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      fees: ReturnType<Transaction['moveCall']>;
      proposalId: string;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'deposit_asset_fees'),
      typeArguments: [config.assetType],
      arguments: [
        config.feeManager,
        config.fees,
        tx.object(config.proposalId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Withdraw stable fees
   *
   * Admin function to withdraw all collected stable token fees.
   * Emits FeesWithdrawn event.
   *
   * @deprecated This function references removed Move code. Use withdraw_fees_as_coin instead.
   * @param tx - Transaction
   * @param config - Configuration
   */
  static withdrawStableFees(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      stableType: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'withdraw_stable_fees'),
      typeArguments: [config.stableType],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Withdraw asset fees
   *
   * Admin function to withdraw all collected asset token fees.
   * Emits FeesWithdrawn event (same event for both asset and stable).
   *
   * @deprecated This function references removed Move code. Use withdraw_fees_as_coin instead.
   * @param tx - Transaction
   * @param config - Configuration
   */
  static withdrawAssetFees(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'withdraw_asset_fees'),
      typeArguments: [config.assetType],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // View Functions
  // ============================================================================

  /**
   * Get DAO creation fee
   *
   * Returns the current fee for creating a new DAO.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Fee amount (u64)
   */
  static getDaoCreationFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'get_dao_creation_fee'),
      typeArguments: [],
      arguments: [config.feeManager],
    });
  }

  /**
   * Get proposal creation fee per outcome
   *
   * Returns the current fee per outcome for creating proposals.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Fee per outcome (u64)
   */
  static getProposalCreationFeePerOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'get_proposal_creation_fee_per_outcome'),
      typeArguments: [],
      arguments: [config.feeManager],
    });
  }

  /**
   * Get launchpad creation fee
   *
   * Returns the current fee for creating a launchpad.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Fee amount (u64)
   */
  static getLaunchpadCreationFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'get_launchpad_creation_fee'),
      typeArguments: [],
      arguments: [config.feeManager],
    });
  }

  /**
   * Get verification fee for specific level
   *
   * Returns the fee for the specified verification level.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Fee amount (u64)
   */
  static getVerificationFeeForLevel(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      level: number; // u8
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'get_verification_fee_for_level'),
      typeArguments: [],
      arguments: [config.feeManager, tx.pure.u8(config.level)],
    });
  }

  /**
   * Check if verification level exists
   *
   * Returns true if the specified verification level is configured.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns true if level exists
   */
  static hasVerificationLevel(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      level: number; // u8
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'has_verification_level'),
      typeArguments: [],
      arguments: [config.feeManager, tx.pure.u8(config.level)],
    });
  }

  /**
   * Get SUI balance
   *
   * Returns the total SUI balance held by the fee manager.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Balance (u64)
   */
  static getSuiBalance(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'get_sui_balance'),
      typeArguments: [],
      arguments: [config.feeManager],
    });
  }

  /**
   * Get stable fee balance
   *
   * Returns the balance of collected stable token fees for the specified type.
   *
   * @deprecated This function references removed Move code. Use get_fee_balance<CoinType> instead.
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Balance (u64)
   */
  static getStableFeeBalance(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      stableType: string;
      feeManager: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'get_stable_fee_balance'),
      typeArguments: [config.stableType],
      arguments: [config.feeManager],
    });
  }

  // ============================================================================
  // Coin-Specific Fee Management
  // ============================================================================

  /**
   * Add coin fee configuration
   *
   * Admin function to add fee configuration for a new coin type.
   * Creates verification fee table with default level 1.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static addCoinFeeConfig(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      coinType: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      decimals: number; // u8
      daoCreationFee: bigint;
      proposalFeePerOutcome: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'add_coin_fee_config_entry'),
      typeArguments: [config.coinType],
      arguments: [
        config.feeManager,
        config.adminCap,
        tx.pure.u8(config.decimals),
        tx.pure.u64(config.daoCreationFee),
        tx.pure.u64(config.proposalFeePerOutcome),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Update creation fee for coin type
   *
   * Admin function to update DAO creation fee for specific coin.
   * Enforces 6-month delay for increases and 10x cap from baseline.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static updateCoinCreationFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      coinTypeName: ReturnType<Transaction['moveCall']>;
      newFee: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'update_coin_creation_fee'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.adminCap,
        config.coinTypeName,
        tx.pure.u64(config.newFee),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Update proposal fee for coin type
   *
   * Admin function to update proposal creation fee for specific coin.
   * Enforces 6-month delay for increases and 10x cap from baseline.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static updateCoinProposalFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      adminCap: ReturnType<Transaction['moveCall']>;
      coinTypeName: ReturnType<Transaction['moveCall']>;
      newFeePerOutcome: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'update_coin_proposal_fee'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.adminCap,
        config.coinTypeName,
        tx.pure.u64(config.newFeePerOutcome),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Apply pending coin fees
   *
   * Apply pending fee updates if 6-month delay has passed.
   * Public function - anyone can call to activate pending fees.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static applyPendingCoinFees(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      coinTypeName: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'apply_pending_coin_fees'),
      typeArguments: [],
      arguments: [
        config.feeManager,
        config.coinTypeName,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Get coin fee configuration
   *
   * Returns the fee configuration for the specified coin type.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns CoinFeeConfig reference
   */
  static getCoinFeeConfig(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      feeManager: ReturnType<Transaction['moveCall']>;
      coinTypeName: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'fee', 'get_coin_fee_config'),
      typeArguments: [],
      arguments: [config.feeManager, config.coinTypeName],
    });
  }
}
