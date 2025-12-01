/**
 * Proposal Workflow - High-level orchestrator for governance proposals
 *
 * Provides simple, user-friendly API for the entire proposal lifecycle:
 * 1. Create proposal
 * 2. Add actions to outcomes
 * 3. Advance through states (PREMARKET → REVIEW → TRADING)
 * 4. Perform swaps during trading
 * 5. Finalize proposal
 * 6. Execute winning outcome actions
 * 7. Redeem conditional tokens
 *
 * @module workflows/proposal-workflow
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { SuiClient } from '@mysten/sui/client';
import {
  CreateProposalConfig,
  AddProposalActionsConfig,
  AdvanceToReviewConfig,
  AdvanceToTradingConfig,
  FinalizeProposalConfig,
  ExecuteProposalActionsConfig,
  SpotSwapConfig,
  ConditionalSwapConfig,
  ActionConfig,
  WorkflowTransaction,
} from './types';
import { IntentExecutor, IntentExecutorPackages } from './intent-executor';

/**
 * Package IDs required for proposal workflow
 */
export interface ProposalWorkflowPackages extends IntentExecutorPackages {
  futarchyTypesPackageId: string;
  futarchyMarketsCorePackageId: string;
  futarchyMarketsPrimitivesPackageId: string;
  futarchyMarketsOperationsPackageId: string;
  futarchyGovernanceActionsPackageId: string;
  oneShotUtilsPackageId?: string;
}

/**
 * Shared object references
 */
export interface ProposalWorkflowSharedObjects {
  packageRegistryId: string;
  packageRegistrySharedVersion: number;
}

/**
 * Proposal Workflow - Complete governance proposal orchestration
 *
 * @example
 * ```typescript
 * const workflow = new ProposalWorkflow(client, packages, sharedObjects);
 *
 * // Create a proposal
 * const createTx = workflow.createProposal({
 *   daoAccountId: '0x...',
 *   assetType: '0x123::coin::COIN',
 *   stableType: '0x2::sui::SUI',
 *   title: 'Fund Team Development',
 *   introduction: 'Allocate funds for Q1 development',
 *   metadata: JSON.stringify({ category: 'funding' }),
 *   outcomeMessages: ['Reject', 'Accept'],
 *   outcomeDetails: ['Do nothing', 'Approve funding'],
 *   proposer: '0xABC',
 *   treasuryAddress: '0xTREASURY',
 *   usedQuota: false,
 *   feeCoins: ['0xCOIN1'],
 *   feeAmount: 1_000_000_000n,
 * });
 *
 * // Add actions to Accept outcome
 * const addActionsTx = workflow.addActionsToOutcome({
 *   proposalId: '0x...',
 *   assetType: '0x123::coin::COIN',
 *   stableType: '0x2::sui::SUI',
 *   outcomeIndex: 1,
 *   actions: [
 *     {
 *       type: 'create_stream',
 *       vaultName: 'treasury',
 *       beneficiary: '0xTEAM',
 *       amountPerIteration: 100_000_000n,
 *       ...
 *     },
 *   ],
 * });
 * ```
 */
export class ProposalWorkflow {
  private packages: ProposalWorkflowPackages;
  private sharedObjects: ProposalWorkflowSharedObjects;
  private intentExecutor: IntentExecutor;

  constructor(
    client: SuiClient,
    packages: ProposalWorkflowPackages,
    sharedObjects: ProposalWorkflowSharedObjects
  ) {
    this.packages = packages;
    this.sharedObjects = sharedObjects;
    this.intentExecutor = new IntentExecutor(client, packages);
  }

  // ============================================================================
  // STEP 1: CREATE PROPOSAL
  // ============================================================================

