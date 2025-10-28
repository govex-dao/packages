import { Transaction } from "@mysten/sui/transactions";
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
    private factoryObjectId: string;
    private packageRegistryId: string;
    private feeManagerId: string;

    constructor(
        client: SuiClient,
        factoryPackageId: string,
        factoryObjectId: string,
        packageRegistryId: string,
        feeManagerId: string
    ) {
        this.client = client;
        this.factoryPackageId = factoryPackageId;
        this.factoryObjectId = factoryObjectId;
        this.packageRegistryId = packageRegistryId;
        this.feeManagerId = feeManagerId;
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
                    elements: agreementLines.map((line) => tx.pure.string(line)),
                }), // agreement_lines
                tx.makeMoveVec({
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
        // Get the futarchy_types package ID from deployments
        // This would need to be passed in or retrieved from deployment config
        // For now, we'll construct the struct inline
        return tx.moveCall({
            target: `${this.factoryPackageId.replace(
                /futarchy_factory$/,
                "futarchy_types"
            )}::signed::new_signed_u128`,
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
}
