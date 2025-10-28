/**
 * Script to contribute to a launchpad raise
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../src/lib/transaction';
import { LaunchpadOperations } from '../src/lib/launchpad';
import { initSDK, loadTestCoins, executeTransaction, getActiveAddress } from './execute-tx';

// The raise we just created
const RAISE_ID = '0xd93026a0108fd3472c9e8df451097a70142719888dc33ff457b74deb1c12d1be';

async function main() {
    console.log('='.repeat(80));
    console.log('CONTRIBUTE TO RAISE');
    console.log('='.repeat(80));

    const sdk = await initSDK();
    const testCoins = loadTestCoins();
    const sender = getActiveAddress();

    console.log(`\n👤 Active Address: ${sender}`);
    console.log(`🎯 Raise ID: ${RAISE_ID}`);

    // Step 1: Mint NSSTABLE tokens to contribute with
    console.log('\n' + '='.repeat(80));
    console.log('STEP 1: MINT NSSTABLE TOKENS');
    console.log('='.repeat(80));

    const amountToMint = TransactionUtils.suiToMist(20); // Mint 20 NSSTABLE
    console.log(`\n💰 Minting ${TransactionUtils.mistToSui(amountToMint)} NSSTABLE tokens...`);

    const mintTx = new Transaction();
    mintTx.moveCall({
        target: `${testCoins.stable.packageId}::coin::mint`,
        arguments: [
            mintTx.object(testCoins.stable.treasuryCap),
            mintTx.pure.u64(amountToMint),
            mintTx.pure.address(sender),
        ],
    });

    console.log('💦 Executing mint transaction...');
    await executeTransaction(sdk, mintTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: true,
    });

    console.log('✅ Minted NSSTABLE tokens!');

    // Wait a bit for the transaction to be indexed
    console.log('\n⏳ Waiting for transaction to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Contribute to the raise
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: CONTRIBUTE TO RAISE');
    console.log('='.repeat(80));

    const contributionAmount = TransactionUtils.suiToMist(5); // Contribute 5 NSSTABLE
    const crankFee = TransactionUtils.suiToMist(0.1); // 0.1 SUI for crank

    console.log(`\n💸 Contributing ${TransactionUtils.mistToSui(contributionAmount)} NSSTABLE...`);
    console.log(`   Crank Fee: ${TransactionUtils.mistToSui(crankFee)} SUI`);
    console.log(`   Max Total Cap: Accepting any raise size (UNLIMITED)`);

    // Get NSSTABLE coins owned by sender
    console.log('\n🔍 Finding NSSTABLE coins...');
    const coins = await sdk.client.getCoins({
        owner: sender,
        coinType: testCoins.stable.type,
    });

    if (coins.data.length === 0) {
        throw new Error('No NSSTABLE coins found! Did the mint transaction complete?');
    }

    console.log(`   Found ${coins.data.length} NSSTABLE coin(s)`);

    // Note: The launchpad.contribute() SDK method expects SUI for payment
    // But we're contributing with NSSTABLE, so we need to build the transaction manually
    const contributeTx = new Transaction();

    // Merge all coins into one
    const [firstCoin, ...restCoins] = coins.data.map(c => contributeTx.object(c.coinObjectId));
    if (restCoins.length > 0) {
        contributeTx.mergeCoins(firstCoin, restCoins);
    }

    // Split the exact contribution amount
    const [paymentCoin] = contributeTx.splitCoins(firstCoin, [contributeTx.pure.u64(contributionAmount)]);

    // Split crank fee from gas
    const [crankFeeCoin] = contributeTx.splitCoins(contributeTx.gas, [contributeTx.pure.u64(crankFee)]);

    // Contribute to raise
    const factoryObject = sdk.deployments.getFactory();
    contributeTx.moveCall({
        target: TransactionUtils.buildTarget(
            sdk.getPackageId('futarchy_factory')!,
            'launchpad',
            'contribute'
        ),
        typeArguments: [testCoins.asset.type, testCoins.stable.type],
        arguments: [
            contributeTx.object(RAISE_ID),
            contributeTx.sharedObjectRef({
                objectId: factoryObject!.objectId,
                initialSharedVersion: factoryObject!.initialSharedVersion,
                mutable: false,
            }),
            paymentCoin,
            contributeTx.pure.u64(LaunchpadOperations.UNLIMITED_CAP), // Accept any total raise size
            crankFeeCoin,
            contributeTx.object('0x6'), // clock
        ],
    });

    // Transfer remaining coins back to sender
    contributeTx.transferObjects([firstCoin], contributeTx.pure.address(sender));

    console.log('\n💦 Executing contribution transaction...');
    const result = await executeTransaction(sdk, contributeTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
    });

    console.log('\n🎉 Successfully contributed to raise!');
    console.log(`   Transaction Digest: ${result.digest}`);

    // Step 3: Query the raise to see updated state
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: QUERY RAISE STATE');
    console.log('='.repeat(80));

    const factoryPackageId = sdk.getPackageId('futarchy_factory')!;
    const contributions = await sdk.query.getContributions(factoryPackageId, RAISE_ID);

    console.log(`\n📊 Total Contributions: ${contributions.length}`);
    contributions.forEach((contrib, idx) => {
        console.log(`\n${idx + 1}. Contributor: ${contrib.contributor}`);
        console.log(`   Amount: ${TransactionUtils.mistToSui(contrib.amount)} NSSTABLE`);
        console.log(`   Cap: ${contrib.cap === '18446744073709551615' ? 'UNLIMITED' : TransactionUtils.mistToSui(contrib.cap)}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ CONTRIBUTION COMPLETE!');
    console.log('='.repeat(80));
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