  /**
   * Create a new governance proposal
   */
  createProposal(config: CreateProposalConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const { futarchyMarketsCorePackageId, accountProtocolPackageId } = this.packages;

    // Merge fee coins if multiple provided
    const coinObjects = config.feeCoins.map((id) => tx.object(id));
    const [firstCoin, ...restCoins] = coinObjects;

    if (restCoins.length > 0) {
      tx.mergeCoins(firstCoin, restCoins);
    }

    // Split fee payment
    const [feePayment] = tx.splitCoins(firstCoin, [tx.pure.u64(config.feeAmount)]);

    // Create Option::None for vector<ActionSpec> (initial intent spec)
    const noneOption = tx.moveCall({
      target: '0x1::option::none',
      typeArguments: [`vector<${accountProtocolPackageId}::intents::ActionSpec>`],
      arguments: [],
    });

    tx.moveCall({
      target: `${futarchyMarketsCorePackageId}::proposal::new_premarket`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.daoAccountId),
        tx.pure.address(config.treasuryAddress),
        tx.pure.string(config.title),
        tx.pure.string(config.introduction),
        tx.pure.string(config.metadata),
        tx.pure.vector('string', config.outcomeMessages),
        tx.pure.vector('string', config.outcomeDetails),
        tx.pure.address(config.proposer),
        tx.pure.bool(config.usedQuota),
        feePayment,
        noneOption,
        tx.sharedObjectRef({
          objectId: clockId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // Return unused fee coins to sender
    tx.transferObjects([firstCoin], tx.pure.address(config.proposer));

    return {
      transaction: tx,
      description: 'Create governance proposal',
    };
  }

  // ============================================================================
  // STEP 2: ADD ACTIONS TO OUTCOME
  // ============================================================================

  /**
   * Add actions to a specific proposal outcome
   */
  addActionsToOutcome(config: AddProposalActionsConfig): WorkflowTransaction {
    const tx = new Transaction();

    const { accountActionsPackageId, futarchyMarketsCorePackageId } = this.packages;

    // Create action spec builder
    const builder = tx.moveCall({
      target: `${accountActionsPackageId}::action_spec_builder::new`,
      arguments: [],
    });

    // Add each action to the builder
    for (const action of config.actions) {
      this.addActionToBuilder(tx, builder, action);
    }

    // Convert builder to vector
    const specs = tx.moveCall({
      target: `${accountActionsPackageId}::action_spec_builder::into_vector`,
      arguments: [builder],
    });

    // Set intent spec for outcome
    tx.moveCall({
      target: `${futarchyMarketsCorePackageId}::proposal::set_intent_spec_for_outcome`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.proposalId),
        tx.pure.u64(config.outcomeIndex),
        specs,
        tx.pure.u64(config.maxActionsPerOutcome || 10),
      ],
    });

    return {
      transaction: tx,
      description: `Add ${config.actions.length} action(s) to outcome ${config.outcomeIndex}`,
    };
  }

  /**
   * Add an action configuration to the builder
   */
  private addActionToBuilder(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    action: ActionConfig
  ): void {
    const { accountActionsPackageId, futarchyActionsPackageId } = this.packages;

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

      // Launchpad-specific actions not typically used in proposals
      case 'return_treasury_cap':
      case 'return_metadata':
      case 'update_trading_params':
      case 'update_twap_config':
        throw new Error(`Action type '${action.type}' is not typically used in proposals`);

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  // ============================================================================
  // STEP 3: ADVANCE TO REVIEW STATE
  // ============================================================================

  /**
   * Create escrow, register conditional coins, and advance to REVIEW state
   *
   * This is a complex multi-step operation that:
   * 1. Takes conditional coins from registry (if available)
   * 2. Creates escrow for the market
   * 3. Registers conditional coin caps with escrow
   * 4. Creates conditional AMM pools
   * 5. Shares the escrow
   */
  advanceToReview(config: AdvanceToReviewConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const {
      futarchyMarketsCorePackageId,
      futarchyMarketsPrimitivesPackageId,
      oneShotUtilsPackageId,
    } = this.packages;

    // Track outcome caps for conditional coin registration
    // Using 'any' here due to complex Sui SDK TransactionResult types
    // that don't fully expose the nested result structure at compile time
    const outcomeCaps: Record<number, { asset?: any; stable?: any; assetType?: string; stableType?: string }> = {};

    // 1. Take conditional coins from registry if provided
    if (config.conditionalCoinsRegistry && config.conditionalCoinsRegistry.coinSets.length > 0 && oneShotUtilsPackageId) {
      const registryId = config.conditionalCoinsRegistry.registryId;
      let feeCoin: any = tx.splitCoins(tx.gas, [tx.pure.u64(0)]);

      for (const coinSet of config.conditionalCoinsRegistry.coinSets) {
        // Take asset conditional coin from registry using cap ID
        const assetResults: any = tx.moveCall({
          target: `${oneShotUtilsPackageId}::coin_registry::take_coin_set_for_ptb`,
          typeArguments: [coinSet.assetCoinType],
          arguments: [
            tx.object(registryId),
            tx.pure.id(coinSet.assetCapId),
            feeCoin,
            tx.sharedObjectRef({
              objectId: clockId,
              initialSharedVersion: 1,
              mutable: false,
            }),
          ],
        });

        outcomeCaps[coinSet.outcomeIndex] = outcomeCaps[coinSet.outcomeIndex] || {};
        outcomeCaps[coinSet.outcomeIndex].asset = assetResults;
        outcomeCaps[coinSet.outcomeIndex].assetType = coinSet.assetCoinType;
        feeCoin = assetResults[2];

        // Take stable conditional coin from registry using cap ID
        const stableResults: any = tx.moveCall({
          target: `${oneShotUtilsPackageId}::coin_registry::take_coin_set_for_ptb`,
          typeArguments: [coinSet.stableCoinType],
          arguments: [
            tx.object(registryId),
            tx.pure.id(coinSet.stableCapId),
            feeCoin,
            tx.sharedObjectRef({
              objectId: clockId,
              initialSharedVersion: 1,
              mutable: false,
            }),
          ],
        });

        outcomeCaps[coinSet.outcomeIndex].stable = stableResults;
        outcomeCaps[coinSet.outcomeIndex].stableType = coinSet.stableCoinType;
        feeCoin = stableResults[2];
      }

      // Transfer remaining fee coin back to sender
      tx.transferObjects([feeCoin], tx.pure.address(config.senderAddress));
    }

    // 2. Create escrow for market
    const escrow = tx.moveCall({
      target: `${futarchyMarketsCorePackageId}::proposal::create_escrow_for_market`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.proposalId),
        tx.sharedObjectRef({
          objectId: clockId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // 3. Register conditional caps with escrow (if we have them)
    if (config.conditionalCoinsRegistry && config.conditionalCoinsRegistry.coinSets.length > 0) {
      for (const coinSet of config.conditionalCoinsRegistry.coinSets) {
        const caps = outcomeCaps[coinSet.outcomeIndex];
        if (!caps?.asset || !caps?.stable) continue;

        // Register asset conditional coin
        tx.moveCall({
          target: `${futarchyMarketsCorePackageId}::proposal::add_conditional_coin_via_account`,
          typeArguments: [config.assetType, config.stableType, caps.assetType!],
          arguments: [
            tx.object(config.proposalId),
            tx.pure.u64(coinSet.outcomeIndex),
            tx.pure.bool(true), // is_asset
            caps.asset[0], // treasury cap
            caps.asset[1], // metadata
            tx.object(config.daoAccountId),
            tx.pure.string('ASSET'),
            tx.pure.string('STABLE'),
          ],
        });

        // Register stable conditional coin
        tx.moveCall({
          target: `${futarchyMarketsCorePackageId}::proposal::add_conditional_coin_via_account`,
          typeArguments: [config.assetType, config.stableType, caps.stableType!],
          arguments: [
            tx.object(config.proposalId),
            tx.pure.u64(coinSet.outcomeIndex),
            tx.pure.bool(false), // is_asset
            caps.stable[0], // treasury cap
            caps.stable[1], // metadata
            tx.object(config.daoAccountId),
            tx.pure.string('ASSET'),
            tx.pure.string('STABLE'),
          ],
        });

        // Register caps with escrow
        tx.moveCall({
          target: `${futarchyMarketsCorePackageId}::proposal::register_outcome_caps_with_escrow`,
          typeArguments: [
            config.assetType,
            config.stableType,
            caps.assetType!,
            caps.stableType!,
          ],
          arguments: [
            tx.object(config.proposalId),
            escrow,
            tx.pure.u64(coinSet.outcomeIndex),
          ],
        });
      }
    }

    // 4. Create conditional AMM pools
    tx.moveCall({
      target: `${futarchyMarketsCorePackageId}::proposal::create_conditional_amm_pools`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.proposalId),
        escrow,
        tx.object(config.spotPoolId),
        tx.sharedObjectRef({
          objectId: clockId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // 5. Get market_state_id and escrow_id for initialize_market_fields
    const marketStateId = tx.moveCall({
      target: `${futarchyMarketsPrimitivesPackageId}::coin_escrow::market_state_id`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [escrow],
    });

    const escrowId = tx.moveCall({
      target: '0x2::object::id',
      typeArguments: [
        `${futarchyMarketsPrimitivesPackageId}::coin_escrow::TokenEscrow<${config.assetType}, ${config.stableType}>`,
      ],
      arguments: [escrow],
    });

    // 6. Initialize market fields to advance proposal from PREMARKET to REVIEW
    // This sets market_initialized_at (critical for timing), market_state_id, escrow_id,
    // and liquidity_provider on the proposal, then advances state to REVIEW
    const clockRef = tx.sharedObjectRef({
      objectId: clockId,
      initialSharedVersion: 1,
      mutable: false,
    });
    const timestamp = tx.moveCall({
      target: '0x2::clock::timestamp_ms',
      arguments: [clockRef],
    });
    tx.moveCall({
      target: `${futarchyMarketsCorePackageId}::proposal::initialize_market_fields`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.proposalId),
        marketStateId,
        escrowId,
        timestamp,
        tx.pure.address(config.senderAddress),
      ],
    });

    // 7. Share the escrow
    tx.moveCall({
      target: '0x2::transfer::public_share_object',
      typeArguments: [
        `${futarchyMarketsPrimitivesPackageId}::coin_escrow::TokenEscrow<${config.assetType}, ${config.stableType}>`,
      ],
      arguments: [escrow],
    });

    return {
      transaction: tx,
      description: 'Create escrow and advance to REVIEW state',
    };
  }

  // ============================================================================
  // STEP 4: ADVANCE TO TRADING STATE
  // ============================================================================

  /**
   * Advance proposal from REVIEW to TRADING state
   *
   * This triggers 100% quantum split from spot pool to conditional AMMs
   */
  advanceToTrading(config: AdvanceToTradingConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const { futarchyGovernancePackageId } = this.packages;

    tx.moveCall({
      target: `${futarchyGovernancePackageId}::proposal_lifecycle::advance_proposal_state`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.daoAccountId),
        tx.object(config.proposalId),
        tx.object(config.escrowId),
        tx.object(config.spotPoolId),
        tx.sharedObjectRef({
          objectId: clockId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    return {
      transaction: tx,
      description: 'Advance to TRADING state (100% quantum split)',
    };
  }

  // ============================================================================
  // STEP 5: PERFORM SWAPS
  // ============================================================================

  /**
   * Execute a spot swap during an active proposal
   */
  spotSwap(config: SpotSwapConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const { futarchyMarketsOperationsPackageId, futarchyMarketsPrimitivesPackageId } =
      this.packages;

    // Merge input coins if multiple provided
    const coinObjects = config.inputCoins.map((id) => tx.object(id));
    const [firstCoin, ...restCoins] = coinObjects;

    if (restCoins.length > 0) {
      tx.mergeCoins(firstCoin, restCoins);
    }

    // Split input amount
    const [inputCoin] = tx.splitCoins(firstCoin, [tx.pure.u64(config.amountIn)]);

    // Create Option::None for existing balance
    const noneBalance = tx.moveCall({
      target: '0x1::option::none',
      typeArguments: [
        `${futarchyMarketsPrimitivesPackageId}::conditional_balance::ConditionalMarketBalance<${config.assetType}, ${config.stableType}>`,
      ],
      arguments: [],
    });

    // Execute swap
    const swapTarget =
      config.direction === 'stable_to_asset'
        ? `${futarchyMarketsOperationsPackageId}::swap_entry::swap_spot_stable_to_asset`
        : `${futarchyMarketsOperationsPackageId}::swap_entry::swap_spot_asset_to_stable`;

    const [outputOpt, balanceOpt] = tx.moveCall({
      target: swapTarget,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.spotPoolId),
        tx.object(config.proposalId || '0x0'), // Empty if no active proposal
        tx.object(config.escrowId || '0x0'), // Empty if no active proposal
        inputCoin,
        tx.pure.u64(config.minAmountOut),
        tx.pure.address(config.recipient),
        noneBalance,
        tx.pure.bool(false), // return_balance = false
        tx.sharedObjectRef({
          objectId: clockId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // Destroy empty options
    tx.moveCall({
      target: '0x1::option::destroy_none',
      typeArguments: [
        `0x2::coin::Coin<${config.direction === 'stable_to_asset' ? config.assetType : config.stableType}>`,
      ],
      arguments: [outputOpt],
    });

    tx.moveCall({
      target: '0x1::option::destroy_none',
      typeArguments: [
        `${futarchyMarketsPrimitivesPackageId}::conditional_balance::ConditionalMarketBalance<${config.assetType}, ${config.stableType}>`,
      ],
      arguments: [balanceOpt],
    });

    // Return remaining input coins
    tx.transferObjects([firstCoin], tx.pure.address(config.recipient));

    return {
      transaction: tx,
      description: `Spot swap ${config.direction}`,
    };
  }

  /**
   * Execute a conditional swap to buy tokens in a specific outcome market
   */
  conditionalSwap(config: ConditionalSwapConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const {
      futarchyMarketsOperationsPackageId,
      futarchyMarketsCorePackageId,
      futarchyMarketsPrimitivesPackageId,
    } = this.packages;

    // Merge input coins
    const coinObjects = config.stableCoins.map((id) => tx.object(id));
    const [firstCoin, ...restCoins] = coinObjects;

    if (restCoins.length > 0) {
      tx.mergeCoins(firstCoin, restCoins);
    }

    // Split input amount
    const [stableCoin] = tx.splitCoins(firstCoin, [tx.pure.u64(config.amountIn)]);

    // Start split stable progress
    let splitProgress = tx.moveCall({
      target: `${futarchyMarketsPrimitivesPackageId}::coin_escrow::start_split_stable_progress`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.escrowId), stableCoin],
    });

    // Split stable across all outcomes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stableCoinsByOutcome: Record<number, any> = {};

    // Sort outcomes by index to process in order
    const sortedOutcomes = [...config.allOutcomeCoins].sort((a, b) => a.outcomeIndex - b.outcomeIndex);

    for (const outcome of sortedOutcomes) {
      const result = tx.moveCall({
        target: `${futarchyMarketsPrimitivesPackageId}::coin_escrow::split_stable_progress_step`,
        typeArguments: [
          config.assetType,
          config.stableType,
          outcome.stableCoinType,
        ],
        arguments: [
          splitProgress,
          tx.object(config.escrowId),
          tx.pure.u8(outcome.outcomeIndex),
        ],
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      splitProgress = (result as any)[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stableCoinsByOutcome[outcome.outcomeIndex] = (result as any)[1];
    }

    // Finish split progress
    tx.moveCall({
      target: `${futarchyMarketsPrimitivesPackageId}::coin_escrow::finish_split_stable_progress`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [splitProgress, tx.object(config.escrowId)],
    });

    // Begin swap session
    const session = tx.moveCall({
      target: `${futarchyMarketsCorePackageId}::swap_core::begin_swap_session`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.escrowId)],
    });

    // Begin conditional swaps batch
    const batch = tx.moveCall({
      target: `${futarchyMarketsOperationsPackageId}::swap_entry::begin_conditional_swaps`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.escrowId)],
    });

    // Find the target outcome coin types
    const targetOutcome = config.allOutcomeCoins.find(o => o.outcomeIndex === config.outcomeIndex);
    if (!targetOutcome) {
      throw new Error(`No conditional coin types found for outcome ${config.outcomeIndex}`);
    }

    // Swap in the target outcome market
    const condStableInput = stableCoinsByOutcome[config.outcomeIndex];
    const swapResult = tx.moveCall({
      target: `${futarchyMarketsOperationsPackageId}::swap_entry::swap_in_batch`,
      typeArguments: [
        config.assetType,
        config.stableType,
        targetOutcome.stableCoinType,
        targetOutcome.assetCoinType,
      ],
      arguments: [
        batch,
        session,
        tx.object(config.escrowId),
        tx.pure.u8(config.outcomeIndex),
        condStableInput,
        tx.pure.bool(config.direction === 'asset_to_stable'),
        tx.pure.u64(config.minAmountOut),
        tx.sharedObjectRef({
          objectId: clockId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedBatch = (swapResult as any)[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const condOutputCoin = (swapResult as any)[1];

    // Finalize conditional swaps
    tx.moveCall({
      target: `${futarchyMarketsOperationsPackageId}::swap_entry::finalize_conditional_swaps`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        updatedBatch,
        tx.object(config.spotPoolId),
        tx.object(config.proposalId),
        tx.object(config.escrowId),
        session,
        tx.pure.address(config.recipient),
        tx.sharedObjectRef({
          objectId: clockId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // Transfer swapped output to recipient
    tx.transferObjects([condOutputCoin], tx.pure.address(config.recipient));

    // Transfer unused conditional stable from OTHER outcomes (not the swapped one)
    for (const outcome of sortedOutcomes) {
      if (outcome.outcomeIndex !== config.outcomeIndex) {
        const otherStable = stableCoinsByOutcome[outcome.outcomeIndex];
        if (otherStable) {
          tx.transferObjects([otherStable], tx.pure.address(config.recipient));
        }
      }
    }

    // Return remaining input coins
    tx.transferObjects([firstCoin], tx.pure.address(config.recipient));

    return {
      transaction: tx,
      description: `Conditional swap in outcome ${config.outcomeIndex}`,
    };
  }

  // ============================================================================
  // STEP 6: FINALIZE PROPOSAL
  // ============================================================================

  /**
   * Finalize proposal after trading period ends
   *
   * Determines winner via TWAP and auto-recombines winning liquidity to spot pool
   */
  finalizeProposal(config: FinalizeProposalConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    const { futarchyGovernancePackageId } = this.packages;
    const { packageRegistryId } = this.sharedObjects;

    tx.moveCall({
      target: `${futarchyGovernancePackageId}::proposal_lifecycle::finalize_proposal_with_spot_pool`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.daoAccountId),
        tx.object(packageRegistryId),
        tx.object(config.proposalId),
        tx.object(config.escrowId),
        tx.object(config.spotPoolId),
        tx.sharedObjectRef({
          objectId: clockId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    return {
      transaction: tx,
      description: 'Finalize proposal and determine winner',
    };
  }

  // ============================================================================
  // STEP 7: EXECUTE ACTIONS
  // ============================================================================

  /**
   * Execute actions for winning outcome
   */
  executeActions(config: ExecuteProposalActionsConfig): WorkflowTransaction {
    return this.intentExecutor.execute({
      intentType: 'proposal',
      accountId: config.daoAccountId,
      proposalId: config.proposalId,
      escrowId: config.escrowId,
      assetType: config.assetType,
      stableType: config.stableType,
      clockId: config.clockId,
      actions: config.actionTypes.map((at) => {
        switch (at.type) {
          case 'create_stream':
            return { action: 'create_stream' as const, coinType: at.coinType };
          case 'mint':
            return { action: 'mint' as const, coinType: at.coinType };
          case 'burn':
            return { action: 'burn' as const, coinType: at.coinType };
          case 'deposit':
            return { action: 'deposit' as const, coinType: at.coinType };
          case 'withdraw':
            return { action: 'withdraw' as const, coinType: at.coinType };
          case 'transfer':
            return { action: 'transfer' as const, objectType: at.objectType };
          case 'memo':
            return { action: 'memo' as const };
          default:
            throw new Error(`Unknown action type: ${(at as any).type}`);
        }
      }),
    });
  }

  // ============================================================================
  // STEP 8: REDEEM CONDITIONAL TOKENS
  // ============================================================================

  /**
   * Redeem winning conditional tokens for underlying assets
   */
  redeemConditionalTokens(
    proposalId: string,
    escrowId: string,
    assetType: string,
    stableType: string,
    conditionalCoinId: string,
    conditionalCoinType: string,
    outcomeIndex: number,
    isAsset: boolean,
    recipient: string,
    clockId?: string
  ): WorkflowTransaction {
    const tx = new Transaction();
    const clock = clockId || '0x6';

    const { futarchyMarketsOperationsPackageId } = this.packages;

    const redeemTarget = isAsset
      ? `${futarchyMarketsOperationsPackageId}::liquidity_interact::redeem_conditional_asset`
      : `${futarchyMarketsOperationsPackageId}::liquidity_interact::redeem_conditional_stable`;

    const redeemedCoin = tx.moveCall({
      target: redeemTarget,
      typeArguments: [assetType, stableType, conditionalCoinType],
      arguments: [
        tx.object(proposalId),
        tx.object(escrowId),
        tx.object(conditionalCoinId),
        tx.pure.u64(outcomeIndex),
        tx.sharedObjectRef({
          objectId: clock,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    tx.transferObjects([redeemedCoin], tx.pure.address(recipient));

    return {
      transaction: tx,
      description: `Redeem conditional ${isAsset ? 'asset' : 'stable'} tokens`,
    };
  }

  // ============================================================================
  // MAINTENANCE: JANITOR OPERATIONS
  // ============================================================================

  /**
   * Clean up expired intents and earn storage rebates
   *
   * Anyone can call this to clean up expired governance intents. The caller
   * receives storage rebates as a reward, making this a public good that's
   * economically incentivized.
   *
   * @param daoAccountId - The DAO account to clean up
   * @param maxToClean - Maximum intents to clean (up to 20)
   * @param clockId - Optional clock object ID
   *
   * @example
   * ```typescript
   * // Bot/keeper can call this to earn storage rebates
   * const cleanupTx = workflow.cleanupExpiredIntents(
   *   daoAccountId,
   *   10 // Clean up to 10 expired intents
   * );
   * ```
   */
  cleanupExpiredIntents(
    daoAccountId: string,
    maxToClean: number,
    clockId?: string
  ): WorkflowTransaction {
    const tx = new Transaction();
    const clock = clockId || '0x6';

    const { futarchyGovernanceActionsPackageId } = this.packages;
    const { packageRegistryId } = this.sharedObjects;

    tx.moveCall({
      target: `${futarchyGovernanceActionsPackageId}::intent_janitor::cleanup_expired_futarchy_intents`,
      arguments: [
        tx.object(daoAccountId),
        tx.object(packageRegistryId),
        tx.pure.u64(Math.min(maxToClean, 20)), // Cap at 20 per Move contract
        tx.object(clock),
      ],
    });

    return {
      transaction: tx,
      description: `Clean up to ${maxToClean} expired intents (with storage rebate reward)`,
    };
  }

  /**
   * Check if DAO maintenance is needed
   *
   * Emits a MaintenanceNeeded event if the DAO has more than 10 expired intents.
   * This is a view function used by bots/keepers to determine when cleanup is profitable.
   *
   * @param daoAccountId - The DAO account to check
   * @param clockId - Optional clock object ID
   */
  checkMaintenanceNeeded(
    daoAccountId: string,
    clockId?: string
  ): WorkflowTransaction {
    const tx = new Transaction();
    const clock = clockId || '0x6';

    const { futarchyGovernanceActionsPackageId } = this.packages;
    const { packageRegistryId } = this.sharedObjects;

    tx.moveCall({
      target: `${futarchyGovernanceActionsPackageId}::intent_janitor::check_maintenance_needed`,
      arguments: [
        tx.object(daoAccountId),
        tx.object(packageRegistryId),
        tx.object(clock),
      ],
    });

    return {
      transaction: tx,
      description: 'Check if DAO intent cleanup is needed',
    };
  }
}
