/**
 * Type definitions for initialization actions
 * Used when creating DAOs with initialization intents
 *
 * This follows the Move architecture:
 * - ActionSpec stores TypeName (package::module::Type) + BCS-serialized data
 * - Each package exports action builder classes that create InitActionSpec objects
 * - Factory accepts InitActionSpec[] and stages them as Intents on the DAO
 */

/**
 * Initialization action specification
 *
 * Matches Move's ActionSpec structure from account_protocol::intents:
 * ```move
 * public struct ActionSpec has store, drop, copy {
 *     version: u8,              // Protocol version
 *     action_type: TypeName,    // Type identity
 *     action_data: vector<u8>,  // BCS-serialized payload
 * }
 * ```
 *
 * This format enables type-safe cross-package orchestration during DAO creation.
 * Each package exports action builder classes that create properly formatted InitActionSpec objects.
 *
 * @example
 * ```typescript
 * import { ConfigActions, LiquidityActions } from '@govex/futarchy-sdk/actions';
 *
 * const specs = [
 *     ConfigActions.updateMetadata({
 *         daoName: "My DAO",
 *         iconUrl: "https://example.com/icon.png",
 *         description: "A futarchy DAO"
 *     }),
 *     LiquidityActions.createPool({
 *         assetAmount: 1_000_000n,
 *         stableAmount: 10_000n,
 *         sqrtPrice: 1000000n,
 *         tickLower: -100000,
 *         tickUpper: 100000,
 *     })
 * ];
 * ```
 */
export interface InitActionSpec {
    /**
     * TypeName of the action marker type
     * Format: "package::module::Type"
     *
     * Examples:
     * - "futarchy_actions::config_actions::MetadataUpdate"
     * - "futarchy_actions::liquidity_actions::CreatePoolAction"
     * - "futarchy_governance_actions::governance_intents::SetMinVotingPower"
     */
    actionType: string;

    /**
     * BCS-serialized action data as byte array
     * This must match the Move struct layout exactly
     */
    actionData: number[];
}
