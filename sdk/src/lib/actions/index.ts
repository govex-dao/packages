/**
 * Action builders for PTB construction
 *
 * Build actions in PTB using the action_spec_builder pattern.
 * Used for launchpad two-outcome system and proposal actions.
 *
 * @example Launchpad Success Intent (create stream + pool)
 * ```typescript
 * import { Transaction } from '@mysten/sui/transactions';
 * import { ActionSpecBuilder, StreamInitActions, LiquidityInitActions } from '@govex/futarchy-sdk/actions';
 *
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Add stream
 * StreamInitActions.addCreateStream(tx, builder, actionsPackageId, {
 *   vaultName: "treasury",
 *   beneficiary: "0xBENEFICIARY",
 *   amountPerIteration: 1_000_000_000n,
 *   startTime: Date.now() + 86400000,
 *   iterationsTotal: 12n,
 *   iterationPeriodMs: 2_592_000_000n,
 *   maxPerWithdrawal: 1_000_000_000n,
 *   isTransferable: true,
 *   isCancellable: true,
 * });
 *
 * // Add pool creation
 * LiquidityInitActions.addCreatePoolWithMint(tx, builder, futarchyActionsPkg, {
 *   vaultName: "treasury",
 *   assetAmountToMint: 1_000_000_000_000n,
 *   stableAmountFromVault: 1_000_000_000n,
 *   feeBps: 30,
 * });
 *
 * // Stage as success intent
 * tx.moveCall({
 *   target: `${launchpadPkg}::launchpad::stage_success_intent`,
 *   typeArguments: [assetType, stableType],
 *   arguments: [raiseId, registryId, creatorCapId, builder, clock],
 * });
 * ```
 *
 * @example Launchpad Failure Intent (return caps)
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * CurrencyInitActions.addReturnTreasuryCap(tx, builder, actionsPackageId, {
 *   recipient: creatorAddress,
 * });
 *
 * CurrencyInitActions.addReturnMetadata(tx, builder, actionsPackageId, {
 *   recipient: creatorAddress,
 * });
 *
 * tx.moveCall({
 *   target: `${launchpadPkg}::launchpad::stage_failure_intent`,
 *   typeArguments: [assetType, stableType],
 *   arguments: [raiseId, registryId, creatorCapId, builder, clock],
 * });
 * ```
 */

export * from "./action-spec-builder";
export * from "./stream-actions";
export * from "./currency-actions";
export * from "./liquidity-init-actions";
export * from "./liquidity-actions";
export * from "./bcs-utils";
