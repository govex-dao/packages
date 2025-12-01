/**
 * Conditional Balance Operations
 *
 * Type-agnostic conditional market position tracking without type explosion.
 * Tracks balances for ALL outcomes in a single dense vector instead of N type parameters.
 *
 * **Storage Layout:**
 * balances = [out0_asset, out0_stable, out1_asset, out1_stable, ...]
 * Index formula: idx = (outcome_idx * 2) + (is_asset ? 0 : 1)
 *
 * @module conditional-balance
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Conditional Balance Static Functions
 *
 * Functions for managing conditional market balance objects that track
 * positions across multiple outcomes without requiring N type parameters.
 *
 * @example Create new balance
 * ```typescript
 * const balance = ConditionalBalance.new(tx, {
 *   marketsPackageId,
 *   assetType,
 *   stableType,
 *   marketId: proposalId,
 *   outcomeCount: 2,
 * });
 * ```
 */
export class ConditionalBalance {
  /**
   * Create display for conditional balance NFTs
   *
   * Shows balance as NFT in wallets with image, name, description.
   * Balance object IS the NFT - no wrapper needed.
   */
  static createDisplay(
    tx: Transaction,
    marketsPackageId: string,
    otw: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'conditional_balance',
        'create_display'
      ),
      arguments: [otw],
    });
  }

  /**
   * Create new balance object for a market
   *
   * Initializes with zero balances for all outcomes.
   * Used when starting arbitrage or tracking positions.
   *
   * @param tx - Transaction
   * @param config - Balance configuration
   * @returns ConditionalMarketBalance object
   *
   * @example
   * ```typescript
   * const balance = ConditionalBalance.new(tx, {
   *   marketsPackageId,
   *   assetType: "0xPKG::coin::MYCOIN",
   *   stableType: "0x2::sui::SUI",
   *   marketId: "0xproposal...",
   *   outcomeCount: 2, // Binary market
   * });
   * ```
   */
  static new(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      marketId: string;
      outcomeCount: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'conditional_balance',
        'new'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.pure.id(config.marketId), tx.pure.u8(config.outcomeCount)],
    });
  }

  /**
   * Create new balance with pre-set amounts
   *
   * Initialize balance with specific amounts for each outcome/coin pair.
   */
  static newWithAmounts(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      marketId: string;
      outcomeCount: number;
      amounts: bigint[];
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'conditional_balance',
        'new_with_amounts'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.id(config.marketId),
        tx.pure.u8(config.outcomeCount),
        tx.pure.vector('u64', config.amounts),
      ],
    });
  }

  /**
   * Get balance for specific outcome and coin type
   *
   * @param tx - Transaction
   * @param config - Query configuration
   * @returns Balance amount (u64)
   *
   * @example
   * ```typescript
   * const balance = ConditionalBalance.getBalance(tx, {
   *   marketsPackageId,
   *   assetType,
   *   stableType,
   *   balanceObj,
   *   outcomeIdx: 0,
   *   isAsset: true, // Get asset balance for outcome 0
   * });
   * ```
   */
  static getBalance(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      balanceObj: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
      isAsset: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'conditional_balance',
        'get_balance'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.balanceObj,
        tx.pure.u8(config.outcomeIdx),
        tx.pure.bool(config.isAsset),
      ],
    });
  }

  /**
   * Set balance for specific outcome and coin type
   *
   * Overwrites existing balance with new value.
   */
  static setBalance(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      balanceObj: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
      isAsset: boolean;
      amount: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'conditional_balance',
        'set_balance'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.balanceObj,
        tx.pure.u8(config.outcomeIdx),
        tx.pure.bool(config.isAsset),
        tx.pure.u64(config.amount),
      ],
    });
  }

  /**
   * Add amount to balance for specific outcome and coin type
   *
   * Increments existing balance by amount.
   */
  static addToBalance(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      balanceObj: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
      isAsset: boolean;
      amount: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'conditional_balance',
        'add_to_balance'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.balanceObj,
        tx.pure.u8(config.outcomeIdx),
        tx.pure.bool(config.isAsset),
        tx.pure.u64(config.amount),
      ],
    });
  }

  /**
   * Subtract amount from balance for specific outcome and coin type
   *
   * Decrements existing balance by amount.
   * Panics if insufficient balance.
   */
  static subFromBalance(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      balanceObj: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
      isAsset: boolean;
      amount: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'conditional_balance',
        'sub_from_balance'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.balanceObj,
        tx.pure.u8(config.outcomeIdx),
        tx.pure.bool(config.isAsset),
        tx.pure.u64(config.amount),
      ],
    });
  }

  /**
   * Find minimum balance across all outcomes and coin types
   *
   * Used to determine how many complete sets can be formed.
   *
   * @returns Minimum balance amount
   */
  static findMinBalance(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    balanceObj: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'conditional_balance',
        'find_min_balance'
      ),
      typeArguments: [assetType, stableType],
      arguments: [balanceObj],
    });
  }

  /**
   * Merge two balance objects
   *
   * Adds all balances from source into target, then destroys source.
   * Both must have same market_id and outcome_count.
   */
  static merge(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    target: ReturnType<Transaction['moveCall']>,
    source: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'conditional_balance',
        'merge'
      ),
      typeArguments: [assetType, stableType],
      arguments: [target, source],
    });
  }

  /**
   * Check if balance object is empty (all balances are zero)
   *
   * @returns True if all balances are zero
   */
  static isEmpty(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    balanceObj: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'conditional_balance',
        'is_empty'
      ),
      typeArguments: [assetType, stableType],
      arguments: [balanceObj],
    });
  }

  /**
   * Destroy empty balance object
   *
   * Panics if balance is not empty.
   * Use is_empty() to check first.
   */
  static destroyEmpty(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    balanceObj: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'conditional_balance',
        'destroy_empty'
      ),
      typeArguments: [assetType, stableType],
      arguments: [balanceObj],
    });
  }

  /**
   * Get market ID this balance belongs to
   */
  static marketId(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    balanceObj: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'conditional_balance',
        'market_id'
      ),
      typeArguments: [assetType, stableType],
      arguments: [balanceObj],
    });
  }

  /**
   * Get number of outcomes in this balance
   */
  static outcomeCount(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    balanceObj: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'conditional_balance',
        'outcome_count'
      ),
      typeArguments: [assetType, stableType],
      arguments: [balanceObj],
    });
  }

  /**
   * Borrow balances vector (read-only)
   *
   * Returns the dense vector: [out0_asset, out0_stable, out1_asset, out1_stable, ...]
   */
  static borrowBalances(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    balanceObj: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        marketsPackageId,
        'conditional_balance',
        'borrow_balances'
      ),
      typeArguments: [assetType, stableType],
      arguments: [balanceObj],
    });
  }

  /**
   * Get object ID of balance
   */
  static id(
    tx: Transaction,
    marketsPackageId: string,
    assetType: string,
    stableType: string,
    balanceObj: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(marketsPackageId, 'conditional_balance', 'id'),
      typeArguments: [assetType, stableType],
      arguments: [balanceObj],
    });
  }

  // === Atomic Balance Operations (Quantum Invariant Safe) ===

  /**
   * Atomically split spot stable to balance for ALL outcomes.
   *
   * Single call replaces the N-call pattern:
   * deposit → N×add_to_balance
   *
   * Maintains quantum invariant automatically by incrementing wrapped
   * balance for all outcomes in a single transaction.
   *
   * @param tx - Transaction
   * @param config - Split configuration
   * @returns Amount deposited (u64)
   *
   * @example
   * ```typescript
   * const amount = ConditionalBalance.splitStableToBalance(tx, {
   *   primitivesPackageId,
   *   assetType,
   *   stableType,
   *   escrowId: "0xescrow...",
   *   balanceObj: balance,
   *   stableCoin: coin,
   * });
   * ```
   */
  static splitStableToBalance(
    tx: Transaction,
    config: {
      primitivesPackageId: string;
      assetType: string;
      stableType: string;
      escrowId: string;
      balanceObj: ReturnType<Transaction['moveCall']> | ReturnType<Transaction['object']>;
      stableCoin: ReturnType<Transaction['moveCall']> | ReturnType<Transaction['splitCoins']>[number];
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.primitivesPackageId,
        'conditional_balance',
        'split_stable_to_balance'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.escrowId),
        config.balanceObj as ReturnType<Transaction['moveCall']>,
        config.stableCoin as ReturnType<Transaction['moveCall']>,
      ],
    });
  }

  /**
   * Atomically split spot asset to balance for ALL outcomes.
   *
   * Single call replaces the N-call pattern:
   * deposit → N×add_to_balance
   *
   * Maintains quantum invariant automatically.
   *
   * @param tx - Transaction
   * @param config - Split configuration
   * @returns Amount deposited (u64)
   */
  static splitAssetToBalance(
    tx: Transaction,
    config: {
      primitivesPackageId: string;
      assetType: string;
      stableType: string;
      escrowId: string;
      balanceObj: ReturnType<Transaction['moveCall']> | ReturnType<Transaction['object']>;
      assetCoin: ReturnType<Transaction['moveCall']> | ReturnType<Transaction['splitCoins']>[number];
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.primitivesPackageId,
        'conditional_balance',
        'split_asset_to_balance'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.escrowId),
        config.balanceObj as ReturnType<Transaction['moveCall']>,
        config.assetCoin as ReturnType<Transaction['moveCall']>,
      ],
    });
  }

  /**
   * Atomically recombine balance to spot stable.
   *
   * Requires equal balance across ALL outcomes (complete set requirement).
   * Single call replaces: N×sub_from_balance → withdraw pattern.
   *
   * Maintains quantum invariant automatically.
   *
   * @param tx - Transaction
   * @param config - Recombine configuration
   * @returns Spot stable coin
   *
   * @example
   * ```typescript
   * const stableCoin = ConditionalBalance.recombineToStable(tx, {
   *   primitivesPackageId,
   *   assetType,
   *   stableType,
   *   escrowId: "0xescrow...",
   *   balanceObj: balance,
   *   amount: 1000000000n,
   * });
   * tx.transferObjects([stableCoin], recipient);
   * ```
   */
  static recombineToStable(
    tx: Transaction,
    config: {
      primitivesPackageId: string;
      assetType: string;
      stableType: string;
      escrowId: string;
      balanceObj: ReturnType<Transaction['moveCall']> | ReturnType<Transaction['object']>;
      amount: bigint | number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.primitivesPackageId,
        'conditional_balance',
        'recombine_balance_to_stable'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.escrowId),
        config.balanceObj as ReturnType<Transaction['moveCall']>,
        tx.pure.u64(config.amount),
      ],
    });
  }

  /**
   * Atomically recombine balance to spot asset.
   *
   * Requires equal balance across ALL outcomes (complete set requirement).
   * Single call replaces: N×sub_from_balance → withdraw pattern.
   *
   * Maintains quantum invariant automatically.
   *
   * @param tx - Transaction
   * @param config - Recombine configuration
   * @returns Spot asset coin
   */
  static recombineToAsset(
    tx: Transaction,
    config: {
      primitivesPackageId: string;
      assetType: string;
      stableType: string;
      escrowId: string;
      balanceObj: ReturnType<Transaction['moveCall']> | ReturnType<Transaction['object']>;
      amount: bigint | number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.primitivesPackageId,
        'conditional_balance',
        'recombine_balance_to_asset'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.escrowId),
        config.balanceObj as ReturnType<Transaction['moveCall']>,
        tx.pure.u64(config.amount),
      ],
    });
  }

  /**
   * Burn complete set from balance and withdraw spot coins.
   *
   * Finds minimum balance across all outcomes and withdraws that amount.
   * Used after trading to exit positions.
   *
   * @param tx - Transaction
   * @param config - Burn configuration
   * @returns [amount, assetCoin, stableCoin] tuple
   *
   * @example
   * ```typescript
   * const [amount, assetCoin, stableCoin] = ConditionalBalance.burnCompleteSetAndWithdraw(tx, {
   *   primitivesPackageId,
   *   assetType,
   *   stableType,
   *   escrowId: "0xescrow...",
   *   balanceObj: balance,
   *   isAsset: true, // Withdraw as asset
   * });
   * ```
   */
  static burnCompleteSetAndWithdraw(
    tx: Transaction,
    config: {
      primitivesPackageId: string;
      assetType: string;
      stableType: string;
      escrowId: string;
      balanceObj: ReturnType<Transaction['moveCall']> | ReturnType<Transaction['object']>;
      isAsset: boolean;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.primitivesPackageId,
        'conditional_balance',
        'burn_complete_set_and_withdraw_from_balance'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.escrowId),
        config.balanceObj as ReturnType<Transaction['moveCall']>,
        tx.pure.bool(config.isAsset),
      ],
    });
  }

  /**
   * Unwrap balance to typed conditional coin
   *
   * Extracts amount from balance and converts to Coin<CondX<CoinType>>.
   * Used when user wants to use conditional coins in external DeFi.
   *
   * Emits BalanceUnwrapped event.
   *
   * @returns Coin object of the conditional type
   */
  static unwrapToCoin(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string; // e.g., "0xPKG::cond0_asset::COND0_ASSET"
      balanceObj: ReturnType<Transaction['moveCall']>;
      escrowId: string;
      outcomeIdx: number;
      isAsset: boolean;
      amount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'conditional_balance',
        'unwrap_to_coin'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [
        config.balanceObj,
        tx.object(config.escrowId),
        tx.pure.u8(config.outcomeIdx),
        tx.pure.bool(config.isAsset),
        tx.pure.u64(config.amount),
      ],
    });
  }

  /**
   * Wrap typed conditional coin back to balance
   *
   * Converts Coin<CondX<CoinType>> back to balance amount.
   * Opposite of unwrap_to_coin().
   *
   * Emits BalanceWrapped event.
   */
  static wrapCoin(
    tx: Transaction,
    config: {
      marketsPackageId: string;
      assetType: string;
      stableType: string;
      conditionalType: string;
      balanceObj: ReturnType<Transaction['moveCall']>;
      escrowId: string;
      coin: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
      isAsset: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsPackageId,
        'conditional_balance',
        'wrap_coin'
      ),
      typeArguments: [config.assetType, config.stableType, config.conditionalType],
      arguments: [
        config.balanceObj,
        tx.object(config.escrowId),
        config.coin,
        tx.pure.u8(config.outcomeIdx),
        tx.pure.bool(config.isAsset),
      ],
    });
  }
}
