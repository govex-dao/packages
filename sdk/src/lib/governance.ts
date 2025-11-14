import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { bcs } from "@mysten/sui/bcs";
import { TransactionBuilder, TransactionUtils } from "./transaction";

/**
 * Configuration for creating a proposal
 */
export interface CreateProposalConfig {
    // DAO  configuration
    daoId: string; // DAO Account ID
    assetType: string; // Full type path for DAO asset token
    stableType: string; // Full type path for stable token

    // Proposal content
    title: string;
    introduction: string;
    outcomeMessages: string[]; // E.g., ["Accept", "Reject"]
    outcomeDetails: string[]; // Details for each outcome (must match outcomeMessages length)
    metadata: string; // JSON or additional metadata

    // Proposal settings
    proposer: string; // Address of proposal creator
    treasuryAddress: string; // DAO treasury address
    maxOutcomes: bigint | number; // DAO's configured max outcomes
    usesDaoLiquidity: boolean; // If true, uses DAO's spot pool liquidity
    usedQuota: boolean; // Track if proposal used admin budget

    // Timing (in milliseconds)
    reviewPeriodMs: bigint | number;
    tradingPeriodMs: bigint | number;
    twapStartDelayMs?: bigint | number; // Optional, defaults to 0

    // Market configuration
    minAssetLiquidity: bigint | number;
    minStableLiquidity: bigint | number;
    ammFeeBps: bigint | number; // AMM fee in basis points (e.g., 30 for 0.3%)

    // TWAP configuration
    twapInitialObservation: bigint; // Initial TWAP observation value
    twapStepMax: bigint | number;
    twapThreshold: bigint; // Signed threshold for determining winner

    // Actions for YES/Accept outcome (optional)
    intentSpecForYes?: any; // Optional vector<ActionSpec> for outcome 1 (YES/Accept) - outcome 0 = Reject/No

    // Reference ID (vestigial field, can be any ID - no queue system exists)
    referenceProposalId: string; // Optional reference ID for tracking purposes
}

/**
 * Configuration for advancing proposal state
 */
export interface AdvanceProposalStateConfig {
    daoId: string; // DAO Account ID (required for quantum split)
    proposalId: string;
    assetType: string;
    stableType: string;
    escrowId: string;
    spotPoolId: string;
}

/**
 * Configuration for finalizing a proposal
 */
export interface FinalizeProposalConfig {
    proposalId: string;
    assetType: string;
    stableType: string;
    daoId: string;
    escrowId: string;
    marketStateId: string;
    spotPoolId: string;
}

/**
 * Configuration for executing proposal actions
 */
export interface ExecuteProposalActionsConfig {
    daoId: string;
    proposalId: string;
    marketStateId: string;
    assetType: string;
    stableType: string;
}

/**
 * Governance operations for proposal lifecycle management
 */
export class GovernanceOperations {
    private client: SuiClient;
    private marketsPackageId: string;
    private governancePackageId: string;
    private packageRegistryId: string;

    constructor(
        client: SuiClient,
        marketsPackageId: string,
        governancePackageId: string,
        packageRegistryId: string
    ) {
        this.client = client;
        this.marketsPackageId = marketsPackageId;
        this.governancePackageId = governancePackageId;
        this.packageRegistryId = packageRegistryId;
    }

    /**
     * Create a new proposal in PREMARKET state
     *
     * This creates the proposal object and allows outcomes to be added.
     * After creation, you'll need to:
     * 1. Add init action specs to outcomes (optional)
     * 2. Initialize the market (transitions to REVIEW state)
     *
     * @param config - Proposal configuration
     * @param clock - Clock object ID (usually "0x6")
     * @returns Transaction for creating the proposal
     */
    createProposal(config: CreateProposalConfig, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.marketsPackageId,
            "proposal",
            "new_premarket"
        );

