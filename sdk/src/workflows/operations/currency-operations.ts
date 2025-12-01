/**
 * Currency Operations - High-level currency/token management
 *
 * Provides simple, user-friendly API for managing DAO token operations.
 * Hides all complexity: package IDs, type arguments, auth patterns, etc.
 *
 * @module currency-operations
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { BaseTransactionBuilder, TransactionUtils } from '../../services/transaction';

/**
 * Configuration for CurrencyOperations
 */
export interface CurrencyOperationsConfig {
  client: SuiClient;
  accountActionsPackageId: string;
  futarchyCorePackageId: string;
  packageRegistryId: string;
}

/**
 * Coin metadata info
 */
export interface CoinMetadataInfo {
  name: string;
  symbol: string;
  description: string;
  iconUrl: string;
  decimals: number;
}

/**
 * High-level currency operations
 *
 * Note: Most currency operations require governance approval (via proposals).
 * Direct calls are only available for permissionless operations.
 *
 * @example
 * ```typescript
 * // Get token metadata
 * const metadata = await sdk.currency.getMetadata("0x123...", assetType);
 *
 * // Get total supply
 * const supply = await sdk.currency.getTotalSupply("0x123...", assetType);
 * ```
 */
export class CurrencyOperations {
  private client: SuiClient;
  private accountActionsPackageId: string;
  private packageRegistryId: string;
  private configType: string;

  constructor(config: CurrencyOperationsConfig) {
    this.client = config.client;
    this.accountActionsPackageId = config.accountActionsPackageId;
    this.packageRegistryId = config.packageRegistryId;
    this.configType = `${config.futarchyCorePackageId}::futarchy_config::FutarchyConfig`;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Extract coin type from a coin object ID
   */
  private async getCoinType(coinId: string): Promise<string> {
    const obj = await this.client.getObject({
      id: coinId,
      options: { showType: true },
    });

    if (!obj.data?.type) {
      throw new Error(`Could not determine type for coin: ${coinId}`);
    }

    // Extract type from "0x2::coin::Coin<TYPE>"
    const match = obj.data.type.match(/0x2::coin::Coin<(.+)>/);
    if (!match) {
      throw new Error(`Invalid coin type format: ${obj.data.type}`);
    }

    return match[1];
  }

  // ============================================================================
  // QUERIES (always available)
  // ============================================================================

  /**
   * Get coin metadata for a DAO's token
   *
   * @param daoId - DAO account ID
   * @param coinType - Full coin type path
   * @returns Coin metadata info
   *
   * @example
   * ```typescript
   * const metadata = await sdk.currency.getMetadata(
   *   "0x123...",
   *   "0xpkg::token::TOKEN"
   * );
   * console.log(metadata.name, metadata.symbol);
   * ```
   */
  async getMetadata(_daoId: string, _coinType: string): Promise<CoinMetadataInfo> {
    // This requires resolving dynamic fields to find CoinMetadata in managed assets
    throw new Error(
      'getMetadata is not yet implemented. ' +
      'Finding CoinMetadata requires dynamic field resolution. ' +
      'Consider using client.getCoinMetadata() for public coin metadata.'
    );
  }

  /**
   * Get total supply of a DAO's token
   *
   * @param daoId - DAO account ID
   * @param coinType - Full coin type path
   * @returns Total supply
   *
   * @example
   * ```typescript
   * const supply = await sdk.currency.getTotalSupply(
   *   "0x123...",
   *   "0xpkg::token::TOKEN"
   * );
   * ```
   */
  async getTotalSupply(_daoId: string, _coinType: string): Promise<bigint> {
    // This requires finding TreasuryCap in DAO's managed assets
    throw new Error(
      'getTotalSupply is not yet implemented. ' +
      'Finding TreasuryCap requires dynamic field resolution. ' +
      'Consider using client.getTotalSupply() for public supply data.'
    );
  }

  /**
   * Get decimals for a coin type
   *
   * @param coinType - Full coin type path
   * @returns Number of decimals
   */
  async getDecimals(coinType: string): Promise<number> {
    // Query CoinMetadata for the type
    const result = await this.client.getCoinMetadata({ coinType });
    return result?.decimals ?? 9;
  }

  // ============================================================================
  // BURN (permissionless for owned coins)
  // ============================================================================

  /**
   * Burn coins (permissionless)
   *
   * Anyone can burn their own coins. This is useful for deflationary mechanics.
   * The DAO must have the TreasuryCap stored.
   *
   * @param config - Burn configuration
   * @returns Transaction to execute
   *
   * @example
   * ```typescript
   * const tx = await sdk.currency.burn({
   *   daoId: "0x123...",
   *   coinId: "0xabc...",
   * });
   * ```
   */
  async burn(config: {
    daoId: string;
    coinId: string;
  }): Promise<Transaction> {
    // Auto-fetch coinType from coinId
    const coinType = await this.getCoinType(config.coinId);

    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    // Call permissionless burn
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.accountActionsPackageId,
        'currency',
        'burn_permissionless'
      ),
      typeArguments: [this.configType, coinType],
      arguments: [
        tx.object(config.daoId),
        tx.object(this.packageRegistryId),
        tx.object(config.coinId),
      ],
    });

    return tx;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Format amount with proper decimals
   *
   * @param amount - Raw amount (smallest unit)
   * @param decimals - Number of decimals
   * @returns Formatted string
   *
   * @example
   * ```typescript
   * const formatted = sdk.currency.formatAmount(1000000000n, 9);
   * // Returns "1.0"
   * ```
   */
  formatAmount(amount: bigint, decimals: number): string {
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;

    if (fraction === 0n) {
      return whole.toString();
    }

    const fractionStr = fraction.toString().padStart(decimals, '0');
    const trimmed = fractionStr.replace(/0+$/, '');
    return `${whole}.${trimmed}`;
  }

  /**
   * Parse amount from decimal string
   *
   * @param amountStr - Amount string (e.g., "1.5")
   * @param decimals - Number of decimals
   * @returns Raw amount in smallest unit
   *
   * @example
   * ```typescript
   * const raw = sdk.currency.parseAmount("1.5", 9);
   * // Returns 1500000000n
   * ```
   */
  parseAmount(amountStr: string, decimals: number): bigint {
    const [whole, fraction = ''] = amountStr.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(whole + paddedFraction);
  }
}
