/**
 * LP Token Custody Module
 *
 * Manages LP tokens owned by DAOs from liquidity operations.
 * Uses Account's managed assets feature for secure custody.
 *
 * Benefits:
 * - Enforces custody under Account's policy engine
 * - Prevents accidental outflows or unauthorized transfers
 * - Explicit relationship between Account and LP tokens
 * - Integrates with Account's permission system
 * - Better tracking and audit capabilities
 *
 * @module lp-token-custody
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../../services/transaction';

/**
 * LP Token Custody Static Functions
 *
 * Secure custody of LP tokens using Account's managed assets.
 *
 * @example Deposit LP token
 * ```typescript
 * LPTokenCustody.depositLpToken(tx, {
 *   marketsOperationsPackageId,
 *   assetType,
 *   stableType,
 *   witnessType,
 *   account,
 *   registry,
 *   poolId: '0x...pool',
 *   token: lpToken,
 *   witness,
 * });
 * ```
 */
export class LPTokenCustody {
  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize LP token custody for an account
   *
   * Creates LP custody data structure if not already present.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static initCustody(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'init_custody'
      ),
      arguments: [config.account, config.registry],
    });
  }

  /**
   * Check if account has LP custody initialized
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns True if custody exists
   */
  static hasCustody(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'has_custody'
      ),
      arguments: [config.account],
    });
  }

  // ============================================================================
  // Deposit/Withdrawal
  // ============================================================================

  /**
   * Deposit LP token into custody (with witness auth)
   *
   * Stores LP token as managed asset in Account.
   * Requires witness for authorization.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositLpToken(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      witnessType: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
      poolId: string;
      token: ReturnType<Transaction['moveCall']>;
      witness: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'deposit_lp_token'
      ),
      typeArguments: [config.assetType, config.stableType, config.witnessType],
      arguments: [
        config.account,
        config.registry,
        tx.pure.id(config.poolId),
        config.token,
        config.witness,
      ],
    });
  }

  /**
   * Deposit LP token during init (works on unshared Accounts)
   *
   * Same as depositLpToken but bypasses auth checks.
   * Only callable during DAO initialization.
   *
   * @param tx - Transaction
   * @param config - Configuration
   */
  static depositLpTokenUnshared(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
      poolId: string;
      token: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'deposit_lp_token_unshared'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.account, config.registry, tx.pure.id(config.poolId), config.token],
    });
  }

  /**
   * Withdraw LP token from custody
   *
   * Retrieves LP token from managed assets.
   * Requires witness for authorization.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns LP token
   */
  static withdrawLpToken(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      assetType: string;
      stableType: string;
      witnessType: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
      poolId: string;
      tokenId: string;
      witness: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'withdraw_lp_token'
      ),
      typeArguments: [config.assetType, config.stableType, config.witnessType],
      arguments: [
        config.account,
        config.registry,
        tx.pure.id(config.poolId),
        tx.pure.id(config.tokenId),
        config.witness,
      ],
    });
  }

  // ============================================================================
  // Query Functions
  // ============================================================================

  /**
   * Get total value locked in LP tokens
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Total LP value
   */
  static getTotalValueLocked(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'get_total_value_locked'
      ),
      arguments: [config.account, config.registry],
    });
  }

  /**
   * Get LP token IDs for specific pool
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Vector of token IDs
   */
  static getPoolTokens(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
      poolId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'get_pool_tokens'
      ),
      arguments: [config.account, config.registry, tx.pure.id(config.poolId)],
    });
  }

  /**
   * Get amount for specific LP token
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Token amount
   */
  static getTokenAmount(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
      tokenId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'get_token_amount'
      ),
      arguments: [config.account, config.registry, tx.pure.id(config.tokenId)],
    });
  }

  /**
   * Get pool ID that contains specific LP token
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Option<ID> of pool
   */
  static getTokenPool(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
      tokenId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'get_token_pool'
      ),
      arguments: [config.account, config.registry, tx.pure.id(config.tokenId)],
    });
  }

  /**
   * Get total LP token amount for specific pool
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Pool total
   */
  static getPoolTotal(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
      poolId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'get_pool_total'
      ),
      arguments: [config.account, config.registry, tx.pure.id(config.poolId)],
    });
  }

  /**
   * Get all active pool IDs (pools with LP tokens)
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Vector of pool IDs
   */
  static getActivePools(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'get_active_pools'
      ),
      arguments: [config.account, config.registry],
    });
  }

  /**
   * Check if account has LP tokens for specific pool
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns True if has tokens
   */
  static hasTokensForPool(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
      poolId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'has_tokens_for_pool'
      ),
      arguments: [config.account, config.registry, tx.pure.id(config.poolId)],
    });
  }

  /**
   * Get summary statistics for all LP token holdings
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Tuple of (total_value_locked, active_pool_count, active_pools)
   */
  static getCustodySummary(
    tx: Transaction,
    config: {
      marketsOperationsPackageId: string;
      account: ReturnType<Transaction['moveCall']>;
      registry: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.marketsOperationsPackageId,
        'lp_token_custody',
        'get_custody_summary'
      ),
      arguments: [config.account, config.registry],
    });
  }
}
