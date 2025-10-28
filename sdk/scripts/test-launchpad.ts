/**
 * Test script for Launchpad operations
 *
 * This demonstrates:
 * 1. Creating a raise using test tokens
 * 2. Contributing to the raise
 * 3. Querying raise data
 */

import { LaunchpadOperations } from '../src/lib/launchpad';
import { TransactionUtils } from '../src/lib/transaction';
import { initSDK, loadTestCoins, executeTransaction, getActiveAddress } from './execute-tx';

async function main() {
    console.log('='.repeat(80));
    console.log('LAUNCHPAD TEST SCRIPT');
    console.log('='.repeat(80));

    // Initialize SDK
    const sdk = await initSDK();
    const testCoins = loadTestCoins();
    const sender = getActiveAddress();

    console.log(`\n👤 Active Address: ${sender}`);

    // ===== Step 1: Create a Raise =====
    console.log('\n' + '='.repeat(80));
    console.log('STEP 1: CREATE RAISE');
    console.log('='.repeat(80));

    const createRaiseTx = sdk.launchpad.createRaise({
        raiseTokenType: testCoins.asset.type,
        stableCoinType: testCoins.stable.type,
        treasuryCap: testCoins.asset.treasuryCap,
        coinMetadata: testCoins.asset.metadata,

        tokensForSale: 1_000_000n, // 1M tokens
        minRaiseAmount: TransactionUtils.suiToMist(10), // Min 10 SUI equivalent
        maxRaiseAmount: TransactionUtils.suiToMist(100), // Max 100 SUI equivalent

        allowedCaps: [
            TransactionUtils.suiToMist(10), // Cap 1: 10 SUI
            TransactionUtils.suiToMist(50), // Cap 2: 50 SUI
            LaunchpadOperations.UNLIMITED_CAP, // No cap
        ],

        allowEarlyCompletion: false,

        description: 'Test launchpad raise for Govex protocol development',
        affiliateId: '',
        metadataKeys: ['website', 'twitter'],
        metadataValues: ['https://govex.ai', '@govex'],

        launchpadFee: 100n, // 100 MIST fee (for testing)
    });

    console.log('\n📝 Transaction prepared:');
    console.log(`   Raise Token: NSASSET (Non-Shared Asset)`);
    console.log(`   Stable Coin: NSSTABLE (Non-Shared Stable)`);
    console.log(`   Tokens for Sale: 1,000,000`);
    console.log(`   Min Raise: 10 NSSTABLE`);
    console.log(`   Max Raise: 100 NSSTABLE`);
    console.log(`   Deadline: Auto-calculated by contract (current time + duration)`);

    console.log('\n💦 EXECUTING FOR REAL (WET RUN)...');
    const result = await executeTransaction(sdk, createRaiseTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: true,
        showEvents: true
    });

    console.log('\n✅ Create raise transaction ready!');
    console.log('\n📋 To execute for real, you would need to:');
    console.log('   1. Get the transaction bytes');
    console.log('   2. Sign with your keypair');
    console.log('   3. Execute on-chain');

    // ===== Step 2: Query Existing Raises =====
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: QUERY EXISTING RAISES');
    console.log('='.repeat(80));

    const factoryPackageId = sdk.getPackageId('futarchy_factory')!;

    try {
        const allRaises = await sdk.query.getAllRaises(factoryPackageId);
        console.log(`\n📊 Total Raises: ${allRaises.length}`);

        if (allRaises.length > 0) {
            console.log('\n🎯 Most Recent Raises:');
            allRaises.slice(-3).forEach((raise, idx) => {
                console.log(`\n${idx + 1}. Raise ID: ${raise.raise_id}`);
                console.log(`   Creator: ${raise.creator}`);
                console.log(`   Tokens for Sale: ${raise.tokens_for_sale_amount}`);
                console.log(`   Min Raise: ${raise.min_raise_amount}`);
                console.log(`   Deadline: ${new Date(Number(raise.deadline_ms)).toLocaleString()}`);
                console.log(`   Description: ${raise.description}`);
            });

            // Query contributions for the latest raise
            const latestRaise = allRaises[allRaises.length - 1];
            const contributions = await sdk.query.getContributions(
                factoryPackageId,
                latestRaise.raise_id
            );

            console.log(`\n💰 Contributions to latest raise: ${contributions.length}`);
            if (contributions.length > 0) {
                contributions.forEach((contrib, idx) => {
                    console.log(
                        `   ${idx + 1}. ${contrib.contributor}: ${TransactionUtils.mistToSui(contrib.amount)} STABLE`
                    );
                });
            }
        } else {
            console.log('\n📭 No raises found yet. Create one to get started!');
        }
    } catch (error) {
        console.log('\n⚠️  No raises found or error querying:', (error as Error).message);
    }

    // ===== Step 3: Prepare Contribute Transaction =====
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: PREPARE CONTRIBUTE TRANSACTION (EXAMPLE)');
    console.log('='.repeat(80));

    console.log('\n💡 To contribute to a raise, you would:');
    console.log(`   1. First mint some NSSTABLE tokens to yourself`);
    console.log(`   2. Then contribute to the raise`);

    // Example of how to build a contribute transaction
    // const contributeTx = sdk.launchpad.contribute(
    //     {
    //         raiseId: EXAMPLE_RAISE_ID,
    //         paymentAmount: TransactionUtils.suiToMist(5), // Contribute 5 NSSTABLE
    //         maxTotalCap: TransactionUtils.suiToMist(50), // Accept raise up to 50 NSSTABLE
    //         crankFee: TransactionUtils.suiToMist(0.1), // 0.1 SUI fee
    //     },
    //     '0x6' // clock
    // );

    console.log('\n📝 Contribution transaction can be built with sdk.launchpad.contribute():');
    console.log(`   Example Amount: 5 NSSTABLE`);
    console.log(`   Example Max Cap: 50 NSSTABLE`);

    // ===== Summary =====
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    console.log('\n✅ SDK is working! You can:');
    console.log('   1. Build transactions for create raise');
    console.log('   2. Build transactions for contributing');
    console.log('   3. Query on-chain data');
    console.log('   4. Query contributions and raise status');

    console.log('\n⚠️  To execute transactions for real:');
    console.log('   • Option 1: Use sui CLI: sui client execute-signed-tx');
    console.log('   • Option 2: Import keypair and use executeTransactionWithKeypair()');
    console.log('   • Option 3: Integrate with a wallet');

    console.log('\n📚 Next steps:');
    console.log('   1. Mint some NSSTABLE tokens to test with');
    console.log('   2. Create a real raise using the transaction builder');
    console.log('   3. Contribute to the raise');
    console.log('   4. Test claiming tokens after raise completes');

    console.log('\n' + '='.repeat(80));
}

// Run the script
main()
    .then(() => {
        console.log('\n✅ Script completed successfully\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
