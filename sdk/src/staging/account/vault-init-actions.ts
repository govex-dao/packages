/**
 * Vault Init Actions
 *
 * Builders for vault operations during initialization/intent staging.
 * Handles deposits, spending, coin type approvals, and stream cancellation.
 *
 * @module vault-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Vault initialization action builders
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Deposit tokens into vault
 * VaultInitActions.addDeposit(tx, builder, actionsPackageId, {
 *   vaultName: 'treasury',
 *   amount: 1_000_000_000n,
 * });
 *
 * // Spend from vault
 * VaultInitActions.addSpend(tx, builder, actionsPackageId, {
 *   vaultName: 'treasury',
 *   amount: 500_000_000n,
 *   spendAll: false,
 * });
 * ```
 */
export class VaultInitActions {
  /**
   * Add action to deposit tokens into a vault
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Deposit configuration
   */
  static addDeposit(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      vaultName: string;
      amount: bigint | number;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::vault_init_actions::add_deposit_spec`,
      arguments: [
        builder,
        tx.pure.string(config.vaultName),
        tx.pure.u64(config.amount),
      ],
    });
  }

  /**
   * Add action to spend tokens from a vault
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Spend configuration
   */
  static addSpend(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      vaultName: string;
      amount: bigint | number;
      spendAll: boolean;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::vault_init_actions::add_spend_spec`,
      arguments: [
        builder,
        tx.pure.string(config.vaultName),
        tx.pure.u64(config.amount),
        tx.pure.bool(config.spendAll),
      ],
    });
  }

  /**
   * Add action to approve a coin type for a vault
   *
   * Allows the vault to hold a specific coin type.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Approval configuration
   */
  static addApproveCoinType(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      vaultName: string;
      coinType: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::vault_init_actions::add_approve_coin_type_spec`,
      typeArguments: [config.coinType],
      arguments: [
        builder,
        tx.pure.string(config.vaultName),
      ],
    });
  }

  /**
   * Add action to remove an approved coin type from a vault
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Removal configuration
   */
  static addRemoveApprovedCoinType(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      vaultName: string;
      coinType: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::vault_init_actions::add_remove_approved_coin_type_spec`,
      typeArguments: [config.coinType],
      arguments: [
        builder,
        tx.pure.string(config.vaultName),
      ],
    });
  }

  /**
   * Add action to cancel a stream
   *
   * Cancels an active payment stream and returns remaining funds to vault.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Cancellation configuration
   */
  static addCancelStream(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      vaultName: string;
      streamId: string;
      coinType: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::vault_init_actions::add_cancel_stream_spec`,
      typeArguments: [config.coinType],
      arguments: [
        builder,
        tx.pure.string(config.vaultName),
        tx.pure.id(config.streamId),
      ],
    });
  }
}
