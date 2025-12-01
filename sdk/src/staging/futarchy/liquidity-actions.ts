/**
 * Liquidity Actions
 *
 * Post-initialization liquidity management actions for DAO-owned AMM pools.
 * Supports pool creation, liquidity management, swaps, and fee operations.
 *
 * Categories:
 * - Pool Management: Create pools, update parameters
 * - Liquidity Operations: Add/remove liquidity
 * - LP Token Management: Withdraw tokens from custody
 * - Swaps: Token swaps in pools
 * - Fee Management: Collect and withdraw fees
 *
 * @module liquidity-actions
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Liquidity Action Markers
 *
 * Static utilities for getting action type markers.
 *
 * @example Get create pool marker
 * ```typescript
 * const marker = LiquidityActionMarkers.createPoolMarker(tx, futarchyActionsPackageId);
 * ```
 */
export class LiquidityActionMarkers {
  static createPoolMarker(
    tx: Transaction,
    futarchyActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        futarchyActionsPackageId,
        'liquidity_actions',
        'create_pool_marker'
      ),
      arguments: [],
    });
  }

  static updatePoolParamsMarker(
    tx: Transaction,
    futarchyActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        futarchyActionsPackageId,
        'liquidity_actions',
        'update_pool_params_marker'
      ),
      arguments: [],
    });
  }

  static addLiquidityMarker(
    tx: Transaction,
    futarchyActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        futarchyActionsPackageId,
        'liquidity_actions',
        'add_liquidity_marker'
      ),
      arguments: [],
    });
  }

  static withdrawLpTokenMarker(
    tx: Transaction,
    futarchyActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        futarchyActionsPackageId,
        'liquidity_actions',
        'withdraw_lp_token_marker'
      ),
      arguments: [],
    });
  }

  static removeLiquidityMarker(
    tx: Transaction,
    futarchyActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        futarchyActionsPackageId,
        'liquidity_actions',
        'remove_liquidity_marker'
      ),
      arguments: [],
    });
  }

  static swapMarker(
    tx: Transaction,
    futarchyActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        futarchyActionsPackageId,
        'liquidity_actions',
        'swap_marker'
      ),
      arguments: [],
    });
  }

  static collectFeesMarker(
    tx: Transaction,
    futarchyActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        futarchyActionsPackageId,
        'liquidity_actions',
        'collect_fees_marker'
      ),
      arguments: [],
    });
  }

  static withdrawFeesMarker(
    tx: Transaction,
    futarchyActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        futarchyActionsPackageId,
        'liquidity_actions',
        'withdraw_fees_marker'
      ),
      arguments: [],
    });
  }
}

/**
 * Liquidity Action Constructors
 *
 * Static utilities for creating action structs.
 *
 * @example Create pool action
 * ```typescript
 * const action = LiquidityActionConstructors.newCreatePoolAction(tx, {
 *   futarchyActionsPackageId,
 *   assetType,
 *   stableType,
 *   initialAssetAmount: 1000000000000n,
 *   initialStableAmount: 1000000000n,
 *   feeBps: 30,
 *   minimumLiquidity: 1000n,
 *   conditionalLiquidityRatioPercent: 50,
 * });
 * ```
 */
