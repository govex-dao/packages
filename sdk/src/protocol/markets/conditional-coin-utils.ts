/**
 * Conditional Coin Utils Module
 *
 * Utilities for conditional tokens:
 * - Validation (treasury cap, supply checks)
 * - Metadata generation and updates for conditional coins
 * - Helper functions for building coin names/symbols
 *
 * Naming Pattern:
 * - Symbol: c_<outcome_index>_<BASE_SYMBOL> (e.g., "c_0_SUI", "c_1_USDC")
 * - Name: "Conditional <index>: <Base Name>" (e.g., "Conditional 0: Sui")
 * - Description: "Conditional token for outcome <index> backed by <Base Name>"
 *
 * @module conditional-coin-utils
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Conditional Coin Utils Static Functions
 *
 * Validation and metadata management for conditional tokens.
 */
export class ConditionalCoinUtils {
  // ============================================================================
  // Validation Functions
  // ============================================================================

  /**
   * Assert that a coin's total supply is zero
   *
   * Validates that treasury cap has no minted coins.
   * Used during initialization to ensure clean state.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static assertZeroSupply(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      conditionalCoinType: string;
      treasuryCap: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'conditional_coin_utils', 'assert_zero_supply'),
      typeArguments: [config.conditionalCoinType],
      arguments: [config.treasuryCap],
    });
  }

  /**
   * Check if supply is zero without aborting
   *
   * Returns boolean instead of asserting, allowing conditional logic.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns true if supply is zero
   */
  static isSupplyZero(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      conditionalCoinType: string;
      treasuryCap: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'conditional_coin_utils', 'is_supply_zero'),
      typeArguments: [config.conditionalCoinType],
      arguments: [config.treasuryCap],
    });
  }

  // ============================================================================
  // Metadata Update Functions
  // ============================================================================

  /**
   * Update conditional CoinMetadata with DAO naming pattern
   *
   * Pattern: c_<outcome_index>_<BASE_SYMBOL>
   * Uses TreasuryCap to update the owned CoinMetadata object.
   * Also copies the icon_url from the base metadata.
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ConditionalCoinUtils.updateConditionalMetadata(tx, {
   *   marketsCorePackageId,
   *   conditionalCoinType,
   *   treasuryCap,
   *   metadata,
   *   coinConfig,
   *   outcomeIndex: 0n,
   *   baseCoinName: "Sui",
   *   baseCoinSymbol: "SUI",
   *   baseIconUrl: "https://...",
   * });
   * ```
   */
  static updateConditionalMetadata(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      conditionalCoinType: string;
      treasuryCap: ReturnType<Transaction['moveCall']>;
      metadata: ReturnType<Transaction['moveCall']>;
      coinConfig: ReturnType<Transaction['moveCall']>;
      outcomeIndex: bigint;
      baseCoinName: string;
      baseCoinSymbol: string;
      baseIconUrl: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'conditional_coin_utils', 'update_conditional_metadata'),
      typeArguments: [config.conditionalCoinType],
      arguments: [
        config.treasuryCap,
        config.metadata,
        config.coinConfig,
        tx.pure.u64(config.outcomeIndex),
        tx.pure.string(config.baseCoinName),
        tx.pure.string(config.baseCoinSymbol),
        tx.pure.string(config.baseIconUrl),
      ],
    });
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Build conditional coin symbol as ASCII
   *
   * Pattern: prefix + outcome_index + _ + base_symbol
   * Example: "c_0_SUI", "c_1_USDC"
   *
   * Returns ASCII string for use with CoinMetadata pattern.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ASCII string
   */
  static buildConditionalSymbolAscii(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      coinConfig: ReturnType<Transaction['moveCall']>;
      outcomeIndex: bigint;
      baseCoinSymbol: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'conditional_coin_utils', 'build_conditional_symbol_ascii'),
      typeArguments: [],
      arguments: [
        config.coinConfig,
        tx.pure.u64(config.outcomeIndex),
        tx.pure.string(config.baseCoinSymbol),
      ],
    });
  }

  /**
   * Build conditional coin symbol as UTF-8
   *
   * Pattern: prefix + outcome_index + _ + base_symbol
   * Example: "c_0_SUI", "c_1_USDC"
   *
   * Returns UTF-8 string for logging/display.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns UTF-8 string
   */
  static buildConditionalSymbol(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      coinConfig: ReturnType<Transaction['moveCall']>;
      outcomeIndex: bigint;
      baseCoinSymbol: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'conditional_coin_utils', 'build_conditional_symbol'),
      typeArguments: [],
      arguments: [
        config.coinConfig,
        tx.pure.u64(config.outcomeIndex),
        tx.pure.string(config.baseCoinSymbol),
      ],
    });
  }

  /**
   * Build conditional coin name (human-readable)
   *
   * Example: "Conditional 0: Sui", "Conditional 1: USD Coin"
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns UTF-8 string
   */
  static buildConditionalName(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      outcomeIndex: bigint;
      baseCoinName: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'conditional_coin_utils', 'build_conditional_name'),
      typeArguments: [],
      arguments: [
        tx.pure.u64(config.outcomeIndex),
        tx.pure.string(config.baseCoinName),
      ],
    });
  }

  /**
   * Build conditional coin description
   *
   * Example: "Conditional token for outcome 0 backed by Sui"
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns UTF-8 string
   */
  static buildConditionalDescription(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      outcomeIndex: bigint;
      baseCoinName: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'conditional_coin_utils', 'build_conditional_description'),
      typeArguments: [],
      arguments: [
        tx.pure.u64(config.outcomeIndex),
        tx.pure.string(config.baseCoinName),
      ],
    });
  }

  /**
   * Convert u64 to UTF-8 string
   *
   * Used for building coin names and descriptions.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns UTF-8 byte vector
   */
  static u64ToString(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      num: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'conditional_coin_utils', 'u64_to_string'),
      typeArguments: [],
      arguments: [tx.pure.u64(config.num)],
    });
  }

  /**
   * Convert u64 to ASCII string
   *
   * Used for building coin symbols.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ASCII string
   */
  static u64ToAscii(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      num: bigint;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'conditional_coin_utils', 'u64_to_ascii'),
      typeArguments: [],
      arguments: [tx.pure.u64(config.num)],
    });
  }
}
