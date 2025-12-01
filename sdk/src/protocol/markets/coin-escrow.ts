/**
 * Coin Escrow Operations
 *
 * Escrow system for conditional tokens. Manages:
 * - Minting conditional tokens by depositing spot coins
 * - Burning conditional tokens to withdraw spot coins
 * - Split operations (spot -> conditional)
 * - Recombine operations (conditional -> spot)
 * - Supply tracking for all conditional coin types
 *
 * @module coin-escrow
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Coin Escrow Static Functions
 *
 * Manage conditional token minting, burning, and escrow operations.
 *
 * @example Mint conditional tokens
 * ```typescript
 * CoinEscrow.depositAssetAndMintConditional(tx, {
 *   marketsPackageId,
 *   assetType,
 *   escrowId,
 *   amount: 1000n,
 *   outcomeIdx: 0,
 * });
 * ```
 */
export class CoinEscrow {
  // ============================================================================
  // Creation & Registration
  // ============================================================================

  /**
   * Create new conditional coin escrow
   *
   * Initializes escrow for a specific market/proposal.
   *
   * @param tx - Transaction
   * @param config - Escrow creation configuration
   * @returns CoinEscrow object
   */
  static new(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      marketStateId: string;
      outcomeCount: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsPackageId, 'coin_escrow', 'new'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.marketStateId), tx.pure.u8(config.outcomeCount)],
    });
  }

  /**
   * Register conditional coin treasury capabilities
   *
   * Registers TreasuryCaps for minting/burning conditional coins.
   * Must be called for each outcome before minting is possible.
   *
   * @param tx - Transaction
   * @param config - Registration configuration
   */
  static registerConditionalCaps(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string; // e.g., "0xPKG::cond0_asset::COND0_ASSET"
      escrowId: string;
      treasuryCap: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'register_conditional_caps'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId), config.treasuryCap],
    });
  }

  // ============================================================================
  // Direct Mint/Burn (Low-Level)
  // ============================================================================

  /**
   * Mint conditional asset coins
   *
   * Low-level minting. Requires TreasuryCap to be registered.
   *
   * @returns Conditional asset coin
   */
  static mintConditionalAsset(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
      amount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'mint_conditional_asset'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId), tx.pure.u64(config.amount)],
    });
  }

  /**
   * Mint conditional stable coins
   *
   * Low-level minting. Requires TreasuryCap to be registered.
   *
   * @returns Conditional stable coin
   */
  static mintConditionalStable(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
      amount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'mint_conditional_stable'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId), tx.pure.u64(config.amount)],
    });
  }

  /**
   * Burn conditional asset coins
   *
   * Low-level burning. Reduces circulating supply.
   */
  static burnConditionalAsset(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
      coin: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'burn_conditional_asset'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId), config.coin],
    });
  }

  /**
   * Burn conditional stable coins
   *
   * Low-level burning. Reduces circulating supply.
   */
  static burnConditionalStable(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
      coin: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'burn_conditional_stable'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId), config.coin],
    });
  }

  // ============================================================================
  // High-Level Deposit/Withdraw
  // ============================================================================

  /**
   * Deposit spot coins into escrow
   *
   * Stores coins in escrow without minting conditional tokens.
   * Both coins are required (use depositSpotLiquidity for convenience).
   *
   * @param tx - Transaction
   * @param config - Deposit configuration
   */
  static depositSpotCoins(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      escrowId: string;
      assetCoin: ReturnType<Transaction['moveCall']>;
      stableCoin: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'deposit_spot_coins'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.escrowId), config.assetCoin, config.stableCoin],
    });
  }

  /**
   * Withdraw coins from escrow
   *
   * Retrieves spot coins from escrow.
   *
   * @returns Tuple of (asset_coin_option, stable_coin_option)
   */
  static withdrawFromEscrow(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      escrowId: string;
      assetAmount: bigint;
      stableAmount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'withdraw_from_escrow'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.escrowId),
        tx.pure.u64(config.assetAmount),
        tx.pure.u64(config.stableAmount),
      ],
    });
  }

  /**
   * Deposit asset and mint conditional tokens
   *
   * High-level: Deposits spot asset and mints conditional asset for specific outcome.
   *
   * @returns Conditional asset coin
   */
  static depositAssetAndMintConditional(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
      assetCoin: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'deposit_asset_and_mint_conditional'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId), config.assetCoin],
    });
  }

  /**
   * Deposit stable and mint conditional tokens
   *
   * High-level: Deposits spot stable and mints conditional stable for specific outcome.
   *
   * @returns Conditional stable coin
   */
  static depositStableAndMintConditional(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
      stableCoin: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'deposit_stable_and_mint_conditional'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId), config.stableCoin],
    });
  }

  /**
   * Burn conditional asset and withdraw spot asset
   *
   * High-level: Burns conditional asset and withdraws underlying spot asset.
   *
   * @returns Spot asset coin
   */
  static burnConditionalAssetAndWithdraw(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
      conditionalCoin: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'burn_conditional_asset_and_withdraw'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId), config.conditionalCoin],
    });
  }

  /**
   * Burn conditional stable and withdraw spot stable
   *
   * High-level: Burns conditional stable and withdraws underlying spot stable.
   *
   * @returns Spot stable coin
   */
  static burnConditionalStableAndWithdraw(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
      conditionalCoin: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'burn_conditional_stable_and_withdraw'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId), config.conditionalCoin],
    });
  }

  /**
   * Deposit spot liquidity (both asset and stable)
   *
   * Convenience function for depositing both coins at once.
   */
  static depositSpotLiquidity(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      escrowId: string;
      assetCoin: ReturnType<Transaction['moveCall']>;
      stableCoin: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'deposit_spot_liquidity'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.escrowId), config.assetCoin, config.stableCoin],
    });
  }

  // ============================================================================
  // Query Functions
  // ============================================================================

  /**
   * Get conditional asset supply for specific outcome
   *
   * @returns Total supply of conditional asset coins
   */
  static getAssetSupply(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'get_asset_supply'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId)],
    });
  }

  /**
   * Get conditional stable supply for specific outcome
   *
   * @returns Total supply of conditional stable coins
   */
  static getStableSupply(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      escrowId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'get_stable_supply'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [tx.object(config.escrowId)],
    });
  }

  /**
   * Get spot balances in escrow
   *
   * @returns Tuple of (asset_balance, stable_balance)
   */
  static getSpotBalances(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'get_spot_balances'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId)],
    });
  }

  /**
   * Get market state reference
   */
  static getMarketState(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'get_market_state'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId)],
    });
  }

  /**
   * Get mutable market state reference
   */
  static getMarketStateMut(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'get_market_state_mut'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId)],
    });
  }

  /**
   * Get market state ID
   */
  static marketStateId(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'market_state_id'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId)],
    });
  }

  /**
   * Get number of conditional caps registered
   *
   * @returns Count of registered TreasuryCaps
   */
  static capsRegisteredCount(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'caps_registered_count'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId)],
    });
  }

  /**
   * Withdraw asset balance from escrow
   *
   * @returns Asset coin
   */
  static withdrawAssetBalance(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string,
    amount: bigint
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'withdraw_asset_balance'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId), tx.pure.u64(amount)],
    });
  }

  /**
   * Withdraw stable balance from escrow
   *
   * @returns Stable coin
   */
  static withdrawStableBalance(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string,
    amount: bigint
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'withdraw_stable_balance'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId), tx.pure.u64(amount)],
    });
  }

  // ============================================================================
  // Progressive Split Operations (for large amounts)
  // ============================================================================

  /**
   * Start progressive asset split operation
   *
   * For splitting large amounts across multiple transactions.
   *
   * @returns SplitAssetProgress hot potato
   */
  static startSplitAssetProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string,
    assetCoin: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'start_split_asset_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId), assetCoin],
    });
  }

  /**
   * Execute one step of asset split
   *
   * Mints conditional coins for one outcome.
   */
  static splitAssetProgressStep(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      progress: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'split_asset_progress_step'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [config.progress, tx.pure.u8(config.outcomeIdx)],
    });
  }

  /**
   * Finish asset split operation
   *
   * Completes the split and destroys progress hot potato.
   */
  static finishSplitAssetProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    progress: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'finish_split_asset_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [progress],
    });
  }

  /**
   * Drop/abort asset split progress
   *
   * Cancels split operation and refunds coins.
   */
  static dropSplitAssetProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    progress: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'drop_split_asset_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [progress],
    });
  }

  /**
   * Start progressive stable split operation
   *
   * @returns SplitStableProgress hot potato
   */
  static startSplitStableProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string,
    stableCoin: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'start_split_stable_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId), stableCoin],
    });
  }

  /**
   * Execute one step of stable split
   */
  static splitStableProgressStep(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      progress: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'split_stable_progress_step'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [config.progress, tx.pure.u8(config.outcomeIdx)],
    });
  }

  /**
   * Finish stable split operation
   */
  static finishSplitStableProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    progress: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'finish_split_stable_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [progress],
    });
  }

  /**
   * Drop/abort stable split progress
   */
  static dropSplitStableProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    progress: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'drop_split_stable_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [progress],
    });
  }

  // ============================================================================
  // Progressive Recombine Operations
  // ============================================================================

  /**
   * Start progressive asset recombine operation
   *
   * Combines conditional assets back into spot asset.
   *
   * @returns RecombineAssetProgress hot potato
   */
  static startRecombineAssetProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string,
    amount: bigint
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'start_recombine_asset_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId), tx.pure.u64(amount)],
    });
  }

  /**
   * Execute one step of asset recombine
   */
  static recombineAssetProgressStep(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      progress: ReturnType<Transaction['moveCall']>;
      conditionalCoin: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'recombine_asset_progress_step'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [config.progress, config.conditionalCoin],
    });
  }

  /**
   * Finish asset recombine operation
   *
   * @returns Spot asset coin
   */
  static finishRecombineAssetProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    progress: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'finish_recombine_asset_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [progress],
    });
  }

  /**
   * Drop/abort asset recombine progress
   */
  static dropRecombineAssetProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    progress: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'drop_recombine_asset_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [progress],
    });
  }

  /**
   * Start progressive stable recombine operation
   *
   * @returns RecombineStableProgress hot potato
   */
  static startRecombineStableProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    escrowId: string,
    amount: bigint
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'start_recombine_stable_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(escrowId), tx.pure.u64(amount)],
    });
  }

  /**
   * Execute one step of stable recombine
   */
  static recombineStableProgressStep(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      progress: ReturnType<Transaction['moveCall']>;
      conditionalCoin: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'coin_escrow',
        'recombine_stable_progress_step'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [config.progress, config.conditionalCoin],
    });
  }

  /**
   * Finish stable recombine operation
   *
   * @returns Spot stable coin
   */
  static finishRecombineStableProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    progress: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'finish_recombine_stable_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [progress],
    });
  }

  /**
   * Drop/abort stable recombine progress
   */
  static dropRecombineStableProgress(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    progress: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'coin_escrow',
        'drop_recombine_stable_progress'
      ),
      typeArguments: [assetType, stableType],
      arguments: [progress],
    });
  }
}
