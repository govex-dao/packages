/**
 * Markets Operations - High-level market interactions
 *
 * Provides simple, user-friendly API for swapping and liquidity.
 * Auto-fetches DAO info so users only need to provide daoId.
 *
 * @module markets-operations
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { BaseTransactionBuilder, TransactionUtils } from '../../services/transaction';
import { DAOInfoHelper } from './dao-info-helper';

/**
 * Configuration for MarketsHighLevelOperations
 */
export interface MarketsHighLevelConfig {
  client: SuiClient;
  marketsPackageId: string;
  marketsCorePackageId: string;
}

/**
 * Swap quote result
 */
export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number;
  fee: bigint;
}

/**
 * Pool reserves
 */
export interface PoolReserves {
  assetReserve: bigint;
  stableReserve: bigint;
  lpSupply: bigint;
}

/**
 * High-level market operations
 *
 * Users only need daoId - asset types and pool IDs are auto-fetched.
 *
 * @example
 * ```typescript
 * // Swap asset for stable
 * const tx = await sdk.marketsSimple.swapAssetForStable({
 *   daoId: "0x123...",
 *   amountIn: 1000n,
 *   minAmountOut: 950n,
 *   coinId: "0xmycoin...",
 * });
 *
 * // Add liquidity
 * const tx = await sdk.marketsSimple.addLiquidity({
 *   daoId: "0x123...",
 *   assetCoinId: "0xasset...",
 *   stableCoinId: "0xstable...",
 * });
 * ```
 */
export class MarketsHighLevelOperations {
  private client: SuiClient;
  private marketsPackageId: string;
  private marketsCorePackageId: string;
  private daoHelper: DAOInfoHelper;

  constructor(config: MarketsHighLevelConfig) {
    this.client = config.client;
    this.marketsPackageId = config.marketsPackageId;
    this.marketsCorePackageId = config.marketsCorePackageId;
    this.daoHelper = new DAOInfoHelper(config.client);
  }

  // ============================================================================
  // SWAPS
  // ============================================================================

