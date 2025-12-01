/**
 * Intent Executor - Executes staged actions via PTB pattern
 *
 * Implements the 3-layer action execution pattern:
 * 1. begin_execution → creates Executable hot potato
 * 2. N × do_init_* calls → execute each action in order
 * 3. finalize_execution → confirms all actions executed
 *
 * This hides all the complexity of witnesses, type arguments, and PTB construction.
 *
 * @module workflows/intent-executor
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import {
  IntentExecutionConfig,
  IntentActionConfig,
  WorkflowTransaction,
} from './types';

/**
 * Package IDs required for intent execution
 */
export interface IntentExecutorPackages {
  accountActionsPackageId: string;
  accountProtocolPackageId: string;
  futarchyCorePackageId: string;
  futarchyActionsPackageId: string;
  futarchyFactoryPackageId: string;
  futarchyGovernancePackageId: string;
  futarchyGovernanceActionsPackageId: string;
  futarchyOracleActionsPackageId: string;
  packageRegistryId: string;
}

/**
 * Helper to construct metadata key types for different contexts
 */
export const MetadataKeyTypes = {
  /**
   * Construct a launchpad factory metadata key type
   * @param factoryPackageId - The factory package ID
   * @param coinType - The coin type
   */
  launchpad: (factoryPackageId: string, coinType: string): string =>
    `${factoryPackageId}::factory::CoinMetadataKey<${coinType}>`,

  /**
   * Construct a currency module metadata key type
   * @param accountActionsPackageId - The account actions package ID
   * @param coinType - The coin type
   */
  governance: (accountActionsPackageId: string, coinType: string): string =>
    `${accountActionsPackageId}::currency::CoinMetadataKey<${coinType}>`,
};

/**
 * Intent Executor - Builds PTBs for executing staged actions
 *
 * Supports all 60+ action types from the Futarchy protocol.
 *
 * @example
 * ```typescript
 * const executor = new IntentExecutor(client, packages);
 *
 * // Execute launchpad init actions
 * const tx = executor.execute({
 *   intentType: 'launchpad',
 *   accountId: '0x...',
 *   raiseId: '0x...',
 *   assetType: '0x123::coin::COIN',
 *   stableType: '0x2::sui::SUI',
 *   actions: [
 *     { action: 'create_stream', coinType: stableType },
 *     { action: 'create_pool_with_mint', assetType, stableType },
 *   ],
 * });
 *
 * // For return_metadata, use the helper to construct the keyType:
 * const keyType = MetadataKeyTypes.launchpad(packages.futarchyFactoryPackageId, assetType);
 * // ...actions: [{ action: 'return_metadata', coinType: assetType, keyType }]
 * ```
 */
export class IntentExecutor {
  private packages: IntentExecutorPackages;

  constructor(_client: SuiClient, packages: IntentExecutorPackages) {
    // Client kept for future use (async operations, object fetching)
    this.packages = packages;
  }

  /**
   * Execute a set of staged actions
   */
  execute(config: IntentExecutionConfig): WorkflowTransaction {
    const tx = new Transaction();
    const clockId = config.clockId || '0x6';

    if (config.intentType === 'launchpad') {
      return this.executeLaunchpadIntent(tx, config, clockId);
    } else {
      return this.executeProposalIntent(tx, config, clockId);
    }
  }

  /**
   * Execute launchpad init actions
   */
  private executeLaunchpadIntent(
    tx: Transaction,
    config: IntentExecutionConfig,
    clockId: string
  ): WorkflowTransaction {
    if (!config.raiseId) {
      throw new Error('raiseId is required for launchpad intent execution');
    }

    const {
      accountActionsPackageId,
      futarchyCorePackageId,
      futarchyFactoryPackageId,
      packageRegistryId,
    } = this.packages;

    // 1. Begin execution - creates Executable hot potato
    const executable = tx.moveCall({
      target: `${futarchyFactoryPackageId}::dao_init_executor::begin_execution_for_launchpad`,
      arguments: [
        tx.pure.id(config.raiseId),
        tx.object(config.accountId),
        tx.object(packageRegistryId),
        tx.object(clockId),
      ],
    });

    // Create witnesses
    const versionWitness = tx.moveCall({
      target: `${accountActionsPackageId}::version::current`,
      arguments: [],
    });

    const intentWitness = tx.moveCall({
      target: `${futarchyFactoryPackageId}::dao_init_executor::dao_init_intent_witness`,
      arguments: [],
    });

    // 2. Execute each action in order
    for (const action of config.actions) {
      this.executeAction(tx, executable, versionWitness, intentWitness, config, action, {
        configType: `${futarchyCorePackageId}::futarchy_config::FutarchyConfig`,
        outcomeType: `${futarchyFactoryPackageId}::dao_init_outcome::DaoInitOutcome`,
        witnessType: `${futarchyFactoryPackageId}::dao_init_executor::DaoInitIntent`,
        clockId,
      });
    }

    // 3. Finalize execution
    tx.moveCall({
      target: `${futarchyFactoryPackageId}::dao_init_executor::finalize_execution`,
      arguments: [
        tx.object(config.accountId),
        executable,
        tx.object(clockId),
      ],
    });

    return {
      transaction: tx,
      description: `Execute ${config.actions.length} launchpad init action(s)`,
    };
  }

