/**
 * Markets/AMM Operations
 *
 * Trading operations for futarchy markets:
 * - Spot pool swaps (asset <-> stable)
 * - Conditional AMM swaps (outcome-specific trading)
 * - Liquidity provision/removal
 * - Position management (mint/burn/redeem conditional tokens)
 * - TWAP oracle operations
 *
 * @module markets
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { BaseTransactionBuilder, TransactionUtils } from './transaction';

export interface SwapConfig {
  poolId: string;
  assetType: string;
  stableType: string;
  amountIn: bigint | number;
  minOut: bigint | number;
}

export interface AddLiquidityConfig {
  poolId: string;
  assetType: string;
  stableType: string;
  assetAmount: bigint | number;
  stableAmount: bigint | number;
  minLpOut: bigint | number;
}

export interface RemoveLiquidityConfig {
  poolId: string;
  assetType: string;
  stableType: string;
  lpTokens: bigint | number;
  minAssetOut: bigint | number;
  minStableOut: bigint | number;
}

/**
 * AMM/Markets operations for trading and liquidity
 *
 * @example Swap in spot pool
 * ```typescript
 * const tx = sdk.markets.swapAssetForStable({
 *   poolId: spotPoolId,
 *   assetType,
 *   stableType,
 *   amountIn: 100_000_000n,
 *   minOut: 95_000_000n, // 5% slippage tolerance
 * });
 * ```
 */
export class MarketsOperations {
  private client: SuiClient;
  private marketsPackageId: string;

  constructor(client: SuiClient, marketsPackageId: string) {
    this.client = client;
    this.marketsPackageId = marketsPackageId;
  }

  /**
   * Swap asset tokens for stable tokens in spot pool
   *
   * @param config - Swap configuration
   * @returns Transaction for swap
   *
   * @example
   * ```typescript
   * const tx = sdk.markets.swapAssetForStable({
   *   poolId: spotPoolId,
   *   assetType: "0xPKG::coin::MYCOIN",
   *   stableType: "0x2::sui::SUI",
   *   amountIn: 100_000_000n, // 100 MYCOIN
   *   minOut: 95_000_000n, // At least 95 SUI (5% slippage)
   * });
   * ```
   */
  swapAssetForStable(config: SwapConfig): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'unified_spot_pool',
        'swap_asset_for_stable'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.poolId), // pool
        tx.pure.u64(config.amountIn), // asset_in
        tx.pure.u64(config.minOut), // min_stable_out
      ],
    });

    return tx;
  }

  /**
   * Swap stable tokens for asset tokens in spot pool
   *
   * @param config - Swap configuration
   * @returns Transaction for swap
   */
  swapStableForAsset(config: SwapConfig): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'unified_spot_pool',
        'swap_stable_for_asset'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.poolId), // pool
        tx.pure.u64(config.amountIn), // stable_in
        tx.pure.u64(config.minOut), // min_asset_out
      ],
    });

    return tx;
  }

  /**
   * Add liquidity to spot pool
   *
   * @param config - Liquidity configuration
   * @returns Transaction for adding liquidity
   *
   * @example
   * ```typescript
   * const tx = sdk.markets.addLiquidity({
   *   poolId: spotPoolId,
   *   assetType,
   *   stableType,
   *   assetAmount: 1_000_000_000n, // 1000 tokens
   *   stableAmount: 100_000_000n, // 100 stable
   *   minLpOut: 95_000_000n, // Min LP tokens (slippage protection)
   * });
   * ```
   */
  addLiquidity(config: AddLiquidityConfig): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'unified_spot_pool',
        'add_liquidity'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.poolId), // pool
        tx.pure.u64(config.assetAmount), // asset_amount
        tx.pure.u64(config.stableAmount), // stable_amount
        tx.pure.u64(config.minLpOut), // min_lp_out
      ],
    });

    return tx;
  }

  /**
   * Remove liquidity from spot pool
   *
   * @param config - Removal configuration
   * @returns Transaction for removing liquidity
   *
   * @example
   * ```typescript
   * const tx = sdk.markets.removeLiquidity({
   *   poolId: spotPoolId,
   *   assetType,
   *   stableType,
   *   lpTokens: 100_000_000n,
   *   minAssetOut: 95_000_000n,
   *   minStableOut: 9_500_000n,
   * });
   * ```
   */
  removeLiquidity(config: RemoveLiquidityConfig): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'unified_spot_pool',
        'remove_liquidity'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.poolId), // pool
        tx.pure.u64(config.lpTokens), // lp_tokens
        tx.pure.u64(config.minAssetOut), // min_asset_out
        tx.pure.u64(config.minStableOut), // min_stable_out
      ],
    });

    return tx;
  }

  /**
   * View: Get pool reserves
   *
   * @param poolId - Pool object ID
   * @returns Asset and stable reserves
   */
  async getReserves(poolId: string): Promise<{
    asset: bigint;
    stable: bigint;
  }> {
    const pool = await this.client.getObject({
      id: poolId,
      options: { showContent: true },
    });

    if (!pool.data?.content || pool.data.content.dataType !== 'moveObject') {
      throw new Error('Pool not found');
    }

    const fields = pool.data.content.fields as any;
    return {
      asset: BigInt(fields.asset_reserve || 0),
      stable: BigInt(fields.stable_reserve || 0),
    };
  }

  /**
   * View: Get current price (stable per asset)
   *
   * @param poolId - Pool object ID
   * @returns Price as bigint (stable/asset ratio)
   */
  async getPrice(poolId: string): Promise<bigint> {
    const reserves = await this.getReserves(poolId);
    if (reserves.asset === 0n) return 0n;
    return (reserves.stable * 1_000_000_000n) / reserves.asset;
  }

  /**
   * View: Get LP token supply
   *
   * @param poolId - Pool object ID
   * @returns Total LP token supply
   */
  async getLpTokenSupply(poolId: string): Promise<bigint> {
    const pool = await this.client.getObject({
      id: poolId,
      options: { showContent: true },
    });

    if (!pool.data?.content || pool.data.content.dataType !== 'moveObject') {
      throw new Error('Pool not found');
    }

    const fields = pool.data.content.fields as any;
    return BigInt(fields.lp_token_supply || 0);
  }

  /**
   * View: Get pool fee in basis points
   *
   * @param poolId - Pool object ID
   * @returns Fee in basis points (e.g., 30 = 0.3%)
   */
  async getTotalFeeBps(poolId: string): Promise<number> {
    const pool = await this.client.getObject({
      id: poolId,
      options: { showContent: true },
    });

    if (!pool.data?.content || pool.data.content.dataType !== 'moveObject') {
      throw new Error('Pool not found');
    }

    const fields = pool.data.content.fields as any;
    return Number(fields.total_fee_bps || 0);
  }

  /**
   * Helper: Calculate output amount for swap (with fee)
   *
   * Uses constant product formula: x * y = k
   * Fee is applied to input amount
   *
   * @param amountIn - Input amount
   * @param reserveIn - Input token reserve
   * @param reserveOut - Output token reserve
   * @param feeBps - Fee in basis points
   * @returns Output amount
   */
  static calculateSwapOutput(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    feeBps: number
  ): bigint {
    // Apply fee to input
    const amountInAfterFee = (amountIn * BigInt(10000 - feeBps)) / 10000n;

    // Constant product formula
    const numerator = amountInAfterFee * reserveOut;
    const denominator = reserveIn + amountInAfterFee;

    return numerator / denominator;
  }

  /**
   * Helper: Calculate price impact of swap
   *
   * @param amountIn - Input amount
   * @param reserveIn - Input token reserve
   * @param reserveOut - Output token reserve
   * @returns Price impact as percentage (e.g., 2.5 = 2.5%)
   */
  static calculatePriceImpact(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint
  ): number {
    const priceBefore = Number(reserveOut) / Number(reserveIn);
    const priceAfter =
      Number(reserveOut - this.calculateSwapOutput(amountIn, reserveIn, reserveOut, 0)) /
      Number(reserveIn + amountIn);

    return Math.abs(((priceAfter - priceBefore) / priceBefore) * 100);
  }
}

