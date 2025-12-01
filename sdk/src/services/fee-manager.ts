/**
 * FeeManager Operations
 *
 * Professional SDK interface for managing protocol fees in the Govex futarchy system.
 * Handles fee configuration, collection, and withdrawal for various coin types.
 *
 * @module FeeManagerOperations
 * @package futarchy_markets_core
 */

import { Transaction } from '@mysten/sui/transactions';
import type { SuiClient } from '@mysten/sui/client';
import { TransactionUtils } from './transaction';

/**
 * Fee configuration for a specific coin type
 */
export interface CoinFeeConfig {
    /** Full coin type (e.g., "0x2::sui::SUI") */
    coinType: string;
    /** Number of decimals for the coin */
    decimals: number;
    /** Fee for creating a DAO (in coin's base units) */
    daoCreationFee: bigint;
    /** Fee per outcome for creating a proposal */
    proposalFeePerOutcome: bigint;
}

/**
 * Fee withdrawal parameters
 */
export interface WithdrawFeesParams {
    /** Type of coin to withdraw */
    coinType: string;
    /** Amount to withdraw (in coin's base units) */
    amount: bigint;
    /** Optional recipient address (defaults to sender) */
    recipient?: string;
}

/**
 * FeeManager operations for managing protocol fees
 *
 * This class provides a professional interface for all fee-related operations including:
 * - Registering new coin types for fee payments
 * - Updating fee amounts (with 6-month delay and 10x cap safety)
 * - Withdrawing collected fees
 * - Querying fee configurations
 *
 * @example
 * ```typescript
 * // Register SUI as a payment coin
 * const tx = feeManager.addCoinFeeConfig({
 *   coinType: "0x2::sui::SUI",
 *   decimals: 9,
 *   daoCreationFee: 100_000_000n, // 0.1 SUI
 *   proposalFeePerOutcome: 10_000_000n, // 0.01 SUI per outcome
 * });
 * ```
 */
export class FeeManagerOperations {
    constructor(
        private readonly client: SuiClient,
        private readonly feeManagerId: string,
        private readonly marketsCorePkgId: string,
    ) {}

