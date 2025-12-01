/**
 * Liquidity Interact Module
 *
 * Methods to interact with AMM liquidity and escrow balances using
 * TreasuryCap-based conditional coins.
 *
 * Key features:
 * - Complete set minting/redemption
 * - AMM liquidity management
 * - Protocol fee collection
 * - LP withdrawal cranking
 *
 * @module liquidity-interact
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../../services/transaction';

/**
 * Liquidity Interact Static Functions
 *
 * Manage liquidity operations and escrow interactions.
 *
 * @example Mint conditional tokens
 * ```typescript
 * const conditionalAsset = LiquidityInteract.mintConditionalAssetForOutcome(tx, {
 *   marketsOperationsPackageId,
 *   assetType,
 *   stableType,
 *   conditionalCoinType,
 *   escrow,
 *   outcomeIndex: 0,
 *   spotAsset: assetCoin,
 * });
 * ```
 */
export class LiquidityInteract {
  // ============================================================================
  // Liquidity Removal (After Finalization)
  // ============================================================================

  /**
   * Empty winning AMM pool and return liquidity to DAO
   *
   * Called when a DAO-funded proposal finalizes.
   * Returns asset and stable coins for DAO to handle.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (asset_coin, stable_coin)
   */
  static emptyAmmAndReturnToDao(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      assetConditionalCoinType: string;
      stableConditionalCoinType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'liquidity_interact',
        'empty_amm_and_return_to_dao'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.assetConditionalCoinType,
        config.stableConditionalCoinType,
      ],
      arguments: [config.proposal, config.escrow],
    });
  }

  // ============================================================================
  // Complete Set Minting/Redemption
  // ============================================================================

  /**
   * Mint conditional asset coin for specific outcome
   *
   * Deposits spot asset and mints conditional asset coin.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Conditional asset coin
   */
  static mintConditionalAssetForOutcome(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalCoinType: string;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIndex: bigint;
      spotAsset: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'liquidity_interact',
        'mint_conditional_asset_for_outcome'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalCoinType],
      arguments: [config.escrow, tx.pure.u64(config.outcomeIndex), config.spotAsset],
    });
  }

  /**
   * Mint conditional stable coin for specific outcome
   *
   * Deposits spot stable and mints conditional stable coin.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Conditional stable coin
   */
  static mintConditionalStableForOutcome(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalCoinType: string;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIndex: bigint;
      spotStable: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'liquidity_interact',
        'mint_conditional_stable_for_outcome'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalCoinType],
      arguments: [config.escrow, tx.pure.u64(config.outcomeIndex), config.spotStable],
    });
  }

  /**
   * Redeem conditional asset coin back to spot asset
   *
   * Burns conditional coin and returns spot asset (1:1).
   * Only works for winning outcome after finalization.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot asset coin
   */
  static redeemConditionalAsset(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalCoinType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      conditionalCoin: ReturnType<Transaction['moveCall']>;
      outcomeIndex: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'liquidity_interact',
        'redeem_conditional_asset'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalCoinType],
      arguments: [
        config.proposal,
        config.escrow,
        config.conditionalCoin,
        tx.pure.u64(config.outcomeIndex),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Redeem conditional stable coin back to spot stable
   *
   * Burns conditional coin and returns spot stable (1:1).
   * Only works for winning outcome after finalization.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot stable coin
   */
  static redeemConditionalStable(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalCoinType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      conditionalCoin: ReturnType<Transaction['moveCall']>;
      outcomeIndex: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'liquidity_interact',
        'redeem_conditional_stable'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalCoinType],
      arguments: [
        config.proposal,
        config.escrow,
        config.conditionalCoin,
        tx.pure.u64(config.outcomeIndex),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // AMM Liquidity Management
  // ============================================================================

  /**
   * Add liquidity to AMM pool for specific outcome (entry function)
   *
   * Takes asset and stable conditional coins and mints LP tokens.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static addLiquidityEntry(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      assetConditionalCoin: string;
      stableConditionalCoin: string;
      lpConditionalCoin: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      assetIn: ReturnType<Transaction['moveCall']>;
      stableIn: ReturnType<Transaction['moveCall']>;
      minLpOut: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'liquidity_interact',
        'add_liquidity_entry'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.assetConditionalCoin,
        config.stableConditionalCoin,
        config.lpConditionalCoin,
      ],
      arguments: [
        config.proposal,
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        config.assetIn,
        config.stableIn,
        tx.pure.u64(config.minLpOut),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Remove liquidity from AMM pool proportionally (entry function)
   *
   * Burns LP tokens and returns asset and stable conditional coins.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static removeLiquidityEntry(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      assetConditionalCoin: string;
      stableConditionalCoin: string;
      lpConditionalCoin: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
      lpToken: ReturnType<Transaction['moveCall']>;
      minAssetOut: bigint;
      minStableOut: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'liquidity_interact',
        'remove_liquidity_entry'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.assetConditionalCoin,
        config.stableConditionalCoin,
        config.lpConditionalCoin,
      ],
      arguments: [
        config.proposal,
        config.escrow,
        tx.pure.u64(config.outcomeIdx),
        config.lpToken,
        tx.pure.u64(config.minAssetOut),
        tx.pure.u64(config.minStableOut),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Protocol Fee Collection
  // ============================================================================

  /**
   * Collect protocol fees from winning pool after finalization
   *
   * Withdraws fees from escrow and deposits them to fee manager.
   * Collects both asset and stable token fees.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static collectProtocolFees(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      feeManager: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'liquidity_interact',
        'collect_protocol_fees'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.escrow,
        config.feeManager,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // LP Withdrawal Crank
  // ============================================================================

  /**
   * Crank to transition TRANSITIONING bucket to WITHDRAW_ONLY
   *
   * Called after proposal finalizes. Allows LPs who marked for withdrawal
   * to claim their coins.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static crankRecombineAndTransition(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'liquidity_interact',
        'crank_recombine_and_transition'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.spotPool],
    });
  }
}
