/**
 * Transfer Init Actions
 *
 * Builders for transfer operations during initialization/intent staging.
 * Handles withdrawals, object transfers, and transfers to sender.
 *
 * @module transfer-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Transfer initialization action builders
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Withdraw and transfer to recipient
 * TransferInitActions.addWithdrawAndTransfer(tx, builder, actionsPackageId, {
 *   vaultName: 'treasury',
 *   amount: 1_000_000_000n,
 *   recipient: '0xRECIPIENT',
 *   coinType: '0x2::sui::SUI',
 * });
 * ```
 */
export class TransferInitActions {
  /**
   * Add action to withdraw from vault and transfer to recipient
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Transfer configuration
   */
  static addWithdrawAndTransfer(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      vaultName: string;
      amount: bigint | number;
      recipient: string;
      coinType: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::transfer_init_actions::add_withdraw_and_transfer_spec`,
      typeArguments: [config.coinType],
      arguments: [
        builder,
        tx.pure.string(config.vaultName),
        tx.pure.u64(config.amount),
        tx.pure.address(config.recipient),
      ],
    });
  }

  /**
   * Add action to transfer an object to recipient
   *
   * Transfers any owned object from the account to a recipient address.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Transfer configuration
   */
  static addTransferObject(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      recipient: string;
      objectType: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::transfer_init_actions::add_transfer_object_spec`,
      typeArguments: [config.objectType],
      arguments: [
        builder,
        tx.pure.address(config.recipient),
      ],
    });
  }

  /**
   * Add action to transfer object to transaction sender
   *
   * Transfers an owned object to whoever executes the intent.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Transfer configuration
   */
  static addTransferToSender(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      objectType: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::transfer_init_actions::add_transfer_to_sender_spec`,
      typeArguments: [config.objectType],
      arguments: [builder],
    });
  }
}
