/**
 * Liquidity actions for pool creation and management
 *
 * These actions manage liquidity pools for DAO markets.
 * Can be executed during DAO creation or through governance proposals.
 *
 * Package: futarchy_actions
 * Module: liquidity_actions
 */

import { bcs } from "@mysten/sui/bcs";
import { InitActionSpec } from "../../types/init-actions";
import { concatBytes } from "./bcs-utils";

/**
 * Liquidity action builders for pool operations
 */
export class LiquidityActions {
    /**
     * Create a new liquidity pool for DAO trading
     *
     * Matches Move: CreatePoolAction
     *
     * @param params - Pool creation parameters
     * @returns InitActionSpec for use in createDAOWithInitSpecs
     *
     * @example
     * ```typescript
     * const action = LiquidityActions.createPool({
     *     assetAmount: 1_000_000n,
     *     stableAmount: 10_000n,
     *     sqrtPrice: 1000000n,
     *     tickLower: -100000,
     *     tickUpper: 100000,
     * });
     * ```
     */
    static createPool(params: {
        /** Amount of asset token to deposit */
        assetAmount: bigint | number;
        /** Amount of stable token to deposit */
        stableAmount: bigint | number;
        /** Initial sqrt price (u128) */
        sqrtPrice: bigint | number;
        /** Lower tick boundary (i32) */
        tickLower: number;
        /** Upper tick boundary (i32) */
        tickUpper: number;
    }): InitActionSpec {
        // Serialize each field matching Move struct
        const assetAmountBytes = bcs.u64().serialize(BigInt(params.assetAmount)).toBytes();
        const stableAmountBytes = bcs.u64().serialize(BigInt(params.stableAmount)).toBytes();
        const sqrtPriceBytes = bcs.u128().serialize(BigInt(params.sqrtPrice)).toBytes();
        const tickLowerBytes = bcs.u32().serialize(params.tickLower).toBytes();
        const tickUpperBytes = bcs.u32().serialize(params.tickUpper).toBytes();

        const actionData = concatBytes(
            assetAmountBytes,
            stableAmountBytes,
            sqrtPriceBytes,
            tickLowerBytes,
            tickUpperBytes
        );

        return {
            actionType: "futarchy_actions::liquidity_actions::CreatePoolAction",
            actionData,
        };
    }

    /**
     * Add liquidity to an existing pool
     *
     * Matches Move: AddLiquidityAction
     *
     * @param params - Liquidity addition parameters
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = LiquidityActions.addLiquidity({
     *     poolId: "0xPOOL_ID",
     *     assetAmount: 500_000n,
     *     stableAmount: 5_000n,
     *     minLpTokens: 1000n,
     *     tickLower: -50000,
     *     tickUpper: 50000,
     * });
     * ```
     */
    static addLiquidity(params: {
        /** Pool object ID */
        poolId: string;
        /** Amount of asset token to add */
        assetAmount: bigint | number;
        /** Amount of stable token to add */
        stableAmount: bigint | number;
        /** Minimum LP tokens to receive (slippage protection) */
        minLpTokens: bigint | number;
        /** Lower tick boundary */
        tickLower: number;
        /** Upper tick boundary */
        tickUpper: number;
    }): InitActionSpec {
        const poolIdBytes = bcs.Address.serialize(params.poolId).toBytes();
        const assetAmountBytes = bcs.u64().serialize(BigInt(params.assetAmount)).toBytes();
        const stableAmountBytes = bcs.u64().serialize(BigInt(params.stableAmount)).toBytes();
        const minLpTokensBytes = bcs.u64().serialize(BigInt(params.minLpTokens)).toBytes();
        const tickLowerBytes = bcs.u32().serialize(params.tickLower).toBytes();
        const tickUpperBytes = bcs.u32().serialize(params.tickUpper).toBytes();

        const actionData = concatBytes(
            poolIdBytes,
            assetAmountBytes,
            stableAmountBytes,
            minLpTokensBytes,
            tickLowerBytes,
            tickUpperBytes
        );

        return {
            actionType: "futarchy_actions::liquidity_actions::AddLiquidityAction",
            actionData,
        };
    }

