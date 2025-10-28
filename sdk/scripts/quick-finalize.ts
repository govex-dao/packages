/**
 * Create a raise with early completion, contribute to meet min, then finalize it
 */

import { Transaction } from '@mysten/sui/transactions';
import { LaunchpadOperations } from '../src/lib/launchpad';
import { TransactionUtils } from '../src/lib/transaction';
import { initSDK, loadTestCoins, executeTransaction, getActiveAddress } from './execute-tx';

async function main() {
    console.log('='.repeat(80));
    console.log('CREATE & FINALIZE RAISE (EARLY COMPLETION)');
    console.log('='.repeat(80));

    const sdk = await initSDK();
    const testCoins = loadTestCoins();
    const sender = getActiveAddress();

    console.log(`\n👤 Active Address: ${sender}`);

    // Step 1: Create raise with early completion enabled
    console.log('\n' + '='.repeat(80));
    console.log('STEP 1: CREATE RAISE WITH EARLY COMPLETION');
    console.log('='.repeat(80));

    const createRaiseTx = sdk.launchpad.createRaise({
        raiseTokenType: testCoins.asset.type,
        stableCoinType: testCoins.stable.type,
        treasuryCap: testCoins.asset.treasuryCap,
        coinMetadata: testCoins.asset.metadata,

        tokensForSale: 1_000_000n,
        minRaiseAmount: TransactionUtils.suiToMist(1), // Min 1 NSSTABLE
        maxRaiseAmount: TransactionUtils.suiToMist(100),

        allowedCaps: [
            TransactionUtils.suiToMist(1),
            TransactionUtils.suiToMist(50),
            LaunchpadOperations.UNLIMITED_CAP,
        ],

        allowEarlyCompletion: true, // ✅ KEY: Enable early completion!

        description: 'Quick finalization test - early completion enabled',
        affiliateId: '',
        metadataKeys: [],
        metadataValues: [],

        launchpadFee: 100n,
    });

    console.log('💦 Creating raise...');
    const createResult = await executeTransaction(sdk, createRaiseTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: true,
        showEvents: true
    });

    const raiseCreatedEvent = createResult.events?.find((e: any) =>
        e.type.includes('RaiseCreated')
    );

    if (!raiseCreatedEvent) {
        throw new Error('Failed to find RaiseCreated event');
    }

    const raiseId = raiseCreatedEvent.parsedJson.raise_id;
    const creatorCapObj = createResult.objectChanges?.find((c: any) =>
        c.objectType?.includes('CreatorCap')
    );
    const creatorCapId = creatorCapObj?.objectId;

    console.log('\n✅ Raise Created!');
    console.log(`   Raise ID: ${raiseId}`);
    console.log(`   CreatorCap ID: ${creatorCapId}`);
    console.log(`   Min Raise: 1 NSSTABLE`);
    console.log(`   Early Completion: ENABLED ✅`);

    // Step 2: Mint and contribute to meet minimum
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: CONTRIBUTE TO MEET MINIMUM');
    console.log('='.repeat(80));

    const amountToContribute = TransactionUtils.suiToMist(2); // Contribute 2 NSSTABLE (exceeds min)

    console.log(`\n💰 Minting NSSTABLE tokens...`);
    const mintTx = new Transaction();
    mintTx.moveCall({
        target: `${testCoins.stable.packageId}::coin::mint`,
        arguments: [
            mintTx.object(testCoins.stable.treasuryCap),
            mintTx.pure.u64(amountToContribute + TransactionUtils.suiToMist(1)),
            mintTx.pure.address(sender),
        ],
    });

    await executeTransaction(sdk, mintTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: false,
    });

    console.log('✅ Minted!');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`\n💸 Contributing ${TransactionUtils.mistToSui(amountToContribute)} NSSTABLE...`);

    const coins = await sdk.client.getCoins({
        owner: sender,
        coinType: testCoins.stable.type,
    });

    const contributeTx = new Transaction();
    const [firstCoin, ...restCoins] = coins.data.map(c => contributeTx.object(c.coinObjectId));
    if (restCoins.length > 0) {
        contributeTx.mergeCoins(firstCoin, restCoins);
    }

    const [paymentCoin] = contributeTx.splitCoins(firstCoin, [contributeTx.pure.u64(amountToContribute)]);
    const [crankFeeCoin] = contributeTx.splitCoins(contributeTx.gas, [contributeTx.pure.u64(TransactionUtils.suiToMist(0.1))]);

    const factoryObject = sdk.deployments.getFactory();
    const factoryPackageId = sdk.getPackageId('futarchy_factory')!;

    contributeTx.moveCall({
        target: TransactionUtils.buildTarget(factoryPackageId, 'launchpad', 'contribute'),
        typeArguments: [testCoins.asset.type, testCoins.stable.type],
        arguments: [
            contributeTx.object(raiseId),
            contributeTx.sharedObjectRef({
                objectId: factoryObject!.objectId,
                initialSharedVersion: factoryObject!.initialSharedVersion,
                mutable: false,
            }),
            paymentCoin,
            contributeTx.pure.u64(LaunchpadOperations.UNLIMITED_CAP),
            crankFeeCoin,
            contributeTx.object('0x6'),
        ],
    });

    contributeTx.transferObjects([firstCoin], contributeTx.pure.address(sender));

    await executeTransaction(sdk, contributeTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: false,
        showEvents: true
    });

    console.log('✅ Contributed! Min raise met!');

    // Step 3: End raise early
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: END RAISE EARLY');
    console.log('='.repeat(80));

    console.log('\n⚡ Ending raise early (min met, early completion enabled)...');

    const endEarlyTx = sdk.launchpad.endRaiseEarly(raiseId, creatorCapId!, '0x6');

    const endResult = await executeTransaction(sdk, endEarlyTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: false,
        showEvents: true
    });

    console.log('✅ Raise ended early!');
    console.log(`   Transaction: ${endResult.digest}`);

    // Step 4: Settle raise
    console.log('\n' + '='.repeat(80));
    console.log('STEP 4: SETTLE RAISE');
    console.log('='.repeat(80));

    console.log('\n📊 Settling raise to determine final amount...');

    const settleTx = sdk.launchpad.settleRaise(raiseId, '0x6');

    const settleResult = await executeTransaction(sdk, settleTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: false,
        showEvents: true
    });

    console.log('✅ Raise settled!');
    console.log(`   Transaction: ${settleResult.digest}`);

    // Step 5: Complete raise (create DAO)
    console.log('\n' + '='.repeat(80));
    console.log('STEP 5: COMPLETE RAISE (CREATE DAO)');
    console.log('='.repeat(80));

    console.log('\n🏛️  Creating DAO from successful raise...');

    // DAO creation fee
    const daoCreationFee = TransactionUtils.suiToMist(0.01); // Small fee for testing

    const completeTx = sdk.launchpad.completeRaise(raiseId, creatorCapId!, daoCreationFee, '0x6');

    const completeResult = await executeTransaction(sdk, completeTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: true,
        showEvents: true
    });

    console.log('✅ DAO Created from raise!');
    console.log(`   Transaction: ${completeResult.digest}`);

    const daoCreatedEvent = completeResult.events?.find((e: any) =>
        e.type.includes('DaoCreated') || e.type.includes('RaiseCompleted')
    );

    if (daoCreatedEvent) {
        console.log('\n🎉 DAO Details:');
        console.log(JSON.stringify(daoCreatedEvent.parsedJson, null, 2));
    }

    // Step 6: Claim tokens
    console.log('\n' + '='.repeat(80));
    console.log('STEP 6: CLAIM TOKENS');
    console.log('='.repeat(80));

    console.log('\n💰 Claiming contributor tokens...');

    const claimTx = sdk.launchpad.claimTokens(raiseId, '0x6');

    const claimResult = await executeTransaction(sdk, claimTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: true,
        showEvents: true
    });

    console.log('✅ Tokens claimed!');
    console.log(`   Transaction: ${claimResult.digest}`);

    console.log('\n' + '='.repeat(80));
    console.log('🎉 FULL RAISE LIFECYCLE COMPLETE! 🎉');
    console.log('='.repeat(80));

    console.log('\n📋 Summary:');
    console.log(`   ✅ Created raise with early completion`);
    console.log(`   ✅ Contributed to meet minimum`);
    console.log(`   ✅ Ended raise early`);
    console.log(`   ✅ Settled raise`);
    console.log(`   ✅ Completed raise (created DAO)`);
    console.log(`   ✅ Claimed contributor tokens`);

    console.log(`\n🔗 View raise on explorer:`);
    console.log(`   https://suiscan.xyz/devnet/object/${raiseId}`);
}

main()
    .then(() => {
        console.log('\n✅ Script completed successfully\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
