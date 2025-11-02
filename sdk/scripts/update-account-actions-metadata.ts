import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { initSDK, executeTransaction, getActiveAddress } from './execute-tx';

async function main() {
    const sdk = await initSDK();
    const sender = getActiveAddress();

    console.log('Updating account_actions package metadata with action types...\n');

    const REGISTRY = '0xb51525d234f807e2fde1605959bb28df084bf7b5bdb7948549fe3898808fc9d4';
    const ACCOUNT_PROTOCOL_PKG = '0xd4c65da22562605271e1bb253f491986d0a3ac1e217a35fc1148f32222174bbf';

    const actionTypes = [
        'account_actions::stream_init_actions::CreateStreamAction',
        'account_actions::currency_init_actions::ReturnTreasuryCapAction',
    ];

    console.log(`Registering ${actionTypes.length} action types for account_actions:`);
    actionTypes.forEach(type => console.log(`  - ${type}`));
    console.log();

    try {
        const tx = new Transaction();
        const actionTypesVector = tx.pure(bcs.vector(bcs.string()).serialize(actionTypes));

        tx.moveCall({
            target: `${ACCOUNT_PROTOCOL_PKG}::package_registry::update_package_metadata`,
            arguments: [
                tx.object(REGISTRY),
                tx.pure.string('account_actions'),
                actionTypesVector,
                tx.pure.string('Actions'),
                tx.pure.string('Core account action modules including init actions for streams and currency'),
            ],
        });

        await executeTransaction(sdk, tx, {
            network: 'devnet',
            dryRun: false,
            showEffects: true,
            showObjectChanges: false,
            showEvents: true,
        });

        console.log('\n✓ account_actions metadata updated successfully!\n');
    } catch (error: any) {
        console.error(`✗ Failed to update metadata: ${error.message}\n`);
        throw error;
    }
}

main().catch(console.error);
