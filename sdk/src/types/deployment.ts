/**
 * Deployment data types based on processed deployment JSONs
 */

export interface OwnerInfo {
    AddressOwner?: string;
    Shared?: {
        initial_shared_version: number;
    };
}

export interface UpgradeCap {
    objectId: string;
    objectType: string;
    owner: OwnerInfo;
}

export interface AdminCap {
    name: string;
    objectId: string;
    objectType: string;
    owner: OwnerInfo;
}

export interface SharedObject {
    name: string;
    objectId: string;
    objectType: string;
    owner: OwnerInfo;
    initialSharedVersion: number;
}

export interface OwnedObject {
    name: string;
    objectId: string;
    objectType: string;
    owner: OwnerInfo;
}

export interface PackageDeployment {
    packageName: string;
    transactionDigest: string;
    packageId: string;
    upgradeCap: UpgradeCap;
    adminCaps: AdminCap[];
    sharedObjects: SharedObject[];
    ownedObjects: OwnedObject[];
}

export interface DeploymentConfig {
    [packageName: string]: PackageDeployment;
}
