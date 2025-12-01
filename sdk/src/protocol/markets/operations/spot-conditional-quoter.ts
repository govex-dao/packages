/**
 * Spot Conditional Quoter Module
 *
 * Provides quote functionality for spot token swaps through conditional AMMs.
 * Simulates routing process to provide accurate quotes without executing trades.
 *
 * Key features:
 * - Accurate quotes for spot-to-spot swaps through conditional AMMs
 * - Complete set minting/redemption cost accounting
 * - Full routing path simulation without state changes
 * - Price impact information
 * - Route optimization (find best outcome)
 * - Oracle price functions
 *
 * @module spot-conditional-quoter
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../../services/transaction';

/**
 * Spot Conditional Quoter Static Functions
 *
 * Quote spot swaps through conditional markets.
 *
 * @example Quote swap
 * ```typescript
 * const quote = SpotConditionalQuoter.quoteSpotAssetToStable(tx, {
 *   marketsOperationsPackageId,
 *   assetType,
 *   stableType,
 *   proposal,
 *   escrow,
 *   outcomeIdx: 0,
 *   amountIn: 1_000_000n,
 *   clock: '0x6',
 * });
 * ```
 */
export class SpotConditionalQuoter {
  // ============================================================================
  // Basic Quote Functions
  // ============================================================================

  /**
   * Get quote for swapping spot asset to spot stable through specific outcome
   *
   * Simulates: deposit asset → mint conditionals → swap asset→stable → redeem
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns SpotQuote struct
   *
   * @example
   * ```typescript
   * const quote = SpotConditionalQuoter.quoteSpotAssetToStable(tx, {
   *   marketsOperationsPackageId,
   *   assetType,
   *   stableType,
   *   proposal,
   *   escrow,
   *   outcomeIdx: 0,
   *   amountIn: 1_000_000n,
   *   clock: '0x6',
   * });
   * ```
   */
  static quoteSpotAssetToStable(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      amountIn: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'quote_spot_asset_to_stable'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        tx.pure.u64(config.amountIn),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Get quote for swapping spot stable to spot asset through specific outcome
   *
   * Simulates: deposit stable → mint conditionals → swap stable→asset → redeem
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns SpotQuote struct
   */
  static quoteSpotStableToAsset(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      amountIn: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'quote_spot_stable_to_asset'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        tx.pure.u64(config.amountIn),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Detailed Quote Functions
  // ============================================================================

  /**
   * Get detailed quote with additional information (asset → stable)
   *
   * Includes conditional token creation, excess tokens, and price info.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns DetailedSpotQuote struct
   */
  static quoteSpotAssetToStableDetailed(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      amountIn: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'quote_spot_asset_to_stable_detailed'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        tx.pure.u64(config.amountIn),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Get detailed quote with additional information (stable → asset)
   *
   * Includes conditional token creation, excess tokens, and price info.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns DetailedSpotQuote struct
   */
  static quoteSpotStableToAssetDetailed(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      amountIn: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'quote_spot_stable_to_asset_detailed'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        tx.pure.u64(config.amountIn),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Route Finding Functions
  // ============================================================================

  /**
   * Find best outcome to route spot asset → stable swap through
   *
   * Compares quotes across all outcomes and returns best.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (best_outcome_index, best_quote)
   *
   * @example
   * ```typescript
   * const [bestOutcome, quote] = SpotConditionalQuoter.findBestAssetToStableRoute(tx, {
   *   marketsOperationsPackageId,
   *   assetType,
   *   stableType,
   *   proposal,
   *   escrow,
   *   amountIn: 1_000_000n,
   *   clock: '0x6',
   * });
   * ```
   */
  static findBestAssetToStableRoute(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      amountIn: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'find_best_asset_to_stable_route'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.escrow,
        tx.pure.u64(config.amountIn),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Find best outcome to route spot stable → asset swap through
   *
   * Compares quotes across all outcomes and returns best.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (best_outcome_index, best_quote)
   */
  static findBestStableToAssetRoute(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      amountIn: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'find_best_stable_to_asset_route'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.escrow,
        tx.pure.u64(config.amountIn),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Accessor Functions (SpotQuote)
  // ============================================================================

  /**
   * Get amount_out from quote
   */
  static getAmountOut(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_amount_out'
      ),
      arguments: [quote],
    });
  }

  /**
   * Get effective_price from quote
   */
  static getEffectivePrice(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_effective_price'
      ),
      arguments: [quote],
    });
  }

  /**
   * Get price_impact_bps from quote
   */
  static getPriceImpactBps(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_price_impact_bps'
      ),
      arguments: [quote],
    });
  }

  /**
   * Get outcome from quote
   */
  static getOutcome(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_outcome'
      ),
      arguments: [quote],
    });
  }

  /**
   * Get is_asset_to_stable from quote
   */
  static isAssetToStable(
    tx: Transaction,
    marketsOperationsPackageId: string,
    quote: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'spot_conditional_quoter',
        'is_asset_to_stable'
      ),
      arguments: [quote],
    });
  }

  // ============================================================================
  // Accessor Functions (DetailedSpotQuote)
  // ============================================================================

  /**
   * Get conditional_tokens_created from detailed quote
   */
  static getConditionalTokensCreated(
    tx: Transaction,
    marketsOperationsPackageId: string,
    detailed: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_conditional_tokens_created'
      ),
      arguments: [detailed],
    });
  }

  /**
   * Get excess_conditional_tokens from detailed quote
   */
  static getExcessConditionalTokens(
    tx: Transaction,
    marketsOperationsPackageId: string,
    detailed: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_excess_conditional_tokens'
      ),
      arguments: [detailed],
    });
  }

  /**
   * Get spot_price_before from detailed quote
   */
  static getSpotPriceBefore(
    tx: Transaction,
    marketsOperationsPackageId: string,
    detailed: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_spot_price_before'
      ),
      arguments: [detailed],
    });
  }

  /**
   * Get spot_price_after from detailed quote
   */
  static getSpotPriceAfter(
    tx: Transaction,
    marketsOperationsPackageId: string,
    detailed: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_spot_price_after'
      ),
      arguments: [detailed],
    });
  }

  // ============================================================================
  // Oracle Price Functions
  // ============================================================================

  /**
   * Get combined oracle price from spot AMM
   *
   * Returns the spot AMM current price.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Price as u128
   */
  static getCombinedOraclePrice(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_combined_oracle_price'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spotPool, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Check if price meets threshold condition
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns True if condition met
   */
  static checkPriceThreshold(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      price: bigint;
      threshold: bigint;
      isAboveThreshold: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'check_price_threshold'
      ),
      arguments: [
        tx.pure.u128(config.price),
        tx.pure.u128(config.threshold),
        tx.pure.bool(config.isAboveThreshold),
      ],
    });
  }

  /**
   * Check if proposals can be created based on TWAP readiness
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns True if proposals can be created
   */
  static canCreateProposal(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'can_create_proposal'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spotPool, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get time until proposals are allowed
   *
   * Returns 0 if ready.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Time in milliseconds
   */
  static timeUntilProposalsAllowed(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'time_until_proposals_allowed'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spotPool, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Get initialization price for conditional AMMs
   *
   * Uses current spot price for immediate market initialization.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Initialization price as u128
   */
  static getInitializationPrice(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'spot_conditional_quoter',
        'get_initialization_price'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spotPool, tx.object(config.clock || '0x6')],
    });
  }
}
