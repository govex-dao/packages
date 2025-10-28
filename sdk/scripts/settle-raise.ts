/**
 * Script to practice raise settlement
 * We'll contribute enough to meet the min, then settle
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../src/lib/transaction';
import { LaunchpadOperations } from '../src/lib/launchpad';
import { initSDK, loadTestCoins, executeTransaction, getActiveAddress } from './execute-tx';

// The first raise we created
const RAISE_ID = '0xd93026a0108fd3472c9e8df451097a70142719888dc33ff457b74deb1c12d1be';
const CREATOR_CAP_ID = '0x893fd5b51d118a3f0cd020d7aea7e581755a81cffabb40f21d11e1188dbfd6f6';

async function main() {
    console.log('='.repeat(80));
    console.log('PRACTICE RAISE RESOLUTION');
    console.log('='.repeat(80));

    const sdk = await initSDK();
    const testCoins = loadTestCoins();
    const sender = getActiveAddress();

    console.log(`\n👤 Active Address: ${sender}`);
    console.log(`🎯 Raise ID: ${RAISE_ID}`);

    // Check current contributions
    const factoryPackageId = sdk.getPackageId('futarchy_factory')!;
    const contributions = await sdk.query.getContributions(factoryPackageId, RAISE_ID);
    const totalContributed = contributions.reduce((sum, c) => sum + BigInt(c.amount), 0n);

    console.log(`\n📊 Current Status:`);
    console.log(`   Total Contributed: ${TransactionUtils.mistToSui(totalContributed)} (need 10 min)`);
    console.log(`   Contributions: ${contributions.length}`);

    // Contribute more to meet minimum
    const minRaise = 10_000_000_000n; // 10 NSSTABLE
    const stillNeeded = minRaise - totalContributed;

    if (stillNeeded > 0) {
        console.log(`\n💰 Need ${TransactionUtils.mistToSui(stillNeeded)} more to meet minimum!`);
        console.log(`   Let's contribute that amount...`);

        // Mint enough NSSTABLE
        const amountToMint = stillNeeded + 1_000_000_000n; // Extra buffer
        console.log(`\n📝 Minting ${TransactionUtils.mistToSui(amountToMint)} NSSTABLE...`);

        const mintTx = new Transaction();
        mintTx.moveCall({
            target: `${testCoins.stable.packageId}::coin::mint`,
            arguments: [
                mintTx.object(testCoins.stable.treasuryCap),
                mintTx.pure.u64(amountToMint),
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

        // Contribute
        console.log(`\n💸 Contributing ${TransactionUtils.mistToSui(stillNeeded + 100_000_000n)}...`);

        const coins = await sdk.client.getCoins({
            owner: sender,
            coinType: testCoins.stable.type,
        });

        const contributeTx = new Transaction();
        const [firstCoin, ...restCoins] = coins.data.map(c => contributeTx.object(c.coinObjectId));
        if (restCoins.length > 0) {
            contributeTx.mergeCoins(firstCoin, restCoins);
        }

        const [paymentCoin] = contributeTx.splitCoins(firstCoin, [contributeTx.pure.u64(stillNeeded + 100_000_000n)]);
        const [crankFeeCoin] = contributeTx.splitCoins(contributeTx.gas, [contributeTx.pure.u64(TransactionUtils.suiToMist(0.1))]);

        const factoryObject = sdk.deployments.getFactory();
        contributeTx.moveCall({
            target: TransactionUtils.buildTarget(factoryPackageId, 'launchpad', 'contribute'),
            typeArguments: [testCoins.asset.type, testCoins.stable.type],
            arguments: [
                contributeTx.object(RAISE_ID),
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

        console.log('✅ Contributed!');
    } else {
        console.log(`\n✅ Minimum already met!`);
    }

    console.log(`\n📋 Raise is still active with 4 days remaining.`);
    console.log(`   To practice settlement, you would:`);
    console.log(`   1. Wait for deadline to pass (or use endRaiseEarly if allowed)`);
    console.log(`   2. Call settleRaise to finalize the amount`);
    console.log(`   3. Call completeRaise to create the DAO`);
    console.log(`   4. Contributors can then claim their tokens`);

    console.log(`\n🔗 View raise on explorer:`);
    console.log(`   https://suiscan.xyz/devnet/object/${RAISE_ID}`);

    console.log('\n' + '='.repeat(80));
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