    /**
     * Remove liquidity from a pool
     *
     * Matches Move: RemoveLiquidityAction
     *
     * @param params - Liquidity removal parameters
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = LiquidityActions.removeLiquidity({
     *     poolId: "0xPOOL_ID",
     *     liquidity: 1000n,
     *     minAssetAmount: 450_000n,
     *     minStableAmount: 4_500n,
     *     tickLower: -50000,
     *     tickUpper: 50000,
     * });
     * ```
     */
    static removeLiquidity(params: {
        /** Pool object ID */
        poolId: string;
        /** Amount of liquidity to remove */
        liquidity: bigint | number;
        /** Minimum asset tokens to receive (slippage protection) */
        minAssetAmount: bigint | number;
        /** Minimum stable tokens to receive (slippage protection) */
        minStableAmount: bigint | number;
        /** Lower tick boundary */
        tickLower: number;
        /** Upper tick boundary */
        tickUpper: number;
    }): InitActionSpec {
        const poolIdBytes = bcs.Address.serialize(params.poolId).toBytes();
        const liquidityBytes = bcs.u128().serialize(BigInt(params.liquidity)).toBytes();
        const minAssetBytes = bcs.u64().serialize(BigInt(params.minAssetAmount)).toBytes();
        const minStableBytes = bcs.u64().serialize(BigInt(params.minStableAmount)).toBytes();
        const tickLowerBytes = bcs.u32().serialize(params.tickLower).toBytes();
        const tickUpperBytes = bcs.u32().serialize(params.tickUpper).toBytes();

        const actionData = concatBytes(
            poolIdBytes,
            liquidityBytes,
            minAssetBytes,
            minStableBytes,
            tickLowerBytes,
            tickUpperBytes
        );

        return {
            actionType: "futarchy_actions::liquidity_actions::RemoveLiquidityAction",
            actionData,
        };
    }

    /**
     * Withdraw LP tokens from custody
     *
     * Matches Move: WithdrawLpTokenAction
     *
     * @param params - Withdrawal parameters
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = LiquidityActions.withdrawLpToken({
     *     poolId: "0xPOOL_ID",
     *     amount: 1000n,
     *     recipient: "0xRECIPIENT_ADDRESS"
     * });
     * ```
     */
    static withdrawLpToken(params: {
        /** Pool object ID */
        poolId: string;
        /** Amount of LP tokens to withdraw */
        amount: bigint | number;
        /** Recipient address */
        recipient: string;
    }): InitActionSpec {
        const poolIdBytes = bcs.Address.serialize(params.poolId).toBytes();
        const amountBytes = bcs.u64().serialize(BigInt(params.amount)).toBytes();
        const recipientBytes = bcs.Address.serialize(params.recipient).toBytes();

        const actionData = concatBytes(poolIdBytes, amountBytes, recipientBytes);

        return {
            actionType: "futarchy_actions::liquidity_actions::WithdrawLpTokenAction",
            actionData,
        };
    }

    /**
     * Update pool parameters
     *
     * Matches Move: UpdatePoolParamsAction
     *
     * @param params - Pool parameter updates
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = LiquidityActions.updatePoolParams({
     *     poolId: "0xPOOL_ID",
     *     feeBps: 30, // 0.3% fee
     *     protocolFeeBps: 10 // 0.1% protocol fee
     * });
     * ```
     */
    static updatePoolParams(params: {
        /** Pool object ID */
        poolId: string;
        /** Fee in basis points (optional) */
        feeBps?: number;
        /** Protocol fee in basis points (optional) */
        protocolFeeBps?: number;
    }): InitActionSpec {
        const poolIdBytes = bcs.Address.serialize(params.poolId).toBytes();

        // Serialize optional parameters
        const feeBpsBytes = bcs
            .option(bcs.u64())
            .serialize(params.feeBps !== undefined ? BigInt(params.feeBps) : null)
            .toBytes();
        const protocolFeeBpsBytes = bcs
            .option(bcs.u64())
            .serialize(params.protocolFeeBps !== undefined ? BigInt(params.protocolFeeBps) : null)
            .toBytes();

        const actionData = concatBytes(poolIdBytes, feeBpsBytes, protocolFeeBpsBytes);

        return {
            actionType: "futarchy_actions::liquidity_actions::UpdatePoolParamsAction",
            actionData,
        };
    }
}
