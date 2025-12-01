import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { BaseTransactionBuilder, TransactionUtils } from "./transaction";

/**
 * Package Registry admin operations requiring PackageAdminCap
 * These are privileged operations for managing the PackageRegistry and account creation
 */
export class PackageRegistryAdminOperations {
    private client: SuiClient;
    private protocolPackageId: string;
    private registryObjectId: string;
    private registryInitialSharedVersion: number;

    constructor(
        client: SuiClient,
        protocolPackageId: string,
        registryObjectId: string,
        registryInitialSharedVersion: number
    ) {
        this.client = client;
        this.protocolPackageId = protocolPackageId;
        this.registryObjectId = registryObjectId;
        this.registryInitialSharedVersion = registryInitialSharedVersion;
    }

    /**
     * Pause account creation system-wide
     * When paused, ALL account creation (factory and direct) is blocked
     *
     * @param packageAdminCapId - PackageAdminCap object ID
     * @returns Transaction for pausing account creation
     *
     * @example
     * ```typescript
     * // Pause all account creation
     * const tx = registryOps.pauseAccountCreation(adminCapId);
     * ```
     */
    pauseAccountCreation(packageAdminCapId: string): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.protocolPackageId,
            "package_registry",
            "pause_account_creation"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.sharedObjectRef({
                    objectId: this.registryObjectId,
                    initialSharedVersion: this.registryInitialSharedVersion,
                    mutable: true,
                }), // registry
                tx.object(packageAdminCapId), // cap
            ],
        });

        return tx;
    }

    /**
     * Unpause account creation system-wide
     * Re-enables account creation after it was paused
     *
     * @param packageAdminCapId - PackageAdminCap object ID
     * @returns Transaction for unpausing account creation
     *
     * @example
     * ```typescript
     * // Re-enable account creation
     * const tx = registryOps.unpauseAccountCreation(adminCapId);
     * ```
     */
    unpauseAccountCreation(packageAdminCapId: string): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.protocolPackageId,
            "package_registry",
            "unpause_account_creation"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.sharedObjectRef({
                    objectId: this.registryObjectId,
                    initialSharedVersion: this.registryInitialSharedVersion,
                    mutable: true,
                }), // registry
                tx.object(packageAdminCapId), // cap
            ],
        });

        return tx;
    }

    /**
     * Add a new package to the registry
     *
     * @param config - Package configuration
     * @returns Transaction for adding package
     *
     * @example
     * ```typescript
     * const tx = registryOps.addPackage({
     *   name: "my_package",
     *   addr: "0xABC...",
     *   version: 1,
     *   actionTypes: ["my_package::actions::MyAction"],
     *   category: "defi",
     *   description: "My awesome package"
     * });
     * ```
     */
    addPackage(config: {
        name: string;
        addr: string;
        version: number;
        actionTypes: string[];
        category: string;
        description: string;
    }): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.protocolPackageId,
            "package_registry",
            "add_package"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.sharedObjectRef({
                    objectId: this.registryObjectId,
                    initialSharedVersion: this.registryInitialSharedVersion,
                    mutable: true,
                }), // registry
                tx.pure.string(config.name),
                tx.pure.address(config.addr),
                tx.pure.u64(config.version),
                tx.pure.vector("string", config.actionTypes),
                tx.pure.string(config.category),
                tx.pure.string(config.description),
            ],
        });

        return tx;
    }

    /**
     * Remove a package from the registry
     *
     * @param packageName - Name of package to remove
     * @returns Transaction for removing package
     *
     * @example
     * ```typescript
     * const tx = registryOps.removePackage("old_package");
     * ```
     */
    removePackage(packageName: string): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.protocolPackageId,
            "package_registry",
            "remove_package"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.sharedObjectRef({
                    objectId: this.registryObjectId,
                    initialSharedVersion: this.registryInitialSharedVersion,
                    mutable: true,
                }), // registry
                tx.pure.string(packageName),
            ],
        });

        return tx;
    }

    /**
     * Update package version
     *
     * @param config - Version update configuration
     * @returns Transaction for updating version
     *
     * @example
     * ```typescript
     * const tx = registryOps.updatePackageVersion({
     *   name: "my_package",
     *   addr: "0xNEW...",
     *   version: 2
     * });
     * ```
     */
    updatePackageVersion(config: {
        name: string;
        addr: string;
        version: number;
    }): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.protocolPackageId,
            "package_registry",
            "update_package_version"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.sharedObjectRef({
                    objectId: this.registryObjectId,
                    initialSharedVersion: this.registryInitialSharedVersion,
                    mutable: true,
                }), // registry
                tx.pure.string(config.name),
                tx.pure.address(config.addr),
                tx.pure.u64(config.version),
            ],
        });

        return tx;
    }

    /**
     * Update package metadata
     *
     * @param config - Metadata update configuration
     * @returns Transaction for updating metadata
     *
     * @example
     * ```typescript
     * const tx = registryOps.updatePackageMetadata({
     *   name: "my_package",
     *   actionTypes: ["my_package::actions::NewAction"],
     *   category: "governance",
     *   description: "Updated description"
     * });
     * ```
     */
    updatePackageMetadata(config: {
        name: string;
        actionTypes: string[];
        category: string;
        description: string;
    }): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.protocolPackageId,
            "package_registry",
            "update_package_metadata"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.sharedObjectRef({
                    objectId: this.registryObjectId,
                    initialSharedVersion: this.registryInitialSharedVersion,
                    mutable: true,
                }), // registry
                tx.pure.string(config.name),
                tx.pure.vector("string", config.actionTypes),
                tx.pure.string(config.category),
                tx.pure.string(config.description),
            ],
        });

        return tx;
    }
}
