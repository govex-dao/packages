/**
 * Action builders for cross-package orchestration
 *
 * Each action builder class provides strongly-typed methods for creating
 * InitActionSpec objects that can be used in factory.createDAOWithInitSpecs()
 * or governance proposal execution.
 *
 * @example
 * ```typescript
 * import { ConfigActions, LiquidityActions, GovernanceActions, VaultActions } from '@govex/futarchy-sdk/actions';
 *
 * const initActions = [
 *     ConfigActions.updateMetadata({ daoName: "My DAO" }),
 *     LiquidityActions.createPool({ ... }),
 *     GovernanceActions.setMinVotingPower(1000n),
 *     VaultActions.createStream({ ... })
 * ];
 * ```
 */

export * from "./config-actions";
export * from "./liquidity-actions";
export * from "./governance-actions";
export * from "./vault-actions";
export * from "./bcs-utils";
