/**
 * Example: Querying on-chain data
 *
 * This example demonstrates:
 * 1. Querying DAOs, proposals, and markets
 * 2. Reading object data
 * 3. Querying events
 * 4. Checking balances
 */

import { FutarchySDK } from '../src';

async function main() {
    // Load deployment configuration
    const deployments = require('../../deployments-processed/_all-packages.json');

    // Initialize SDK
    const sdk = await FutarchySDK.init({
        network: 'devnet',
        deployments,
    });

    console.log('✅ SDK initialized');
    console.log('Network:', sdk.network.network);

    // ===== Query Factory =====

    const factory = sdk.deployments.getFactory();
    if (factory) {
        console.log('\n🏭 Factory Object:');
        console.log('Object ID:', factory.objectId);

        const factoryData = await sdk.query.getObject(factory.objectId);
        console.log('\nFactory Data:');
        console.log(JSON.stringify(factoryData.data, null, 2));
    }

    // ===== Query Package Registry =====

    const registry = sdk.deployments.getPackageRegistry();
    if (registry) {
        console.log('\n📦 Package Registry:');
        console.log('Object ID:', registry.objectId);
    }

    // ===== Query all DAOs =====

    const factoryPackageId = sdk.getPackageId('futarchy_factory')!;

    console.log('\n📊 Querying all DAOs...');
    const allDAOs = await sdk.query.getAllDAOs(factoryPackageId);

    console.log(`\nFound ${allDAOs.length} DAOs total`);

    if (allDAOs.length > 0) {
        console.log('\n=== Recent DAOs ===');
        allDAOs.slice(-10).forEach((dao, idx) => {
            console.log(`\n${idx + 1}. ${dao.dao_name}`);
            console.log(`   Account ID: ${dao.account_id}`);
            console.log(`   Creator: ${dao.creator}`);
            console.log(`   Asset Type: ${dao.asset_type}`);
            console.log(`   Stable Type: ${dao.stable_type}`);
            console.log(`   Timestamp: ${new Date(Number(dao.timestamp)).toLocaleString()}`);
            if (dao.affiliate_id) {
                console.log(`   Affiliate: ${dao.affiliate_id}`);
            }
        });

        // ===== Query specific DAO details =====

        console.log('\n\n=== Detailed DAO Query ===');
        const firstDAO = allDAOs[0];
        console.log(`\nQuerying DAO: ${firstDAO.dao_name}`);
        console.log(`Account ID: ${firstDAO.account_id}`);

        const daoObject = await sdk.query.getDAO(firstDAO.account_id);

        if (daoObject.data) {
            console.log('\nDAO Object Type:', daoObject.data.type);
            console.log('Owner:', JSON.stringify(daoObject.data.owner, null, 2));

            // Extract specific fields if available
            if (daoObject.data.content?.dataType === 'moveObject') {
                const fields = daoObject.data.content.fields as any;
                console.log('\nDAO Fields:');
                console.log('ID:', fields.id?.id);

                // Show some fields if they exist
                if (fields.name) console.log('Name:', fields.name);
                if (fields.version) console.log('Version:', fields.version);
            }
        }
    }

    // ===== Query user balances (example) =====

    console.log('\n\n=== Balance Query Example ===');

    // Replace with actual address to query
    const exampleAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';

    try {
        const suiBalance = await sdk.query.getBalance(exampleAddress, '0x2::sui::SUI');
        console.log('SUI Balance:', suiBalance.totalBalance, 'MIST');
        console.log('SUI Balance:', Number(suiBalance.totalBalance) / 1_000_000_000, 'SUI');

        const allBalances = await sdk.query.getAllBalances(exampleAddress);
        console.log('\nAll Coin Types:');
        allBalances.forEach((bal) => {
            console.log(`  ${bal.coinType}: ${bal.totalBalance}`);
        });
    } catch (error) {
        console.log('(Skipping balance query - use a real address)');
    }

    // ===== Query events =====

    console.log('\n\n=== Event Query ===');

    const daoCreatedEvents = await sdk.query.queryEvents({
        MoveEventType: `${factoryPackageId}::factory::DAOCreated`,
    });

    console.log(`Total DAO creation events: ${daoCreatedEvents.data.length}`);

    // ===== Query objects by type =====

    console.log('\n\n=== Object Query by Type ===');

    // Example: Find all Account objects owned by an address
    // const myAddress = 'YOUR_ADDRESS';
    // const accountType = sdk.getPackageId('AccountProtocol') + '::account::Account';

    // const myAccounts = await sdk.query.getOwnedObjects(myAddress, {
    //     StructType: accountType
    // });

    // console.log(`Found ${myAccounts.data.length} Account objects owned by ${myAddress}`);

    // ===== Deployment Info =====

    console.log('\n\n=== Deployment Info ===');

    const allPackages = sdk.getAllPackageIds();
    console.log('\nAll deployed packages:');
    Object.entries(allPackages).forEach(([name, id]) => {
        console.log(`  ${name.padEnd(35)}: ${id}`);
    });

    console.log('\n\n=== Shared Objects ===');

    const sharedObjects = sdk.deployments.getAllSharedObjects();
    console.log(`\nTotal shared objects: ${sharedObjects.length}`);
    sharedObjects.forEach(({ package: pkg, object }) => {
        console.log(`\n${object.name} (${pkg})`);
        console.log(`  Object ID: ${object.objectId}`);
        console.log(`  Type: ${object.objectType}`);
    });

    console.log('\n✅ Query examples complete!');
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
