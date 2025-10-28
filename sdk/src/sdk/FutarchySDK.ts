import { SuiClient } from "@mysten/sui/client";
import { NetworkType, createNetworkConfig, NetworkConfig } from "../config/network";
import { DeploymentManager } from "../config/deployment";
import { DeploymentConfig } from "../types/deployment";
import { FactoryOperations } from "../lib/factory";
import { LaunchpadOperations } from "../lib/launchpad";
import { QueryHelper } from "../lib/queries";

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
    public launchpad: LaunchpadOperations;
    public query: QueryHelper;

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

        this.factory = new FactoryOperations(
            client,
            factoryPackageId,
            factoryObject.objectId,
            packageRegistry.objectId,
            feeManager.objectId
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
