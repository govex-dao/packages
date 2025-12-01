/**
 * Governance PTB Executor
 *
 * PTB (Programmable Transaction Block) execution helpers for Futarchy proposals.
 * Provides begin/finalize pattern for executing proposal actions in custom PTBs.
 *
 * @module governance-ptb-executor
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from './transaction';

/**
 * Governance PTB Executor
 *
 * Use this for advanced PTB composition where you need to execute proposal actions
 * with custom logic between begin and finalize steps.
 *
 * @example Execute proposal with custom logic
 * ```typescript
 * const tx = new Transaction();
 *
 * // Step 1: Begin execution
 * const [executable, intentKey] = GovernancePTBExecutor.beginExecution(tx, {
 *   governancePackageId,
 *   daoId,
 *   proposalId,
 *   marketStateId,
 *   registryId,
 *   assetType,
 *   stableType,
 * });
 *
 * // Step 2: Execute actions (custom logic here)
 * // The executable hot potato allows you to call do_init_* functions
 * // from account_actions package
 *
 * // Step 3: Finalize execution
 * GovernancePTBExecutor.finalizeExecution(tx, {
 *   governancePackageId,
 *   daoId,
 *   proposalId,
 *   registryId,
 *   assetType,
 *   stableType,
 * }, executable);
 * ```
 */
export class GovernancePTBExecutor {
  /**
   * Begin execution of proposal actions (Step 1 of 3)
   *
   * Creates an Executable hot potato that must be consumed by finalizeExecution.
   * Between begin and finalize, you can call do_init_* actions.
   *
   * Requirements:
   * - Proposal must be finalized
   * - Outcome 1 (Accept/Yes) must have won (Outcome 0 = Reject/No)
   *
   * @param tx - Transaction to add the call to
   * @param config - Execution configuration
   * @returns TransactionArgument tuple [Executable, intent_key: String]
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * const [executable, intentKey] = GovernancePTBExecutor.beginExecution(tx, {
   *   governancePackageId,
   *   daoId,
   *   proposalId,
   *   marketStateId,
   *   registryId,
   *   assetType,
   *   stableType,
   *   clock: '0x6',
   * });
   * ```
   */
  static beginExecution(
    tx: Transaction,
    config: {
      governancePackageId: string;
      daoId: string;
      proposalId: string;
      marketStateId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'ptb_executor',
        'begin_execution'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.daoId), // account
        tx.object(config.registryId), // registry
        tx.object(config.proposalId), // proposal
        tx.object(config.marketStateId), // market
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }

  /**
   * Begin execution using escrow reference (alternative to beginExecution)
   *
   * This variant extracts MarketState from the TokenEscrow internally,
   * avoiding object reference conflicts in complex PTBs where you already
   * have the escrow reference.
   *
   * @param tx - Transaction to add the call to
   * @param config - Execution configuration with escrowId instead of marketStateId
   * @returns TransactionArgument for Executable hot potato
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * // Use when you have escrow reference and want to avoid PTB reference issues
   * const executable = GovernancePTBExecutor.beginExecutionWithEscrow(tx, {
   *   governancePackageId,
   *   daoId,
   *   proposalId,
   *   escrowId,
   *   registryId,
   *   assetType,
   *   stableType,
   *   clock: '0x6',
   * });
   * ```
   */
  static beginExecutionWithEscrow(
    tx: Transaction,
    config: {
      governancePackageId: string;
      daoId: string;
      proposalId: string;
      escrowId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'ptb_executor',
        'begin_execution_with_escrow'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.daoId), // account
        tx.object(config.registryId), // registry
        tx.object(config.proposalId), // proposal
        tx.object(config.escrowId), // escrow
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }

  /**
   * Finalize execution of proposal actions (Step 3 of 3)
   *
   * Consumes the Executable hot potato and confirms all actions were executed.
   * Emits ProposalIntentExecuted event.
   *
   * @param tx - Transaction to add the call to
   * @param config - Execution configuration
   * @param executable - The Executable hot potato from beginExecution
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * // After begin_execution and do_init_* calls
   * GovernancePTBExecutor.finalizeExecution(tx, {
   *   governancePackageId,
   *   daoId,
   *   proposalId,
   *   registryId,
   *   assetType,
   *   stableType,
   *   clock: '0x6',
   * }, executable);
   * ```
   */
  static finalizeExecution(
    tx: Transaction,
    config: {
      governancePackageId: string;
      daoId: string;
      proposalId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'ptb_executor',
        'finalize_execution'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.daoId), // account
        tx.object(config.registryId), // registry
        tx.object(config.proposalId), // proposal
        executable, // executable
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }
}
