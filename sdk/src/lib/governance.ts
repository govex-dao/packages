import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { TransactionBuilder, TransactionUtils } from "./transaction";

/**
 * Configuration for creating a proposal
 *
 * SECURITY NOTE: All governance parameters (review/trading periods, fees, TWAP config, etc.)
 * are now READ FROM DAO CONFIG and cannot be overridden by callers.
 * This prevents governance bypass attacks.
 */
export interface CreateProposalConfig {
    // DAO configuration
    daoAccountId: string; // DAO Account ID - ALL governance config read from here
    assetType: string; // Full type path for DAO asset token
    stableType: string; // Full type path for stable token

    // Proposal content
    title: string;
    introduction: string; // Introduction/description
    outcomeMessages: string[]; // E.g., ["Reject", "Accept"]
    outcomeDetails: string[]; // Details for each outcome (must match outcomeMessages length)
    metadata: string; // JSON or additional metadata

    // Proposal settings
    proposer: string; // Address of proposal creator
    treasuryAddress: string; // DAO treasury address
    usedQuota: boolean; // Track if proposal used admin budget

    // Actions for YES/Accept outcome (optional)
    intentSpecForYes?: any; // Optional vector<ActionSpec> for outcome 1 - N (YES/Accept/[Name]) - outcome 0 = Reject/No
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
     * SECURITY: All governance parameters (review period, trading period, fees, TWAP config, etc.)
     * are now read from DAO config. Callers can only control proposal-specific content.
     * This prevents governance bypass attacks where attackers could override DAO settings.
     *
     * This creates the proposal object and allows outcomes to be added.
     * After creation, you'll need to:
     * 1. Add init action specs to outcomes (optional)
     * 2. Initialize the market (transitions to REVIEW state)
     *
     * @param config - Proposal configuration (governance params read from DAO)
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

        // Create Option::None for intent_spec_for_yes if not provided
        // TODO: Support actual ActionSpec when intentSpecForYes is provided
        const intentSpec = tx.moveCall({
            target: '0x1::option::none',
            typeArguments: [`vector<0x1::string::String>`], // Placeholder - should be ActionSpec
            arguments: [],
        });

        // NEW SECURE SIGNATURE: All governance params read from DAO config
        tx.moveCall({
            target,
            typeArguments: [config.assetType, config.stableType],
            arguments: [
                tx.object(config.daoAccountId), // dao_account (ALL config read from here)
                tx.pure.address(config.treasuryAddress), // treasury_address
                tx.pure.string(config.title), // title
                tx.pure.string(config.introduction), // introduction_details
                tx.pure.string(config.metadata), // metadata
                tx.pure.vector("string", config.outcomeMessages), // outcome_messages
                tx.pure.vector("string", config.outcomeDetails), // outcome_details
                tx.pure.address(config.proposer), // proposer
                tx.pure.bool(config.usedQuota), // used_quota
                intentSpec, // intent_spec_for_yes
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

    /**
     * Get proposal information
     *
     * @param proposalId - Proposal object ID
     * @returns Proposal info
     */
    async getProposal(proposalId: string): Promise<{
        id: string;
        title: string;
        state: number;
        outcomes: string[];
        winningOutcome?: number;
    }> {
        const obj = await this.client.getObject({
            id: proposalId,
            options: { showContent: true },
        });

        if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
            throw new Error(`Proposal not found: ${proposalId}`);
        }

        const fields = obj.data.content.fields as any;

        return {
            id: proposalId,
            title: fields.title || '',
            state: Number(fields.state || 0),
            outcomes: fields.outcome_messages || [],
            winningOutcome: fields.winning_outcome !== undefined
                ? Number(fields.winning_outcome)
                : undefined,
        };
    }

    /**
     * List proposals for a DAO
     *
     * @param daoId - DAO account ID
     * @param state - Optional state filter (0=PREMARKET, 1=REVIEW, 2=TRADING, 3=FINALIZED)
     * @returns Array of proposal IDs
     */
    async listProposals(daoId: string, state?: number): Promise<string[]> {
        // Query events or owned objects to find proposals
        // This is a simplified implementation
        const events = await this.client.queryEvents({
            query: {
                MoveEventType: `${this.marketsPackageId}::proposal::ProposalCreated`,
            },
            limit: 100,
        });

        const proposalIds: string[] = [];

        for (const event of events.data) {
            const parsedJson = event.parsedJson as any;
            if (parsedJson?.dao_id === daoId) {
                proposalIds.push(parsedJson.proposal_id);
            }
        }

        // Filter by state if specified
        if (state !== undefined) {
            const filtered: string[] = [];
            for (const id of proposalIds) {
                try {
                    const proposal = await this.getProposal(id);
                    if (proposal.state === state) {
                        filtered.push(id);
                    }
                } catch {
                    // Skip invalid proposals
                }
            }
            return filtered;
        }

        return proposalIds;
    }
}
