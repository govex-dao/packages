/**
 * Governance Intents
 *
 * Simplified interface for creating and executing governance intents from
 * approved proposals. This provides higher-level helpers for governance operations.
 *
 * @module governance-intents
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Governance Intent helpers
 *
 * Static utilities for governance intent execution.
 *
 * @example Execute proposal intent
 * ```typescript
 * const tx = new Transaction();
 *
 * const [executable, intentKey] = GovernanceIntents.executeProposalIntent(tx, {
 *   governanceActionsPackageId,
 *   daoId,
 *   proposalId,
 *   marketStateId,
 *   registryId,
 *   outcomeIndex: 0,
 *   assetType,
 *   stableType,
 *   outcomeType: "0xabc::governance::FutarchyOutcome",
 * });
 *
 * // Now execute actions in the intent...
 * // Finally call finalize_execution
 * ```
 */
export class GovernanceIntents {
  /**
   * Get the governance witness
   *
   * Returns the GovernanceWitness type for use in PTB composition.
   *
   * @param tx - Transaction
   * @param governanceActionsPackageId - Governance actions package ID
   * @returns TransactionArgument for GovernanceWitness
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   * const witness = GovernanceIntents.witness(tx, governanceActionsPackageId);
   * ```
   */
  static witness(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        governanceActionsPackageId,
        'governance_intents',
        'witness'
      ),
      arguments: [],
    });
  }

  /**
   * Execute a governance intent from an approved proposal
   *
   * Creates an Executable hot potato from an approved proposal's intent.
   * This is a higher-level alternative to using ptb_executor directly.
   *
   * Requirements:
   * - Proposal must be finalized
   * - Specified outcome must have won
   * - Outcome must match the winning outcome
   *
   * @param tx - Transaction
   * @param config - Execution configuration
   * @param outcome - Outcome witness (e.g., from LaunchpadOutcome.new())
   * @returns TransactionArgument tuple [Executable, intent_key: String]
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * const [executable, intentKey] = GovernanceIntents.executeProposalIntent(tx, {
   *   governanceActionsPackageId,
   *   daoId,
   *   proposalId,
   *   marketStateId,
   *   registryId,
   *   outcomeIndex: 0,
   *   assetType: "0x2::sui::SUI",
   *   stableType: "0xusdc::usdc::USDC",
   *   outcomeType: "0xabc::launchpad_outcome::LaunchpadOutcome",
   * }, outcomeWitness);
   *
   * // Execute actions...
   *
   * // Finalize with appropriate module's finalize_execution
   * ```
   */
  static executeProposalIntent(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      proposalId: string;
      marketStateId: string;
      registryId: string;
      outcomeIndex: number;
      assetType: string;
      stableType: string;
      outcomeType: string; // Full type path for Outcome
      clock?: string;
    },
    outcome: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governanceActionsPackageId,
        'governance_intents',
        'execute_proposal_intent'
      ),
      typeArguments: [config.assetType, config.stableType, config.outcomeType],
      arguments: [
        tx.object(config.daoId), // account
        tx.object(config.registryId), // registry
        tx.object(config.proposalId), // proposal
        tx.object(config.marketStateId), // market
        tx.pure.u64(config.outcomeIndex), // outcome_index
        outcome, // outcome witness
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }

  /**
   * Create and store an Intent from a vector of ActionSpecs
   *
   * Higher-level helper for creating intents from action specs.
   * This combines creation and storage in one call.
   *
   * @param tx - Transaction
   * @param config - Intent configuration
   * @param specs - Vector of ActionSpec (from action builders)
   * @param outcome - Outcome witness
   * @returns TransactionArgument for intent key (String)
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * // Build action specs using action builders
   * const specs = [
   *   // ... create action specs
   * ];
   *
   * const intentKey = GovernanceIntents.createAndStoreIntentFromSpec(tx, {
   *   governanceActionsPackageId,
   *   daoId,
   *   registryId,
   *   outcomeType: "0xabc::governance::FutarchyOutcome",
   * }, specs, outcomeWitness);
   * ```
   */
  static createAndStoreIntentFromSpec(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      outcomeType: string; // Full type path for Outcome
      clock?: string;
    },
    specs: ReturnType<Transaction['moveCall']>, // vector<ActionSpec>
    outcome: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governanceActionsPackageId,
        'governance_intents',
        'create_and_store_intent_from_spec'
      ),
      typeArguments: [config.outcomeType],
      arguments: [
        tx.object(config.daoId), // account
        tx.object(config.registryId), // registry
        specs, // specs: vector<ActionSpec>
        outcome, // outcome witness
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }
}
