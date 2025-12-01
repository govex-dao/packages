import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { BaseTransactionBuilder, TransactionUtils } from "./transaction";

/**
 * Factory operations for creating DAOs
 */
export class FactoryOperations {
    private client: SuiClient;
    private factoryPackageId: string;
    private factoryObjectId: string;
    private packageRegistryId: string;

    constructor(
        client: SuiClient,
        factoryPackageId: string,
        _futarchyTypesPackageId: string,  // Kept for API compatibility
        factoryObjectId: string,
        _factoryInitialSharedVersion: number,  // Kept for API compatibility
        packageRegistryId: string,
        _feeManagerId: string,  // Kept for API compatibility
        _feeManagerInitialSharedVersion: number  // Kept for API compatibility
    ) {
        this.client = client;
        this.factoryPackageId = factoryPackageId;
        this.factoryObjectId = factoryObjectId;
        this.packageRegistryId = packageRegistryId;
    }

    /**
     * View: Get total DAO count
     */
    async getDaoCount(): Promise<number> {
        const factory = await this.client.getObject({
            id: this.factoryObjectId,
            options: { showContent: true },
        });

        if (!factory.data?.content || factory.data.content.dataType !== 'moveObject') {
            throw new Error('Factory not found');
        }

        const fields = factory.data.content.fields as any;
        return Number(fields.dao_count || 0);
    }

    /**
     * View: Check if factory is paused
     */
    async isPaused(): Promise<boolean> {
        const factory = await this.client.getObject({
            id: this.factoryObjectId,
            options: { showContent: true },
        });

        if (!factory.data?.content || factory.data.content.dataType !== 'moveObject') {
            throw new Error('Factory not found');
        }

        const fields = factory.data.content.fields as any;
        return fields.is_paused === true;
    }

    /**
     * View: Check if factory is permanently disabled
     */
    async isPermanentlyDisabled(): Promise<boolean> {
        const factory = await this.client.getObject({
            id: this.factoryObjectId,
            options: { showContent: true },
        });

        if (!factory.data?.content || factory.data.content.dataType !== 'moveObject') {
            throw new Error('Factory not found');
        }

        const fields = factory.data.content.fields as any;
        return fields.permanently_disabled === true;
    }

    /**
     * View: Check if a stable type is allowed
     */
    async isStableTypeAllowed(stableType: string): Promise<boolean> {
        const factory = await this.client.getObject({
            id: this.factoryObjectId,
            options: { showContent: true },
        });

        if (!factory.data?.content || factory.data.content.dataType !== 'moveObject') {
            throw new Error('Factory not found');
        }

        const fields = factory.data.content.fields as any;
        const allowedTypes = fields.allowed_stable_types?.fields?.contents || [];

        // Check if stableType is in the allowed list
        return allowedTypes.some((entry: any) => {
            const typeName = entry.fields?.key?.fields?.name;
            return typeName === stableType;
        });
    }

    /**
     * View: Get launchpad bid fee
     */
    async getLaunchpadBidFee(): Promise<bigint> {
        const factory = await this.client.getObject({
            id: this.factoryObjectId,
            options: { showContent: true },
        });

        if (!factory.data?.content || factory.data.content.dataType !== 'moveObject') {
            throw new Error('Factory not found');
        }

        const fields = factory.data.content.fields as any;
        return BigInt(fields.launchpad_bid_fee || 0);
    }

    /**
     * View: Get launchpad cranker reward
     */
    async getLaunchpadCrankerReward(): Promise<bigint> {
        const factory = await this.client.getObject({
            id: this.factoryObjectId,
            options: { showContent: true },
        });

        if (!factory.data?.content || factory.data.content.dataType !== 'moveObject') {
            throw new Error('Factory not found');
        }

        const fields = factory.data.content.fields as any;
        return BigInt(fields.launchpad_cranker_reward || 0);
    }

    /**
     * View: Get launchpad settlement reward
     */
    async getLaunchpadSettlementReward(): Promise<bigint> {
        const factory = await this.client.getObject({
            id: this.factoryObjectId,
            options: { showContent: true },
        });

        if (!factory.data?.content || factory.data.content.dataType !== 'moveObject') {
            throw new Error('Factory not found');
        }

        const fields = factory.data.content.fields as any;
        return BigInt(fields.launchpad_settlement_reward || 0);
    }

    /**
     * Borrow CoinMetadata from DAO Account
     * Returns reference to CoinMetadata for reading
     */
    borrowCoinMetadata(
        accountId: string,
        coinType: string
    ): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.factoryPackageId,
                'factory',
                'borrow_coin_metadata'
            ),
            typeArguments: [coinType],
            arguments: [
                tx.object(accountId), // account
                tx.object(this.packageRegistryId), // registry
            ],
        });

        return tx;
    }
}