    /**
     * Register a new coin type for fee payments
     *
     * This enables users to pay protocol fees in the specified coin type.
     * Requires FeeAdminCap to execute.
     *
     * @param config - Coin fee configuration
     * @param adminCapId - FeeAdminCap object ID
     * @param clock - Clock object (defaults to "0x6")
     * @returns Transaction for adding coin fee config
     *
     * @example
     * ```typescript
     * const tx = sdk.feeManager.addCoinFeeConfig({
     *   coinType: "0x2::sui::SUI",
     *   decimals: 9,
     *   daoCreationFee: 100_000_000n,
     *   proposalFeePerOutcome: 10_000_000n,
     * }, adminCapId);
     * ```
     */
    addCoinFeeConfig(
        config: CoinFeeConfig,
        adminCapId: string,
        clock: string = '0x6',
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.marketsCorePkgId,
                'fee',
                'add_coin_fee_config_entry',
            ),
            typeArguments: [config.coinType],
            arguments: [
                tx.object(this.feeManagerId),
                tx.object(adminCapId),
                tx.pure.u8(config.decimals),
                tx.pure.u64(config.daoCreationFee),
                tx.pure.u64(config.proposalFeePerOutcome),
                tx.object(clock),
            ],
        });

        return tx;
    }

    /**
     * Update DAO creation fee (with 6-month delay and 10x cap)
     *
     * Fee updates are subject to safety constraints:
     * - 6-month delay before taking effect
     * - Maximum 10x increase from baseline
     * - Baseline resets every 6 months
     *
     * @param newFee - New DAO creation fee
     * @param adminCapId - FeeAdminCap object ID
     * @param clock - Clock object (defaults to "0x6")
     * @returns Transaction for updating fee
     *
     * @example
     * ```typescript
     * const tx = sdk.feeManager.updateDaoCreationFee(
     *   200_000_000n, // 0.2 SUI
     *   adminCapId
     * );
     * ```
     */
    updateDaoCreationFee(
        newFee: bigint,
        adminCapId: string,
        clock: string = '0x6',
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.marketsCorePkgId,
                'fee',
                'update_dao_creation_fee',
            ),
            arguments: [
                tx.object(this.feeManagerId),
                tx.object(adminCapId),
                tx.pure.u64(newFee),
                tx.object(clock),
            ],
        });

        return tx;
    }

    /**
     * Update proposal creation fee per outcome
     *
     * @param newFee - New proposal creation fee per outcome
     * @param adminCapId - FeeAdminCap object ID
     * @param clock - Clock object (defaults to "0x6")
     * @returns Transaction for updating fee
     */
    updateProposalCreationFee(
        newFee: bigint,
        adminCapId: string,
        clock: string = '0x6',
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.marketsCorePkgId,
                'fee',
                'update_proposal_creation_fee',
            ),
            arguments: [
                tx.object(this.feeManagerId),
                tx.object(adminCapId),
                tx.pure.u64(newFee),
                tx.object(clock),
            ],
        });

        return tx;
    }

    /**
     * Update launchpad creation fee
     *
     * @param newFee - New launchpad creation fee
     * @param adminCapId - FeeAdminCap object ID
     * @param clock - Clock object (defaults to "0x6")
     * @returns Transaction for updating fee
     */
    updateLaunchpadCreationFee(
        newFee: bigint,
        adminCapId: string,
        clock: string = '0x6',
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.marketsCorePkgId,
                'fee',
                'update_launchpad_creation_fee',
            ),
            arguments: [
                tx.object(this.feeManagerId),
                tx.object(adminCapId),
                tx.pure.u64(newFee),
                tx.object(clock),
            ],
        });

        return tx;
    }

    /**
     * Withdraw collected fees for a specific stable coin type
     *
     * Withdraws accumulated fees to the specified recipient (or sender if not specified).
     * Only callable by FeeAdminCap holder.
     *
     * @param params - Withdrawal parameters
     * @param adminCapId - FeeAdminCap object ID
     * @returns Transaction for withdrawing fees
     *
     * @example
     * ```typescript
     * const tx = sdk.feeManager.withdrawStableFees({
     *   coinType: "0x2::sui::SUI",
     *   amount: 1_000_000_000n, // 1 SUI
     *   recipient: "0xabc...",
     * }, adminCapId);
     * ```
     */
    withdrawStableFees(params: WithdrawFeesParams, adminCapId: string): Transaction {
        const tx = new Transaction();

        const recipient = params.recipient || tx.pure.address('{{sender}}');

        tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.marketsCorePkgId,
                'fee',
                'withdraw_stable_fees',
            ),
            typeArguments: [params.coinType],
            arguments: [
                tx.object(this.feeManagerId),
                tx.object(adminCapId),
                tx.pure.u64(params.amount),
                typeof recipient === 'string' ? tx.pure.address(recipient) : recipient,
            ],
        });

        return tx;
    }

    /**
     * Withdraw collected fees for a specific asset coin type
     *
     * @param params - Withdrawal parameters
     * @param adminCapId - FeeAdminCap object ID
     * @returns Transaction for withdrawing asset fees
     */
    withdrawAssetFees(params: WithdrawFeesParams, adminCapId: string): Transaction {
        const tx = new Transaction();

        const recipient = params.recipient || tx.pure.address('{{sender}}');

        tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.marketsCorePkgId,
                'fee',
                'withdraw_asset_fees',
            ),
            typeArguments: [params.coinType],
            arguments: [
                tx.object(this.feeManagerId),
                tx.object(adminCapId),
                tx.pure.u64(params.amount),
                typeof recipient === 'string' ? tx.pure.address(recipient) : recipient,
            ],
        });

        return tx;
    }

    /**
     * Withdraw all SUI fees collected
     *
     * Convenience method to withdraw the entire SUI balance from the FeeManager.
     *
     * @param adminCapId - FeeAdminCap object ID
     * @param recipient - Optional recipient address (defaults to sender)
     * @returns Transaction for withdrawing all SUI fees
     *
     * @example
     * ```typescript
     * const tx = sdk.feeManager.withdrawAllSuiFees(adminCapId);
     * await sdk.signAndExecute(tx);
     * ```
     */
    withdrawAllSuiFees(adminCapId: string, recipient?: string): Transaction {
        const tx = new Transaction();

        const recipientArg = recipient
            ? tx.pure.address(recipient)
            : tx.pure.address('{{sender}}');

        tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.marketsCorePkgId,
                'fee',
                'withdraw_all_fees',
            ),
            arguments: [
                tx.object(this.feeManagerId),
                tx.object(adminCapId),
                recipientArg,
            ],
        });

        return tx;
    }

    /**
     * Query the current DAO creation fee
     *
     * @returns The DAO creation fee in SUI base units
     *
     * @example
     * ```typescript
     * const fee = await sdk.feeManager.getDaoCreationFee();
     * console.log(`DAO creation fee: ${fee / 1e9} SUI`);
     * ```
     */
    async getDaoCreationFee(): Promise<bigint> {
        const feeManager = await this.client.getObject({
            id: this.feeManagerId,
            options: { showContent: true },
        });

        if (!feeManager.data?.content || feeManager.data.content.dataType !== 'moveObject') {
            throw new Error('FeeManager not found or invalid');
        }

        const fields = feeManager.data.content.fields as any;
        return BigInt(fields.dao_creation_fee);
    }

    /**
     * Query the current proposal creation fee per outcome
     *
     * @returns The proposal creation fee per outcome in SUI base units
     */
    async getProposalCreationFee(): Promise<bigint> {
        const feeManager = await this.client.getObject({
            id: this.feeManagerId,
            options: { showContent: true },
        });

        if (!feeManager.data?.content || feeManager.data.content.dataType !== 'moveObject') {
            throw new Error('FeeManager not found or invalid');
        }

        const fields = feeManager.data.content.fields as any;
        return BigInt(fields.proposal_creation_fee_per_outcome);
    }

    /**
     * Query the current launchpad creation fee
     *
     * @returns The launchpad creation fee in SUI base units
     */
    async getLaunchpadCreationFee(): Promise<bigint> {
        const feeManager = await this.client.getObject({
            id: this.feeManagerId,
            options: { showContent: true },
        });

        if (!feeManager.data?.content || feeManager.data.content.dataType !== 'moveObject') {
            throw new Error('FeeManager not found or invalid');
        }

        const fields = feeManager.data.content.fields as any;
        return BigInt(fields.launchpad_creation_fee);
    }

    /**
     * Query the current SUI balance in the FeeManager
     *
     * @returns The SUI balance in base units
     */
    async getSuiBalance(): Promise<bigint> {
        const feeManager = await this.client.getObject({
            id: this.feeManagerId,
            options: { showContent: true },
        });

        if (!feeManager.data?.content || feeManager.data.content.dataType !== 'moveObject') {
            throw new Error('FeeManager not found or invalid');
        }

        const fields = feeManager.data.content.fields as any;
        return BigInt(fields.sui_balance);
    }
}
