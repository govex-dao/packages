/**
 * Arbitrage Entry Module
 *
 * Provides aggregator-friendly interfaces and arbitrage bot entry points
 * for the deterministic arbitrage solver.
 *
 * Interfaces:
 * 1. get_quote() - Quote for aggregators (Aftermath, Cetus, etc.)
 * 2. simulate_arbitrage() - Profit simulation for arbitrage bots
 *
 * Note: On Sui there is no MEV (front-running) due to atomic transactions.
 * "MEV bot" refers to arbitrage bots that capture pricing inefficiencies.
 *
 * @module arbitrage-entry
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../../services/transaction';

/**
 * Arbitrage Entry Static Functions
 *
 * Quote and simulation functions for aggregators and arbitrage bots.
 *
 * @example Get quote for aggregators
 * ```typescript
 * const quote = ArbitrageEntry.getQuoteAssetToStable(tx, {
 *   marketsOperationsPackageId,
 *   assetType,
 *   stableType,
 *   spot,
 *   conditionals,
 *   amountIn: 1_000_000n,
 * });
 * ```
 */
export class ArbitrageEntry {
  // ============================================================================
  // Aggregator Interface
  // ============================================================================

  /**
   * Get swap quote with arbitrage opportunity analysis (asset → stable)
   *
   * Returns direct swap output and available arbitrage opportunity.
   *
   * CRITICAL: The arbitrage profit is calculated on CURRENT pool state.
   * If user swaps first, pool state changes, and actual arbitrage differs.
   * DO NOT add direct_output + expected_arb_profit!
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns SwapQuote struct
   *
   * @example
   * ```typescript
   * const quote = ArbitrageEntry.getQuoteAssetToStable(tx, {
   *   marketsOperationsPackageId,
   *   assetType,
   *   stableType,
   *   spot,
   *   conditionals,
   *   amountIn: 1_000_000n,
   * });
   * // User receives: quote.direct_output
   * // Arbitrage profit goes to arbitrageur (not user)
   * ```
   */
  static getQuoteAssetToStable(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      amountIn: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'arbitrage_entry',
        'get_quote_asset_to_stable'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spot, config.conditionals, tx.pure.u64(config.amountIn)],
    });
  }

  /**
   * Get swap quote with arbitrage opportunity analysis (stable → asset)
   *
   * Returns direct swap output and available arbitrage opportunity.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns SwapQuote struct
   */
  static getQuoteStableToAsset(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      amountIn: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'arbitrage_entry',
        'get_quote_stable_to_asset'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spot, config.conditionals, tx.pure.u64(config.amountIn)],
    });
  }

  // ============================================================================
  // Arbitrage Bot Interface
  // ============================================================================

  /**
   * Simulate pure arbitrage with minimum profit threshold
   *
   * Uses bidirectional search to find best arbitrage direction.
   *
   * Features:
   * - Bidirectional search (finds best direction automatically)
   * - Min profit threshold (don't execute if profit < threshold)
   * - 40-60% more efficient (pruning + early exits + no sqrt)
   * - Smart bounding (pass user_swap_output hint for 95%+ gas savings)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (optimal_amount, expected_profit, is_spot_to_cond)
   *
   * @example
   * ```typescript
   * const [amount, profit, direction] = ArbitrageEntry.simulatePureArbitrageWithMinProfit(tx, {
   *   marketsOperationsPackageId,
   *   assetType,
   *   stableType,
   *   spot,
   *   conditionals,
   *   userSwapOutput: 1_000_000n,
   *   minProfit: 10_000n,
   * });
   * if (profit > 0) {
   *   // Execute arbitrage in the profitable direction
   * }
   * ```
   */
  static simulatePureArbitrageWithMinProfit(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      userSwapOutput: bigint;
      minProfit: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'arbitrage_entry',
        'simulate_pure_arbitrage_with_min_profit'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spot,
        config.conditionals,
        tx.pure.u64(config.userSwapOutput),
        tx.pure.u64(config.minProfit),
      ],
    });
  }

  /**
   * Legacy: Simulate arbitrage in specific direction (asset → stable)
   *
   * Note: New code should use simulatePureArbitrageWithMinProfit for bidirectional search.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (amount, profit)
   */
  static simulatePureArbitrageAssetToStable(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      userSwapOutput: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'arbitrage_entry',
        'simulate_pure_arbitrage_asset_to_stable'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spot, config.conditionals, tx.pure.u64(config.userSwapOutput)],
    });
  }

  /**
   * Legacy: Simulate arbitrage in specific direction (stable → asset)
   *
   * Note: New code should use simulatePureArbitrageWithMinProfit for bidirectional search.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (amount, profit)
   */
  static simulatePureArbitrageStableToAsset(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spot: ReturnType<Transaction['moveCall']>;
      conditionals: ReturnType<Transaction['moveCall']>;
      userSwapOutput: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'arbitrage_entry',
        'simulate_pure_arbitrage_stable_to_asset'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spot, config.conditionals, tx.pure.u64(config.userSwapOutput)],
    });
  }

  // ============================================================================
  // Quote Getters
  // ============================================================================

  /**
   * Get amount_in from quote
   */
  static quoteAmountIn(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'arbitrage_entry',
        'quote_amount_in'
      ),
      arguments: [quote],
    });
  }

  /**
   * Get direct_output from quote
   */
  static quoteDirectOutput(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'arbitrage_entry',
        'quote_direct_output'
      ),
      arguments: [quote],
    });
  }

  /**
   * Get optimal_arb_amount from quote
   */
  static quoteOptimalArbAmount(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'arbitrage_entry',
        'quote_optimal_arb_amount'
      ),
      arguments: [quote],
    });
  }

  /**
   * Get expected_arb_profit from quote
   */
  static quoteExpectedArbProfit(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'arbitrage_entry',
        'quote_expected_arb_profit'
      ),
      arguments: [quote],
    });
  }

  /**
   * Get is_arb_available from quote
   */
  static quoteIsArbAvailable(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'arbitrage_entry',
        'quote_is_arb_available'
      ),
      arguments: [quote],
    });
  }

  /**
   * Get arbitrage profit in basis points relative to direct output
   *
   * Returns 0 if no arbitrage available.
   * Note: This is the arbitrage bot's potential profit, NOT added to user output!
   *
   * @param tx - Transaction
   * @param marketsOperationsPackageId - Package ID
   * @param quote - Quote object
   * @returns Profit in basis points
   */
  static quoteArbProfitBps(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'arbitrage_entry',
        'quote_arb_profit_bps'
      ),
      arguments: [quote],
    });
  }
}
