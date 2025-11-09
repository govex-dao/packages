import { Transaction, TransactionObjectArgument } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { TransactionBuilder, TransactionUtils } from "./transaction";

/**
 * DAO creation configuration
 */
export interface DAOConfig {
    // Token configuration
    assetType: string; // Full type path for DAO token (e.g., "0x123::mycoin::MYCOIN")
    stableType: string; // Full type path for stable coin
    treasuryCap: string; // Object ID of TreasuryCap
    coinMetadata: string; // Object ID of CoinMetadata

    // DAO metadata
    daoName: string; // ASCII string
    iconUrl: string; // ASCII string
    description: string; // UTF-8 string
    affiliateId?: string; // Partner identifier (empty string if none)

    // Market configuration
    minAssetAmount: bigint | number; // Minimum asset amount for markets
    minStableAmount: bigint | number; // Minimum stable amount for markets

    // Governance timing (in milliseconds)
    reviewPeriodMs: number; // How long proposals stay in review
    tradingPeriodMs: number; // How long markets stay open

    // TWAP configuration
    twapStartDelay: number; // Delay before TWAP starts (ms)
    twapStepMax: number; // TWAP window cap
    twapInitialObservation: bigint | number; // Initial TWAP observation (u128)
    twapThreshold: { value: bigint | number; negative: boolean }; // Signed threshold

    // Market parameters
    ammTotalFeeBps: number; // Total AMM fee in basis points (e.g., 30 = 0.3%)
    maxOutcomes: number; // Maximum number of outcomes per proposal

    // Agreement (can be empty vectors)
    agreementLines?: string[];
    agreementDifficulties?: number[];

    // Payment
    paymentAmount: bigint | number; // Amount in MIST for creation fee
}

/**
 * Factory operations for creating DAOs
 */
export class FactoryOperations {
    private client: SuiClient;
    private factoryPackageId: string;
    private futarchyTypesPackageId: string;
    private factoryObjectId: string;
    private factoryInitialSharedVersion: number;
    private packageRegistryId: string;
    private feeManagerId: string;
    private feeManagerInitialSharedVersion: number;

    constructor(
        client: SuiClient,
        factoryPackageId: string,
        futarchyTypesPackageId: string,
        factoryObjectId: string,
        factoryInitialSharedVersion: number,
        packageRegistryId: string,
        feeManagerId: string,
        feeManagerInitialSharedVersion: number
    ) {
        this.client = client;
        this.factoryPackageId = factoryPackageId;
        this.futarchyTypesPackageId = futarchyTypesPackageId;
        this.factoryObjectId = factoryObjectId;
        this.factoryInitialSharedVersion = factoryInitialSharedVersion;
        this.packageRegistryId = packageRegistryId;
        this.feeManagerId = feeManagerId;
        this.feeManagerInitialSharedVersion = feeManagerInitialSharedVersion;
    }