        // Create the proposal
        tx.moveCall({
            target,
            typeArguments: [config.assetType, config.stableType],
            arguments: [
                tx.object(config.referenceProposalId), // proposal_id_from_queue (vestigial)
                tx.object(config.daoId), // dao_id
                tx.pure.u64(config.reviewPeriodMs), // review_period_ms
                tx.pure.u64(config.tradingPeriodMs), // trading_period_ms
                tx.pure.u64(config.minAssetLiquidity), // min_asset_liquidity
                tx.pure.u64(config.minStableLiquidity), // min_stable_liquidity
                tx.pure.u64(config.twapStartDelayMs || 0), // twap_start_delay
                tx.pure.u128(config.twapInitialObservation), // twap_initial_observation
                tx.pure.u64(config.twapStepMax), // twap_step_max
                tx.pure.u128(config.twapThreshold), // twap_threshold (SignedU128)
                tx.pure.u64(config.ammFeeBps), // amm_total_fee_bps
                tx.pure.u64(config.maxOutcomes), // max_outcomes
                tx.pure.address(config.treasuryAddress), // treasury_address
                tx.pure.string(config.title), // title
                tx.pure.string(config.introduction), // introduction_details
                tx.pure.string(config.metadata), // metadata
                tx.pure.vector("string", config.outcomeMessages), // outcome_messages
                tx.pure.vector("string", config.outcomeDetails), // outcome_details
                tx.pure.address(config.proposer), // proposer
                tx.pure.bool(config.usesDaoLiquidity), // uses_dao_liquidity
                tx.pure.bool(config.usedQuota), // used_quota
                config.intentSpecForYes
                    ? tx.pure(bcs.option(bcs.vector(bcs.u8())).serialize(config.intentSpecForYes).toBytes())
                    : tx.pure(bcs.option(bcs.vector(bcs.u8())).serialize(null).toBytes()), // intent_spec_for_yes
                tx.sharedObjectRef({
                    objectId: clock,
                    initialSharedVersion: 1,
                    mutable: false,
                }), // clock
            ],
        });

