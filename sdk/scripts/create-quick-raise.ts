/**
 * Create a quick raise with 10s duration for testing resolution flow
 */

import { LaunchpadOperations } from '../src/lib/launchpad';
import { TransactionUtils } from '../src/lib/transaction';
import { initSDK, loadTestCoins, executeTransaction, getActiveAddress } from './execute-tx';

async function main() {
    console.log('='.repeat(80));
    console.log('CREATE QUICK RAISE (10 SECOND DURATION)');
    console.log('='.repeat(80));

    const sdk = await initSDK();
    const testCoins = loadTestCoins();
    const sender = getActiveAddress();

    console.log(`\n👤 Active Address: ${sender}`);

    console.log('\n📝 Transaction configuration:');
    console.log(`   Raise Token: NSASSET (Non-Shared Asset)`);
    console.log(`   Stable Coin: NSSTABLE (Non-Shared Stable)`);
    console.log(`   Tokens for Sale: 1,000,000`);
    console.log(`   Min Raise: 1 NSSTABLE (1 billion MIST)`);
    console.log(`   Max Raise: 100 NSSTABLE`);
    console.log(`   Duration: 10 SECONDS ⚡`);
    console.log(`   Fee: 100 MIST`);

    const createRaiseTx = sdk.launchpad.createRaise({
        raiseTokenType: testCoins.asset.type,
        stableCoinType: testCoins.stable.type,
        treasuryCap: testCoins.asset.treasuryCap,
        coinMetadata: testCoins.asset.metadata,

        tokensForSale: 1_000_000n,
        minRaiseAmount: 1_000_000_000n, // 1 NSSTABLE (1 billion MIST, same as 1 SUI)
        maxRaiseAmount: TransactionUtils.suiToMist(100), // 100 NSSTABLE

        allowedCaps: [
            TransactionUtils.suiToMist(1), // Cap 1: 1 NSSTABLE
            TransactionUtils.suiToMist(50), // Cap 2: 50 NSSTABLE
            LaunchpadOperations.UNLIMITED_CAP, // No cap
        ],

        allowEarlyCompletion: false,

        description: 'Quick raise for testing resolution flow - 10s duration',
        affiliateId: '',
        metadataKeys: ['test'],
        metadataValues: ['quick-resolution'],

        launchpadFee: 100n, // 100 MIST
    });

    console.log('\n💦 EXECUTING FOR REAL...');
    const result = await executeTransaction(sdk, createRaiseTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: true,
        showEvents: true
    });

    // Extract raise ID from events
    const raiseCreatedEvent = result.events?.find((e: any) =>
        e.type.includes('RaiseCreated')
    );

    if (raiseCreatedEvent) {
        const raiseId = raiseCreatedEvent.parsedJson.raise_id;
        const deadline = raiseCreatedEvent.parsedJson.deadline_ms;
        const now = Date.now();
        const secondsRemaining = Math.ceil((Number(deadline) - now) / 1000);

        console.log('\n🎯 RAISE CREATED!');
        console.log(`   Raise ID: ${raiseId}`);
        console.log(`   Deadline: ${new Date(Number(deadline)).toISOString()}`);
        console.log(`   ⏱️  Time Remaining: ${secondsRemaining} seconds`);
        console.log(`   Transaction: ${result.digest}`);

        console.log('\n⏳ Waiting for raise to complete...');
        console.log(`   (Sleeping for ${secondsRemaining + 2} seconds)`);

        // Wait for the raise to complete
        await new Promise(resolve => setTimeout(resolve, (secondsRemaining + 2) * 1000));

        console.log('\n✅ Raise should now be past deadline!');
        console.log('\n📋 Next steps:');
        console.log(`   1. Settle the raise: sdk.launchpad.settleRaise("${raiseId}")`);
        console.log(`   2. If successful, complete: sdk.launchpad.completeRaise("${raiseId}", creatorCapId, fee)`);
        console.log(`   3. If failed, cleanup: sdk.launchpad.cleanupFailedRaise("${raiseId}", creatorCapId)`);

        console.log(`\n🔗 View on explorer:`);
        console.log(`   https://suiscan.xyz/devnet/object/${raiseId}`);
    }

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
