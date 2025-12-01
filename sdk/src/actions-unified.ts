/**
 * Unified Actions Namespace
 *
 * Provides a clean, organized namespace for all action builders.
 * This replaces direct imports of individual action modules.
 *
 * @example
 * ```typescript
 * // Instead of:
 * import { StreamInitActions } from './lib/actions/stream-actions';
 * StreamInitActions.addCreateStreamSpec(tx, builder, ...);
 *
 * // Use:
 * sdk.actions.stream.addCreateStream(tx, builder, ...);
 * ```
 *
 * @module actions-unified
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

/**
 * Package IDs required for action builders
 */
export interface ActionsPackages {
  accountActionsPackageId: string;
  futarchyActionsPackageId: string;
  futarchyTypesPackageId: string;
  futarchyOracleActionsPackageId: string;
  futarchyGovernanceActionsPackageId: string;
  futarchyCorePackageId: string;
}

/**
 * Stream action builder
 */
export class StreamActions {
  constructor(private packages: ActionsPackages) {}

  /**
   * Add a create stream action spec to the builder
   */
  addCreateStream(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    config: {
      vaultName: string;
      beneficiary: string;
      amountPerIteration: bigint;
      startTime: number;
      iterationsTotal: bigint;
      iterationPeriodMs: bigint;
      cliffTime?: number;
      claimWindowMs?: bigint;
      maxPerWithdrawal: bigint;
      isTransferable: boolean;
      isCancellable: boolean;
    }
  ): void {
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::stream_init_actions::add_create_stream_spec`,
      arguments: [
        builder,
        tx.pure.string(config.vaultName),
        tx.pure(bcs.Address.serialize(config.beneficiary).toBytes()),
        tx.pure.u64(config.amountPerIteration),
        tx.pure.u64(config.startTime),
        tx.pure.u64(config.iterationsTotal),
        tx.pure.u64(config.iterationPeriodMs),
        tx.pure.option('u64', config.cliffTime ?? null),
        tx.pure.option('u64', config.claimWindowMs ? Number(config.claimWindowMs) : null),
        tx.pure.u64(config.maxPerWithdrawal),
        tx.pure.bool(config.isTransferable),
        tx.pure.bool(config.isCancellable),
      ],
    });
  }
}

/**
 * Currency action builder
 */
export class CurrencyActions {
  constructor(private packages: ActionsPackages) {}

  /**
   * Add a mint action spec
   * Note: The minted coin is returned to PTB for further handling at execution time
   */
  addMint(tx: Transaction, builder: ReturnType<Transaction['moveCall']>, amount: bigint): void {
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::currency_init_actions::add_mint_spec`,
      arguments: [builder, tx.pure.u64(amount)],
    });
  }

  /**
   * Add a burn action spec
   * Note: The coin to burn is passed at execution time
   */
  addBurn(tx: Transaction, builder: ReturnType<Transaction['moveCall']>, amount: bigint): void {
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::currency_init_actions::add_burn_spec`,
      arguments: [builder, tx.pure.u64(amount)],
    });
  }

  /**
   * Add a return treasury cap action spec
   */
  addReturnTreasuryCap(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    recipient: string
  ): void {
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::currency_init_actions::add_return_treasury_cap_spec`,
      arguments: [builder, tx.pure.address(recipient)],
    });
  }

  /**
   * Add a return metadata action spec
   */
  addReturnMetadata(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    recipient: string
  ): void {
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::currency_init_actions::add_return_metadata_spec`,
      arguments: [builder, tx.pure.address(recipient)],
    });
  }
}

/**
 * Liquidity action builder
 */
export class LiquidityActions {
  constructor(private packages: ActionsPackages) {}

  /**
   * Add a create pool with mint action spec
   */
  addCreatePoolWithMint(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    config: {
      vaultName: string;
      assetAmount: bigint;
      stableAmount: bigint;
      feeBps: number;
    }
  ): void {
    tx.moveCall({
      target: `${this.packages.futarchyActionsPackageId}::liquidity_init_actions::add_create_pool_with_mint_spec`,
      arguments: [
        builder,
        tx.pure.string(config.vaultName),
        tx.pure.u64(config.assetAmount),
        tx.pure.u64(config.stableAmount),
        tx.pure.u64(config.feeBps),
      ],
    });
  }
}

/**
 * Vault action builder
 */
export class VaultActions {
  constructor(private packages: ActionsPackages) {}

  /**
   * Add a deposit action spec
   */
  addDeposit(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    vaultName: string,
    amount: bigint
  ): void {
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::vault_init_actions::add_deposit_spec`,
      arguments: [builder, tx.pure.string(vaultName), tx.pure.u64(amount)],
    });
  }

  /**
   * Add a withdraw action spec (withdraw from vault + transfer to recipient)
   */
  addWithdraw(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    vaultName: string,
    amount: bigint,
    recipient: string
  ): void {
    // Use transfer_init_actions for withdraw+transfer combo
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::transfer_init_actions::add_withdraw_and_transfer_spec`,
      arguments: [
        builder,
        tx.pure.string(vaultName),
        tx.pure.u64(amount),
        tx.pure.address(recipient),
      ],
    });
  }
}

/**
 * Config action builder
 */
export class ConfigActions {
  constructor(private packages: ActionsPackages) {}

  /**
   * Add an update trading params action spec
   */
  addUpdateTradingParams(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    config: {
      minAssetAmount?: bigint;
      minStableAmount?: bigint;
      reviewPeriodMs?: bigint;
      tradingPeriodMs?: bigint;
      ammTotalFeeBps?: number;
    }
  ): void {
    tx.moveCall({
      target: `${this.packages.futarchyActionsPackageId}::config_init_actions::add_update_trading_params_spec`,
      arguments: [
        builder,
        tx.pure.option('u64', config.minAssetAmount ? Number(config.minAssetAmount) : null),
        tx.pure.option('u64', config.minStableAmount ? Number(config.minStableAmount) : null),
        tx.pure.option('u64', config.reviewPeriodMs ? Number(config.reviewPeriodMs) : null),
        tx.pure.option('u64', config.tradingPeriodMs ? Number(config.tradingPeriodMs) : null),
        tx.pure.option('u64', config.ammTotalFeeBps ?? null),
      ],
    });
  }

  /**
   * Add an update TWAP config action spec
   */
  addUpdateTwapConfig(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    config: {
      startDelay?: bigint;
      stepMax?: bigint;
      initialObservation?: bigint;
      threshold?: bigint;
    }
  ): void {
    let thresholdOption: ReturnType<Transaction['moveCall']>;
    if (config.threshold !== undefined) {
      const signedThreshold = tx.moveCall({
        target: `${this.packages.futarchyTypesPackageId}::signed::from_u128`,
        arguments: [tx.pure.u128(config.threshold)],
      });
      thresholdOption = tx.moveCall({
        target: '0x1::option::some',
        typeArguments: [`${this.packages.futarchyTypesPackageId}::signed::SignedU128`],
        arguments: [signedThreshold],
      });
    } else {
      thresholdOption = tx.moveCall({
        target: '0x1::option::none',
        typeArguments: [`${this.packages.futarchyTypesPackageId}::signed::SignedU128`],
        arguments: [],
      });
    }

    tx.moveCall({
      target: `${this.packages.futarchyActionsPackageId}::config_init_actions::add_update_twap_config_spec`,
      arguments: [
        builder,
        tx.pure.option('u64', config.startDelay ? Number(config.startDelay) : null),
        tx.pure.option('u64', config.stepMax ? Number(config.stepMax) : null),
        tx.pure.option('u128', config.initialObservation ?? null),
        thresholdOption,
      ],
    });
  }
}

/**
 * Transfer action builder
 */
export class TransferActions {
  constructor(private packages: ActionsPackages) {}

  /**
   * Add a transfer object action spec
   * Note: The object to transfer is passed at execution time
   */
  addTransfer(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    recipient: string
  ): void {
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::transfer_init_actions::add_transfer_object_spec`,
      arguments: [builder, tx.pure.address(recipient)],
    });
  }

  /**
   * Add a transfer to sender action spec
   * Transfers object to whoever executes the intent (cranker)
   */
  addTransferToSender(tx: Transaction, builder: ReturnType<Transaction['moveCall']>): void {
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::transfer_init_actions::add_transfer_to_sender_spec`,
      arguments: [builder],
    });
  }
}

/**
 * Memo action builder
 */
export class MemoActions {
  constructor(private packages: ActionsPackages) {}

  /**
   * Add a memo action spec
   */
  addMemo(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    message: string
  ): void {
    tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::memo_init_actions::add_emit_memo_spec`,
      arguments: [builder, tx.pure.string(message)],
    });
  }
}