    /**
     * Create a new DAO
     *
     * @param config - DAO configuration
     * @param clock - Clock object ID (usually "0x6")
     * @returns Transaction for creating the DAO
     *
     * @example
     * ```typescript
     * const tx = factory.createDAO({
     *   assetType: "0x123::mycoin::MYCOIN",
     *   stableType: "0x2::sui::SUI",
     *   treasuryCap: "0xabc...",
     *   coinMetadata: "0xdef...",
     *   daoName: "My DAO",
     *   iconUrl: "https://example.com/icon.png",
     *   description: "A futarchy DAO for governance",
     *   minAssetAmount: 1000n,
     *   minStableAmount: 1000n,
     *   reviewPeriodMs: 86400000, // 1 day
     *   tradingPeriodMs: 259200000, // 3 days
     *   twapStartDelay: 3600000, // 1 hour
     *   twapStepMax: 100,
     *   twapInitialObservation: 1000000n,
     *   twapThreshold: { value: 10000n, negative: false },
     *   ammTotalFeeBps: 30,
     *   maxOutcomes: 5,
     *   paymentAmount: TransactionUtils.suiToMist(1), // 1 SUI
     * }, "0x6");
     * ```
     */
    createDAO(config: DAOConfig, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        // Split payment coin
        const payment = builder.splitSui(config.paymentAmount);

        // Prepare parameters
        const affiliateId = config.affiliateId || "";
        const agreementLines = config.agreementLines || [];
        const agreementDifficulties = config.agreementDifficulties || [];

        // Build target function
        const target = TransactionUtils.buildTarget(
            this.factoryPackageId,
            "factory",
            "create_dao"
        );

        // Make the move call
        tx.moveCall({
            target,
            typeArguments: [config.assetType, config.stableType],
            arguments: [
                tx.object(this.factoryObjectId), // factory
                tx.object(this.packageRegistryId), // registry
                tx.object(this.feeManagerId), // fee_manager
                payment, // payment
                tx.pure.string(affiliateId), // affiliate_id
                tx.pure.u64(config.minAssetAmount), // min_asset_amount
                tx.pure.u64(config.minStableAmount), // min_stable_amount
                tx.pure.string(config.daoName), // dao_name (ASCII)
                tx.pure.string(config.iconUrl), // icon_url_string (ASCII)
                tx.pure.u64(config.reviewPeriodMs), // review_period_ms
                tx.pure.u64(config.tradingPeriodMs), // trading_period_ms
                tx.pure.u64(config.twapStartDelay), // twap_start_delay
                tx.pure.u64(config.twapStepMax), // twap_step_max
                tx.pure.u128(config.twapInitialObservation), // twap_initial_observation
                this.buildSignedU128(
                    tx,
                    config.twapThreshold.value,
                    config.twapThreshold.negative
                ), // twap_threshold
                tx.pure.u64(config.ammTotalFeeBps), // amm_total_fee_bps
                tx.pure.string(config.description), // description
                tx.pure.u64(config.maxOutcomes), // max_outcomes
                tx.makeMoveVec({
                    type: '0x1::string::String',
                    elements: agreementLines.map((line) => tx.pure.string(line)),
                }), // agreement_lines
                tx.makeMoveVec({
                    type: 'u64',
                    elements: agreementDifficulties.map((d) => tx.pure.u64(d)),
                }), // agreement_difficulties
                tx.object(config.treasuryCap), // treasury_cap
                tx.object(config.coinMetadata), // coin_metadata
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Build a SignedU128 struct for Move
     * @private
     */
    private buildSignedU128(
        tx: Transaction,
        value: bigint | number,
        negative: boolean
    ): ReturnType<Transaction["moveCall"]> {
        // Call futarchy_types::signed::new to create SignedU128
        return tx.moveCall({
            target: `${this.futarchyTypesPackageId}::signed::new`,
            arguments: [tx.pure.u128(value), tx.pure.bool(negative)],
        });
    }

    /**
     * Helper: Create DAO with default parameters
     *
     * This uses sensible defaults for most parameters.
     * Only requires essential configuration.
     */
    createDAOWithDefaults(config: {
        assetType: string;
        stableType: string;
        treasuryCap: string;
        coinMetadata: string;
        daoName: string;
        iconUrl: string;
        description: string;
        paymentAmount?: bigint | number;
    }): Transaction {
        return this.createDAO({
            ...config,
            affiliateId: "",
            minAssetAmount: 1000n,
            minStableAmount: 1000n,
            reviewPeriodMs: 86400000, // 1 day
            tradingPeriodMs: 259200000, // 3 days
            twapStartDelay: 3600000, // 1 hour
            twapStepMax: 100,
            twapInitialObservation: 1000000n,
            twapThreshold: { value: 100000n, negative: false },
            ammTotalFeeBps: 30, // 0.3%
            maxOutcomes: 5,
            agreementLines: [],
            agreementDifficulties: [],
            paymentAmount: config.paymentAmount || TransactionUtils.suiToMist(1),
        });
    }

    /**
     * Create a DAO with init actions using the atomic PTB pattern
     *
     * This uses a three-step atomic flow:
     * 1. Create unshared DAO (returns owned Account and SpotPool)
     * 2. Execute init actions on the unshared Account
     * 3. Finalize and share both objects
     *
     * All steps happen in ONE transaction - if any fails, nothing is created.
     *
     * @param config - DAO configuration
     * @param actions - Callback to execute init actions on the unshared account
     * @returns Transaction that creates DAO with init actions atomically
     *
     * @example
     * ```typescript
     * const tx = sdk.factory.createDAOWithActions(
     *   daoConfig,
     *   (tx, account) => {
     *     // Create stream
     *     VaultActions.createStreamPTB(tx, account, {
     *       vaultName: "team_vesting",
     *       beneficiary: "0x...",
     *       totalAmount: 1_000_000n,
     *       // ...
     *     });
     *   }
     * );
     * ```
     */
    createDAOWithActions(
        config: Omit<DAOConfig, 'iconUrl' | 'description' | 'daoName' | 'affiliateId' | 'agreementLines' | 'agreementDifficulties'>,
        actions: (tx: Transaction, account: TransactionObjectArgument) => void
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        // Step 1: Create unshared DAO
        const payment = builder.splitSui(config.paymentAmount);

        // Construct Option<TreasuryCap> and Option<CoinMetadata>
        const treasuryCapArg = config.treasuryCap
            ? tx.moveCall({
                target: '0x1::option::some',
                typeArguments: [`0x2::coin::TreasuryCap<${config.assetType}>`],
                arguments: [tx.object(config.treasuryCap)],
            })
            : tx.moveCall({
                target: '0x1::option::none',
                typeArguments: [`0x2::coin::TreasuryCap<${config.assetType}>`],
                arguments: [],
            });

        const coinMetadataArg = config.coinMetadata
            ? tx.moveCall({
                target: '0x1::option::some',
                typeArguments: [`0x2::coin::CoinMetadata<${config.assetType}>`],
                arguments: [tx.object(config.coinMetadata)],
            })
            : tx.moveCall({
                target: '0x1::option::none',
                typeArguments: [`0x2::coin::CoinMetadata<${config.assetType}>`],
                arguments: [],
            });

        const [account, spotPool] = tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.factoryPackageId,
                "factory",
                "create_dao_unshared"
            ),
            typeArguments: [config.assetType, config.stableType],
            arguments: [
                tx.sharedObjectRef({
                    objectId: this.factoryObjectId,
                    initialSharedVersion: this.factoryInitialSharedVersion,
                    mutable: true,
                }), // factory
                tx.object(this.packageRegistryId), // registry
                tx.sharedObjectRef({
                    objectId: this.feeManagerId,
                    initialSharedVersion: this.feeManagerInitialSharedVersion,
                    mutable: true,
                }), // fee_manager
                payment, // payment
                treasuryCapArg, // treasury_cap
                coinMetadataArg, // coin_metadata
                tx.object('0x6'), // clock
            ],
        });

        // Step 2: Execute init actions on unshared account
        actions(tx, account);

        // Step 3: Finalize and share
        tx.moveCall({
            target: TransactionUtils.buildTarget(
                this.factoryPackageId,
                "factory",
                "finalize_and_share_dao"
            ),
            typeArguments: [config.assetType, config.stableType],
            arguments: [account, spotPool],
        });

        return tx;
    }

    /**
     * Finalize and share a DAO that was created via launchpad pre-create flow
     * This makes the DAO and its spot pool publicly accessible
     *
     * @param accountId - Account object ID (unshared DAO)
     * @param spotPoolId - UnifiedSpotPool object ID
     * @param assetType - Full type path for asset coin
     * @param stableType - Full type path for stable coin
     * @returns Transaction for finalizing and sharing DAO
     *
     * @example
     * ```typescript
     * const tx = factory.finalizeAndShareDao(
     *   accountId,
     *   spotPoolId,
     *   "0xPKG::coin::MYCOIN",
     *   "0x2::sui::SUI"
     * );
     * ```
     */
    finalizeAndShareDao(
        accountId: string,
        spotPoolId: string,
        assetType: string,
        stableType: string
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.factoryPackageId,
            "factory",
            "finalize_and_share_dao"
        );

        tx.moveCall({
            target,
            typeArguments: [assetType, stableType],
            arguments: [
                tx.object(accountId), // account
                tx.object(spotPoolId), // spot_pool
            ],
        });

        return tx;
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
        const builder = new TransactionBuilder(this.client);
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