/**
 * TWAP Oracle operations
 *
 * Time-Weighted Average Price oracle for proposal resolution.
 *
 * @example Record observation
 * ```typescript
 * const tx = sdk.twap.recordObservation(marketStateId);
 * ```
 */
export class TWAPOperations {
  private client: SuiClient;
  private marketsPackageId: string;

  constructor(client: SuiClient, marketsPackageId: string) {
    this.client = client;
    this.marketsPackageId = marketsPackageId;
  }

  /**
   * Record a TWAP observation
   *
   * Should be called periodically during the trading period to
   * accumulate price data for the time-weighted average.
   *
   * @param marketStateId - Market state object ID
   * @param clock - Clock object
   * @returns Transaction for recording observation
   */
  recordObservation(marketStateId: string, clock: string = '0x6'): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'twap',
        'record_observation'
      ),
      arguments: [tx.object(marketStateId), tx.object(clock)],
    });

    return tx;
  }

  /**
   * View: Get current TWAP value
   *
   * @param marketStateId - Market state object ID
   * @returns Current TWAP value
   */
  async getCurrentTWAP(marketStateId: string): Promise<bigint> {
    const marketState = await this.client.getObject({
      id: marketStateId,
      options: { showContent: true },
    });

    if (
      !marketState.data?.content ||
      marketState.data.content.dataType !== 'moveObject'
    ) {
      throw new Error('Market state not found');
    }

    const fields = marketState.data.content.fields as any;
    return BigInt(fields.current_twap || 0);
  }

  /**
   * View: Get observation count
   *
   * @param marketStateId - Market state object ID
   * @returns Number of recorded observations
   */
  async getObservationCount(marketStateId: string): Promise<number> {
    const marketState = await this.client.getObject({
      id: marketStateId,
      options: { showContent: true },
    });

    if (
      !marketState.data?.content ||
      marketState.data.content.dataType !== 'moveObject'
    ) {
      throw new Error('Market state not found');
    }

    const fields = marketState.data.content.fields as any;
    return Number(fields.observation_count || 0);
  }
}
