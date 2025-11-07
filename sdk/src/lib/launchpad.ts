import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { TransactionBuilder, TransactionUtils } from "./transaction";
import { InitActionSpec } from "../types/init-actions";

/**
 * Configuration for creating a launchpad raise
 */
export interface CreateRaiseConfig {
    // Token configuration
    raiseTokenType: string; // Full type path for token being sold
    stableCoinType: string; // Full type path for payment token (e.g., SUI, USDC)
    treasuryCap: string; // Object ID of TreasuryCap (must have 0 supply)
    coinMetadata: string; // Object ID of CoinMetadata

    // Raise parameters
    tokensForSale: bigint | number; // Amount of tokens to sell
    minRaiseAmount: bigint | number; // Minimum stable coins to raise
    maxRaiseAmount?: bigint | number; // Optional maximum (undefined = no max)

    // Timing
    startDelayMs?: bigint | number; // Optional delay before raise starts (in milliseconds)

    // Contribution caps
    allowedCaps: (bigint | number)[]; // Sorted array of allowed caps, must end with UNLIMITED_CAP
    allowEarlyCompletion: boolean; // Allow creator to end raise early if min met

    // Metadata
    description: string; // Max 1000 characters
    affiliateId?: string; // Partner identifier (max 64 chars, default: "")
    metadataKeys?: string[]; // Custom metadata keys (max 20)
    metadataValues?: string[]; // Custom metadata values (must match keys length)

    // Payment
    launchpadFee: bigint | number; // Creation fee in MIST
}

/**
 * Contribution configuration
 */
export interface ContributeConfig {
    raiseId: string; // Raise object ID
    raiseTokenType: string; // Full type path for raise token
    stableCoinType: string; // Full type path for stable coin
    paymentAmount: bigint | number; // Amount to contribute in stable coins
    maxTotalCap: bigint | number; // Max total raise you're willing to accept (use UNLIMITED_CAP for any)
    crankFee: bigint | number; // Fee for batch claim operations (from factory config)
}

/**
 * Launchpad operations for token crowdfunding
 */
export class LaunchpadOperations {
    private client: SuiClient;
    private launchpadPackageId: string;
    private factoryObjectId: string;
    private factoryInitialSharedVersion: number;
    private packageRegistryId: string;
    private feeManagerId: string;
    private feeManagerInitialSharedVersion: number;

    // Launchpad constant
    public static readonly UNLIMITED_CAP = 18446744073709551615n;

    constructor(
        client: SuiClient,
        launchpadPackageId: string,
        _factoryPackageId: string, // Passed for consistency but not used
        factoryObjectId: string,
        factoryInitialSharedVersion: number,
        packageRegistryId: string,
        feeManagerId: string,
        feeManagerInitialSharedVersion: number
    ) {
        this.client = client;
        this.launchpadPackageId = launchpadPackageId;
        // _factoryPackageId is not stored as it's not needed for launchpad operations
        this.factoryObjectId = factoryObjectId;
        this.factoryInitialSharedVersion = factoryInitialSharedVersion;
        this.packageRegistryId = packageRegistryId;
        this.feeManagerId = feeManagerId;
        this.feeManagerInitialSharedVersion = feeManagerInitialSharedVersion;
    }

