import { Transaction } from '@mysten/sui/transactions';
import { initSDK, executeTransaction, getActiveAddress } from './execute-tx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
    const sdk = await initSDK();
    const sender = getActiveAddress();

    console.log('Updating package versions in PackageRegistry...\n');

    // Load PackageRegistry and AccountProtocol addresses from deployment files
    const accountProtocolPath = path.join(__dirname, '../../deployments-processed/AccountProtocol.json');
    const accountProtocolDeployment = JSON.parse(fs.readFileSync(accountProtocolPath, 'utf8'));

    const REGISTRY = accountProtocolDeployment.sharedObjects.find((obj: any) => obj.name === 'PackageRegistry')?.objectId;
    const ACCOUNT_PROTOCOL_PKG = accountProtocolDeployment.packageId;

    if (!REGISTRY || !ACCOUNT_PROTOCOL_PKG) {
        throw new Error('Failed to load PackageRegistry or AccountProtocol package ID from deployment files');
    }

    console.log(`Using PackageRegistry: ${REGISTRY}`);
    console.log(`Using AccountProtocol: ${ACCOUNT_PROTOCOL_PKG}\n`);

    // Load the latest deployment data from _all-packages.json
    const allPackagesData = require('../../deployments-processed/_all-packages.json');

    // Packages that were redeployed (futarchy_core and all dependents)
    const packagesToUpdate = [
        { name: 'futarchy_core', version: 2 },
        { name: 'futarchy_markets_primitives', version: 2 },
        { name: 'futarchy_markets_core', version: 2 },
        { name: 'futarchy_markets_operations', version: 2 },
        { name: 'futarchy_oracle', version: 2 },
        { name: 'futarchy_actions', version: 2 },
        { name: 'futarchy_factory', version: 2 },
        { name: 'futarchy_governance_actions', version: 2 },
        { name: 'futarchy_governance', version: 2 },
    ];

    for (const pkg of packagesToUpdate) {
        const packageData = allPackagesData[pkg.name];
        if (!packageData) {
            console.log(`⚠️  Package ${pkg.name} not found in deployment data, skipping\n`);
            continue;
        }

        const packageId = packageData.packageId;
        console.log(`Updating ${pkg.name} to version ${pkg.version}...`);
        console.log(`  New address: ${packageId}`);

        try {
            const tx = new Transaction();
            tx.moveCall({
                target: `${ACCOUNT_PROTOCOL_PKG}::package_registry::update_package_version`,
                arguments: [
                    tx.object(REGISTRY),
                    tx.pure.string(pkg.name),
                    tx.pure.address(packageId),
                    tx.pure.u64(pkg.version),
                ],
            });

            await executeTransaction(sdk, tx, {
                network: 'devnet',
                dryRun: false,
                showEffects: false,
                showObjectChanges: false,
                showEvents: false,
            });

            console.log(`✓ ${pkg.name} updated to version ${pkg.version}\n`);
        } catch (error: any) {
            console.error(`✗ Failed to update ${pkg.name}: ${error.message}\n`);
        }
    }

    console.log('✓ All package versions updated!');
}

main().catch(console.error);
