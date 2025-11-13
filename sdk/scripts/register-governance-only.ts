import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { initSDK, executeTransaction, getActiveAddress } from './execute-tx';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
    const sdk = await initSDK();

    console.log('Registering futarchy_governance in PackageRegistry...\n');

    // Load PackageRegistry and AccountProtocol addresses
    const accountProtocolPath = path.join(__dirname, '../../deployments-processed/AccountProtocol.json');
    const accountProtocolDeployment = JSON.parse(fs.readFileSync(accountProtocolPath, 'utf8'));

    const REGISTRY = accountProtocolDeployment.sharedObjects.find((obj: any) => obj.name === 'PackageRegistry')?.objectId;
    const ACCOUNT_PROTOCOL_PKG = accountProtocolDeployment.packageId;

    if (!REGISTRY || !ACCOUNT_PROTOCOL_PKG) {
        throw new Error('Failed to load PackageRegistry or AccountProtocol package ID');
    }

    console.log(`PackageRegistry: ${REGISTRY}`);
    console.log(`AccountProtocol: ${ACCOUNT_PROTOCOL_PKG}\n`);

    // Load futarchy_governance package ID
    const allPackagesData = require('../../deployments-processed/_all-packages.json');
    const governancePkgId = allPackagesData.futarchy_governance.packageId;

    console.log(`futarchy_governance package ID: ${governancePkgId}\n`);

    // Try to register it
    try {
        const tx = new Transaction();
        const actionTypesVector = tx.pure(bcs.vector(bcs.string()).serialize([]));
        tx.moveCall({
            target: `${ACCOUNT_PROTOCOL_PKG}::package_registry::add_package`,
            arguments: [
                tx.object(REGISTRY),
                tx.pure.string('futarchy_governance'),
                tx.pure.address(governancePkgId),
                tx.pure.u64(1),
                actionTypesVector,
                tx.pure.string('Governance'),
                tx.pure.string('Proposal execution for futarchy governance'),
            ],
        });

        await executeTransaction(sdk, tx, {
            network: 'devnet',
            dryRun: false,
            showEffects: false,
            showObjectChanges: false,
            showEvents: false,
        });

        console.log('✓ futarchy_governance registered successfully!');
    } catch (error: any) {
        // Check if already registered
        if (error.message?.includes('EPackageAlreadyExists') || error.message?.includes('}, 1)')) {
            console.log('✓ futarchy_governance already registered (this is expected)');
            console.log('\nℹ️  The package was already registered by deploy_verified.sh');
            console.log('   Your test should now work!');
        } else {
            console.error('✗ Failed:', error.message);
            throw error;
        }
    }
}

main().catch(console.error);
