/**
 * Govex Futarchy SDK
 *
 * A comprehensive TypeScript SDK for interacting with the Futarchy Protocol on Sui.
 *
 * ## Architecture
 *
 * ```
 * src/
 * ├── sdk/           # Main SDK entry point
 * ├── config/        # Network & deployment configuration
 * ├── types/         # TypeScript type definitions
 * ├── core/          # Foundation (action registry, validation, errors)
 * ├── workflows/     # High-level orchestration (launchpad, proposal)
 * ├── staging/       # Action staging functions (add_*_spec)
 * ├── execution/     # Action execution wrappers (do_*)
 * ├── protocol/      # Move module wrappers (queries)
 * ├── services/      # High-level service classes
 * └── utils/         # Shared utilities
 * ```
 *
 * ## Quick Start
 *
 * ```typescript
 * import { FutarchySDK } from '@govex/futarchy-sdk';
 *
 * const sdk = await FutarchySDK.init({
 *   network: 'testnet',
 *   deployments
 * });
 *
 * // Use high-level workflows
 * const tx = sdk.workflows.launchpad.createRaise({...});
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// MAIN SDK
// ============================================================================

export * from './sdk';

// ============================================================================
// CONFIGURATION
// ============================================================================

export * from './config';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export * from './types';

// ============================================================================
// CORE (Foundation)
// ============================================================================

export * from './core';

// ============================================================================
// WORKFLOWS (High-level orchestration)
// ============================================================================

export * from './workflows';

// ============================================================================
// STAGING (Action staging functions)
// ============================================================================

export * from './staging';

// ============================================================================
// EXECUTION (Action execution wrappers)
// ============================================================================

export * from './execution';

// ============================================================================
// PROTOCOL (Move module wrappers)
// ============================================================================

export * from './protocol';

// ============================================================================
// SERVICES (High-level service classes)
// ============================================================================

export * from './services';

// ============================================================================
// UTILITIES
// ============================================================================

export * from './utils';

// ============================================================================
// PTB HELPERS
// ============================================================================

export * from './ptb';

// ============================================================================
// SUI TYPE RE-EXPORTS
// ============================================================================

export type { SuiClient, SuiObjectResponse, SuiObjectData } from '@mysten/sui/client';
export type { Transaction, TransactionResult } from '@mysten/sui/transactions';