    /**
     * Create a new token launchpad/crowdfunding raise
     *
     * Note: The deadline is automatically calculated by the Move contract as
     * current_time + launchpad_duration_ms (configured in constants)
     *
     * @param config - Raise configuration
     * @param clock - Clock object ID (usually "0x6")
     * @returns Transaction for creating the raise
     *
     * @example
     * ```typescript
     * const tx = launchpad.createRaise({
     *   raiseTokenType: "0x123::mycoin::MYCOIN",
     *   stableCoinType: "0x2::sui::SUI",
     *   treasuryCap: "0xCAP_ID",
     *   coinMetadata: "0xMETADATA_ID",
     *   tokensForSale: 1000000n,
     *   minRaiseAmount: 100n * 1000000000n, // 100 SUI
     *   allowedCaps: [50n * 1000000000n, 100n * 1000000000n, LaunchpadOperations.UNLIMITED_CAP],
     *   allowEarlyCompletion: false,
     *   description: "A revolutionary new token!",
     *   launchpadFee: TransactionUtils.suiToMist(1),
     * });
     * ```
     */
    createRaise(config: CreateRaiseConfig, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        // Validate and prepare parameters
        const affiliateId = config.affiliateId || "";
        const metadataKeys = config.metadataKeys || [];
        const metadataValues = config.metadataValues || [];
        const maxRaise = config.maxRaiseAmount !== undefined ?
            config.maxRaiseAmount :
            undefined;
        const startDelay = config.startDelayMs !== undefined ?
            config.startDelayMs :
            undefined;

        // Prepare launchpad fee payment
        const launchpadFee = builder.splitSui(config.launchpadFee);

        // Build target
        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "create_raise"
        );

        // Create the raise
        tx.moveCall({
            target,
            typeArguments: [config.raiseTokenType, config.stableCoinType],
            arguments: [
                tx.sharedObjectRef({
                    objectId: this.factoryObjectId,
                    initialSharedVersion: this.factoryInitialSharedVersion,
                    mutable: false,
                }), // factory (shared, immutable)
                tx.sharedObjectRef({
                    objectId: this.feeManagerId,
                    initialSharedVersion: this.feeManagerInitialSharedVersion,
                    mutable: true,
                }), // fee_manager (shared, mutable)
                tx.object(config.treasuryCap), // treasury_cap
                tx.object(config.coinMetadata), // coin_metadata
                tx.pure.string(affiliateId), // affiliate_id
                tx.pure.u64(config.tokensForSale), // tokens_for_sale
                tx.pure.u64(config.minRaiseAmount), // min_raise_amount
                tx.pure.option("u64", maxRaise), // max_raise_amount (Option<u64>)
                tx.pure.vector("u64", config.allowedCaps), // allowed_caps
                tx.pure.option("u64", startDelay), // start_delay_ms (Option<u64>)
                tx.pure.bool(config.allowEarlyCompletion), // allow_early_completion
                tx.pure.string(config.description), // description
                tx.makeMoveVec({
                    type: '0x1::string::String',
                    elements: metadataKeys.map(k => tx.pure.string(k))
                }), // metadata_keys
                tx.makeMoveVec({
                    type: '0x1::string::String',
                    elements: metadataValues.map(v => tx.pure.string(v))
                }), // metadata_values
                launchpadFee, // launchpad_fee
                tx.sharedObjectRef({
                    objectId: clock,
                    initialSharedVersion: 1,
                    mutable: false,
                }), // clock (shared, immutable)
            ],
        });

