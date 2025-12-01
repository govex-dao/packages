/**
 * Launchpad Workflow - High-level orchestrator for token launches
 *
 * Provides simple, user-friendly API for the entire launchpad lifecycle:
 * 1. Create raise
 * 2. Stage success/failure actions
 * 3. Lock intents
 * 4. Contribute
 * 5. Complete raise
 * 6. Execute init actions
 * 7. Claim tokens
 *
 * @module workflows/launchpad-workflow
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { SuiClient } from '@mysten/sui/client';
import {
  CreateRaiseConfig,
  StageActionsConfig,
  ContributeConfig,
  CompleteRaiseConfig,
  ExecuteLaunchpadActionsConfig,
  ActionConfig,
  WorkflowTransaction,
} from './types';
import { IntentExecutor, IntentExecutorPackages } from './intent-executor';
// TransactionUtils may be used in future enhancements

/**
 * Package IDs required for launchpad workflow
 */
export interface LaunchpadWorkflowPackages extends IntentExecutorPackages {
  futarchyTypesPackageId: string;
  oneShotUtilsPackageId?: string;
}

/**
 * Shared object references
 */
export interface LaunchpadWorkflowSharedObjects {
  factoryId: string;
  factorySharedVersion: number;
  packageRegistryId: string;
  packageRegistrySharedVersion: number;
  feeManagerId: string;
  feeManagerSharedVersion: number;
}

/**
 * Launchpad Workflow - Complete token launch orchestration
 *
 * @example
 * ```typescript
 * const workflow = new LaunchpadWorkflow(client, packages, sharedObjects);
 *
 * // Create a raise
 * const createTx = workflow.createRaise({
 *   assetType: '0x123::coin::COIN',
 *   stableType: '0x2::sui::SUI',
 *   treasuryCap: '0xCAP',
 *   coinMetadata: '0xMETA',
 *   tokensForSale: 1_000_000n,
 *   minRaiseAmount: 100_000_000n,
 *   allowedCaps: [1_000_000n, 10_000_000n],
 *   allowEarlyCompletion: true,
 *   description: 'My token launch',
 *   launchpadFee: 100n,
 * });
 *
 * // Stage success actions
 * const stageTx = workflow.stageActions({
 *   raiseId: '0x...',
 *   creatorCapId: '0x...',
 *   assetType: '0x123::coin::COIN',
 *   stableType: '0x2::sui::SUI',
 *   outcome: 'success',
 *   actions: [
 *     {
 *       type: 'create_stream',
 *       vaultName: 'treasury',
 *       beneficiary: '0xABC',
 *       amountPerIteration: 50_000_000n,
 *       startTime: Date.now() + 300_000,
 *       iterationsTotal: 12n,
 *       iterationPeriodMs: 2_592_000_000n,
 *       maxPerWithdrawal: 50_000_000n,
 *       isTransferable: true,
 *       isCancellable: true,
 *     },
 *     {
 *       type: 'create_pool_with_mint',
 *       vaultName: 'treasury',
 *       assetAmount: 1_000_000_000n,
 *       stableAmount: 1_000_000_000n,
 *       feeBps: 30,
 *     },
 *   ],
 * });
 * ```
 */
export class LaunchpadWorkflow {
  private packages: LaunchpadWorkflowPackages;
  private sharedObjects: LaunchpadWorkflowSharedObjects;
  private intentExecutor: IntentExecutor;

  /** Unlimited cap constant for contribution tiers */
  static readonly UNLIMITED_CAP = 18446744073709551615n;

  constructor(
    client: SuiClient,
    packages: LaunchpadWorkflowPackages,
    sharedObjects: LaunchpadWorkflowSharedObjects
  ) {
    this.packages = packages;
    this.sharedObjects = sharedObjects;
    this.intentExecutor = new IntentExecutor(client, packages);
  }

  // ============================================================================
  // STEP 1: CREATE RAISE
  // ============================================================================

