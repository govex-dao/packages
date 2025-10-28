/**
 * Example: Creating a new Futarchy DAO
 *
 * This example demonstrates:
 * 1. Initializing the SDK
 * 2. Creating a DAO transaction
 * 3. Signing and executing the transaction
 * 4. Querying the created DAO
 */

import { FutarchySDK, TransactionUtils } from '../src';
import { Transaction } from '@mysten/sui/transactions';

async function main() {
    // Load deployment configuration
    const deployments = require('../../deployments-processed/_all-packages.json');

    // Initialize SDK
    const sdk = await FutarchySDK.init({
        network: 'devnet',
        deployments,
    });

    console.log('✅ SDK initialized');

    // ===== STEP 1: Prepare DAO configuration =====

    // NOTE: You need to create a coin first with TreasuryCap and CoinMetadata
    // This is typically done using `sui client publish` or a separate transaction

    const daoConfig = {
        // Token configuration (REPLACE THESE)
        assetType: '0xYOUR_PACKAGE::your_coin::YOUR_COIN',
        stableType: '0x2::sui::SUI',
        treasuryCap: '0xYOUR_TREASURY_CAP_ID',
        coinMetadata: '0xYOUR_COIN_METADATA_ID',

        // DAO metadata
        daoName: 'My Futarchy DAO',
        iconUrl: 'https://example.com/icon.png',
        description: 'A decentralized autonomous organization governed by prediction markets',

        // Market amounts
        minAssetAmount: 1000n,
        minStableAmount: 1000n,

        // Governance timing
        reviewPeriodMs: 86400000, // 1 day
        tradingPeriodMs: 259200000, // 3 days

        // TWAP configuration
        twapStartDelay: 3600000, // 1 hour
        twapStepMax: 100,
        twapInitialObservation: 1000000n,
        twapThreshold: { value: 100000n, negative: false },

        // Market parameters
        ammTotalFeeBps: 30, // 0.3% fee
        maxOutcomes: 5,

        // Payment (1 SUI creation fee)
        paymentAmount: TransactionUtils.suiToMist(1),
    };

    // ===== STEP 2: Build transaction =====

    console.log('\n📝 Building DAO creation transaction...');

    const tx = sdk.factory.createDAO(daoConfig);

    console.log('Transaction created');

    // ===== STEP 3: Sign and execute =====

    // NOTE: In a real application, you would:
    // 1. Get a keypair or use a wallet
    // 2. Sign the transaction
    // 3. Execute it

    // Example (pseudocode - you need actual keypair):
    /*
    import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

    const keypair = Ed25519Keypair.fromSecretKey(YOUR_SECRET_KEY);

    const result = await sdk.client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: {
            showEffects: true,
            showObjectChanges: true,
            showEvents: true,
        },
    });

    console.log('\n✅ DAO created!');
    console.log('Transaction digest:', result.digest);

    // Extract DAO (Account) object ID from object changes
    const daoObject = result.objectChanges?.find(
        (change) => change.type === 'created' && change.objectType.includes('::account::Account')
    );

    if (daoObject && 'objectId' in daoObject) {
        console.log('DAO Account ID:', daoObject.objectId);

        // ===== STEP 4: Query the created DAO =====
        const dao = await sdk.query.getDAO(daoObject.objectId);
        console.log('\n📊 DAO Details:');
        console.log(JSON.stringify(dao.data, null, 2));
    }
    */

    // ===== Alternative: Use simple defaults =====

    console.log('\n📝 You can also use createDAOWithDefaults for simpler configuration:');

    const simpleTx = sdk.factory.createDAOWithDefaults({
        assetType: '0xYOUR_PACKAGE::your_coin::YOUR_COIN',
        stableType: '0x2::sui::SUI',
        treasuryCap: '0xYOUR_TREASURY_CAP_ID',
        coinMetadata: '0xYOUR_COIN_METADATA_ID',
        daoName: 'My DAO',
        iconUrl: 'https://example.com/icon.png',
        description: 'A futarchy DAO',
    });

    console.log('Simple transaction created with default parameters');

    // ===== STEP 5: Query existing DAOs =====

    console.log('\n🔍 Querying existing DAOs...');

    const factoryPackageId = sdk.getPackageId('futarchy_factory')!;

    // Get all DAOs
    const allDAOs = await sdk.query.getAllDAOs(factoryPackageId);
    console.log(`\nFound ${allDAOs.length} DAOs`);

    if (allDAOs.length > 0) {
        console.log('\nRecent DAOs:');
        allDAOs.slice(-5).forEach((dao, idx) => {
            console.log(`\n${idx + 1}. ${dao.dao_name}`);
            console.log(`   Account ID: ${dao.account_id}`);
            console.log(`   Creator: ${dao.creator}`);
            console.log(`   Asset: ${dao.asset_type}`);
            console.log(`   Stable: ${dao.stable_type}`);
        });
    }

    // Get DAOs by specific creator
    // const myDAOs = await sdk.query.getDAOsCreatedByAddress(
    //     factoryPackageId,
    //     'YOUR_ADDRESS'
    // );
    // console.log(`\nYou have created ${myDAOs.length} DAOs`);
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
