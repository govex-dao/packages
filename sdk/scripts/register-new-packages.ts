import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { initSDK, executeTransaction, getActiveAddress } from './execute-tx';

async function main() {
    const sdk = await initSDK();
    const sender = getActiveAddress();

    console.log('Registering new packages in PackageRegistry...\n');

    const REGISTRY = '0x829e1b3cd9726760baf7eeccfd56b35918c5187b6d8321967f11ecf8136d01f3';
    const ACCOUNT_PROTOCOL_PKG = '0x2fbef131639a2febdd72814533faff704b8d42b1c1f37cd4a27ad725a4e6eff3';

    // Load all packages from deployment JSON
    const deploymentData = require('../../deployment-logs/deployment_verified_20251031_231756.json');
    const allPackages = deploymentData.packages;

    // Map package names to lowercase for registry (factory expects lowercase names)
    const nameMapping: Record<string, string> = {
        'AccountProtocol': 'account_protocol',
        'AccountActions': 'account_actions',
    };

    const packages = Object.keys(allPackages).map(key => {
        const registryName = nameMapping[key] || key; // Use lowercase for AccountProtocol/AccountActions
        return {
            name: registryName,
            addr: allPackages[key], // Direct access since it's just packageId string
            version: 1,
            actionTypes: [],
            category: registryName.includes('actions') ? 'Actions' : registryName.includes('governance') ? 'Governance' : 'Core',
            description: `${registryName} package`
        };
    });

    // Skip removal step for fresh registry (nothing to remove)
    console.log('✓ Skipping removal step (fresh registry)\n');

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