  /**
   * Create a new token raise
   */
  createRaise(config: CreateRaiseConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const { futarchyFactoryPackageId } = this.packages;
    const { factoryId, factorySharedVersion, feeManagerId, feeManagerSharedVersion } =
      this.sharedObjects;

    // Split launchpad fee from gas
    const [launchpadFeeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(config.launchpadFee)]);

    tx.moveCall({
      target: `${futarchyFactoryPackageId}::launchpad::create_raise`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        // 1. factory (immutable)
        tx.sharedObjectRef({
          objectId: factoryId,
          initialSharedVersion: factorySharedVersion,
          mutable: false,
        }),
        // 2. fee_manager (mutable)
        tx.sharedObjectRef({
          objectId: feeManagerId,
          initialSharedVersion: feeManagerSharedVersion,
          mutable: true,
        }),
        // 3. treasury_cap
        tx.object(config.treasuryCap),
        // 4. coin_metadata
        tx.object(config.coinMetadata),
        // 5. affiliate_id
        tx.pure.string(config.affiliateId || ''),
        // 6. tokens_for_sale
        tx.pure.u64(config.tokensForSale),
        // 7. min_raise_amount
        tx.pure.u64(config.minRaiseAmount),
        // 8. max_raise_amount (Option)
        tx.pure.option('u64', config.maxRaiseAmount ?? null),
        // 9. allowed_caps (vector)
        tx.pure.vector('u64', config.allowedCaps.map(c => c)),
        // 10. start_delay_ms (Option)
        tx.pure.option('u64', config.startDelayMs ?? null),
        // 11. allow_early_completion
        tx.pure.bool(config.allowEarlyCompletion),
        // 12. description
        tx.pure.string(config.description),
        // 13. metadata_keys (vector)
        tx.pure.vector('string', config.metadataKeys || []),
        // 14. metadata_values (vector)
        tx.pure.vector('string', config.metadataValues || []),
        // 15. launchpad_fee (Coin<SUI>)
        launchpadFeeCoin,
        // 16. extra_mint_to_caller
        tx.pure.u64(config.extraMintToCaller ?? 0),
        // 17. clock
        tx.object(clockId),
      ],
    });

    return {
      transaction: tx,
      description: 'Create token raise',
    };
  }

  // ============================================================================
  // STEP 2: STAGE ACTIONS
  // ============================================================================

  /**
   * Stage success or failure actions for a raise
   */
  stageActions(config: StageActionsConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const { accountActionsPackageId, futarchyFactoryPackageId } = this.packages;
    const { packageRegistryId } = this.sharedObjects;

    // Create action spec builder
    const builder = tx.moveCall({
      target: `${accountActionsPackageId}::action_spec_builder::new`,
      arguments: [],
    });

    // Add each action to the builder
    for (const action of config.actions) {
      this.addActionToBuilder(tx, builder, action, config);
    }

    // Stage as success or failure intent
    const stageTarget =
      config.outcome === 'success'
        ? `${futarchyFactoryPackageId}::launchpad::stage_success_intent`
        : `${futarchyFactoryPackageId}::launchpad::stage_failure_intent`;

    tx.moveCall({
      target: stageTarget,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.raiseId),
        tx.object(packageRegistryId),
        tx.object(config.creatorCapId),
        builder,
        tx.object(clockId),
      ],
    });

    return {
      transaction: tx,
      description: `Stage ${config.actions.length} ${config.outcome} action(s)`,
    };
  }

  /**
   * Add an action configuration to the builder
   */
  private addActionToBuilder(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    action: ActionConfig,
    _config: StageActionsConfig
  ): void {
    const { accountActionsPackageId, futarchyActionsPackageId, futarchyTypesPackageId } =
      this.packages;

    switch (action.type) {
      case 'create_stream':
        tx.moveCall({
          target: `${accountActionsPackageId}::stream_init_actions::add_create_stream_spec`,
          arguments: [
            builder,
            tx.pure.string(action.vaultName),
            tx.pure(bcs.Address.serialize(action.beneficiary).toBytes()),
            tx.pure.u64(action.amountPerIteration),
            tx.pure.u64(action.startTime),
            tx.pure.u64(action.iterationsTotal),
            tx.pure.u64(action.iterationPeriodMs),
            tx.pure.option('u64', action.cliffTime ?? null),
            tx.pure.option('u64', action.claimWindowMs ? Number(action.claimWindowMs) : null),
            tx.pure.u64(action.maxPerWithdrawal),
            tx.pure.bool(action.isTransferable),
            tx.pure.bool(action.isCancellable),
          ],
        });
        break;

      case 'create_pool_with_mint':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::liquidity_init_actions::add_create_pool_with_mint_spec`,
          arguments: [
            builder,
            tx.pure.string(action.vaultName),
            tx.pure.u64(action.assetAmount),
            tx.pure.u64(action.stableAmount),
            tx.pure.u64(action.feeBps),
          ],
        });
        break;

      case 'return_treasury_cap':
        tx.moveCall({
          target: `${accountActionsPackageId}::currency_init_actions::add_return_treasury_cap_spec`,
          arguments: [builder, tx.pure.address(action.recipient)],
        });
        break;

      case 'return_metadata':
        tx.moveCall({
          target: `${accountActionsPackageId}::currency_init_actions::add_return_metadata_spec`,
          arguments: [builder, tx.pure.address(action.recipient)],
        });
        break;

      case 'update_trading_params':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_init_actions::add_update_trading_params_spec`,
          arguments: [
            builder,
            tx.pure.option('u64', action.minAssetAmount ? Number(action.minAssetAmount) : null),
            tx.pure.option('u64', action.minStableAmount ? Number(action.minStableAmount) : null),
            tx.pure.option('u64', action.reviewPeriodMs ? Number(action.reviewPeriodMs) : null),
            tx.pure.option('u64', action.tradingPeriodMs ? Number(action.tradingPeriodMs) : null),
            tx.pure.option('u64', action.ammTotalFeeBps ?? null),
          ],
        });
        break;

      case 'update_twap_config':
        // Create SignedU128 for threshold if provided
        let thresholdOption: ReturnType<Transaction['moveCall']>;
        if (action.threshold !== undefined) {
          const signedThreshold = tx.moveCall({
            target: `${futarchyTypesPackageId}::signed::from_u128`,
            arguments: [tx.pure.u128(action.threshold)],
          });
          thresholdOption = tx.moveCall({
            target: '0x1::option::some',
            typeArguments: [`${futarchyTypesPackageId}::signed::SignedU128`],
            arguments: [signedThreshold],
          });
        } else {
          thresholdOption = tx.moveCall({
            target: '0x1::option::none',
            typeArguments: [`${futarchyTypesPackageId}::signed::SignedU128`],
            arguments: [],
          });
        }

        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_init_actions::add_update_twap_config_spec`,
          arguments: [
            builder,
            tx.pure.option('u64', action.startDelay ? Number(action.startDelay) : null),
            tx.pure.option('u64', action.stepMax ? Number(action.stepMax) : null),
            tx.pure.option('u128', action.initialObservation ?? null),
            thresholdOption,
          ],
        });
        break;

      case 'mint':
        tx.moveCall({
          target: `${accountActionsPackageId}::currency_init_actions::add_mint_spec`,
          arguments: [
            builder,
            tx.pure.u64(action.amount),
          ],
        });
        break;

      case 'burn':
        tx.moveCall({
          target: `${accountActionsPackageId}::currency_init_actions::add_burn_spec`,
          arguments: [
            builder,
            tx.pure.u64(action.amount),
          ],
        });
        break;

      case 'deposit':
        tx.moveCall({
          target: `${accountActionsPackageId}::vault_init_actions::add_deposit_spec`,
          arguments: [
            builder,
            tx.pure.string(action.vaultName),
            tx.pure.u64(action.amount),
          ],
        });
        break;

      case 'withdraw':
        // Use transfer_init_actions for withdraw+transfer combo
        tx.moveCall({
          target: `${accountActionsPackageId}::transfer_init_actions::add_withdraw_and_transfer_spec`,
          arguments: [
            builder,
            tx.pure.string(action.vaultName),
            tx.pure.u64(action.amount),
            tx.pure.address(action.recipient),
          ],
        });
        break;

      case 'transfer':
        tx.moveCall({
          target: `${accountActionsPackageId}::transfer_init_actions::add_transfer_object_spec`,
          arguments: [
            builder,
            tx.pure.address(action.recipient),
          ],
        });
        break;

      case 'memo':
        tx.moveCall({
          target: `${accountActionsPackageId}::memo_init_actions::add_emit_memo_spec`,
          arguments: [builder, tx.pure.string(action.message)],
        });
        break;

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  // ============================================================================
  // STEP 3: LOCK INTENTS
  // ============================================================================

  /**
   * Lock intents and start the raise (prevents further modifications)
   */
  lockIntentsAndStart(
    raiseId: string,
    creatorCapId: string,
    assetType: string,
    stableType: string
  ): WorkflowTransaction {
    const tx = new Transaction();

    const { futarchyFactoryPackageId } = this.packages;

    tx.moveCall({
      target: `${futarchyFactoryPackageId}::launchpad::lock_intents_and_start_raise`,
      typeArguments: [assetType, stableType],
      arguments: [tx.object(raiseId), tx.object(creatorCapId)],
    });

    return {
      transaction: tx,
      description: 'Lock intents and start raise',
    };
  }

  // ============================================================================
  // STEP 4: CONTRIBUTE
  // ============================================================================

  /**
   * Contribute to a raise
   */
  contribute(config: ContributeConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const { futarchyFactoryPackageId } = this.packages;
    const { factoryId, factorySharedVersion } = this.sharedObjects;

    // Merge coins if multiple provided
    const coinObjects = config.stableCoins.map((id) => tx.object(id));
    const [firstCoin, ...restCoins] = coinObjects;

    if (restCoins.length > 0) {
      tx.mergeCoins(firstCoin, restCoins);
    }

    // Split payment and crank fee
    const [paymentCoin] = tx.splitCoins(firstCoin, [tx.pure.u64(config.amount)]);
    const [crankFeeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(config.crankFee)]);

    tx.moveCall({
      target: `${futarchyFactoryPackageId}::launchpad::contribute`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.raiseId),
        tx.sharedObjectRef({
          objectId: factoryId,
          initialSharedVersion: factorySharedVersion,
          mutable: false,
        }),
        paymentCoin,
        tx.pure.u64(config.capTier),
        crankFeeCoin,
        tx.object(clockId),
      ],
    });

    // Note: Caller should handle returning leftover coins to sender
    // using tx.transferObjects([firstCoin], tx.pure.address(senderAddress))

    return {
      transaction: tx,
      description: `Contribute ${config.amount} to raise`,
    };
  }

  // ============================================================================
  // STEP 5: COMPLETE RAISE
  // ============================================================================

  /**
   * Complete a raise (settle, create DAO, finalize)
   */
  completeRaise(config: CompleteRaiseConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const { futarchyFactoryPackageId } = this.packages;
    const { factoryId, packageRegistryId } = this.sharedObjects;

    // 1. Settle raise
    tx.moveCall({
      target: `${futarchyFactoryPackageId}::launchpad::settle_raise`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.raiseId), tx.object(clockId)],
    });

    // 2. Begin DAO creation
    const unsharedDao = tx.moveCall({
      target: `${futarchyFactoryPackageId}::launchpad::begin_dao_creation`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.raiseId),
        tx.object(factoryId),
        tx.object(packageRegistryId),
        tx.object(clockId),
      ],
    });

    // 3. Finalize and share DAO (JIT conversion happens inside)
    tx.moveCall({
      target: `${futarchyFactoryPackageId}::launchpad::finalize_and_share_dao`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.raiseId),
        unsharedDao,
        tx.object(packageRegistryId),
        tx.object(clockId),
      ],
    });

    return {
      transaction: tx,
      description: 'Complete raise and create DAO',
    };
  }

  // ============================================================================
  // STEP 6: EXECUTE INIT ACTIONS
  // ============================================================================

  /**
   * Execute launchpad init actions
   */
  executeActions(config: ExecuteLaunchpadActionsConfig): WorkflowTransaction {
    return this.intentExecutor.execute({
      intentType: 'launchpad',
      accountId: config.accountId,
      raiseId: config.raiseId,
      assetType: config.assetType,
      stableType: config.stableType,
      clockId: config.clockId,
      actions: config.actionTypes.map((at) => {
        switch (at.type) {
          case 'create_stream':
            return { action: 'create_stream' as const, coinType: at.coinType };
          case 'create_pool_with_mint':
            return {
              action: 'create_pool_with_mint' as const,
              assetType: at.assetType,
              stableType: at.stableType,
            };
          case 'update_trading_params':
            return { action: 'update_trading_params' as const };
          case 'update_twap_config':
            return { action: 'update_twap_config' as const };
          case 'return_treasury_cap':
            return { action: 'return_treasury_cap' as const, coinType: at.coinType };
          case 'return_metadata':
            return {
              action: 'return_metadata' as const,
              coinType: at.coinType,
              keyType: `${this.packages.accountActionsPackageId}::currency::CoinMetadataKey<${at.coinType}>`,
            };
          default:
            throw new Error(`Unknown action type: ${(at as any).type}`);
        }
      }),
    });
  }

  // ============================================================================
  // STEP 7: CLAIM TOKENS
  // ============================================================================

  /**
   * Claim tokens from a completed raise
   */
  claimTokens(
    raiseId: string,
    assetType: string,
    stableType: string,
    clockId?: string
  ): WorkflowTransaction {
    const tx = new Transaction();
    const clock = clockId || '0x6';

    const { futarchyFactoryPackageId } = this.packages;

    tx.moveCall({
      target: `${futarchyFactoryPackageId}::launchpad::claim_tokens`,
      typeArguments: [assetType, stableType],
      arguments: [tx.object(raiseId), tx.object(clock)],
    });

    return {
      transaction: tx,
      description: 'Claim tokens from raise',
    };
  }

  // ============================================================================
  // CONVENIENCE: FULL FLOW HELPERS
  // ============================================================================

  /**
   * Create a raise with pre-staged success and failure actions
   *
   * This combines createRaise + stageActions (success) + stageActions (failure)
   * into a single transaction when possible, or returns multiple transactions
   * if they must be sequential.
   */
  createRaiseWithActions(
    raiseConfig: CreateRaiseConfig,
    successActions: ActionConfig[],
    failureActions: ActionConfig[],
    _creatorAddress?: string // Reserved for future use
  ): {
    createTx: WorkflowTransaction;
    stageSuccessTx: (raiseId: string, creatorCapId: string) => WorkflowTransaction;
    stageFailureTx: (raiseId: string, creatorCapId: string) => WorkflowTransaction;
    lockTx: (raiseId: string, creatorCapId: string) => WorkflowTransaction;
  } {
    const createTx = this.createRaise(raiseConfig);

    const stageSuccessTx = (raiseId: string, creatorCapId: string) =>
      this.stageActions({
        raiseId,
        creatorCapId,
        assetType: raiseConfig.assetType,
        stableType: raiseConfig.stableType,
        outcome: 'success',
        actions: successActions,
      });

    const stageFailureTx = (raiseId: string, creatorCapId: string) =>
      this.stageActions({
        raiseId,
        creatorCapId,
        assetType: raiseConfig.assetType,
        stableType: raiseConfig.stableType,
        outcome: 'failure',
        actions: failureActions,
      });

    const lockTx = (raiseId: string, creatorCapId: string) =>
      this.lockIntentsAndStart(
        raiseId,
        creatorCapId,
        raiseConfig.assetType,
        raiseConfig.stableType
      );

    return { createTx, stageSuccessTx, stageFailureTx, lockTx };
  }
}
