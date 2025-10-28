/**
 * Basic usage example for Futarchy SDK
 *
 * This example shows how to:
 * 1. Initialize the SDK with deployment config
 * 2. Access package IDs
 * 3. Access shared objects (Factory, PackageRegistry)
 * 4. Query on-chain data using the SuiClient
 */

import { FutarchySDK } from '../src';

async function main() {
    // Load deployment configuration
    // In production, you would import this from a JSON file:
    // import deployments from '../deployments/devnet.json';
    const deployments = require('../../deployments-processed/_all-packages.json');

    // Initialize SDK
    const sdk = await FutarchySDK.init({
        network: 'devnet',
        deployments,
    });

    console.log('✅ SDK initialized');
    console.log('Network:', sdk.network.network);
    console.log('RPC URL:', sdk.network.url);

    // Get package IDs
    const factoryPkgId = sdk.getPackageId('futarchy_factory');
    const governancePkgId = sdk.getPackageId('futarchy_governance');
    console.log('\n📦 Package IDs:');
    console.log('Factory:', factoryPkgId);
    console.log('Governance:', governancePkgId);

    // Access shared objects
    const factory = sdk.deployments.getFactory();
    const registry = sdk.deployments.getPackageRegistry();
    console.log('\n🔗 Shared Objects:');
    console.log('Factory:', factory?.objectId);
    console.log('PackageRegistry:', registry?.objectId);

    // Query Factory object on-chain
    if (factory) {
        const factoryObj = await sdk.client.getObject({
            id: factory.objectId,
            options: { showContent: true },
        });
        console.log('\n🏭 Factory Object:');
        console.log(JSON.stringify(factoryObj.data, null, 2));
    }

    // Get all package IDs
    const allPackages = sdk.getAllPackageIds();
    console.log('\n📚 All Packages:');
    Object.entries(allPackages).forEach(([name, id]) => {
        console.log(`  ${name}: ${id}`);
    });
}

main().catch(console.error);
