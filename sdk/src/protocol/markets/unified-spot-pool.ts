/**
 * Unified Spot Pool Module
 *
 * UNIFIED SPOT POOL - Single pool type with optional aggregator support
 *
 * Design Goals:
 * - Replace both SpotAMM and AccountSpotPool with single unified type
 * - Optional aggregator features (zero overhead when disabled)
 * - NO circular dependencies (uses IDs, not concrete types)
 * - Backward compatible initialization
 *
 * Key Features:
 * - Constant product AMM (x * y = k)
 * - Bucket-based LP management (LIVE, TRANSITIONING, WITHDRAW_ONLY, PENDING)
 * - Quantum liquidity (LP splits to conditional markets during proposals)
 * - TWAP oracle integration
 * - Dynamic fee scheduling (anti-snipe for launchpads)
 * - Protocol fee collection
 *
 * @module unified-spot-pool
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Unified Spot Pool Static Functions
 *
 * AMM pool with full futarchy features.
 */
export class UnifiedSpotPool {
  // ============================================================================
  // LP Token Functions
  // ============================================================================

  /**
   * Get LP token amount
   *
   * Returns the amount of LP tokens held by this token.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns LP amount (u64)
   */
  static lpTokenAmount(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'lp_token_amount'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.lpToken],
    });
  }

  /**
   * Get the pool ID this LP belongs to
   *
   * Returns the ID of the parent pool that minted this LP token.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Pool ID
   */
  static lpTokenPoolId(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'lp_token_pool_id'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.lpToken],
    });
  }

  /**
   * Check if LP is locked in a proposal
   *
   * Returns true if LP is locked and proposal is not finalized.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns true if locked
   */
  static isLockedInProposal(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'is_locked_in_proposal'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.lpToken],
    });
  }

  /**
   * Get the proposal ID this LP is locked in
   *
   * Returns Option<ID> with the proposal ID if locked.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Option<ID>
   */
  static getLockedProposal(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_locked_proposal'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.lpToken],
    });
  }

  /**
   * Check if LP is in withdraw mode
   *
   * Returns true if LP has been marked for withdrawal.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns true if in withdraw mode
   */
  static isWithdrawMode(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      lpToken: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'is_withdraw_mode'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.lpToken],
    });
  }

  // ============================================================================
  // Pool Creation Functions
  // ============================================================================

  /**
   * Create a futarchy spot pool with FULL features
   *
   * All futarchy pools have: TWAP oracle, escrow tracking, bucket management.
   * There is NO "simple" mode - all pools need these features for governance.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns UnifiedSpotPool
   */
  static new(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      feeBps: bigint;
      feeSchedule: ReturnType<Transaction['moveCall']> | null; // Option<FeeSchedule>
      oracleConditionalThresholdBps: bigint; // When to use conditional vs spot oracle (typically 5000 = 50%)
      conditionalLiquidityRatioPercent: bigint; // DAO's configured ratio for quantum split (1-99)
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'new'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.u64(config.feeBps),
        config.feeSchedule || tx.object('0x0'),
        tx.pure.u64(config.oracleConditionalThresholdBps),
        tx.pure.u64(config.conditionalLiquidityRatioPercent),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * DEPRECATED: Use new() instead - all pools now have full features
   *
   * This function is kept for backwards compatibility but just calls new().
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns UnifiedSpotPool
   */
  static newWithAggregator(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      feeBps: bigint;
      feeSchedule: ReturnType<Transaction['moveCall']> | null;
      oracleConditionalThresholdBps: bigint;
      conditionalLiquidityRatioPercent: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'new_with_aggregator'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.u64(config.feeBps),
        config.feeSchedule || tx.object('0x0'),
        tx.pure.u64(config.oracleConditionalThresholdBps),
        tx.pure.u64(config.conditionalLiquidityRatioPercent),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Upgrade existing pool to add aggregator support
   *
   * Can be called via governance to enable aggregator features.
   * No-op: all pools already have full features enabled at creation.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static enableAggregator(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      oracleConditionalThresholdBps: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'enable_aggregator'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.pool,
        tx.pure.u64(config.oracleConditionalThresholdBps),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Escrow Management Functions (Aggregator Only)
  // ============================================================================

  /**
   * Store active escrow ID when proposal starts trading
   *
   * NOTE: Takes ID (not TokenEscrow object) because shared objects can't be stored.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static storeActiveEscrow(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      escrowId: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'store_active_escrow'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, tx.object(config.escrowId)],
    });
  }

  /**
   * Extract active escrow ID when proposal ends
   *
   * Returns the escrow ID to caller (to look up the shared object).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Escrow ID
   */
  static extractActiveEscrow(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'extract_active_escrow'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get active escrow ID (read-only)
   *
   * Returns None if no active escrow.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Option<ID>
   */
  static getActiveEscrowId(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_active_escrow_id'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  // ============================================================================
  // Core AMM Functions
  // ============================================================================

  /**
   * Add liquidity to the pool and return LP token with excess coins
   *
   * IMPORTANT: LP can be added anytime, including during active proposals.
   * - If no proposal active: LP goes to LIVE bucket (participates immediately)
   * - If proposal active: LP goes to PENDING bucket (joins spot pool when proposal ends)
   *
   * This prevents new LP from unfairly benefiting from conditional market outcomes.
   * Returns: (LPToken, excess_asset_coin, excess_stable_coin)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (LPToken, excess_asset, excess_stable)
   */
  static addLiquidity(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      assetCoin: ReturnType<Transaction['moveCall']>;
      stableCoin: ReturnType<Transaction['moveCall']>;
      minLpOut: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'add_liquidity'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.pool,
        config.assetCoin,
        config.stableCoin,
        tx.pure.u64(config.minLpOut),
      ],
    });
  }

  /**
   * Add liquidity and return LP token with excess coins (explicit name for clarity)
   *
   * Returns: (LPToken, excess_asset_coin, excess_stable_coin)
   *
   * CRITICAL: This function calculates the optimal amounts needed to match pool ratio
   * and returns any excess coins instead of depositing them (which would donate to existing LPs).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (LPToken, excess_asset, excess_stable)
   */
  static addLiquidityAndReturn(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      assetCoin: ReturnType<Transaction['moveCall']>;
      stableCoin: ReturnType<Transaction['moveCall']>;
      minLpOut: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'add_liquidity_and_return'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.pool,
        config.assetCoin,
        config.stableCoin,
        tx.pure.u64(config.minLpOut),
      ],
    });
  }

  /**
   * Remove liquidity from the pool
   *
   * NOTE: This function is for removing from LIVE bucket ONLY.
   * For withdrawal after marking, use markLpForWithdrawal() + withdrawLp().
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset_coin, stable_coin)
   */
  static removeLiquidity(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      lpToken: ReturnType<Transaction['moveCall']>;
      minAssetOut: bigint;
      minStableOut: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'remove_liquidity'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.pool,
        config.lpToken,
        tx.pure.u64(config.minAssetOut),
        tx.pure.u64(config.minStableOut),
      ],
    });
  }

  // ============================================================================
  // LP Withdrawal System
  // ============================================================================

  /**
   * Mark LP for withdrawal - user triggers this to exit
   *
   * If proposal is active: moves LIVE → TRANSITIONING (still trades)
   * If no proposal: moves LIVE → WITHDRAW_ONLY (immediate)
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static markLpForWithdrawal(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      lpToken: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'mark_lp_for_withdrawal'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, config.lpToken],
    });
  }

  /**
   * Withdraw LP as coins (final step)
   *
   * Burns LP token and returns proportional share of WITHDRAW_ONLY bucket as coins.
   * LP must be in withdraw mode and NOT locked.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset_coin, stable_coin)
   */
  static withdrawLp(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      lpToken: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'withdraw_lp'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, config.lpToken],
    });
  }

  /**
   * Transition leaving bucket to frozen claimable bucket
   *
   * Public function to move TRANSITIONING → WITHDRAW_ONLY after proposal ends.
   * Anyone can call this to help users claim their LP.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static transitionLeavingToFrozenClaimable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'transition_leaving_to_frozen_claimable'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Check if pool can create proposals
   *
   * Returns true if pool has sufficient liquidity and no active proposal.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns true if can create proposals
   */
  static canCreateProposals(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'can_create_proposals'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  // ============================================================================
  // Swap Functions
  // ============================================================================

  /**
   * Swap stable for asset
   *
   * Swaps stable coins for asset coins using constant product AMM.
   * Applies dynamic fees if fee_schedule is configured.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Asset coin
   */
  static swapStableForAsset(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      stableCoin: ReturnType<Transaction['moveCall']>;
      minAssetOut: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'swap_stable_for_asset'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.pool,
        config.stableCoin,
        tx.pure.u64(config.minAssetOut),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Swap asset for stable
   *
   * Swaps asset coins for stable coins using constant product AMM.
   * Applies dynamic fees if fee_schedule is configured.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Stable coin
   */
  static swapAssetForStable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      assetCoin: ReturnType<Transaction['moveCall']>;
      minStableOut: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'swap_asset_for_stable'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.pool,
        config.assetCoin,
        tx.pure.u64(config.minStableOut),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // View Functions
  // ============================================================================

  /**
   * Get pool reserves
   *
   * Returns (asset_reserve, stable_reserve).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset_reserve: u64, stable_reserve: u64)
   */
  static getReserves(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_reserves'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get LP supply
   *
   * Returns total LP supply for the pool.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns LP supply (u64)
   */
  static lpSupply(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'lp_supply'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get active quantum LP reserves
   *
   * Returns (asset, stable) reserves for LIVE bucket.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset: u64, stable: u64)
   */
  static getActiveQuantumLpReserves(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_active_quantum_lp_reserves'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get active quantum LP supply
   *
   * Returns LP supply for LIVE bucket.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns LP supply (u64)
   */
  static getActiveQuantumLpSupply(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_active_quantum_lp_supply'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get leaving on proposal end reserves
   *
   * Returns (asset, stable, lp) for TRANSITIONING bucket.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset: u64, stable: u64, lp: u64)
   */
  static getLeavingOnProposalEndReserves(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_leaving_on_proposal_end_reserves'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get frozen claimable LP reserves
   *
   * Returns (asset, stable) for WITHDRAW_ONLY bucket.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset: u64, stable: u64)
   */
  static getFrozenClaimableLpReserves(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_frozen_claimable_lp_reserves'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get spot price
   *
   * Returns current price (stable per asset) with PRECISION scaling (1e12).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Price (u128)
   */
  static getSpotPrice(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_spot_price'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Check if aggregator is enabled
   *
   * Returns true if pool has aggregator features.
   * (Always true for new pools - kept for backwards compatibility)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns true if enabled
   */
  static isAggregatorEnabled(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'is_aggregator_enabled'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Check if pool has active escrow
   *
   * Returns true if proposal is active and trading.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns true if has active escrow
   */
  static hasActiveEscrow(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'has_active_escrow'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Check if pool is locked for proposal
   *
   * Returns true if proposal is active.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns true if locked
   */
  static isLockedForProposal(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'is_locked_for_proposal'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get conditional liquidity ratio percent
   *
   * Returns the percentage of liquidity that gets quantum-split (1-99).
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Ratio percent (u64)
   */
  static getConditionalLiquidityRatioPercent(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_conditional_liquidity_ratio_percent'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get oracle conditional threshold bps
   *
   * Returns the threshold for switching between conditional and spot oracles.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Threshold (u64)
   */
  static getOracleConditionalThresholdBps(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_oracle_conditional_threshold_bps'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Mark liquidity to proposal
   *
   * Updates last_proposal_usage timestamp for oracle switching logic.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static markLiquidityToProposal(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      proposalId: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'mark_liquidity_to_proposal'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, tx.object(config.proposalId)],
    });
  }

  // ============================================================================
  // TWAP Functions
  // ============================================================================

  /**
   * Check if TWAP is ready
   *
   * Returns true if enough observations have been made.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns true if ready
   */
  static isTwapReady(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'is_twap_ready'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get geometric TWAP
   *
   * Returns geometric mean TWAP price.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TWAP price (u128)
   */
  static getGeometricTwap(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_geometric_twap'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get TWAP with conditional fallback
   *
   * Returns TWAP from conditional oracle or spot oracle based on threshold.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TWAP price (u128)
   */
  static getTwapWithConditional(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_twap_with_conditional'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, config.escrow, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get simple TWAP
   *
   * Returns simple TWAP from spot pool oracle.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TWAP price (u128)
   */
  static getSimpleTwap(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_simple_twap'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get fee bps
   *
   * Returns the current fee in basis points.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Fee bps (u64)
   */
  static getFeeBps(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_fee_bps'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  // ============================================================================
  // Simulation Functions
  // ============================================================================

  /**
   * Simulate swap asset to stable
   *
   * Returns expected output without executing the swap.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Expected stable out (u64)
   */
  static simulateSwapAssetToStable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      assetIn: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'simulate_swap_asset_to_stable'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, tx.pure.u64(config.assetIn)],
    });
  }

  /**
   * Simulate swap stable to asset
   *
   * Returns expected output without executing the swap.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Expected asset out (u64)
   */
  static simulateSwapStableToAsset(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      stableIn: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'simulate_swap_stable_to_asset'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, tx.pure.u64(config.stableIn)],
    });
  }

  // ============================================================================
  // DAO Dissolution Functions
  // ============================================================================

  /**
   * Remove liquidity for dissolution
   *
   * Extracts all liquidity for DAO dissolution process.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset_coin, stable_coin, protocol_fee_asset, protocol_fee_stable)
   */
  static removeLiquidityForDissolution(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'remove_liquidity_for_dissolution'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Get DAO LP value
   *
   * Returns the current value of DAO-owned LP.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset_value: u64, stable_value: u64)
   */
  static getDaoLpValue(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
      daoLpAmount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_dao_lp_value'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool, tx.pure.u64(config.daoLpAmount)],
    });
  }

  /**
   * Get protocol fee amounts
   *
   * Returns the current protocol fee balances.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset_fees: u64, stable_fees: u64)
   */
  static getProtocolFeeAmounts(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'get_protocol_fee_amounts'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }

  /**
   * Share pool object
   *
   * Makes pool a shared object (callable by anyone).
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static share(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      pool: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'unified_spot_pool', 'share'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.pool],
    });
  }
}
