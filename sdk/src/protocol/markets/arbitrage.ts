/**
 * Arbitrage Module
 *
 * Unified arbitrage that works for ANY outcome count.
 * Eliminates type explosion by using balance-based operations.
 *
 * Key innovation: Loops over outcomes using balance indices instead of
 * requiring N type parameters.
 *
 * @module arbitrage
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Arbitrage Static Functions
 *
 * Execute arbitrage operations across conditional markets.
 */
export class Arbitrage {
  /**
   * Execute optimal spot arbitrage with auto-merge
   *
   * Works for ANY outcome count! Takes spot coins, performs quantum mint + swaps
   * across all outcomes, finds complete set minimum, burns complete set, returns profit + dust.
   *
   * NEW: Auto-Merge Support - Pass existing dust balance to accumulate.
   * DCA bots doing 100 swaps = 1 NFT instead of 100!
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (stable_profit, asset_profit, dust_balance)
   *
   * @example DCA Bot Pattern
   * ```typescript
   * let balance = null;
   * for (let i = 0; i < 100; i++) {
   *   const [stableProfit, assetProfit, dust] = Arbitrage.executeOptimalSpotArbitrage(tx, {
   *     marketsCorePackageId,
   *     assetType,
   *     stableType,
   *     spotPool,
   *     escrow,
   *     session,
   *     stableForArb: stableCoin,
   *     assetForArb: tx.object('0x0'),
   *     minProfit: 0n,
   *     recipient: '0x...',
   *     existingBalanceOpt: balance,
   *     clock: '0x6',
   *   });
   *   balance = dust; // Accumulate into one NFT
   * }
   * ```
   */
  static executeOptimalSpotArbitrage(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      spotPool: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      session: ReturnType<Transaction['moveCall']>;
      stableForArb: ReturnType<Transaction['moveCall']>;
      assetForArb: ReturnType<Transaction['moveCall']>;
      minProfit: bigint;
      recipient: string;
      existingBalanceOpt: ReturnType<Transaction['moveCall']> | null;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage', 'execute_optimal_spot_arbitrage'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.spotPool,
        config.escrow,
        config.session,
        config.stableForArb,
        config.assetForArb,
        tx.pure.u64(config.minProfit),
        tx.pure.address(config.recipient),
        config.existingBalanceOpt || tx.object('0x0'),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  /**
   * Burn complete set of conditional stables and withdraw spot stable
   *
   * PUBLIC for use in swap_entry::finalize_conditional_swaps.
   * Subtracts amount from ALL outcome stable balances, then withdraws from escrow.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot stable coin
   */
  static burnCompleteSetAndWithdrawStable(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      balance: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage', 'burn_complete_set_and_withdraw_stable'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.balance, config.escrow, tx.pure.u64(config.amount)],
    });
  }

  /**
   * Burn complete set of conditional assets and withdraw spot asset
   *
   * PUBLIC for use in swap_entry::finalize_conditional_swaps.
   * Subtracts amount from ALL outcome asset balances, then withdraws from escrow.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Spot asset coin
   */
  static burnCompleteSetAndWithdrawAsset(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      balance: ReturnType<Transaction['moveCall']>;
      escrow: ReturnType<Transaction['moveCall']>;
      amount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'arbitrage', 'burn_complete_set_and_withdraw_asset'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.balance, config.escrow, tx.pure.u64(config.amount)],
    });
  }
}