export class LiquidityActionConstructors {
  static newCreatePoolAction(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      assetType: string;
      stableType: string;
      initialAssetAmount: bigint;
      initialStableAmount: bigint;
      feeBps: number;
      minimumLiquidity: bigint;
      conditionalLiquidityRatioPercent: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'new_create_pool_action'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.u64(config.initialAssetAmount),
        tx.pure.u64(config.initialStableAmount),
        tx.pure.u64(config.feeBps),
        tx.pure.u64(config.minimumLiquidity),
        tx.pure.u64(config.conditionalLiquidityRatioPercent),
      ],
    });
  }

  static newUpdatePoolParamsAction(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      poolId: string;
      newFeeBps: number;
      newMinimumLiquidity: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'new_update_pool_params_action'
      ),
      arguments: [
        tx.pure.id(config.poolId),
        tx.pure.u64(config.newFeeBps),
        tx.pure.u64(config.newMinimumLiquidity),
      ],
    });
  }

  static newAddLiquidityAction(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      assetType: string;
      stableType: string;
      poolId: string;
      assetAmount: bigint;
      stableAmount: bigint;
      minLpOut: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'new_add_liquidity_action'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.id(config.poolId),
        tx.pure.u64(config.assetAmount),
        tx.pure.u64(config.stableAmount),
        tx.pure.u64(config.minLpOut),
      ],
    });
  }

  static newRemoveLiquidityAction(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      assetType: string;
      stableType: string;
      poolId: string;
      tokenId: string;
      lpAmount: bigint;
      minAssetAmount: bigint;
      minStableAmount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'new_remove_liquidity_action'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.id(config.poolId),
        tx.pure.id(config.tokenId),
        tx.pure.u64(config.lpAmount),
        tx.pure.u64(config.minAssetAmount),
        tx.pure.u64(config.minStableAmount),
      ],
    });
  }

  static newWithdrawLpTokenAction(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      assetType: string;
      stableType: string;
      poolId: string;
      tokenId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'new_withdraw_lp_token_action'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.pure.id(config.poolId), tx.pure.id(config.tokenId)],
    });
  }

  static newSwapAction(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      assetType: string;
      stableType: string;
      poolId: string;
      swapAsset: boolean;
      amountIn: bigint;
      minAmountOut: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'new_swap_action'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.id(config.poolId),
        tx.pure.bool(config.swapAsset),
        tx.pure.u64(config.amountIn),
        tx.pure.u64(config.minAmountOut),
      ],
    });
  }

  static newCollectFeesAction(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      assetType: string;
      stableType: string;
      poolId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'new_collect_fees_action'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.pure.id(config.poolId)],
    });
  }

  static newWithdrawFeesAction(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      assetType: string;
      stableType: string;
      poolId: string;
      assetAmount: bigint;
      stableAmount: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'new_withdraw_fees_action'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.pure.id(config.poolId),
        tx.pure.u64(config.assetAmount),
        tx.pure.u64(config.stableAmount),
      ],
    });
  }
}

/**
 * Liquidity Action Executors
 *
 * Static utilities for executing liquidity actions in PTB.
 *
 * @example Execute create pool action
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get executable from governance
 * const [executable, intentKey] = GovernanceIntents.executeProposalIntent(tx, {...});
 * const versionWitness = ...;
 * const intentWitness = ...;
 *
 * // Execute create pool
 * const request = LiquidityActionExecutors.doCreatePool(tx, {
 *   futarchyActionsPackageId,
 *   daoId,
 *   assetType,
 *   stableType,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, versionWitness, intentWitness);
 * ```
 */
export class LiquidityActionExecutors {
  static doCreatePool(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'do_create_pool'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        executable,
        tx.object(config.daoId),
        versionWitness,
        intentWitness,
      ],
    });
  }

  static doUpdatePoolParams(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'do_update_pool_params'
      ),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        versionWitness,
        intentWitness,
      ],
    });
  }

  static doAddLiquidity(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'do_add_liquidity'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
      ],
    });
  }

  static doWithdrawLpToken(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'do_withdraw_lp_token'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
      ],
    });
  }

  static doRemoveLiquidity(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'do_remove_liquidity'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        executable,
        tx.object(config.daoId),
        versionWitness,
        intentWitness,
      ],
    });
  }

  static doSwap(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'do_swap'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        executable,
        tx.object(config.daoId),
        versionWitness,
        intentWitness,
      ],
    });
  }

  static doCollectFees(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'do_collect_fees'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        executable,
        tx.object(config.daoId),
        versionWitness,
        intentWitness,
      ],
    });
  }

  static doWithdrawFees(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'do_withdraw_fees'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        executable,
        tx.object(config.daoId),
        versionWitness,
        intentWitness,
      ],
    });
  }
}