  /**
   * Execute proposal actions
   */
  private executeProposalIntent(
    tx: Transaction,
    config: IntentExecutionConfig,
    clockId: string
  ): WorkflowTransaction {
    if (!config.proposalId || !config.escrowId) {
      throw new Error('proposalId and escrowId are required for proposal intent execution');
    }

    const {
      accountActionsPackageId,
      futarchyCorePackageId,
      futarchyGovernancePackageId,
      packageRegistryId,
    } = this.packages;

    // 1. Begin execution with escrow
    const executable = tx.moveCall({
      target: `${futarchyGovernancePackageId}::ptb_executor::begin_execution_with_escrow`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.accountId),
        tx.object(packageRegistryId),
        tx.object(config.proposalId),
        tx.object(config.escrowId),
        tx.object(clockId),
      ],
    });

    // Create witnesses
    const versionWitness = tx.moveCall({
      target: `${accountActionsPackageId}::version::current`,
      arguments: [],
    });

    const governanceWitness = tx.moveCall({
      target: `${futarchyCorePackageId}::futarchy_config::witness`,
      arguments: [],
    });

    // 2. Execute each action in order
    for (const action of config.actions) {
      this.executeAction(tx, executable, versionWitness, governanceWitness, config, action, {
        configType: `${futarchyCorePackageId}::futarchy_config::FutarchyConfig`,
        outcomeType: `${futarchyCorePackageId}::futarchy_config::FutarchyOutcome`,
        witnessType: `${futarchyCorePackageId}::futarchy_config::ConfigWitness`,
        clockId,
      });
    }

    // 3. Finalize execution
    tx.moveCall({
      target: `${futarchyGovernancePackageId}::ptb_executor::finalize_execution`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.accountId),
        tx.object(packageRegistryId),
        tx.object(config.proposalId),
        executable,
        tx.object(clockId),
      ],
    });

    return {
      transaction: tx,
      description: `Execute ${config.actions.length} proposal action(s)`,
    };
  }

  /**
   * Execute a single action within the intent
   */
  private executeAction(
    tx: Transaction,
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>,
    config: IntentExecutionConfig,
    action: IntentActionConfig,
    typeContext: {
      configType: string;
      outcomeType: string;
      witnessType: string;
      clockId: string;
    }
  ): void {
    const {
      accountActionsPackageId,
      futarchyActionsPackageId,
      futarchyGovernanceActionsPackageId,
      futarchyOracleActionsPackageId,
      packageRegistryId,
    } = this.packages;

    const { configType, outcomeType, witnessType, clockId } = typeContext;

    switch (action.action) {
      // =========================================================================
      // ACCOUNT ACTIONS - STREAM
      // =========================================================================
      case 'create_stream':
        tx.moveCall({
          target: `${accountActionsPackageId}::vault::do_init_create_stream`,
          typeArguments: [configType, outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            tx.object(clockId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'cancel_stream':
        // do_cancel_stream requires: executable, account, registry, clock, version, witness, ctx
        // vault_name is now read from ActionSpec (not passed as parameter)
        // Returns: (Coin<CoinType>, u64)
        tx.moveCall({
          target: `${accountActionsPackageId}::vault::do_cancel_stream`,
          typeArguments: [configType, outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            tx.object(clockId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      // =========================================================================
      // ACCOUNT ACTIONS - VAULT
      // =========================================================================
      case 'deposit':
        // do_init_deposit takes coin from executable_resources (deterministic!)
        // No coin parameter - coin comes from previous action via executable_resources
        tx.moveCall({
          target: `${accountActionsPackageId}::vault::do_init_deposit`,
          typeArguments: [configType, outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'spend':
        tx.moveCall({
          target: `${accountActionsPackageId}::vault::do_spend`,
          typeArguments: [configType, outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'withdraw':
        // For init contexts (launchpad/proposal), use do_init_withdraw_and_transfer
        // which withdraws from vault AND transfers to recipient in one action
        tx.moveCall({
          target: `${accountActionsPackageId}::vault::do_init_withdraw_and_transfer`,
          typeArguments: [configType, outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'approve_coin_type':
        tx.moveCall({
          target: `${accountActionsPackageId}::vault::do_approve_coin_type`,
          typeArguments: [configType, outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'remove_approved_coin_type':
        tx.moveCall({
          target: `${accountActionsPackageId}::vault::do_remove_approved_coin_type`,
          typeArguments: [configType, outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      // =========================================================================
      // ACCOUNT ACTIONS - CURRENCY
      // =========================================================================
      case 'mint':
        tx.moveCall({
          target: `${accountActionsPackageId}::currency::do_mint`,
          typeArguments: [outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'burn':
        // do_init_burn takes coin from executable_resources (deterministic!)
        // No coin parameter - coin comes from previous action via executable_resources
        tx.moveCall({
          target: `${accountActionsPackageId}::currency::do_init_burn`,
          typeArguments: [outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'disable_currency':
        tx.moveCall({
          target: `${accountActionsPackageId}::currency::do_disable`,
          typeArguments: [outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'update_currency':
        tx.moveCall({
          target: `${accountActionsPackageId}::currency::do_update`,
          typeArguments: [outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'return_treasury_cap':
        tx.moveCall({
          target: `${accountActionsPackageId}::currency::do_init_remove_treasury_cap`,
          typeArguments: [configType, outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'return_metadata': {
        // Determine the key type based on context
        // Launchpad uses factory::CoinMetadataKey, governance uses currency::CoinMetadataKey
        const keyType = action.keyType;

        // Create metadata key witness using the appropriate module
        const keyModule = keyType.includes('::factory::')
          ? this.packages.futarchyFactoryPackageId
          : accountActionsPackageId;

        const metadataKey = tx.moveCall({
          target: `${keyModule}::${keyType.includes('::factory::') ? 'factory' : 'currency'}::coin_metadata_key`,
          typeArguments: [action.coinType],
          arguments: [],
        });

        tx.moveCall({
          target: `${accountActionsPackageId}::currency::do_init_remove_metadata`,
          typeArguments: [
            configType,
            outcomeType,
            keyType,
            action.coinType,
            witnessType,
          ],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            metadataKey,
            versionWitness,
            intentWitness,
          ],
        });
        break;
      }

      // =========================================================================
      // ACCOUNT ACTIONS - TRANSFER
      // =========================================================================
      case 'transfer':
        // do_init_transfer takes object from executable_resources (deterministic!)
        // No object parameter - object comes from previous action via executable_resources
        tx.moveCall({
          target: `${accountActionsPackageId}::transfer::do_init_transfer`,
          typeArguments: [outcomeType, action.objectType, witnessType],
          arguments: [
            executable,
            intentWitness,
          ],
        });
        break;

      case 'transfer_to_sender':
        // do_init_transfer_to_sender takes object from executable_resources (deterministic!)
        // No object parameter - object comes from previous action via executable_resources
        tx.moveCall({
          target: `${accountActionsPackageId}::transfer::do_init_transfer_to_sender`,
          typeArguments: [outcomeType, action.objectType, witnessType],
          arguments: [
            executable,
            intentWitness,
          ],
        });
        break;

      // =========================================================================
      // ACCOUNT ACTIONS - PACKAGE UPGRADE
      // =========================================================================
      case 'upgrade_package':
        tx.moveCall({
          target: `${accountActionsPackageId}::package_upgrade::do_upgrade`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'commit_upgrade':
        // Use do_commit_dao_only for proposal/launchpad context (no commit cap)
        tx.moveCall({
          target: `${accountActionsPackageId}::package_upgrade::do_commit_dao_only`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'restrict_upgrade':
        tx.moveCall({
          target: `${accountActionsPackageId}::package_upgrade::do_restrict`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'create_commit_cap':
        tx.moveCall({
          target: `${accountActionsPackageId}::package_upgrade::do_create_commit_cap`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      // =========================================================================
      // ACCOUNT ACTIONS - ACCESS CONTROL
      // =========================================================================
      case 'borrow_access':
        tx.moveCall({
          target: `${accountActionsPackageId}::access_control::do_borrow`,
          typeArguments: [configType, outcomeType, action.capType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'return_access':
        tx.moveCall({
          target: `${accountActionsPackageId}::access_control::do_return`,
          typeArguments: [configType, outcomeType, action.capType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      // =========================================================================
      // ACCOUNT ACTIONS - MEMO
      // =========================================================================
      case 'memo':
        // do_emit_memo signature: (executable, account, intent_witness, clock, ctx)
        tx.moveCall({
          target: `${accountActionsPackageId}::memo::do_emit_memo`,
          typeArguments: [configType, outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      // =========================================================================
      // FUTARCHY CONFIG ACTIONS
      // =========================================================================
      case 'set_proposals_enabled':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_set_proposals_enabled`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'terminate_dao':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_terminate_dao`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_dao_name':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_update_name`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_trading_params':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_update_trading_params`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_dao_metadata':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_update_metadata`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_twap_config':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_update_twap_config`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_governance':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_update_governance`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_metadata_table':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_update_metadata_table`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_conditional_metadata':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_update_conditional_metadata`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_sponsorship_config':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::config_actions::do_update_sponsorship_config`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      // =========================================================================
      // FUTARCHY QUOTA ACTIONS
      // =========================================================================
      case 'set_quotas':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::quota_actions::do_set_quotas`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      // =========================================================================
      // FUTARCHY LIQUIDITY ACTIONS
      // =========================================================================
      case 'create_pool_with_mint':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::liquidity_init_actions::do_init_create_pool_with_mint`,
          typeArguments: [
            configType,
            outcomeType,
            action.assetType,
            action.stableType,
            witnessType,
          ],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            tx.object(clockId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      // NOTE: The following actions use ResourceRequest pattern and are NOT supported
      // in launchpad/proposal execution. They require separate PTB flows with fulfill_*:
      // - create_pool (use create_pool_with_mint instead)
      // - add_liquidity
      // - withdraw_lp_token
      // - remove_liquidity
      // - swap

      case 'update_pool_params':
        // This action is deterministic (no ResourceRequest)
        tx.moveCall({
          target: `${futarchyActionsPackageId}::liquidity_actions::do_update_pool_params`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            versionWitness,
            intentWitness,
          ],
        });
        break;

      case 'collect_fees':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::liquidity_actions::do_collect_fees`,
          typeArguments: [action.assetType, action.stableType, outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'withdraw_fees':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::liquidity_actions::do_withdraw_fees`,
          typeArguments: [action.assetType, action.stableType, outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      // =========================================================================
      // FUTARCHY DISSOLUTION ACTIONS
      // =========================================================================
      case 'create_dissolution_capability':
        tx.moveCall({
          target: `${futarchyActionsPackageId}::dissolution_actions::do_create_dissolution_capability`,
          typeArguments: [action.assetType, outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      // =========================================================================
      // GOVERNANCE ACTIONS - PACKAGE REGISTRY
      // =========================================================================
      case 'add_package':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::package_registry_actions::do_add_package`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'remove_package':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::package_registry_actions::do_remove_package`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_package_version':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::package_registry_actions::do_update_package_version`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_package_metadata':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::package_registry_actions::do_update_package_metadata`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'pause_account_creation':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::package_registry_actions::do_pause_account_creation`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'unpause_account_creation':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::package_registry_actions::do_unpause_account_creation`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      // =========================================================================
      // GOVERNANCE ACTIONS - PROTOCOL ADMIN
      // =========================================================================
      case 'set_factory_paused':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_set_factory_paused`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'disable_factory_permanently':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_disable_factory_permanently`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'add_stable_type':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_add_stable_type`,
          typeArguments: [outcomeType, witnessType, action.stableType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'remove_stable_type':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_remove_stable_type`,
          typeArguments: [outcomeType, witnessType, action.stableType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_dao_creation_fee':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_update_dao_creation_fee`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_proposal_fee':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_update_proposal_fee`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_verification_fee':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_update_verification_fee`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'add_verification_level':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_add_verification_level`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'remove_verification_level':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_remove_verification_level`,
          typeArguments: [outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'withdraw_fees_to_treasury':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_withdraw_fees_to_treasury`,
          typeArguments: [configType, outcomeType, action.coinType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'add_coin_fee_config':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_add_coin_fee_config`,
          typeArguments: [outcomeType, witnessType, action.coinType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_coin_creation_fee':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_update_coin_creation_fee`,
          typeArguments: [outcomeType, witnessType, action.coinType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'update_coin_proposal_fee':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_update_coin_proposal_fee`,
          typeArguments: [outcomeType, witnessType, action.coinType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'apply_pending_coin_fees':
        tx.moveCall({
          target: `${futarchyGovernanceActionsPackageId}::protocol_admin_actions::do_apply_pending_coin_fees`,
          typeArguments: [outcomeType, witnessType, action.coinType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      // =========================================================================
      // ORACLE ACTIONS
      // =========================================================================
      case 'create_oracle_grant':
        tx.moveCall({
          target: `${futarchyOracleActionsPackageId}::oracle_actions::do_create_oracle_grant`,
          typeArguments: [action.assetType, action.stableType, outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      case 'cancel_oracle_grant':
        tx.moveCall({
          target: `${futarchyOracleActionsPackageId}::oracle_actions::do_cancel_grant`,
          typeArguments: [action.assetType, action.stableType, outcomeType, witnessType],
          arguments: [
            executable,
            tx.object(config.accountId),
            tx.object(packageRegistryId),
            versionWitness,
            intentWitness,
            tx.object(clockId),
          ],
        });
        break;

      default:
        throw new Error(`Unknown action type: ${(action as { action: string }).action}`);
    }
  }
}
