/**
 * Quantum LP Manager Module
 *
 * Simplified quantum LP management with automatic participation:
 * - Withdrawal validation with minimum liquidity checks
 * - Auto-locking LPs when withdrawal would violate minimums
 * - Auto quantum-split on proposal start
 * - Recombination after proposal ends
 *
 * Key Features:
 * - Single LP token level (no manual split/redeem)
 * - DAO-configured quantum split ratio (10-90%)
 * - Automatic bucket management (LIVE, TRANSITIONING, WITHDRAW_ONLY)
 * - Safety caps from conditional capacity
 *
 * @module quantum-lp-manager
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Quantum LP Manager Static Functions
 *
 * Manage liquidity lifecycle across spot and conditional markets.
 */
export class QuantumLPManager {
  /**
   * Check if LP withdrawal would violate minimum liquidity in ANY conditional AMM
   *
   * Returns (can_withdraw, min_violating_amm_index)
   * Used to determine if withdrawal must wait for proposal to end.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (can_withdraw: bool, violating_amm_index: Option<u8>)
   */
  static wouldViolateMinimumLiquidity(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
      spotPool: ReturnType<Transaction['moveCall']>;
      marketState: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'quantum_lp_manager', 'would_violate_minimum_liquidity'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.lpToken, config.spotPool, config.marketState],
    });
  }

  /**
   * Attempt to withdraw LP with minimum liquidity check
   *
   * If withdrawal would violate minimum, LP is locked in proposal and set to withdraw mode.
   * Returns (can_withdraw_now, proposal_id_if_locked).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (can_withdraw: bool, locked_proposal_id: Option<ID>)
   */
  static checkAndLockIfNeeded(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
      spotPool: ReturnType<Transaction['moveCall']>;
      marketState: ReturnType<Transaction['moveCall']>;
      proposalId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'quantum_lp_manager', 'check_and_lock_if_needed'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.lpToken,
        config.spotPool,
        config.marketState,
        tx.object(config.proposalId),
      ],
    });
  }

  /**
   * Auto quantum-split on proposal start
   *
   * Automatically quantum-splits spot LP to conditional AMMs when proposal starts.
   * Amount split is based on DAO-configured ratio with safety cap from conditional capacity.
   *
   * Splits BOTH:
   * - LIVE bucket: Will recombine back to spot.LIVE when proposal ends
   * - TRANSITIONING bucket: Will recombine to spot.WITHDRAW_ONLY (frozen for claiming)
   *
   * WITHDRAW_ONLY bucket stays in spot (not quantum-split).
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static autoQuantumSplitOnProposalStart(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      proposalId: string;
      conditionalLiquidityRatioPercent: bigint; // Base 100: 1-99
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'quantum_lp_manager', 'auto_quantum_split_on_proposal_start'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spotPool,
        config.escrow,
        tx.object(config.proposalId),
        tx.pure.u64(config.conditionalLiquidityRatioPercent),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Auto redeem on proposal end
   *
   * Automatically recombines winning conditional LP back to spot when proposal ends.
   * Uses bucket-aware recombination:
   * - conditional.LIVE → spot.LIVE (will quantum-split for next proposal)
   * - conditional.TRANSITIONING → spot.WITHDRAW_ONLY (frozen for claiming)
   *
   * NOTE: Does NOT mint LP tokens. User LP tokens existed throughout quantum split,
   * they're now just backed by spot liquidity again after recombination.
   *
   * CRITICAL FIX: Derives bucket amounts from current reserves and original LP token ratios
   * instead of using stale bucket counters.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static autoRedeemOnProposalEnd(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      winningOutcome: bigint;
      spotPool: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      marketState: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'quantum_lp_manager', 'auto_redeem_on_proposal_end'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.u64(config.winningOutcome),
        config.spotPool,
        config.escrow,
        config.marketState,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Auto redeem on proposal end from escrow
   *
   * Entry-friendly wrapper that extracts market_state from escrow.
   * Avoids borrow checker issues since it manages escrow/market_state borrow scopes internally.
   *
   * CRITICAL: Subtracts bootstrap reserves before withdrawing from escrow.
   * Bootstrap reserves (1000/1000 per pool) are NOT backed by escrow - they stay locked in pools.
   * Only the quantum-split liquidity has escrow backing.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static autoRedeemOnProposalEndFromEscrow(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      winningOutcome: bigint;
      spotPool: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'quantum_lp_manager', 'auto_redeem_on_proposal_end_from_escrow'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.u64(config.winningOutcome),
        config.spotPool,
        config.escrow,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Withdraw LP with automatic lock check
   *
   * Entry function that checks if withdrawal would violate minimum liquidity.
   * If violation would occur, LP is locked in proposal with withdraw mode.
   * Otherwise, proceeds with immediate withdrawal.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static withdrawWithLockCheck(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
      spotPool: ReturnType<Transaction['moveCall']>;
      marketState: ReturnType<Transaction['moveCall']>;
      proposalId: string;
      minAssetOut: bigint;
      minStableOut: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'quantum_lp_manager', 'withdraw_with_lock_check'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.lpToken,
        config.spotPool,
        config.marketState,
        tx.object(config.proposalId),
        tx.pure.u64(config.minAssetOut),
        tx.pure.u64(config.minStableOut),
      ],
    });
  }

  /**
   * Unlock LP token after proposal finalized
   *
   * Allows users whose withdrawal was delayed to proceed with claiming.
   * Validates that the proposal has finalized before unlocking.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static unlockAfterProposalFinalized(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
      marketState: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'quantum_lp_manager', 'unlock_after_proposal_finalized'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.lpToken, config.marketState],
    });
  }

  /**
   * Claim withdrawal from WITHDRAW_ONLY bucket
   *
   * Withdraw LP tokens after they've been marked for withdrawal and moved to WITHDRAW_ONLY bucket.
   * This is the simple spot-only version - no conditional token complexity.
   *
   * Flow:
   * 1. User marks LP for withdrawal → moves LIVE → TRANSITIONING (if proposal active) or LIVE → WITHDRAW_ONLY (if no proposal)
   * 2. If proposal was active: quantum split happens, then recombination moves TRANSITIONING → WITHDRAW_ONLY
   * 3. User calls this function → withdraws from WITHDRAW_ONLY bucket as coins
   *
   * NOTE: LP must be in withdraw mode and NOT locked in a proposal.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static claimWithdrawal(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
      spotPool: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'quantum_lp_manager', 'claim_withdrawal'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.lpToken, config.spotPool],
    });
  }
}
