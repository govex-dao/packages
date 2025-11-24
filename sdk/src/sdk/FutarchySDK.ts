import { SuiClient } from "@mysten/sui/client";
import { NetworkType, createNetworkConfig, NetworkConfig } from "../config/network";
import { DeploymentManager } from "../config/deployment";
import { DeploymentConfig } from "../types/deployment";
import { FactoryOperations } from "../lib/factory";
import { FactoryAdminOperations } from "../lib/factory-admin";
import { FactoryValidatorOperations } from "../lib/factory-validator";
import { PackageRegistryAdminOperations } from "../lib/package-registry-admin";
import { LaunchpadOperations } from "../lib/launchpad";
import { FeeManagerOperations } from "../lib/fee-manager";
import { OracleActionsOperations } from "../lib/oracle-actions";
import { MarketsOperations, TWAPOperations } from "../lib/markets";
import { GovernanceOperations } from "../lib/governance";
import { ProposalSponsorshipOperations } from "../lib/proposal-sponsorship";
import { ProposalEscrowOperations } from "../lib/proposal-escrow";
import { IntentJanitorOperations } from "../lib/governance-actions/intent-janitor";
import { DAODissolutionOperations } from "../lib/dao-actions/dao-dissolution-actions";
import { QueryHelper } from "../lib/queries";
import { DAOOperations } from "../lib/operations/dao-operations";
import { VaultOperations } from "../lib/operations/vault-operations";
import { CurrencyOperations } from "../lib/operations/currency-operations";
import { ActionBuilders } from "../lib/operations/action-builders";
import { DAOInfoHelper } from "../lib/operations/dao-info-helper";
import { MarketsHighLevelOperations } from "../lib/operations/markets-operations";
import { TransferOperations } from "../lib/operations/transfer-operations";

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
export class FutarchySDK {
    public factory: FactoryOperations;
    public factoryAdmin: FactoryAdminOperations;
    public factoryValidator: FactoryValidatorOperations;
    public packageRegistryAdmin: PackageRegistryAdminOperations;
    public launchpad: LaunchpadOperations;
    public feeManager: FeeManagerOperations;
    public oracleActions: OracleActionsOperations;
    public markets: MarketsOperations;
    public twap: TWAPOperations;
    public governance: GovernanceOperations;
    public proposalSponsorship: ProposalSponsorshipOperations;
    public proposalEscrow: ProposalEscrowOperations;
    public intentJanitor: IntentJanitorOperations;
    public daoDissolution: DAODissolutionOperations;
    public query: QueryHelper;

    // NEW: High-level operations (user-friendly APIs)
    public dao: DAOOperations;
    public vault: VaultOperations;
    public currency: CurrencyOperations;
    public actions: ActionBuilders;
    public daoInfo: DAOInfoHelper;
    public marketsSimple: MarketsHighLevelOperations;
    public transfer: TransferOperations;

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

        // Initialize launchpad operations
        this.launchpad = new LaunchpadOperations(
            client,
            factoryPackageId, // launchpad is in same package as factory
            factoryPackageId,
            factoryObject.objectId,
            factoryObject.initialSharedVersion,
            packageRegistry.objectId,
            feeManager.objectId,
            feeManager.initialSharedVersion
        );

        // Initialize fee manager operations
        const marketsCorePackageId = deployments.getPackageId("futarchy_markets_core")!;
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
            packageRegistry.objectId
        );

        // Initialize markets operations
        this.markets = new MarketsOperations(client, marketsCorePackageId);
        this.twap = new TWAPOperations(client, marketsCorePackageId);

        // Initialize governance operations
        const governancePackageId = deployments.getPackageId("futarchy_governance")!;
        this.governance = new GovernanceOperations(
            client,
            marketsCorePackageId,
            governancePackageId,
            packageRegistry.objectId,
            protocolPackageId
        );

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
        const futarchyCorePackageId = deployments.getPackageId("futarchy_core")!;
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

        this.actions = new ActionBuilders({
            accountActionsPackageId,
            futarchyActionsPackageId,
            futarchyCorePackageId,
            oracleActionsPackageId,
            governanceActionsPackageId,
        });

        this.daoInfo = new DAOInfoHelper(client);

        this.marketsSimple = new MarketsHighLevelOperations({
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