  /**
   * Swap asset tokens for stable tokens
   *
   * @param config - Swap configuration
   * @returns Transaction to execute
   *
   * @example
   * ```typescript
   * const tx = await sdk.marketsSimple.swapAssetForStable({
   *   daoId: "0x123...",
   *   amountIn: 1000n,
   *   minAmountOut: 950n,
   *   coinId: "0xmycoin...",
   * });
   * ```
   */
  async swapAssetForStable(config: {
    daoId: string;
    amountIn: bigint;
    minAmountOut: bigint;
    coinId: string;
  }): Promise<Transaction> {
    const daoInfo = await this.daoHelper.getInfo(config.daoId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'swap_entry',
        'swap_asset_for_stable'
      ),
      typeArguments: [daoInfo.assetType, daoInfo.stableType],
      arguments: [
        tx.object(daoInfo.spotPoolId),
        tx.object(config.coinId),
        tx.pure.u64(config.minAmountOut),
        tx.object('0x6'), // clock
      ],
    });

    return tx;
  }

  /**
   * Swap stable tokens for asset tokens
   *
   * @param config - Swap configuration
   * @returns Transaction to execute
   */
  async swapStableForAsset(config: {
    daoId: string;
    amountIn: bigint;
    minAmountOut: bigint;
    coinId: string;
  }): Promise<Transaction> {
    const daoInfo = await this.daoHelper.getInfo(config.daoId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'swap_entry',
        'swap_stable_for_asset'
      ),
      typeArguments: [daoInfo.assetType, daoInfo.stableType],
      arguments: [
        tx.object(daoInfo.spotPoolId),
        tx.object(config.coinId),
        tx.pure.u64(config.minAmountOut),
        tx.object('0x6'), // clock
      ],
    });

    return tx;
  }

  /**
   * Swap with auto-split from gas (for SUI stable)
   *
   * Convenience method that splits SUI from gas and swaps.
   *
   * @param config - Swap configuration
   * @returns Transaction to execute
   */
  async swapSuiForAsset(config: {
    daoId: string;
    amountIn: bigint;
    minAmountOut: bigint;
  }): Promise<Transaction> {
    const daoInfo = await this.daoHelper.getInfo(config.daoId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    // Split SUI from gas
    const coin = builder.splitSui(config.amountIn);

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'swap_entry',
        'swap_stable_for_asset'
      ),
      typeArguments: [daoInfo.assetType, daoInfo.stableType],
      arguments: [
        tx.object(daoInfo.spotPoolId),
        coin,
        tx.pure.u64(config.minAmountOut),
        tx.object('0x6'), // clock
      ],
    });

    return tx;
  }

  // ============================================================================
  // LIQUIDITY
  // ============================================================================

  /**
   * Add liquidity to the spot pool
   *
   * @param config - Liquidity configuration
   * @returns Transaction to execute
   *
   * @example
   * ```typescript
   * const tx = await sdk.marketsSimple.addLiquidity({
   *   daoId: "0x123...",
   *   assetCoinId: "0xasset...",
   *   stableCoinId: "0xstable...",
   * });
   * ```
   */
  async addLiquidity(config: {
    daoId: string;
    assetCoinId: string;
    stableCoinId: string;
    minLpOut?: bigint;
  }): Promise<Transaction> {
    const daoInfo = await this.daoHelper.getInfo(config.daoId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'liquidity_interact',
        'add_liquidity_entry'
      ),
      typeArguments: [daoInfo.assetType, daoInfo.stableType],
      arguments: [
        tx.object(daoInfo.spotPoolId),
        tx.object(config.assetCoinId),
        tx.object(config.stableCoinId),
        tx.pure.u64(config.minLpOut || 0),
        tx.object('0x6'), // clock
      ],
    });

    return tx;
  }

  /**
   * Remove liquidity from the spot pool
   *
   * @param config - Liquidity configuration
   * @returns Transaction to execute
   */
  async removeLiquidity(config: {
    daoId: string;
    lpCoinId: string;
    minAssetOut?: bigint;
    minStableOut?: bigint;
  }): Promise<Transaction> {
    const daoInfo = await this.daoHelper.getInfo(config.daoId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.marketsPackageId,
        'liquidity_interact',
        'remove_liquidity_entry'
      ),
      typeArguments: [daoInfo.assetType, daoInfo.stableType],
      arguments: [
        tx.object(daoInfo.spotPoolId),
        tx.object(config.lpCoinId),
        tx.pure.u64(config.minAssetOut || 0),
        tx.pure.u64(config.minStableOut || 0),
        tx.object('0x6'), // clock
      ],
    });

    return tx;
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get current spot price (asset per stable)
   *
   * @param daoId - DAO account ID
   * @returns Price as bigint (scaled)
   */
  async getSpotPrice(daoId: string): Promise<bigint> {
    const daoInfo = await this.daoHelper.getInfo(daoId);

    const poolObj = await this.client.getObject({
      id: daoInfo.spotPoolId,
      options: { showContent: true },
    });

    if (!poolObj.data?.content || poolObj.data.content.dataType !== 'moveObject') {
      throw new Error(`Pool not found: ${daoInfo.spotPoolId}`);
    }

    const fields = poolObj.data.content.fields as any;
    const assetReserve = BigInt(fields.asset_reserve || 0);
    const stableReserve = BigInt(fields.stable_reserve || 0);

    if (assetReserve === 0n) return 0n;

    // Price = stable / asset (scaled by 1e9 for precision)
    return (stableReserve * 1_000_000_000n) / assetReserve;
  }

  /**
   * Get pool reserves
   *
   * @param daoId - DAO account ID
   * @returns Pool reserves
   */
  async getPoolReserves(daoId: string): Promise<PoolReserves> {
    const daoInfo = await this.daoHelper.getInfo(daoId);

    const poolObj = await this.client.getObject({
      id: daoInfo.spotPoolId,
      options: { showContent: true },
    });

    if (!poolObj.data?.content || poolObj.data.content.dataType !== 'moveObject') {
      throw new Error(`Pool not found: ${daoInfo.spotPoolId}`);
    }

    const fields = poolObj.data.content.fields as any;

    return {
      assetReserve: BigInt(fields.asset_reserve || 0),
      stableReserve: BigInt(fields.stable_reserve || 0),
      lpSupply: BigInt(fields.lp_supply || 0),
    };
  }

  /**
   * Get swap quote (estimate output amount)
   *
   * @param config - Quote configuration
   * @returns Swap quote
   */
  async getSwapQuote(config: {
    daoId: string;
    amountIn: bigint;
    assetToStable: boolean;
  }): Promise<SwapQuote> {
    const reserves = await this.getPoolReserves(config.daoId);

    const reserveIn = config.assetToStable ? reserves.assetReserve : reserves.stableReserve;
    const reserveOut = config.assetToStable ? reserves.stableReserve : reserves.assetReserve;

    // Constant product formula: (x + dx) * (y - dy) = x * y
    // dy = y * dx / (x + dx)
    // With 0.3% fee: dx_after_fee = dx * 997 / 1000
    const amountInAfterFee = (config.amountIn * 997n) / 1000n;
    const amountOut = (reserveOut * amountInAfterFee) / (reserveIn + amountInAfterFee);
    const fee = config.amountIn - amountInAfterFee;

    // Price impact = (1 - (amountOut/amountIn) / (reserveOut/reserveIn)) * 100
    const spotPrice = (reserveOut * 1_000_000n) / reserveIn;
    const execPrice = (amountOut * 1_000_000n) / config.amountIn;
    const priceImpact = spotPrice > 0n
      ? Number((spotPrice - execPrice) * 10000n / spotPrice) / 100
      : 0;

    return {
      amountIn: config.amountIn,
      amountOut,
      priceImpact,
      fee,
    };
  }

  /**
   * Get LP token balance for an address
   *
   * @param daoId - DAO account ID
   * @param owner - Owner address
   * @returns LP balance
   */
  async getLpBalance(daoId: string, owner: string): Promise<bigint> {
    const daoInfo = await this.daoHelper.getInfo(daoId);

    // Query owned LP tokens
    const objects = await this.client.getOwnedObjects({
      owner,
      filter: {
        StructType: `0x2::coin::Coin<${this.marketsCorePackageId}::unified_spot_pool::LP<${daoInfo.assetType}, ${daoInfo.stableType}>>`,
      },
      options: { showContent: true },
    });

    let total = 0n;
    for (const obj of objects.data) {
      if (obj.data?.content && obj.data.content.dataType === 'moveObject') {
        const fields = obj.data.content.fields as any;
        total += BigInt(fields.balance || 0);
      }
    }

    return total;
  }
}
