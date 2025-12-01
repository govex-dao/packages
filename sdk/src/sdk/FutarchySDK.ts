import { SuiClient } from "@mysten/sui/client";
import { NetworkType, createNetworkConfig, NetworkConfig } from "../config/network";
import { DeploymentManager } from "../config/deployment";
import { DeploymentConfig } from "../types/deployment";
import { FactoryOperations } from "../services/factory";
import { FactoryAdminOperations } from "../services/factory-admin";
import { FactoryValidatorOperations } from "../services/factory-validator";
import { PackageRegistryAdminOperations } from "../services/package-registry-admin";
import { FeeManagerOperations } from "../services/fee-manager";
import { OracleActionsOperations } from "../services/oracle-actions";
import { MarketsOperations, TWAPOperations } from "../services/markets";
import { ProposalSponsorshipOperations } from "../services/proposal-sponsorship";
import { ProposalEscrowOperations } from "../services/proposal-escrow";
import { IntentJanitorOperations } from "../execution/governance/intent-janitor";
import { DAODissolutionOperations } from "../execution/dao/dao-dissolution-actions";
import { QueryHelper } from "../services/queries";
import { DAOOperations } from "../workflows/operations/dao-operations";
import { VaultOperations } from "../workflows/operations/vault-operations";
import { CurrencyOperations } from "../workflows/operations/currency-operations";
import { MarketsHighLevelOperations } from "../workflows/operations/markets-operations";
import { TransferOperations } from "../workflows/operations/transfer-operations";

// Workflow imports
import { LaunchpadWorkflow, LaunchpadWorkflowPackages, LaunchpadWorkflowSharedObjects } from "../workflows/launchpad-workflow";
import { ProposalWorkflow, ProposalWorkflowPackages, ProposalWorkflowSharedObjects } from "../workflows/proposal-workflow";
import { IntentExecutor, IntentExecutorPackages } from "../workflows/intent-executor";
import { TransactionComposer, TransactionComposerPackages, TransactionComposerSharedObjects } from "../ptb/transaction-composer";
import { UnifiedActions, ActionsPackages } from "../actions-unified";

/**
 * Configuration options for FutarchySDK initialization
 */
export interface FutarchySDKConfig {
    network: NetworkType | string;
    deployments: DeploymentConfig;
}

/**
 * Main SDK class for interacting with Futarchy Protocol on Sui
 *
 * @example
 * ```typescript
 * import { FutarchySDK } from '@govex/futarchy-sdk';
 * import deployments from './deployments.json';
 *
 * const sdk = await FutarchySDK.init({
 *   network: 'devnet',
 *   deployments
 * });
 *
 * // Use the SDK
 * const factory = sdk.deployments.getFactory();
 * console.log('Factory object ID:', factory?.objectId);
 * ```
 */
/**
 * Workflows namespace - high-level orchestrators for complex multi-step operations
 */
export interface SDKWorkflows {
    /** Launchpad workflow - complete token launch orchestration */
    launchpad: LaunchpadWorkflow;
    /** Proposal workflow - complete governance proposal orchestration */
    proposal: ProposalWorkflow;
    /** Intent executor - execute staged actions via PTB pattern */
    intents: IntentExecutor;
}

/**
 * Markets namespace - organized market operations
 */
export interface SDKMarkets {
    /** Core market primitives */
    core: MarketsOperations;
    /** High-level market operations */
    high: MarketsHighLevelOperations;
    /** TWAP oracle operations */
    twap: TWAPOperations;
}

export class FutarchySDK {
    // ========================================================================
    // PRIMARY APIs (Recommended)
    // ========================================================================

    /** Workflow orchestrators for complex multi-step operations */
    public workflows: SDKWorkflows;
    /** Market operations organized by abstraction level */
    public markets: SDKMarkets;
    /** Unified action builders */
    public actions: UnifiedActions;
    /** Fluent PTB composer */
    public ptb: TransactionComposer;

    // High-level operations (user-friendly APIs)
    /** DAO account operations */
    public dao: DAOOperations;
    /** Vault operations (deposit, withdraw, streams) */
    public vault: VaultOperations;
    /** Currency operations (mint, burn) */
    public currency: CurrencyOperations;
    /** Transfer operations */
    public transfer: TransferOperations;
    /** Query helper for on-chain data */
    public query: QueryHelper;

    // ========================================================================
    // ADMIN APIs (For protocol administrators)
    // ========================================================================

    /** Factory admin operations */
    public factoryAdmin: FactoryAdminOperations;
    /** Factory validator operations */
    public factoryValidator: FactoryValidatorOperations;
    /** Package registry admin operations */
    public packageRegistryAdmin: PackageRegistryAdminOperations;
    /** Fee manager operations */
    public feeManager: FeeManagerOperations;

    // ========================================================================
    // LOW-LEVEL APIs (Use workflows instead when possible)
    // ========================================================================