/**
 * Liquidity Action Fulfillment
 *
 * Static utilities for fulfilling resource requests from liquidity actions.
 *
 * @example Fulfill create pool request
 * ```typescript
 * const tx = new Transaction();
 *
 * // After doCreatePool returns a ResourceRequest
 * const [receipt, poolId] = LiquidityActionFulfillment.fulfillCreatePool(tx, {
 *   futarchyActionsPackageId,
 *   daoId,
 *   registryId,
 *   assetType,
 *   stableType,
 *   intentWitnessType,
 *   clock: '0x6',
 * }, request, assetCoin, stableCoin, intentWitness);
 * ```
 */
export class LiquidityActionFulfillment {
  static fulfillCreatePool(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      intentWitnessType: string;
      clock?: string;
    },
    request: ReturnType<Transaction['moveCall']>,
    assetCoin: ReturnType<Transaction['moveCall']>,
    stableCoin: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'fulfill_create_pool'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.intentWitnessType,
      ],
      arguments: [
        request,
        tx.object(config.daoId),
        tx.object(config.registryId),
        assetCoin,
        stableCoin,
        tx.object(config.clock || '0x6'),
        intentWitness,
      ],
    });
  }

  static fulfillAddLiquidity(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      registryId: string;
      poolId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    request: ReturnType<Transaction['moveCall']>,
    executable: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'fulfill_add_liquidity'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        request,
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        tx.object(config.poolId),
        intentWitness,
      ],
    });
  }

  static fulfillRemoveLiquidity(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      registryId: string;
      poolId: string;
      assetType: string;
      stableType: string;
      intentWitnessType: string;
    },
    request: ReturnType<Transaction['moveCall']>,
    lpToken: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'fulfill_remove_liquidity'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.intentWitnessType,
      ],
      arguments: [
        request,
        tx.object(config.daoId),
        tx.object(config.registryId),
        tx.object(config.poolId),
        lpToken,
        intentWitness,
      ],
    });
  }
}

/**
 * Liquidity Action Helpers
 *
 * Static utilities for special operations.
 *
 * @example Enable remove liquidity bypass
 * ```typescript
 * // When DAO is terminated, bypass minimum liquidity requirement
 * LiquidityActionHelpers.enableRemoveLiquidityBypass(tx, {
 *   futarchyActionsPackageId,
 *   daoId,
 *   registryId,
 *   assetType,
 *   stableType,
 * }, request);
 * ```
 */
export class LiquidityActionHelpers {
  static enableRemoveLiquidityBypass(
    tx: Transaction,
    config: {
      futarchyActionsPackageId: string;
      daoId: string;
      registryId: string;
      assetType: string;
      stableType: string;
    },
    request: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyActionsPackageId,
        'liquidity_actions',
        'enable_remove_liquidity_bypass'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [request, tx.object(config.daoId), tx.object(config.registryId)],
    });
  }
}

/**
 * Liquidity Action Getters
 *
 * Static utilities for reading action parameters.
 *
 * @example Read pool ID from AddLiquidityAction
 * ```typescript
 * const poolId = LiquidityActionGetters.getPoolId(tx, futarchyActionsPackageId, assetType, stableType, action);
 * ```
 */
