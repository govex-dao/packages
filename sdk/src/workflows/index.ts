/**
 * Workflows - High-level orchestrators for complex multi-step operations
 *
 * This module provides user-friendly APIs that hide all the complexity
 * of package IDs, type arguments, witnesses, and PTB construction.
 *
 * @module workflows
 */

// Types
export * from './types';

// Intent execution
export {
  IntentExecutor,
  MetadataKeyTypes,
  type IntentExecutorPackages,
} from './intent-executor';

// Launchpad workflow
export {
  LaunchpadWorkflow,
  type LaunchpadWorkflowPackages,
  type LaunchpadWorkflowSharedObjects,
} from './launchpad-workflow';

// Proposal workflow
export {
  ProposalWorkflow,
  type ProposalWorkflowPackages,
  type ProposalWorkflowSharedObjects,
} from './proposal-workflow';