    /** Factory operations (low-level) */
    public factory: FactoryOperations;
    /** Oracle actions operations */
    public oracleActions: OracleActionsOperations;
    /** Proposal sponsorship operations */
    public proposalSponsorship: ProposalSponsorshipOperations;
    /** Proposal escrow operations */
    public proposalEscrow: ProposalEscrowOperations;
    /** Intent janitor operations (cleanup expired intents) */
    public intentJanitor: IntentJanitorOperations;
    /** DAO dissolution operations */
    public daoDissolution: DAODissolutionOperations;

    // Convenience properties for commonly used package IDs
    public packageRegistryId: string;
    public vaultActionsPackageId: string;

    protected constructor(
        public client: SuiClient,
        public network: NetworkConfig,
        public deployments: DeploymentManager,
    ) {
        // Initialize query helper
        this.query = new QueryHelper(client);

        // Initialize factory operations
        const factoryPackageId = deployments.getPackageId("futarchy_factory")!;
        const factoryObject = deployments.getFactory();
        const packageRegistry = deployments.getPackageRegistry();

        // Get FeeManager from futarchy_markets_core deployment
        const marketsCoreDeployment = deployments.getPackage("futarchy_markets_core");
        const feeManager = marketsCoreDeployment?.sharedObjects.find(
            (obj) => obj.name === "FeeManager"
        );

        if (!factoryPackageId || !factoryObject || !packageRegistry || !feeManager) {
            throw new Error(
                "Missing required deployment objects. Ensure Factory, PackageRegistry, and FeeManager are deployed."
            );
        }

        const futarchyTypesPackageId = deployments.getPackageId("futarchy_types")!;

        // Set convenience properties
        this.packageRegistryId = packageRegistry.objectId;
        this.vaultActionsPackageId = deployments.getPackageId("futarchy_actions")!;

        this.factory = new FactoryOperations(
            client,
            factoryPackageId,
            futarchyTypesPackageId,
            factoryObject.objectId,
            factoryObject.initialSharedVersion,
            packageRegistry.objectId,
            feeManager.objectId,
            feeManager.initialSharedVersion
        );

        // Initialize factory admin operations
        this.factoryAdmin = new FactoryAdminOperations(
            client,
            factoryPackageId,
            factoryObject.objectId,
            factoryObject.initialSharedVersion
        );

        // Initialize factory validator operations
        this.factoryValidator = new FactoryValidatorOperations(
            client,
            factoryPackageId,
            packageRegistry.objectId
        );

        // Initialize package registry admin operations
        const protocolPackageId = deployments.getPackageId("AccountProtocol")!;
        this.packageRegistryAdmin = new PackageRegistryAdminOperations(
            client,
            protocolPackageId,
            packageRegistry.objectId,
            packageRegistry.initialSharedVersion
        );

        // Initialize fee manager operations
        const marketsCorePackageId = deployments.getPackageId("futarchy_markets_core")!;
        const futarchyCorePackageId = deployments.getPackageId("futarchy_core")!;
        this.feeManager = new FeeManagerOperations(
            client,
            feeManager.objectId,
            marketsCorePackageId
        );

        // Initialize oracle actions operations
        const oracleActionsPackageId = deployments.getPackageId("futarchy_oracle_actions")!;
        this.oracleActions = new OracleActionsOperations(
            client,
            oracleActionsPackageId,
            packageRegistry.objectId,
            futarchyCorePackageId
        );

        const governancePackageId = deployments.getPackageId("futarchy_governance")!;

        // Initialize proposal sponsorship operations
        this.proposalSponsorship = new ProposalSponsorshipOperations(
            client,
            governancePackageId
        );

        // Initialize proposal escrow operations
        this.proposalEscrow = new ProposalEscrowOperations(
            client,
            governancePackageId
        );

        // Initialize intent janitor operations
        const governanceActionsPackageId = deployments.getPackageId("futarchy_governance_actions")!;
        this.intentJanitor = new IntentJanitorOperations(
            client,
            governanceActionsPackageId
        );

        // Initialize DAO dissolution operations
        const futarchyActionsPackageId = deployments.getPackageId("futarchy_actions")!;
        this.daoDissolution = new DAODissolutionOperations(
            client,
            futarchyActionsPackageId
        );

        // Initialize NEW high-level operations
        const accountActionsPackageId = deployments.getPackageId("AccountActions")!;

        this.dao = new DAOOperations({
            client,
            accountProtocolPackageId: protocolPackageId,
            futarchyCorePackageId,
            packageRegistryId: packageRegistry.objectId,
        });

        this.vault = new VaultOperations({
            client,
            accountActionsPackageId,
            futarchyCorePackageId,
            packageRegistryId: packageRegistry.objectId,
        });

        this.currency = new CurrencyOperations({
            client,
            accountActionsPackageId,
            futarchyCorePackageId,
            packageRegistryId: packageRegistry.objectId,
        });

        const marketsHighLevel = new MarketsHighLevelOperations({
            client,
            marketsPackageId: marketsCorePackageId,
            marketsCorePackageId,
        });

        this.transfer = new TransferOperations({
            client,
            accountActionsPackageId,
            futarchyCorePackageId,
            packageRegistryId: packageRegistry.objectId,
        });

        // Initialize markets operations
        const marketsOps = new MarketsOperations(client, marketsCorePackageId);
        const twapOps = new TWAPOperations(client, marketsCorePackageId);

        // Set up organized markets namespace
        this.markets = {
            core: marketsOps,
            high: marketsHighLevel,
            twap: twapOps,
        };

        // Initialize unified actions namespace
        const actionsPackages: ActionsPackages = {
            accountActionsPackageId,
            futarchyActionsPackageId,
            futarchyTypesPackageId,
            futarchyOracleActionsPackageId: oracleActionsPackageId,
            futarchyGovernanceActionsPackageId: governanceActionsPackageId,
            futarchyCorePackageId,
        };
        this.actions = new UnifiedActions(actionsPackages);

        // Get primitives and operations package IDs
        const marketsPrimitivesPackageId = deployments.getPackageId("futarchy_markets_primitives")!;
        const marketsOperationsPackageId = deployments.getPackageId("futarchy_markets_operations")!;
        const oneShotUtilsPackageId = deployments.getPackageId("futarchy_one_shot_utils");

        // Initialize workflow packages
        const intentExecutorPackages: IntentExecutorPackages = {
            accountActionsPackageId,
            accountProtocolPackageId: protocolPackageId,
            futarchyCorePackageId,
            futarchyActionsPackageId,
            futarchyFactoryPackageId: factoryPackageId,
            futarchyGovernancePackageId: governancePackageId,
            futarchyGovernanceActionsPackageId: governanceActionsPackageId,
            futarchyOracleActionsPackageId: oracleActionsPackageId,
            packageRegistryId: packageRegistry.objectId,
        };

        const launchpadWorkflowPackages: LaunchpadWorkflowPackages = {
            ...intentExecutorPackages,
            futarchyTypesPackageId,
            oneShotUtilsPackageId,
        };

        const launchpadWorkflowSharedObjects: LaunchpadWorkflowSharedObjects = {
            factoryId: factoryObject.objectId,
            factorySharedVersion: factoryObject.initialSharedVersion,
            packageRegistryId: packageRegistry.objectId,
            packageRegistrySharedVersion: packageRegistry.initialSharedVersion,
            feeManagerId: feeManager.objectId,
            feeManagerSharedVersion: feeManager.initialSharedVersion,
        };

        const proposalWorkflowPackages: ProposalWorkflowPackages = {
            ...intentExecutorPackages,
            futarchyTypesPackageId,
            futarchyMarketsCorePackageId: marketsCorePackageId,
            futarchyMarketsPrimitivesPackageId: marketsPrimitivesPackageId,
            futarchyMarketsOperationsPackageId: marketsOperationsPackageId,
            futarchyGovernanceActionsPackageId: governanceActionsPackageId,
            oneShotUtilsPackageId,
        };

        const proposalWorkflowSharedObjects: ProposalWorkflowSharedObjects = {
            packageRegistryId: packageRegistry.objectId,
            packageRegistrySharedVersion: packageRegistry.initialSharedVersion,
        };

        // Initialize workflows
        this.workflows = {
            launchpad: new LaunchpadWorkflow(client, launchpadWorkflowPackages, launchpadWorkflowSharedObjects),
            proposal: new ProposalWorkflow(client, proposalWorkflowPackages, proposalWorkflowSharedObjects),
            intents: new IntentExecutor(client, intentExecutorPackages),
        };

        // Initialize PTB composer
        const ptbPackages: TransactionComposerPackages = {
            accountActionsPackageId,
            futarchyActionsPackageId,
            futarchyTypesPackageId,
            futarchyFactoryPackageId: factoryPackageId,
            futarchyMarketsCorePackageId: marketsCorePackageId,
        };

        const ptbSharedObjects: TransactionComposerSharedObjects = {
            packageRegistryId: packageRegistry.objectId,
        };

        this.ptb = new TransactionComposer(ptbPackages, ptbSharedObjects);
    }

    /**
     * Initialize the Futarchy SDK
     *
     * @param config - SDK configuration with network and deployment data
     * @returns Initialized FutarchySDK instance
     */
    static async init(config: FutarchySDKConfig): Promise<FutarchySDK> {
        // Set up network and client
        const networkConfig = createNetworkConfig(config.network);

        // Set up deployment manager
        const deploymentManager = DeploymentManager.fromConfig(config.deployments);

        return new this(
            networkConfig.client,
            networkConfig,
            deploymentManager,
        );
    }

    /**
     * Refresh SDK state (for future use when we add cached data)
     */
    async refresh(): Promise<void> {
        // Future: Refresh cached on-chain data
        // For now, this is a placeholder
    }

    /**
     * Get package ID for a specific package by name
     */
    getPackageId(packageName: string): string | undefined {
        return this.deployments.getPackageId(packageName);
    }

    /**
     * Get all package IDs
     */
    getAllPackageIds(): Record<string, string> {
        return this.deployments.getAllPackageIds();
    }
}
