/**
 * Liquidity Init Actions (PTB Builder Pattern)
 *
 * Builders for creating AMM pools during DAO initialization.
 * Uses the action_spec_builder pattern for PTB construction.
 *
 * @module liquidity-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

export interface CreatePoolWithMintConfig {
  /** Vault name to pull stable coins from (e.g., "treasury") */
  vaultName: string;
  /** Amount of asset tokens to MINT (not from vault) */
  assetAmountToMint: bigint | number;
  /** Amount of stable tokens to pull from vault */
  stableAmountFromVault: bigint | number;
  /** AMM fee in basis points (e.g., 30 = 0.3%) */
  feeBps: number;
}

export interface CreatePoolConfig {
  /** Vault name to pull both tokens from */
  vaultName: string;
  /** Amount of asset tokens from vault */
  assetAmount: bigint | number;
  /** Amount of stable tokens from vault */
  stableAmount: bigint | number;
  /** AMM fee in basis points */
  feeBps: number;
}

/**
 * Liquidity pool initialization action builders
 *
 * These actions create AMM pools during DAO creation or via proposals.
 * Common use case: Create initial liquidity pool after successful launchpad raise.
 *
 * @example
 * ```typescript
 * // Success spec: Create pool when raise succeeds
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * LiquidityInitActions.addCreatePoolWithMint(tx, builder, futarchyActionsPkg, {
 *   vaultName: "treasury",
 *   assetAmountToMint: 1_000_000_000_000n, // Mint 1000 new tokens
 *   stableAmountFromVault: 1_000_000_000n, // Use 1 stable from raised funds
 *   feeBps: 30, // 0.3% swap fee
 * });
 *
 * // Stage as success intent
 * tx.moveCall({
 *   target: `${launchpadPkg}::launchpad::stage_success_intent`,
 *   typeArguments: [assetType, stableType],
 *   arguments: [raiseId, registryId, creatorCapId, builder, clock],
 * });
 * ```
 */
export class LiquidityInitActions {
  /**
   * Add action to create pool by minting asset + using vault stable
   *
   * This is the most common pattern for launchpad raises:
   * - Mint fresh asset tokens (requires TreasuryCap in DAO custody)
   * - Use stable coins from vault (from the raise)
   * - Create initial AMM pool with both
   * - LP token automatically saved to DAO custody
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Pool creation config
   *
   * @example
   * ```typescript
   * // Create pool with 1000 minted asset tokens + 1 stable from treasury
   * LiquidityInitActions.addCreatePoolWithMint(tx, builder, futarchyActionsPkg, {
   *   vaultName: "treasury",
   *   assetAmountToMint: 1_000_000_000_000n, // Mint 1000 tokens
   *   stableAmountFromVault: 1_000_000_000n, // 1 stable coin
   *   feeBps: 30, // 0.3% fee
   * });
   * ```
   */
  static addCreatePoolWithMint(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: CreatePoolWithMintConfig
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::liquidity_init_actions::add_create_pool_with_mint_spec`,
      arguments: [
        builder, // &mut Builder
        tx.pure.string(config.vaultName),
        tx.pure.u64(config.assetAmountToMint),
        tx.pure.u64(config.stableAmountFromVault),
        tx.pure.u64(config.feeBps),
      ],
    });
  }

  /**
   * Add action to create pool using tokens from vault (no minting)
   *
   * Use this when both asset and stable tokens are already in the vault.
   * Does NOT require TreasuryCap.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Pool creation config
   *
   * @example
   * ```typescript
   * // Create pool from existing vault balances
   * LiquidityInitActions.addCreatePoolFromVault(tx, builder, futarchyActionsPkg, {
   *   vaultName: "treasury",
   *   assetAmount: 500_000_000_000n,
   *   stableAmount: 500_000_000n,
   *   feeBps: 30,
   * });
   * ```
   */
  static addCreatePoolFromVault(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: CreatePoolConfig
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::liquidity_init_actions::add_create_pool_from_vault_spec`,
      arguments: [
        builder, // &mut Builder
        tx.pure.string(config.vaultName),
        tx.pure.u64(config.assetAmount),
        tx.pure.u64(config.stableAmount),
        tx.pure.u64(config.feeBps),
      ],
    });
  }

  /**
   * Add action to add liquidity to existing pool
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param futarchyActionsPackageId - Package ID for futarchy_actions
   * @param config - Liquidity addition config
   */
  static addLiquidityToPool(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    futarchyActionsPackageId: string,
    config: {
      vaultName: string;
      assetAmount: bigint | number;
      stableAmount: bigint | number;
      minLpOut: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${futarchyActionsPackageId}::liquidity_init_actions::add_liquidity_spec`,
      arguments: [
        builder,
        tx.pure.string(config.vaultName),
        tx.pure.u64(config.assetAmount),
        tx.pure.u64(config.stableAmount),
        tx.pure.u64(config.minLpOut),
      ],
    });
  }

  /**
   * Helper: Calculate initial price ratio
   *
   * @param assetAmount - Amount of asset tokens
   * @param stableAmount - Amount of stable tokens
   * @returns Price ratio (stable / asset)
   *
   * @example
   * ```typescript
   * const price = LiquidityInitActions.calculatePrice(
   *   1000n, // 1000 asset tokens
   *   100n   // 100 stable tokens
   * ); // Returns 0.1 (each asset token worth 0.1 stable)
   * ```
   */
  static calculatePrice(assetAmount: bigint, stableAmount: bigint): number {
    return Number(stableAmount) / Number(assetAmount);
  }

  /**
   * Helper: Calculate amounts for target price
   *
   * Given a total stable amount and target price, calculate how many
   * asset tokens to mint to achieve that price.
   *
   * @param stableAmount - Stable coins available
   * @param targetPrice - Desired price (stable per asset)
   * @returns Asset amount needed
   *
   * @example
   * ```typescript
   * // Want price of 0.01 (1 asset = 0.01 stable) with 100 stable
   * const assetAmount = LiquidityInitActions.calculateAssetForPrice(
   *   100n,  // 100 stable coins
   *   0.01   // Target price
   * ); // Returns 10000n (need 10000 asset tokens)
   * ```
   */
  static calculateAssetForPrice(
    stableAmount: bigint,
    targetPrice: number
  ): bigint {
    return BigInt(Math.floor(Number(stableAmount) / targetPrice));
  }
}