export class LiquidityActionGetters {
  // AddLiquidityAction Getters
  static getPoolId(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_pool_id'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getAssetAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_asset_amount'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getStableAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_stable_amount'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getMinLpAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_min_lp_amount'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  // RemoveLiquidityAction Getters
  static getRemovePoolId(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_remove_pool_id'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getRemoveTokenId(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_remove_token_id'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getLpAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_lp_amount'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getMinAssetAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_min_asset_amount'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getMinStableAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_min_stable_amount'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getBypassMinimum(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_bypass_minimum'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  // WithdrawLpTokenAction Getters
  static getWithdrawPoolId(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_withdraw_pool_id'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getWithdrawTokenId(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_withdraw_token_id'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  // CreatePoolAction Getters
  static getInitialAssetAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_initial_asset_amount'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getInitialStableAmount(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_initial_stable_amount'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getFeeBps(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_fee_bps'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static getMinimumLiquidity(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_minimum_liquidity'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  // UpdatePoolParamsAction Getters
  static getUpdatePoolId(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_update_pool_id'),
      arguments: [action],
    });
  }

  static getNewFeeBps(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_new_fee_bps'),
      arguments: [action],
    });
  }

  static getNewMinimumLiquidity(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'get_new_minimum_liquidity'),
      arguments: [action],
    });
  }

  // LP Token Getter
  static lpValue(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    lpToken: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'lp_value'),
      typeArguments: [assetType, stableType],
      arguments: [lpToken],
    });
  }
}

/**
 * Liquidity Action Destroy Functions
 *
 * Static utilities for destroying action structs after use.
 *
 * @example Destroy CreatePoolAction
 * ```typescript
 * LiquidityActionDestroy.destroyCreatePoolAction(tx, futarchyActionsPackageId, assetType, stableType, action);
 * ```
 */
export class LiquidityActionDestroy {
  static destroyCreatePoolAction(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'destroy_create_pool_action'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static destroyUpdatePoolParamsAction(
    tx: Transaction,
    futarchyActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'destroy_update_pool_params_action'),
      arguments: [action],
    });
  }

  static destroyAddLiquidityAction(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'destroy_add_liquidity_action'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static destroyRemoveLiquidityAction(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'destroy_remove_liquidity_action'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static destroyWithdrawLpTokenAction(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'destroy_withdraw_lp_token_action'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static destroySwapAction(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'destroy_swap_action'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static destroyCollectFeesAction(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'destroy_collect_fees_action'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }

  static destroyWithdrawFeesAction(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'destroy_withdraw_fees_action'),
      typeArguments: [assetType, stableType],
      arguments: [action],
    });
  }
}

/**
 * Liquidity Action Delete Functions
 *
 * Static utilities for deleting expired action specs.
 *
 * @example Delete AddLiquidity from expired intent
 * ```typescript
 * LiquidityActionDelete.deleteAddLiquidity(tx, futarchyActionsPackageId, assetType, stableType, expired);
 * ```
 */
export class LiquidityActionDelete {
  static deleteAddLiquidity(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'delete_add_liquidity'),
      typeArguments: [assetType, stableType],
      arguments: [expired],
    });
  }

  static deleteWithdrawLpToken(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'delete_withdraw_lp_token'),
      typeArguments: [assetType, stableType],
      arguments: [expired],
    });
  }

  static deleteRemoveLiquidity(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'delete_remove_liquidity'),
      typeArguments: [assetType, stableType],
      arguments: [expired],
    });
  }

  static deleteCreatePool(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'delete_create_pool'),
      typeArguments: [assetType, stableType],
      arguments: [expired],
    });
  }

  static deleteUpdatePoolParams(
    tx: Transaction,
    futarchyActionsPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'delete_update_pool_params'),
      arguments: [expired],
    });
  }

  static deleteSwap(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'delete_swap'),
      typeArguments: [assetType, stableType],
      arguments: [expired],
    });
  }

  static deleteCollectFees(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'delete_collect_fees'),
      typeArguments: [assetType, stableType],
      arguments: [expired],
    });
  }

  static deleteWithdrawFees(
    tx: Transaction,
    futarchyActionsPackageId: string,
    assetType: string,
    stableType: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(futarchyActionsPackageId, 'liquidity_actions', 'delete_withdraw_fees'),
      typeArguments: [assetType, stableType],
      arguments: [expired],
    });
  }
}