        return tx;
    }

    /**
     * Contribute to a raise
     *
     * @param config - Contribution configuration
     * @param clock - Clock object ID
     * @returns Transaction for contributing
     *
     * @example
     * ```typescript
     * const tx = launchpad.contribute({
     *   raiseId: "0xRAISE_ID",
     *   raiseTokenType: "0x123::mycoin::MYCOIN",
     *   stableCoinType: "0x2::sui::SUI",
     *   paymentAmount: TransactionUtils.suiToMist(10), // 10 SUI
     *   maxTotalCap: TransactionUtils.suiToMist(100), // Accept raise up to 100 SUI
     *   crankFee: TransactionUtils.suiToMist(0.1), // 0.1 SUI
     * });
     * ```
     */
    contribute(config: ContributeConfig, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        // Split payment and crank fee from gas
        const payment = builder.splitSui(config.paymentAmount);
        const crankFee = builder.splitSui(config.crankFee);

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "contribute"
        );

        tx.moveCall({
            target,
            typeArguments: [config.raiseTokenType, config.stableCoinType],
            arguments: [
                tx.object(config.raiseId), // raise
                tx.object(this.factoryObjectId), // factory
                payment, // payment
                tx.pure.u64(config.maxTotalCap), // max_total_cap
                crankFee, // crank_fee
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Settle a raise after deadline (determines final raise amount)
     * Anyone can call this after the deadline
     *
     * @param raiseId - Raise object ID
     * @param raiseTokenType - Full type path for raise token
     * @param stableCoinType - Full type path for stable coin
     * @param clock - Clock object ID
     * @returns Transaction for settling
     */
    settleRaise(
        raiseId: string,
        raiseTokenType: string,
        stableCoinType: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "settle_raise"
        );

        tx.moveCall({
            target,
            typeArguments: [raiseTokenType, stableCoinType],
            arguments: [
                tx.object(raiseId), // raise
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Lock intents and start the raise (must be called after preCreateDaoForRaise)
     *
     * @param raiseId - Raise object ID
     * @param creatorCapId - CreatorCap object ID
     * @param raiseTokenType - Full type path for raise token
     * @param stableCoinType - Full type path for stable coin
     * @returns Transaction for locking intents
     */
    lockIntentsAndStartRaise(
        raiseId: string,
        creatorCapId: string,
        raiseTokenType: string,
        stableCoinType: string
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "lock_intents_and_start_raise"
        );

        tx.moveCall({
            target,
            typeArguments: [raiseTokenType, stableCoinType],
            arguments: [
                tx.object(raiseId), // raise
                tx.object(creatorCapId), // creator_cap
            ],
        });

        return tx;
    }

    /**
     * Complete a successful raise (creates the DAO)
     * Can be called by creator with CreatorCap
     * No DAO creation fee required - launchpad already collected it
     *
     * @param raiseId - Raise object ID
     * @param creatorCapId - CreatorCap object ID
     * @param raiseTokenType - Full type path for raise token
     * @param stableCoinType - Full type path for stable coin
     * @param finalRaiseAmount - Final raise amount to use (must be <= total raised)
     * @param clock - Clock object ID
     * @returns Transaction for completing the raise
     */
    completeRaise(
        raiseId: string,
        creatorCapId: string,
        raiseTokenType: string,
        stableCoinType: string,
        finalRaiseAmount: bigint | number,
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "complete_raise"
        );

        tx.moveCall({
            target,
            typeArguments: [raiseTokenType, stableCoinType],
            arguments: [
                tx.object(raiseId), // raise
                tx.object(creatorCapId), // creator_cap
                tx.pure.u64(finalRaiseAmount), // final_raise_amount
                tx.sharedObjectRef({
                    objectId: this.factoryObjectId,
                    initialSharedVersion: this.factoryInitialSharedVersion,
                    mutable: true,
                }), // factory
                tx.object(this.packageRegistryId), // registry
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Complete a raise permissionlessly (after 24h delay)
     * Anyone can call this after deadline + 24 hours
     * No DAO creation fee required - launchpad already collected it
     *
     * @param raiseId - Raise object ID
     * @param raiseTokenType - Full type path for raise token
     * @param stableCoinType - Full type path for stable coin
     * @param clock - Clock object ID
     * @returns Transaction for completing the raise
     */
    completeRaisePermissionless(
        raiseId: string,
        raiseTokenType: string,
        stableCoinType: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "complete_raise_permissionless"
        );

        tx.moveCall({
            target,
            typeArguments: [raiseTokenType, stableCoinType],
            arguments: [
                tx.object(raiseId), // raise
                tx.sharedObjectRef({
                    objectId: this.factoryObjectId,
                    initialSharedVersion: this.factoryInitialSharedVersion,
                    mutable: true,
                }), // factory
                tx.object(this.packageRegistryId), // registry
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Claim tokens after successful raise
     * Contributor calls this to claim their tokens
     *
     * @param raiseId - Raise object ID
     * @param raiseTokenType - Full type path for raise token
     * @param stableCoinType - Full type path for stable coin
     * @param clock - Clock object ID
     * @returns Transaction for claiming tokens
     */
    claimTokens(
        raiseId: string,
        raiseTokenType: string,
        stableCoinType: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "claim_tokens"
        );

        tx.moveCall({
            target,
            typeArguments: [raiseTokenType, stableCoinType],
            arguments: [
                tx.object(raiseId), // raise
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Claim refund after failed raise
     * Contributor calls this to get their contribution back
     *
     * @param raiseId - Raise object ID
     * @param clock - Clock object ID
     * @returns Transaction for claiming refund
     */
    claimRefund(raiseId: string, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "claim_refund"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(raiseId), // raise
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Batch claim tokens for multiple contributors
     * Cranker earns rewards for processing claims
     *
     * @param raiseId - Raise object ID
     * @param contributors - Array of contributor addresses (max 100)
     * @param clock - Clock object ID
     * @returns Transaction for batch claiming
     */
    batchClaimTokensFor(
        raiseId: string,
        contributors: string[],
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "batch_claim_tokens_for"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(raiseId), // raise
                tx.object(this.factoryObjectId), // factory
                tx.pure.vector("address", contributors), // contributors
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Batch claim refunds for multiple contributors
     * Cranker earns rewards for processing refunds
     *
     * @param raiseId - Raise object ID
     * @param contributors - Array of contributor addresses (max 100)
     * @param clock - Clock object ID
     * @returns Transaction for batch refund claiming
     */
    batchClaimRefundFor(
        raiseId: string,
        contributors: string[],
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "batch_claim_refund_for"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(raiseId), // raise
                tx.object(this.factoryObjectId), // factory
                tx.pure.vector("address", contributors), // contributors
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * End raise early (if min raise met and early completion allowed)
     * Only creator with CreatorCap can call
     *
     * @param raiseId - Raise object ID
     * @param creatorCapId - CreatorCap object ID
     * @param raiseTokenType - Full type path for raise token
     * @param stableCoinType - Full type path for stable coin
     * @param clock - Clock object ID
     * @returns Transaction for ending raise early
     */
    endRaiseEarly(
        raiseId: string,
        creatorCapId: string,
        raiseTokenType: string,
        stableCoinType: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "end_raise_early"
        );

        tx.moveCall({
            target,
            typeArguments: [raiseTokenType, stableCoinType],
            arguments: [
                tx.object(raiseId), // raise
                tx.object(creatorCapId), // creator_cap
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Cleanup a failed raise (returns TreasuryCap and metadata to creator)
     * Anyone can call after raise fails (permissionless)
     *
     * @param raiseId - Raise object ID
     * @param clock - Clock object ID
     * @returns Transaction for cleanup
     */
    cleanupFailedRaise(raiseId: string, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "cleanup_failed_raise"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(raiseId), // raise
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Pre-create DAO for a raise (creates unshared DAO before raise completes)
     * Allows setting up DAO configuration during raise period
     *
     * @param raiseId - Raise object ID
     * @param creatorCapId - CreatorCap object ID
     * @param raiseTokenType - Full type path for raise token
     * @param stableCoinType - Full type path for stable coin
     * @param daoCreationFee - Payment for DAO creation (in MIST)
     * @param clock - Clock object ID
     * @returns Transaction for pre-creating DAO
     */
    /**
     * REMOVED: preCreateDaoForRaise
     *
     * This function was removed to fix ESharedNonNewObject error.
     * Sui requires objects to be shared in the same transaction they're created.
     *
     * OLD FLOW (broken):
     *   1. preCreateDaoForRaise → creates Account in TX1
     *   2. completeRaise → tries to share Account in TX2 → FAILS
     *
     * NEW FLOW (fixed):
     *   1. completeRaise → creates Account + shares it in same TX → SUCCESS
     *   2. Frontend PTB → executes staged init specs against shared Account
     *
     * Migration: Remove calls to preCreateDaoForRaise from your code.
     * The DAO is now automatically created during completeRaise.
     */

    /**
     * TWO-OUTCOME PATTERN (New - for staging success/failure intents)
     *
     * The launchpad now supports a two-outcome system where you can stage different
     * actions for success vs failure scenarios (just like proposals).
     *
     * Because this requires building InitActionSpecs in the same PTB as staging,
     * you should construct these transactions manually rather than using SDK wrappers.
     *
     * @example Staging success intents (execute when raise succeeds)
     * ```typescript
     * import { Transaction } from '@mysten/sui/transactions';
     * import { bcs } from '@mysten/sui/bcs';
     *
     * const tx = new Transaction();
     *
     * // Step 1: Create empty InitActionSpecs
     * const specs = tx.moveCall({
     *   target: `${actionsPkg}::init_action_specs::new_init_specs`,
     *   arguments: [],
     * });
     *
     * // Step 2: Add actions to specs (example: create a stream)
     * tx.moveCall({
     *   target: `${actionsPkg}::stream_init_actions::add_create_stream_spec`,
     *   arguments: [
     *     specs,
     *     tx.pure.string('treasury'),
     *     tx.pure(bcs.Address.serialize(beneficiary).toBytes()),
     *     tx.pure.u64(amountPerIteration), // amount per iteration (NO DIVISION in Move!)
     *     tx.pure.u64(startTime),
     *     tx.pure.u64(iterationsTotal), // number of unlock events
     *     tx.pure.u64(iterationPeriodMs), // time between unlocks (ms)
     *     tx.pure.option('u64', null), // cliff_time
     *     tx.pure.option('u64', null), // claim_window_ms (use-or-lose)
     *     tx.pure.u64(maxPerWithdrawal),
     *     tx.pure.bool(true), // is_transferable
     *     tx.pure.bool(true), // is_cancellable
     *   ],
     * });
     *
     * // Step 3: Stage as SUCCESS intent
     * tx.moveCall({
     *   target: `${launchpadPkg}::launchpad::stage_success_intent`,
     *   typeArguments: [raiseTokenType, stableCoinType],
     *   arguments: [
     *     tx.object(raiseId),
     *     tx.object(registryId),
     *     tx.object(creatorCapId),
     *     specs,
     *     tx.object('0x6'), // clock
     *   ],
     * });
     *
     * await client.signAndExecuteTransaction({ transaction: tx, signer });
     * ```
     *
     * @example Staging failure intents (execute if raise fails)
     * ```typescript
     * const tx = new Transaction();
     *
     * const specs = tx.moveCall({
     *   target: `${actionsPkg}::init_action_specs::new_init_specs`,
     *   arguments: [],
     * });
     *
     * // Example: Return TreasuryCap to creator if raise fails
     * tx.moveCall({
     *   target: `${actionsPkg}::currency_init_actions::add_return_treasury_cap_spec`,
     *   arguments: [specs, tx.pure(bcs.Address.serialize(creator).toBytes())],
     * });
     *
     * // Stage as FAILURE intent
     * tx.moveCall({
     *   target: `${launchpadPkg}::launchpad::stage_failure_intent`,
     *   typeArguments: [raiseTokenType, stableCoinType],
     *   arguments: [
     *     tx.object(raiseId),
     *     tx.object(registryId),
     *     tx.object(creatorCapId),
     *     specs,
     *     tx.object('0x6'), // clock
     *   ],
     * });
     * ```
     *
     * After staging intents, call lockIntentsAndStartRaise() to lock them
     * and start accepting contributions.
     *
     * See: scripts/launchpad-e2e-with-init-actions-TWO-OUTCOME.ts for full example
     */

    /**
     * @deprecated Use the two-outcome pattern instead (see documentation above)
     *
     * This method is deprecated in favor of the new two-outcome pattern where
     * you stage specs manually using stage_success_intent() or stage_failure_intent().
     *
     * Old pattern (deprecated):
     * - stageLaunchpadInitIntent() - single set of intents
     *
     * New pattern (recommended):
     * - Manually build PTB with init_action_specs::new_init_specs()
     * - Add actions with action-specific builders
     * - Stage with launchpad::stage_success_intent() or stage_failure_intent()
     *
     * See TWO-OUTCOME PATTERN documentation above for examples.
     *
     * @param raiseId - Raise object ID
     * @param creatorCapId - CreatorCap object ID
     * @param initSpec - Init action specification
     * @param clock - Clock object ID
     * @returns Transaction for staging intent
     */
    stageLaunchpadInitIntent(
        raiseId: string,
        creatorCapId: string,
        initSpec: InitActionSpec,
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "stage_launchpad_init_intent"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(raiseId), // raise
                tx.object(this.packageRegistryId), // registry
                tx.object(creatorCapId), // creator_cap
                tx.pure(initSpec as any), // spec
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Remove the most recently staged init intent
     *
     * @param raiseId - Raise object ID
     * @param creatorCapId - CreatorCap object ID
     * @returns Transaction for unstaging intent
     */
    unstageLastLaunchpadInitIntent(
        raiseId: string,
        creatorCapId: string
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "unstage_last_launchpad_init_intent"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(raiseId), // raise
                tx.object(creatorCapId), // creator_cap
            ],
        });

        return tx;
    }

    /**
     * Sweep remaining dust tokens/coins after claim period ends
     * Returns remaining balances to the DAO
     *
     * @param raiseId - Raise object ID
     * @param creatorCapId - CreatorCap object ID
     * @param daoAccountId - DAO Account object ID
     * @param clock - Clock object ID
     * @returns Transaction for sweeping dust
     */
    sweepDust(
        raiseId: string,
        creatorCapId: string,
        daoAccountId: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "sweep_dust"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(raiseId), // raise
                tx.object(creatorCapId), // creator_cap
                tx.object(daoAccountId), // dao_account
                tx.object(this.packageRegistryId), // registry
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Sweep protocol fees collected during raise
     * Only callable by FactoryOwnerCap holder
     *
     * @param raiseId - Raise object ID
     * @param factoryOwnerCapId - FactoryOwnerCap object ID
     * @param clock - Clock object ID
     * @returns Transaction for sweeping protocol fees
     */
    sweepProtocolFees(
        raiseId: string,
        factoryOwnerCapId: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "sweep_protocol_fees"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(raiseId), // raise
                tx.object(factoryOwnerCapId), // _owner_cap
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Set verification level for a launchpad raise
     * Only callable by ValidatorAdminCap holder
     *
     * @param raiseId - Raise object ID
     * @param validatorCapId - ValidatorAdminCap object ID
     * @param level - Verification level (0-255)
     * @param attestationUrl - URL to verification attestation
     * @param reviewText - Admin review text
     * @param clock - Clock object ID
     * @returns Transaction for setting verification
     */
    setLaunchpadVerification(
        raiseId: string,
        validatorCapId: string,
        level: number,
        attestationUrl: string,
        reviewText: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "launchpad",
            "set_launchpad_verification"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(raiseId), // raise
                tx.object(validatorCapId), // _validator_cap
                tx.pure.u8(level), // level
                tx.pure.string(attestationUrl), // attestation_url
                tx.pure.string(reviewText), // review_text
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Cleanup initialization intents (remove all staged intents)
     * Used to abort the initialization workflow
     *
     * @param accountId - Account/DAO object ID
     * @param ownerId - Owner ID (typically CreatorCap ID)
     * @param initSpecs - Array of init specs to cleanup
     * @returns Transaction for cleanup
     *
     * @example
     * ```typescript
     * const tx = sdk.launchpad.cleanupInitIntents(
     *   accountId,
     *   ownerCapId,
     *   [spec1, spec2, spec3]
     * );
     * ```
     */
    cleanupInitIntents(
        accountId: string,
        ownerId: string,
        initSpecs: InitActionSpec[]
    ): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.launchpadPackageId,
            "init_actions",
            "cleanup_init_intents"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(accountId), // account
                tx.pure.id(ownerId), // owner_id
                tx.pure(initSpecs as any), // specs
            ],
        });

        return tx;
    }
}
