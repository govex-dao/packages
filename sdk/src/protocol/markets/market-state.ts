/**
 * Market State Operations
 *
 * Tracks lifecycle and status of conditional markets:
 * - PreTrading: Market created, not yet active
 * - Trading: Active trading period
 * - TradingEnded: Trading closed, awaiting finalization
 * - Finalized: Winner determined, payouts available
 *
 * Manages AMM pool references for all outcomes.
 *
 * @module market-state
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Market State Static Functions
 *
 * Manage conditional market lifecycle and pool access.
 *
 * @example Check if trading is active
 * ```typescript
 * const isActive = MarketState.isTradingActive(tx, marketsPackageId, marketStateId);
 * ```
 */
export class MarketState {
  // ============================================================================
  // Creation & Lifecycle
  // ============================================================================

  /**
   * Create new market state
   *
   * Initializes market in PreTrading status.
   *
   * @param tx - Transaction
   * @param config - Market creation configuration
   * @returns MarketState object
   *
   * @example
   * ```typescript
   * const marketState = MarketState.new(tx, {
   *   marketsPackageId,
   *   marketId: proposalId,
   *   outcomeCount: 2,
   *   daoId: "0xdao...",
   *   clock: '0x6',
   * });
   * ```
   */
  static new(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      marketId: string;
      outcomeCount: number;
      daoId: string;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsPackageId, 'market_state', 'new'),
      arguments: [
        tx.pure.id(config.marketId),
        tx.pure.u8(config.outcomeCount),
        tx.pure.id(config.daoId),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Start trading period
   *
   * Transitions market from PreTrading to Trading status.
   *
   * @param tx - Transaction
   * @param config - Start trading configuration
   */
  static startTrading(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      marketState: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'market_state',
        'start_trading'
      ),
      arguments: [config.marketState, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * End trading period
   *
   * Transitions market from Trading to TradingEnded status.
   * Disables new trades while allowing settlement.
   *
   * @param tx - Transaction
   * @param config - End trading configuration
   */
  static endTrading(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      marketState: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsPackageId, 'market_state', 'end_trading'),
      arguments: [config.marketState, tx.object(config.clock || '0x6')],
    });
  }

  /**
   * Finalize market with winning outcome
   *
   * Transitions market to Finalized status.
   * Sets winner and enables redemptions.
   *
   * @param tx - Transaction
   * @param config - Finalization configuration
   */
  static finalize(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      marketState: ReturnType<Transaction['moveCall']>;
      winningOutcome: number;
      outcomeMessage: string;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsPackageId, 'market_state', 'finalize'),
      arguments: [
        config.marketState,
        tx.pure.u8(config.winningOutcome),
        tx.pure.string(config.outcomeMessage),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // AMM Pool Management
  // ============================================================================

  /**
   * Set AMM pool references
   *
   * Stores pool IDs for all outcomes in market state.
   * Called during pool creation.
   *
   * @param tx - Transaction
   * @param config - Pool configuration
   */
  static setAmmPools(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      marketState: ReturnType<Transaction['moveCall']>;
      poolIds: string[];
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'market_state',
        'set_amm_pools'
      ),
      arguments: [config.marketState, tx.pure.vector('id', config.poolIds)],
    });
  }

  /**
   * Check if AMM pools are set
   *
   * @returns True if pools have been initialized
   */
  static hasAmmPools(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'market_state', 'has_amm_pools'),
      arguments: [marketState],
    });
  }

  /**
   * Borrow AMM pools (read-only)
   *
   * @returns Vector of pool IDs
   */
  static borrowAmmPools(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'market_state', 'borrow_amm_pools'),
      arguments: [marketState],
    });
  }

  /**
   * Borrow AMM pools (mutable)
   *
   * @returns Mutable vector of pool IDs
   */
  static borrowAmmPoolsMut(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'borrow_amm_pools_mut'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Get pool ID for specific outcome
   *
   * @param tx - Transaction
   * @param config - Query configuration
   * @returns Pool ID
   */
  static getPoolByOutcome(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      marketState: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'market_state',
        'get_pool_by_outcome'
      ),
      arguments: [config.marketState, tx.pure.u8(config.outcomeIdx)],
    });
  }

  /**
   * Get mutable pool ID for specific outcome
   *
   * @returns Mutable pool ID
   */
  static getPoolMutByOutcome(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      marketState: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'market_state',
        'get_pool_mut_by_outcome'
      ),
      arguments: [config.marketState, tx.pure.u8(config.outcomeIdx)],
    });
  }

  /**
   * Borrow single AMM pool (mutable)
   *
   * @returns Mutable pool reference
   */
  static borrowAmmPoolMut(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      marketState: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'market_state',
        'borrow_amm_pool_mut'
      ),
      arguments: [config.marketState, tx.pure.u8(config.outcomeIdx)],
    });
  }

  // ============================================================================
  // Validation & Assertions
  // ============================================================================

  /**
   * Assert trading is active
   *
   * Panics if market is not in Trading status.
   */
  static assertTradingActive(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'assert_trading_active'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Assert market is in trading or pre-trading
   *
   * Panics if market has ended trading.
   */
  static assertInTradingOrPreTrading(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'assert_in_trading_or_pre_trading'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Assert market is finalized
   *
   * Panics if market is not finalized.
   */
  static assertMarketFinalized(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'assert_market_finalized'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Assert market is NOT finalized
   *
   * Panics if market is finalized.
   */
  static assertNotFinalized(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'assert_not_finalized'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Validate outcome index is within bounds
   *
   * Panics if outcome index >= outcome count.
   */
  static validateOutcome(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      marketState: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'market_state',
        'validate_outcome'
      ),
      arguments: [config.marketState, tx.pure.u8(config.outcomeIdx)],
    });
  }

  // ============================================================================
  // Query Functions
  // ============================================================================

  /**
   * Get market ID
   */
  static marketId(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'market_state', 'market_id'),
      arguments: [marketState],
    });
  }

  /**
   * Get outcome count
   */
  static outcomeCount(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'market_state', 'outcome_count'),
      arguments: [marketState],
    });
  }

  /**
   * Check if trading is active
   *
   * @returns True if market is in Trading status
   */
  static isTradingActive(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'is_trading_active'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Check if market is finalized
   *
   * @returns True if winner has been determined
   */
  static isFinalized(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'market_state', 'is_finalized'),
      arguments: [marketState],
    });
  }

  /**
   * Get DAO ID
   */
  static daoId(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'market_state', 'dao_id'),
      arguments: [marketState],
    });
  }

  /**
   * Get winning outcome index
   *
   * Only valid after finalization.
   *
   * @returns Winning outcome index
   */
  static getWinningOutcome(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'get_winning_outcome'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Get outcome message/description
   *
   * Returns message set during finalization.
   *
   * @returns Outcome message string
   */
  static getOutcomeMessage(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'get_outcome_message'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Get market creation timestamp
   *
   * @returns Creation time in milliseconds
   */
  static getCreationTime(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'get_creation_time'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Get trading end timestamp
   *
   * @returns End time in milliseconds (if set)
   */
  static getTradingEndTime(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'get_trading_end_time'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Get trading start timestamp
   *
   * @returns Start time in milliseconds (if set)
   */
  static getTradingStart(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'get_trading_start'
      ),
      arguments: [marketState],
    });
  }

  /**
   * Get finalization timestamp
   *
   * @returns Finalization time in milliseconds (if finalized)
   */
  static getFinalizationTime(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'get_finalization_time'
      ),
      arguments: [marketState],
    });
  }

  // ============================================================================
  // Copy Functions (for devInspect queries)
  // ============================================================================

  /**
   * Copy market ID (for queries)
   *
   * Returns owned copy instead of reference.
   */
  static copyMarketId(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'market_state', 'copy_market_id'),
      arguments: [marketState],
    });
  }

  /**
   * Copy status (for queries)
   *
   * Returns owned copy of status enum.
   */
  static copyStatus(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'market_state', 'copy_status'),
      arguments: [marketState],
    });
  }

  /**
   * Copy winning outcome (for queries)
   *
   * Returns owned copy of winning outcome option.
   */
  static copyWinningOutcome(
    tx: Transaction,
    marketsPackageId: string,
    marketState: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'market_state',
        'copy_winning_outcome'
      ),
      arguments: [marketState],
    });
  }
}