        return tx;
    }

    /**
     * Advance proposal through state machine
     *
     * States: PREMARKET (0) → REVIEW (1) → TRADING (2) → FINALIZED (3)
     *
     * REVIEW → TRADING: Automatically performs quantum liquidity split
     * - Moves liquidity from spot pool to conditional AMMs
     * - Percentage determined by DAO config's conditional_liquidity_ratio_percent (not per-proposal)
     *
     * TRADING → (ended): Market stops trading, ready for finalization
     *
     * @param config - Advance state configuration
     * @param clock - Clock object ID
     * @returns Transaction for advancing state
     */
    advanceProposalState(config: AdvanceProposalStateConfig, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.governancePackageId,
            "proposal_lifecycle",
            "advance_proposal_state"
        );

        tx.moveCall({
            target,
            typeArguments: [config.assetType, config.stableType],
            arguments: [
                tx.object(config.daoId), // account (DAO)
                tx.object(config.proposalId), // proposal
                tx.object(config.escrowId), // escrow
                tx.object(config.spotPoolId), // spot_pool (for quantum split)
                tx.sharedObjectRef({
                    objectId: clock,
                    initialSharedVersion: 1,
                    mutable: false,
                }), // clock
            ],
        });

        return tx;
    }

    /**
     * Finalize proposal and determine winning outcome
     *
     * This calculates the winning outcome based on TWAP prices and
     * prepares the proposal for intent execution.
     *
     * Process:
     * 1. Calculates winner based on TWAP vs threshold
     * 2. Performs quantum liquidity recombination:
     *    - Burns winning outcome's conditional LP tokens
     *    - Returns liquidity back to spot pool
     *    - Clears losing outcome's action specs
     * 3. Clears active escrow from spot pool
     * 4. Transitions proposal to FINALIZED state
     *
     * @param config - Finalize configuration
     * @param clock - Clock object ID
     * @returns Transaction for finalizing the proposal
     */
    finalizeProposal(config: FinalizeProposalConfig, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.governancePackageId,
            "proposal_lifecycle",
            "finalize_proposal_market"
        );

        tx.moveCall({
            target,
            typeArguments: [config.assetType, config.stableType],
            arguments: [
                tx.object(config.daoId), // account (DAO)
                tx.object(this.packageRegistryId), // registry
                tx.object(config.proposalId), // proposal
                tx.object(config.escrowId), // escrow
                tx.object(config.marketStateId), // market_state
                tx.object(config.spotPoolId), // spot_pool
                tx.sharedObjectRef({
                    objectId: clock,
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return tx;
    }

    /**
     * Finalize proposal with spot pool liquidity recombination
     *
     * Alternative to finalizeProposal() that combines market finalization
     * with quantum liquidity recombination in a single call.
     *
     * This is the recommended finalization method as it:
     * 1. Finalizes the proposal market
     * 2. Returns conditional liquidity back to spot pool
     * 3. Clears active escrow
     *
     * @param config - Finalize configuration
     * @param clock - Clock object ID
     * @returns Transaction for finalizing with spot pool
     */
    finalizeProposalWithSpotPool(config: FinalizeProposalConfig, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.governancePackageId,
            "proposal_lifecycle",
            "finalize_proposal_with_spot_pool"
        );

        tx.moveCall({
            target,
            typeArguments: [config.assetType, config.stableType],
            arguments: [
                tx.object(config.daoId), // account (DAO)
                tx.object(this.packageRegistryId), // registry
                tx.object(config.proposalId), // proposal
                tx.object(config.escrowId), // escrow
                tx.object(config.spotPoolId), // spot_pool
                tx.sharedObjectRef({
                    objectId: clock,
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return tx;
    }

    /**
     * Execute proposal actions after approval
     *
     * After a proposal is finalized and the Accept/Yes outcome won,
     * this executes the staged InitActionSpecs.
     *
     * Requirements:
     * - Proposal must be in FINALIZED state
     * - Market must show outcome 1 (Accept/Yes) as winner (outcome 0 = Reject/No)
     * - Caller must be authorized
     *
     * @param config - Execute configuration
     * @param clock - Clock object ID
     * @returns Transaction for executing proposal actions
     */
    executeProposalActions(config: ExecuteProposalActionsConfig, clock: string = "0x6"): Transaction {
        const builder = new TransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.governancePackageId,
            "proposal_lifecycle",
            "execute_proposal_actions"
        );

        tx.moveCall({
            target,
            typeArguments: [config.assetType, config.stableType],
            arguments: [
                tx.object(config.daoId), // account (DAO)
                tx.object(this.packageRegistryId), // registry
                tx.object(config.proposalId), // proposal
                tx.object(config.marketStateId), // market_state
                tx.sharedObjectRef({
                    objectId: clock,
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return tx;
    }

    /**
     * Check if a proposal can be executed
     *
     * View function to validate if proposal actions can be executed.
     * Returns true if:
     * - Market is finalized
     * - Outcome 1 (Accept/Yes) won (outcome 0 = Reject/No)
     *
     * @param proposalId - Proposal object ID
     * @param marketStateId - Market state object ID
     * @param assetType - DAO asset type
     * @param stableType - DAO stable type
     * @returns Promise<boolean> - True if executable
     */
    async canExecuteProposal(
        proposalId: string,
        marketStateId: string,
        assetType: string,
        stableType: string
    ): Promise<boolean> {
        const result = await this.client.devInspectTransactionBlock({
            sender: "0x0000000000000000000000000000000000000000000000000000000000000000",
            transactionBlock: (() => {
                const tx = new Transaction();
                tx.moveCall({
                    target: TransactionUtils.buildTarget(
                        this.governancePackageId,
                        "proposal_lifecycle",
                        "can_execute_proposal"
                    ),
                    typeArguments: [assetType, stableType],
                    arguments: [tx.object(proposalId), tx.object(marketStateId)],
                });
                return tx;
            })(),
        });

        if (result.results && result.results[0]?.returnValues) {
            const value = result.results[0].returnValues[0];
            return value[0][0] === 1; // BCS bool: 1 = true, 0 = false
        }

        return false;
    }

    /**
     * Check if a proposal has passed
     *
     * View function to check if proposal is finalized and outcome 0 won.
     *
     * @param proposalId - Proposal object ID
     * @param assetType - DAO asset type
     * @param stableType - DAO stable type
     * @returns Promise<boolean> - True if proposal passed
     */
    async isPassed(proposalId: string, assetType: string, stableType: string): Promise<boolean> {
        const result = await this.client.devInspectTransactionBlock({
            sender: "0x0000000000000000000000000000000000000000000000000000000000000000",
            transactionBlock: (() => {
                const tx = new Transaction();
                tx.moveCall({
                    target: TransactionUtils.buildTarget(
                        this.governancePackageId,
                        "proposal_lifecycle",
                        "is_passed"
                    ),
                    typeArguments: [assetType, stableType],
                    arguments: [tx.object(proposalId)],
                });
                return tx;
            })(),
        });

        if (result.results && result.results[0]?.returnValues) {
            const value = result.results[0].returnValues[0];
            return value[0][0] === 1;
        }

        return false;
    }
}
