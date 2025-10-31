import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { initSDK, executeTransaction, getActiveAddress } from './execute-tx';

async function main() {
    const sdk = await initSDK();
    const sender = getActiveAddress();

    console.log('Registering new packages in PackageRegistry...\n');

    const REGISTRY = '0x582599b1d40503bd43618d678e32f0c4d55ee30e89af985f33a5451787c1f2f5';
    const ACCOUNT_PROTOCOL_PKG = '0xd0751a5281bd851ac7df5c62cd523239ddfa7dc321a7df3ddfc7400d65938ed6';

    // Load all packages from deployments
    const allPackages = require('../../deployments-processed/_all-packages.json');

    // Map package names to lowercase for registry (factory expects lowercase names)
    const nameMapping: Record<string, string> = {
        'AccountProtocol': 'account_protocol',
        'AccountActions': 'account_actions',
    };

    const packages = Object.keys(allPackages).map(key => {
        const registryName = nameMapping[key] || key; // Use lowercase for AccountProtocol/AccountActions
        return {
            name: registryName,
            addr: allPackages[key].packageId,
            version: 1,
            actionTypes: [],
            category: registryName.includes('actions') ? 'Actions' : registryName.includes('governance') ? 'Governance' : 'Core',
            description: `${registryName} package`
        };
    });

    // First, remove incorrectly-named packages (AccountProtocol, AccountActions)
    const packagesToRemove = ['AccountProtocol', 'AccountActions'];
    for (const name of packagesToRemove) {
        console.log(`Removing old entry: ${name}...`);
        try {
            const tx = new Transaction();
            tx.moveCall({
                target: `${ACCOUNT_PROTOCOL_PKG}::package_registry::remove_package`,
                arguments: [
                    tx.object(REGISTRY),
                    tx.pure.string(name),
                ],
            });

            await executeTransaction(sdk, tx, {
                network: 'devnet',
                dryRun: false,
                showEffects: false,
                showObjectChanges: false,
                showEvents: false,
            });

            console.log(`✓ ${name} removed\n`);
        } catch (error: any) {
            if (error.message?.includes('EPackageNotFound')) {
                console.log(`ℹ️  ${name} not found (already removed or never existed)\n`);
            } else {
                console.error(`✗ Failed to remove ${name}: ${error.message}\n`);
            }
        }
    }

    // Now register all packages with correct names
    for (const pkg of packages) {
        console.log(`Registering ${pkg.name}...`);

        try {
            const tx = new Transaction();
            const actionTypesVector = tx.pure(bcs.vector(bcs.string()).serialize(pkg.actionTypes));
            tx.moveCall({
                target: `${ACCOUNT_PROTOCOL_PKG}::package_registry::add_package`,
                arguments: [
                    tx.object(REGISTRY),
                    tx.pure.string(pkg.name),
                    tx.pure.address(pkg.addr),
                    tx.pure.u64(pkg.version),
                    actionTypesVector,
                    tx.pure.string(pkg.category),
                    tx.pure.string(pkg.description),
                ],
            });

            await executeTransaction(sdk, tx, {
                network: 'devnet',
                dryRun: false,
                showEffects: false,
                showObjectChanges: false,
                showEvents: false,
            });

            console.log(`✓ ${pkg.name} registered\n`);
        } catch (error: any) {
            if (error.message?.includes('EPackageAlreadyExists')) {
                console.log(`ℹ️  ${pkg.name} already registered\n`);
            } else {
                console.error(`✗ Failed to register ${pkg.name}: ${error.message}\n`);
            }
        }
    }

    console.log('✓ All packages registered successfully!');
}

main().catch(console.error);