/**
 * Action spec builder utilities
 */
export class ActionSpecBuilderUtils {
  constructor(private packages: ActionsPackages) {}

  /**
   * Create a new action spec builder
   */
  newBuilder(tx: Transaction): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::action_spec_builder::new`,
      arguments: [],
    });
  }

  /**
   * Convert builder to vector
   */
  intoVector(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: `${this.packages.accountActionsPackageId}::action_spec_builder::into_vector`,
      arguments: [builder],
    });
  }
}

/**
 * Unified Actions Namespace
 *
 * Organizes all action builders under a single, clean interface.
 */
export class UnifiedActions {
  public readonly stream: StreamActions;
  public readonly currency: CurrencyActions;
  public readonly liquidity: LiquidityActions;
  public readonly vault: VaultActions;
  public readonly config: ConfigActions;
  public readonly transfer: TransferActions;
  public readonly memo: MemoActions;
  public readonly builder: ActionSpecBuilderUtils;

  constructor(packages: ActionsPackages) {
    this.stream = new StreamActions(packages);
    this.currency = new CurrencyActions(packages);
    this.liquidity = new LiquidityActions(packages);
    this.vault = new VaultActions(packages);
    this.config = new ConfigActions(packages);
    this.transfer = new TransferActions(packages);
    this.memo = new MemoActions(packages);
    this.builder = new ActionSpecBuilderUtils(packages);
  }
}
