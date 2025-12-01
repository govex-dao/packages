/**
 * Arbitrage Math Module
 *
 * N-OUTCOME ARBITRAGE MATH - EFFICIENT B-PARAMETERIZATION
 *
 * Key Improvements:
 * - B-parameterization (no square roots, cleaner math)
 * - Early exit checks (BOTH directions optimized)
 * - Bidirectional solving (catches all opportunities)
 * - Min profit threshold (simple profitability check)
 * - u256 arithmetic (accurate overflow-free calculations)
 * - Ternary search precision (max(1%, MIN_COARSE_THRESHOLD) to prevent infinite loops)
 * - Concavity proof (F(b) is strictly concave, ternary search is optimal)
 * - Smart bounding (95%+ gas reduction via 1.1x user swap hint)
 *
 * Smart Bounding Insight:
 * The optimization is mathematically correct because the max arbitrage opportunity
 * ≤ the swap that created it! User swaps 1,000 tokens → search [0, 1,100] not [0, 10^18].
 * This is not an approximation - it's exact search in a tighter, correct bound.
 *
 * @module arbitrage-math
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Arbitrage Math Static Functions
 *
 * Sophisticated arbitrage algorithms with smart bounding and ternary search.
 */
export class ArbitrageMath {
  /**
   * PRIMARY N-OUTCOME FUNCTION - Compute optimal arbitrage after user swap
   *
   * Returns (optimal_amount, expected_profit, is_cond_to_spot)
   *
   * SMART BOUNDING OPTIMIZATION:
   * Uses user's swap output as upper bound (1.1x for safety margin).
   * Key insight: Max arbitrage ≤ swap that created the imbalance!
   * Searches [0, min(1.1 * user_output, upper_bound_b)] instead of [0, 10^18].
   *
   * Why This Works:
   * User swap creates the imbalance - you can't extract more arbitrage than
   * the imbalance size. No meaningful trade-off, massive gas savings.
   *
   * Algorithm:
   * 1. Spot → Conditional: Buy from spot, sell to ALL conditionals, burn complete set
   * 2. Conditional → Spot: Buy from ALL conditionals, recombine, sell to spot
   * 3. Compare profits, return better direction
   *
   * Direction Flag (is_cond_to_spot):
   * - true = Conditional→Spot: Buy from conditional pools, recombine, sell to spot
   * - false = Spot→Conditional: Buy from spot, split, sell to conditional pools
   *
   * Performance: O(log(1.1*user_output) × N) = ~95%+ gas reduction vs global search
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (optimal_amount: u64, expected_profit: u128, is_cond_to_spot: bool)
   */
  static computeOptimalArbitrageForNOutcomes(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      userSwapOutput: bigint; // Hint from user's swap (0 = use global bound)
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_math', 'compute_optimal_arbitrage_for_n_outcomes'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spot,
        config.conditionals,
        tx.pure.u64(config.userSwapOutput),
      ],
    });
  }

  /**
   * Compute optimal Spot → Conditional arbitrage with smart bounding
   *
   * Buy from spot pool, sell to ALL conditional pools, burn complete set.
   * Uses B-parameterization for efficient search.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (optimal_amount: u64, profit: u128)
   */
  static computeOptimalSpotToConditional(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      userSwapOutput: bigint; // Hint: 0 = use global bound
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_math', 'compute_optimal_spot_to_conditional'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spot,
        config.conditionals,
        tx.pure.u64(config.userSwapOutput),
      ],
    });
  }

  /**
   * Compute optimal Conditional → Spot arbitrage with smart bounding
   *
   * Buy from ALL conditional pools, recombine, sell to spot pool.
   * Uses ternary search with smart bounding for efficiency.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (optimal_amount: u64, profit: u128)
   */
  static computeOptimalConditionalToSpot(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      userSwapOutput: bigint; // Hint: 0 = use global bound
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_math', 'compute_optimal_conditional_to_spot'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spot,
        config.conditionals,
        tx.pure.u64(config.userSwapOutput),
      ],
    });
  }

  /**
   * Original x-parameterization interface (for compatibility)
   *
   * Now uses b-parameterization with smart bounding internally.
   * Maintained for backward compatibility with legacy code.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (amount: u64, profit: u128)
   */
  static computeOptimalSpotArbitrage(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      spotSwapIsStableToAsset: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_math', 'compute_optimal_spot_arbitrage'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spot,
        config.conditionals,
        tx.pure.bool(config.spotSwapIsStableToAsset),
      ],
    });
  }

  /**
   * Calculate arbitrage profit for specific amount (simulation)
   *
   * Used for testing and verification of arbitrage calculations.
   *
   * spotSwapIsStableToAsset:
   * - true = Spot→Conditional (buy from spot, sell to conditionals)
   * - false = Conditional→Spot (buy from conditionals, sell to spot)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Profit (u128)
   */
  static calculateSpotArbitrageProfit(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      arbitrageAmount: bigint;
      spotSwapIsStableToAsset: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_math', 'calculate_spot_arbitrage_profit'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spot,
        config.conditionals,
        tx.pure.u64(config.arbitrageAmount),
        tx.pure.bool(config.spotSwapIsStableToAsset),
      ],
    });
  }

  /**
   * Simulate Conditional → Spot arbitrage profit (for testing/verification)
   *
   * Conditional → Spot simulation:
   * 1. Calculate cost to buy b conditional tokens from EACH pool
   * 2. Recombine b complete sets → b base assets
   * 3. Sell b base assets to spot → get stable
   * 4. Profit = spot_revenue - total_cost_from_all_pools
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Profit (u128)
   */
  static simulateConditionalToSpotProfit(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      arbitrageAmount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_math', 'simulate_conditional_to_spot_profit'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spot,
        config.conditionals,
        tx.pure.u64(config.arbitrageAmount),
      ],
    });
  }

  /**
   * Conditional arbitrage (legacy compatibility)
   *
   * Calculate arbitrage profit for a specific outcome index.
   * Maintained for backward compatibility.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Profit (u128)
   */
  static calculateConditionalArbitrageProfit(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      swappedOutcomeIdx: number; // u8
      arbitrageAmount: bigint;
      isAssetToStable: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage_math', 'calculate_conditional_arbitrage_profit'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spot,
        config.conditionals,
        tx.pure.u8(config.swappedOutcomeIdx),
        tx.pure.u64(config.arbitrageAmount),
        tx.pure.bool(config.isAssetToStable),
      ],
    });
  }
}
