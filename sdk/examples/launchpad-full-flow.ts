/**
 * Example: Complete Launchpad Flow
 *
 * This example demonstrates the full lifecycle of a token launchpad:
 * 1. Creating a raise
 * 2. Contributing to the raise
 * 3. Settling and completing the raise
 * 4. Claiming tokens
 * 5. Batch operations
 * 6. Querying raise data
 */

import { FutarchySDK, LaunchpadOperations, TransactionUtils } from '../src';

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

    // ===== STEP 1: Create a Token Raise =====

    console.log('\n📝 Creating a token launchpad raise...');

    const raiseConfig = {
        // Token configuration
        raiseTokenType: '0xYOUR_PACKAGE::your_coin::YOUR_COIN',
        stableCoinType: '0x2::sui::SUI',
        treasuryCap: '0xYOUR_TREASURY_CAP_ID',
        coinMetadata: '0xYOUR_COIN_METADATA_ID',

        // Raise parameters
        tokensForSale: 1000000n, // 1M tokens
        minRaiseAmount: TransactionUtils.suiToMist(100), // Min 100 SUI
        maxRaiseAmount: TransactionUtils.suiToMist(1000), // Max 1000 SUI (optional)

        // Contribution caps (sorted ascending, must end with UNLIMITED_CAP)
        allowedCaps: [
            TransactionUtils.suiToMist(50), // Cap 1: 50 SUI
            TransactionUtils.suiToMist(100), // Cap 2: 100 SUI
            TransactionUtils.suiToMist(200), // Cap 3: 200 SUI
            LaunchpadOperations.UNLIMITED_CAP, // No cap
        ],

        allowEarlyCompletion: false,

        // Metadata
        description:
            'Revolutionary token with real utility! Join our community and be part of the future.',
        affiliateId: '', // Optional partner ID
        metadataKeys: ['website', 'twitter', 'discord'],
        metadataValues: [
            'https://example.com',
            '@example',
            'https://discord.gg/example',
        ],

        // Creation fee
        launchpadFee: TransactionUtils.suiToMist(1), // 1 SUI
    };

    // Deadline: 7 days from now
    const deadlineMs = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const createTx = sdk.launchpad.createRaise(raiseConfig, deadlineMs);

    console.log('Transaction created. Sign and execute to create raise.');

    // NOTE: In real usage, sign and execute:
    /*
    const result = await sdk.client.signAndExecuteTransaction({
        transaction: createTx,
        signer: keypair,
        options: {
            showEffects: true,
            showObjectChanges: true,
            showEvents: true,
        },
    });

    // Extract Raise object ID
    const raiseObject = result.objectChanges?.find(
        (change) => change.type === 'created' && change.objectType.includes('::launchpad::Raise')
    );

    const raiseId = raiseObject && 'objectId' in raiseObject ? raiseObject.objectId : null;

    // Extract CreatorCap object ID
    const creatorCap = result.objectChanges?.find(
        (change) => change.type === 'created' && change.objectType.includes('::launchpad::CreatorCap')
    );

    const creatorCapId = creatorCap && 'objectId' in creatorCap ? creatorCap.objectId : null;

    console.log('\n✅ Raise created!');
    console.log('Raise ID:', raiseId);
    console.log('Creator Cap ID:', creatorCapId);
    */

    // ===== STEP 2: Contribute to the Raise =====

    console.log('\n💰 Contributing to raise...');

    const EXAMPLE_RAISE_ID = '0xRAISE_ID';

    const contributeTx = sdk.launchpad.contribute({
        raiseId: EXAMPLE_RAISE_ID,
        paymentAmount: TransactionUtils.suiToMist(10), // Contribute 10 SUI
        maxTotalCap: TransactionUtils.suiToMist(200), // Accept raise up to 200 SUI
        crankFee: TransactionUtils.suiToMist(0.1), // 0.1 SUI fee for batch claims
    });

    console.log('Contribution transaction created.');

    // Multiple contributions allowed - just call contribute() again
    // Can change maxTotalCap before deadline - 24 hours

    // ===== STEP 3: Query Raise Data =====

    console.log('\n🔍 Querying raise data...');

    const factoryPackageId = sdk.getPackageId('futarchy_factory')!;

    // Get all raises
    const allRaises = await sdk.query.getAllRaises(factoryPackageId);
    console.log(`\nTotal raises: ${allRaises.length}`);

    if (allRaises.length > 0) {
        const recentRaise = allRaises[allRaises.length - 1];
        console.log('\nMost Recent Raise:');
        console.log('  Raise ID:', recentRaise.raise_id);
        console.log('  Creator:', recentRaise.creator);
        console.log('  Min Raise:', recentRaise.min_raise_amount);
        console.log('  Max Raise:', recentRaise.max_raise_amount || 'Unlimited');
        console.log('  Tokens for Sale:', recentRaise.tokens_for_sale_amount);
        console.log('  Description:', recentRaise.description);
        console.log('  Deadline:', new Date(Number(recentRaise.deadline_ms)).toLocaleString());

        // Get contributions for this raise
        const contributions = await sdk.query.getContributions(
            factoryPackageId,
            recentRaise.raise_id
        );
        console.log(`\n  Total contributors: ${contributions.length}`);

        if (contributions.length > 0) {
            console.log('\n  Recent contributions:');
            contributions.slice(-5).forEach((contrib, idx) => {
                console.log(`    ${idx + 1}. ${contrib.contributor}`);
                console.log(`       Amount: ${TransactionUtils.mistToSui(contrib.amount)} SUI`);
                console.log(`       Max Cap: ${TransactionUtils.mistToSui(contrib.max_total_cap)} SUI`);
            });
        }

        // Get raise state
        const state = await sdk.query.getRaiseState(recentRaise.raise_id);
        const stateNames = ['FUNDING', 'SUCCESSFUL', 'FAILED'];
        console.log(`\n  State: ${stateNames[state]}`);

        // Get total raised
        const totalRaised = await sdk.query.getTotalRaised(recentRaise.raise_id);
        console.log(`  Total Raised: ${TransactionUtils.mistToSui(totalRaised)} SUI`);
    }

    // ===== STEP 4: Settle Raise (After Deadline) =====

    console.log('\n\n⚖️ Settling raise (after deadline)...');

    const settleTx = sdk.launchpad.settleRaise(EXAMPLE_RAISE_ID);

    console.log('Settle transaction created. Anyone can call this after deadline.');

    // ===== STEP 5: Complete Raise (Create DAO) =====

    console.log('\n🎉 Completing successful raise...');

    const EXAMPLE_CREATOR_CAP_ID = '0xCREATOR_CAP_ID';

    const completeTx = sdk.launchpad.completeRaise(
        EXAMPLE_RAISE_ID,
        EXAMPLE_CREATOR_CAP_ID,
        TransactionUtils.suiToMist(1), // DAO creation fee
    );

    console.log('Complete raise transaction created (requires CreatorCap).');

    // Alternative: Permissionless completion after 24h delay
    const completePermissionlessTx = sdk.launchpad.completeRaisePermissionless(
        EXAMPLE_RAISE_ID,
        TransactionUtils.suiToMist(1),
    );

    console.log('Or use permissionless completion after deadline + 24 hours.');

    // ===== STEP 6: Claim Tokens =====

    console.log('\n🎁 Claiming tokens (for contributors)...');

    const claimTx = sdk.launchpad.claimTokens(EXAMPLE_RAISE_ID);

    console.log('Claim transaction created. Each contributor calls this once.');

    // Check if tokens were claimed
    const tokenClaims = await sdk.query.getTokenClaims(factoryPackageId, EXAMPLE_RAISE_ID);
    console.log(`\nTotal token claims: ${tokenClaims.length}`);

    // ===== STEP 7: Batch Claim Tokens =====

    console.log('\n⚡ Batch claiming tokens (for crankers to earn rewards)...');

    const contributorAddresses = [
        '0xCONTRIBUTOR_1',
        '0xCONTRIBUTOR_2',
        '0xCONTRIBUTOR_3',
        // ... up to 100 addresses
    ];

    const batchClaimTx = sdk.launchpad.batchClaimTokensFor(
        EXAMPLE_RAISE_ID,
        contributorAddresses
    );

    console.log('Batch claim transaction created. Cranker earns rewards per successful claim.');

    // ===== STEP 8: Failed Raise - Claim Refunds =====

    console.log('\n💸 Claiming refunds (if raise failed)...');

    const refundTx = sdk.launchpad.claimRefund(EXAMPLE_RAISE_ID);

    console.log('Refund claim transaction created.');

    // Batch refund claiming
    const batchRefundTx = sdk.launchpad.batchClaimRefundFor(
        EXAMPLE_RAISE_ID,
        contributorAddresses
    );

    console.log('Batch refund transaction created.');

    // ===== STEP 9: Query User Contributions =====

    console.log('\n\n👤 Querying user-specific data...');

    const userAddress = '0xUSER_ADDRESS';

    // Get all raises created by user
    const myRaises = await sdk.query.getRaisesByCreator(factoryPackageId, userAddress);
    console.log(`\nRaises created by user: ${myRaises.length}`);

    // Get all contributions by user
    const myContributions = await sdk.query.getContributionsByAddress(
        factoryPackageId,
        userAddress
    );
    console.log(`Contributions by user: ${myContributions.length}`);

    // Get specific contribution in a raise
    const userContribution = await sdk.query.getUserContribution(
        EXAMPLE_RAISE_ID,
        userAddress
    );
    if (userContribution) {
        console.log('\nUser contribution in this raise:');
        console.log(JSON.stringify(userContribution, null, 2));
    } else {
        console.log('\nUser has not contributed to this raise.');
    }

    // ===== STEP 10: Additional Operations =====

    console.log('\n\n🛠️ Additional operations...');

    // End raise early (if allowed and min met)
    const endEarlyTx = sdk.launchpad.endRaiseEarly(
        EXAMPLE_RAISE_ID,
        EXAMPLE_CREATOR_CAP_ID
    );
    console.log('End raise early transaction created (requires allowEarlyCompletion=true).');

    // Cleanup failed raise
    const cleanupTx = sdk.launchpad.cleanupFailedRaise(
        EXAMPLE_RAISE_ID,
        EXAMPLE_CREATOR_CAP_ID
    );
    console.log('Cleanup transaction created (returns TreasuryCap to creator).');

    console.log('\n✅ All launchpad operations demonstrated!');
    console.log('\n📚 Remember to:');
    console.log('   1. Create coin with TreasuryCap (0 supply)');
    console.log('   2. Get launchpad/DAO creation fees from Factory config');
    console.log('   3. Wait for deadline before settling');
    console.log('   4. Settlement must complete before DAO creation');
    console.log('   5. Contributors can claim once raise completes');
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
