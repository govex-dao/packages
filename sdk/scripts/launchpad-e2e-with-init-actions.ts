/**
 * Launchpad E2E Test with Init Actions
 *
 * Full end-to-end integration test of the launchpad flow:
 * 1. Creates fresh test coins
 * 2. Registers them in the system
 * 3. Creates a raise with init actions
 * 4. Contributes to meet minimum
 * 5. Ends raise early
 * 6. Settles and finalizes the raise
 * 7. Claims tokens
 */

import { Transaction, Inputs } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { LaunchpadOperations } from '../src/lib/launchpad';
import { TransactionUtils } from '../src/lib/transaction';
import { initSDK, executeTransaction, getActiveAddress } from './execute-tx';

const testCoinSource = (symbol: string, name: string) => `
module test_coin::coin {
    use sui::coin::{Self, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::TxContext;

    public struct COIN has drop {}

    fun init(witness: COIN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9,
            b"${symbol}",
            b"${name}",
            b"Test coin for launchpad E2E testing",
            option::none(),
            ctx
        );

        // Transfer treasury and metadata to sender WITHOUT freezing (required for launchpad)
        transfer::public_transfer(treasury, ctx.sender());
        transfer::public_transfer(metadata, ctx.sender());
    }

    public entry fun mint(
        treasury_cap: &mut TreasuryCap<COIN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient)
    }
}
`;

async function createTestCoin(name: string, symbol: string): Promise<{
    packageId: string;
    type: string;
    treasuryCap: string;
    metadata: string;
}> {
    console.log(`\n📦 Publishing ${name} test coin...`);

    const tmpDir = `/tmp/test_coin_${symbol.toLowerCase()}`;
    execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}/sources`, { encoding: 'utf8' });

    fs.writeFileSync(`${tmpDir}/Move.toml`, `
[package]
name = "test_coin"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
test_coin = "0x0"
`);

    fs.writeFileSync(`${tmpDir}/sources/coin.move`, testCoinSource(symbol, name));

    console.log('   Building...');
    execSync(`cd ${tmpDir} && sui move build 2>&1 | grep -v "warning"`, { encoding: 'utf8' });

    console.log('   Publishing...');
    const result = execSync(`cd ${tmpDir} && sui client publish --gas-budget 100000000 --json`, { encoding: 'utf8' });
    const parsed = JSON.parse(result);

    if (parsed.effects.status.status !== 'success') {
        throw new Error(`Failed to publish ${name}: ${parsed.effects.status.error}`);
    }

    const published = parsed.objectChanges.find((c: any) => c.type === 'published');
    const packageId = published.packageId;

    const created = parsed.objectChanges.filter((c: any) => c.type === 'created');
    const treasuryCap = created.find((c: any) => c.objectType.includes('TreasuryCap'));
    const metadata = created.find((c: any) => c.objectType.includes('CoinMetadata'));

    const coinType = `${packageId}::coin::COIN`;

    console.log(`   ✅ Published!`);
    console.log(`      Package: ${packageId}`);
    console.log(`      Type: ${coinType}`);
    console.log(`      TreasuryCap: ${treasuryCap.objectId}`);
    console.log(`      Metadata: ${metadata.objectId}`);

    return {
        packageId,
        type: coinType,
        treasuryCap: treasuryCap.objectId,
        metadata: metadata.objectId,
    };
}

async function main() {
    console.log('='.repeat(80));
    console.log('E2E TEST: LAUNCHPAD RAISE LIFECYCLE (EARLY COMPLETION)');
    console.log('='.repeat(80));

    const sdk = await initSDK();
    const sender = getActiveAddress();

    console.log(`\n👤 Active Address: ${sender}`);

    // Step 0: Create fresh test coins
    console.log('\n' + '='.repeat(80));
    console.log('STEP 0: CREATE TEST COINS');
    console.log('='.repeat(80));

    const testCoins = {
        asset: await createTestCoin('Test Asset', 'TASSET'),
        stable: await createTestCoin('Test Stable', 'TSTABLE'),
    };

    console.log('\n✅ Test coins created!');

    // Step 1: Register test stable coin for fee payments
    console.log('\n' + '='.repeat(80));
    console.log('STEP 1: REGISTER TEST STABLE COIN FOR FEE PAYMENTS');
    console.log('='.repeat(80));

    // Load FeeAdminCap from deployment JSON
    const feeManagerDeployment = require('../../deployments/futarchy_markets_core.json');
    const feeAdminCapId = feeManagerDeployment.objectChanges?.find(
        (obj: any) => obj.objectType?.includes('::fee::FeeAdminCap')
    )?.objectId;

    if (!feeAdminCapId) {
        throw new Error('FeeAdminCap not found in futarchy_markets_core deployment');
    }

    console.log(`Using FeeAdminCap: ${feeAdminCapId}`);

    try {
        const registerFeeTx = sdk.feeManager.addCoinFeeConfig({
            coinType: testCoins.stable.type,
            decimals: 9,
            daoCreationFee: 100_000_000n,  // 0.1 TSTABLE
            proposalFeePerOutcome: 10_000_000n,  // 0.01 TSTABLE
        }, feeAdminCapId);

        await executeTransaction(sdk, registerFeeTx, {
            network: 'devnet',
            dryRun: false,
            showEffects: false
        });
        console.log('✅ Test stable coin registered for fee payments');
    } catch (error: any) {
        if (error.message?.includes('dynamic_field') || error.message?.includes('EAlreadyExists')) {
            console.log('✅ Test stable coin already registered for fee payments');
        } else {
            throw error;
        }
    }

    // Step 2: Register test stable coin type in Factory (required for creating raises)
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: REGISTER TEST STABLE COIN IN FACTORY ALLOWLIST');
    console.log('='.repeat(80));

    // Load FactoryOwnerCap from deployment JSON
    const factoryDeployment = require('../../deployments/futarchy_factory.json');
    const factoryOwnerCapId = factoryDeployment.objectChanges?.find(
        (obj: any) => obj.objectType?.includes('::factory::FactoryOwnerCap')
    )?.objectId;

    if (!factoryOwnerCapId) {
        throw new Error('FactoryOwnerCap not found in futarchy_factory deployment');
    }

    // Load PackageRegistry from deployment JSON
    const registryDeployment = require('../../deployments/AccountProtocol.json');
    const registryId = registryDeployment.objectChanges?.find(
        (obj: any) => obj.objectType?.includes('::package_registry::PackageRegistry')
    )?.objectId;

    if (!registryId) {
        throw new Error('PackageRegistry not found in AccountProtocol deployment');
    }

    console.log(`Using FactoryOwnerCap: ${factoryOwnerCapId}`);

    try {
        const registerFactoryTx = sdk.factoryAdmin.addAllowedStableType(
            testCoins.stable.type,
            factoryOwnerCapId
        );

        await executeTransaction(sdk, registerFactoryTx, {
            network: 'devnet',
            dryRun: false,
            showEffects: false
        });
        console.log('✅ Test stable coin registered in factory allowlist');
    } catch (error: any) {
        console.log('✅ Test stable coin already allowed in factory (or registration failed - will check on create)');
    }

    // Step 3: Create raise with early completion enabled
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: CREATE RAISE WITH EARLY COMPLETION');
    console.log('='.repeat(80));

    const createRaiseTx = sdk.launchpad.createRaise({
        raiseTokenType: testCoins.asset.type,
        stableCoinType: testCoins.stable.type,
        treasuryCap: testCoins.asset.treasuryCap,
        coinMetadata: testCoins.asset.metadata,

        tokensForSale: 1_000_000n,
        minRaiseAmount: TransactionUtils.suiToMist(1), // Min 1 TSTABLE
        maxRaiseAmount: TransactionUtils.suiToMist(100),

        allowedCaps: [
            TransactionUtils.suiToMist(1),
            TransactionUtils.suiToMist(50),
            LaunchpadOperations.UNLIMITED_CAP,
        ],

        startDelayMs: 15_000, // 15-second delay to pre-create DAO before raise starts
        allowEarlyCompletion: true, // ✅ KEY: Enable early completion!

        description: 'E2E test - raise with pre-created DAO',
        affiliateId: '',
        metadataKeys: [],
        metadataValues: [],

        launchpadFee: 100n,
    });

    console.log('Creating raise...');
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
    console.log(`   Min Raise: 1 TSTABLE`);
    console.log(`   Early Completion: ENABLED ✅`);

    // Step 3.5: Stage init action specs (DISCLOSURE ONLY - for investor transparency)
    //
    // IMPORTANT: This does NOT execute the stream creation. It only stores the
    // InitActionSpecs so investors can see what will happen during DAO creation.
    // Actual execution happens in Step 8 via manual PTB call to init_create_stream.
    //
    // This is the "disclosure-only" pattern - staging for transparency, manual execution.
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3.5: STAGE INIT ACTION SPECS (DISCLOSURE ONLY)');
    console.log('='.repeat(80));

    // Define stream parameters (will be used in both staging AND execution)
    const streamRecipient = sender;
    const streamAmount = TransactionUtils.suiToMist(0.5); // 0.5 TSTABLE
    const currentTime = Date.now();
    const streamStart = currentTime + 60_000; // Start in 1 minute
    const streamEnd = streamStart + 3_600_000; // End in 1 hour
    const actionsPkg = sdk.getPackageId('AccountActions'); // Note: Capital A!
    const launchpadPkg = sdk.getPackageId('futarchy_factory');
    const futarchyActionsPkg = sdk.getPackageId('futarchy_actions');

    console.log(`\n📦 Package IDs:`);
    console.log(`   AccountActions: ${actionsPkg}`);
    console.log(`   futarchy_factory: ${launchpadPkg}`);
    console.log(`   futarchy_actions: ${futarchyActionsPkg}`);

    console.log('\n📋 Staging stream init action for investor transparency...');
    console.log('   (This is disclosure-only - actual execution in Step 8)');
    console.log(`   Vault: treasury`);
    console.log(`   Beneficiary: ${streamRecipient}`);
    console.log(`   Amount: ${Number(streamAmount) / 1e9} TSTABLE`);
    console.log(`   Duration: ${(streamEnd - streamStart) / 3600000} hours`);

    const stageTx = new Transaction();

    // Step 1: Build InitActionSpecs using vault_init_staging helper
    const initSpecs = stageTx.moveCall({
        target: `${futarchyActionsPkg}::vault_init_staging::build_stream_init_spec`,
        arguments: [
            stageTx.pure.string('treasury'),
            stageTx.pure(bcs.Address.serialize(streamRecipient).toBytes()), // Use BCS serialization for address
            stageTx.pure.u64(streamAmount),
            stageTx.pure.u64(streamStart),
            stageTx.pure.u64(streamEnd),
            stageTx.pure.option('u64', null), // cliff_time
            stageTx.pure.u64(streamAmount), // max_per_withdrawal
            stageTx.pure.u64(86400000), // min_interval_ms (1 day)
            stageTx.pure.u64(1), // max_beneficiaries
        ],
    });

    // Step 2: Stage the specs using generic staging function
    stageTx.moveCall({
        target: `${launchpadPkg}::launchpad::stage_launchpad_init_intent`,
        typeArguments: [testCoins.asset.type, testCoins.stable.type],
        arguments: [
            stageTx.object(raiseId),
            stageTx.object(registryId),
            stageTx.object(creatorCapId!),
            initSpecs, // InitActionSpecs from step 1
            stageTx.object('0x6'), // Clock
        ],
    });

    const stageResult = await executeTransaction(sdk, stageTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: false,
    });

    console.log('✅ Stream init action staged!');
    console.log(`   Transaction: ${stageResult.digest}`);

    // Step 4: Lock intents and start raise
    console.log('\n' + '='.repeat(80));
    console.log('STEP 4: LOCK INTENTS AND START RAISE');
    console.log('='.repeat(80));

    console.log('\n🔒 Locking intents...');

    const lockTx = sdk.launchpad.lockIntentsAndStartRaise(
        raiseId,
        creatorCapId!,
        testCoins.asset.type,
        testCoins.stable.type
    );

    await executeTransaction(sdk, lockTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: false
    });

    console.log('✅ Intents locked!');

    // Wait for start delay to pass
    console.log('\n⏳ Waiting for start delay (15s) to pass...');
    await new Promise(resolve => setTimeout(resolve, 16000)); // Wait 16s to be safe
    console.log('✅ Raise has started!');

    // Step 5: Mint test stable coins and contribute to meet minimum
    console.log('\n' + '='.repeat(80));
    console.log('STEP 5: MINT & CONTRIBUTE TO MEET MINIMUM');
    console.log('='.repeat(80));

    const amountToContribute = TransactionUtils.suiToMist(2); // Contribute 2 TSTABLE (exceeds min)

    console.log(`\n💰 Minting ${TransactionUtils.mistToSui(amountToContribute)} TSTABLE...`);
    const mintTx = new Transaction();
    mintTx.moveCall({
        target: `${testCoins.stable.packageId}::coin::mint`,
        arguments: [
            mintTx.object(testCoins.stable.treasuryCap),
            mintTx.pure.u64(amountToContribute),
            mintTx.pure.address(sender),
        ],
    });

    await executeTransaction(sdk, mintTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: false,
    });
    console.log('✅ Minted!');

    console.log(`\n💸 Contributing ${TransactionUtils.mistToSui(amountToContribute)} TSTABLE...`);

    // Get minted coins
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

    // Step 6: End raise / Wait for deadline
    console.log('\n' + '='.repeat(80));
    console.log('STEP 6: WAIT FOR DEADLINE');
    console.log('='.repeat(80));

    // Deadline = start_delay (15s) + duration (120s) = 135s from raise creation
    // Wait for the full duration to elapse
    console.log('\n⏰ Waiting for 2-minute raise deadline to pass...');
    console.log('   (Deadline = 15s start delay + 120s duration = 135s total)');
    await new Promise(resolve => setTimeout(resolve, 125000)); // Wait 125s (already waited 16s earlier)
    console.log('✅ Deadline passed, raise ended!');

    // Step 8: Complete raise and EXECUTE init actions (MANUAL PTB EXECUTION)
    //
    // CRITICAL: This is where the stream is ACTUALLY CREATED via manual PTB call.
    // The InitActionSpecs from Step 3.5 were disclosure-only (investor transparency).
    // Here we manually execute the actual init_create_stream function.
    //
    // Pattern: Disclosure (Step 3.5) → Atomic Execution (Step 8)
    console.log('\n' + '='.repeat(80));
    console.log('STEP 8: COMPLETE RAISE + EXECUTE INIT ACTIONS (ATOMIC)');
    console.log('='.repeat(80));

    console.log('\n🏛️  Creating DAO and executing stream init action atomically...');
    console.log('   Using UnsharedDao hot potato for atomic DAO creation + init actions');

    const finalRaiseAmount = amountToContribute; // Use the amount we contributed
    // launchpadPkg and actionsPkg were already loaded in Step 3.5
    const corePkg = sdk.getPackageId('futarchy_core');
    // registryId was already loaded in Step 2

    // Recalculate stream times to ensure they're valid (original times were calculated ~2+ minutes ago)
    const currentTimeNow = Date.now();
    const streamStartNow = currentTimeNow + 60_000; // Start in 1 minute
    const streamEndNow = streamStartNow + 3_600_000; // End in 1 hour

    console.log(`   Stream Recipient: ${streamRecipient}`);
    console.log(`   Stream Amount: ${TransactionUtils.mistToSui(streamAmount)} TSTABLE`);
    console.log(`   Stream Duration: 1 hour`);

    // Get Factory object ID from deployment (factoryDeployment already loaded in Step 2)
    const factoryId = factoryDeployment.objectChanges?.find(
        (obj: any) => obj.objectType?.includes('::factory::Factory') && obj.owner?.Shared
    )?.objectId;

    if (!factoryId) {
        throw new Error('Factory object not found in deployment');
    }

    console.log(`   Factory ID: ${factoryId}`);

    // Build PTB: settle → begin_dao_creation → execute init actions → finalize_and_share_dao
    // ALL in ONE atomic transaction using UnsharedDao hot potato
    const completeTx = new Transaction();

    // Step 1: Settle raise
    completeTx.moveCall({
        target: `${launchpadPkg}::launchpad::settle_raise`,
        typeArguments: [testCoins.asset.type, testCoins.stable.type],
        arguments: [
            completeTx.object(raiseId),
            completeTx.object('0x6'), // Clock
        ],
    });

    // Step 2: Begin DAO creation (returns UnsharedDao hot potato)
    const unsharedDao = completeTx.moveCall({
        target: `${launchpadPkg}::launchpad::begin_dao_creation`,
        typeArguments: [testCoins.asset.type, testCoins.stable.type],
        arguments: [
            completeTx.object(raiseId),
            completeTx.object(factoryId),
            completeTx.object(registryId),
            completeTx.object('0x6'), // Clock
        ],
    });

    // Step 3: Execute init stream action on UnsharedDao
    completeTx.moveCall({
        target: `${launchpadPkg}::launchpad::execute_init_stream_on_unshared`,
        typeArguments: [
            testCoins.asset.type,
            testCoins.stable.type,
            `${corePkg}::futarchy_config::FutarchyConfig`,
            testCoins.stable.type,
        ],
        arguments: [
            unsharedDao,  // Pass UnsharedDao by &mut
            completeTx.object(registryId),
            completeTx.pure.string('treasury'),
            completeTx.pure(bcs.Address.serialize(streamRecipient).toBytes()),
            completeTx.pure.u64(streamAmount),
            completeTx.pure.u64(streamStartNow),
            completeTx.pure.u64(streamEndNow),
            completeTx.pure.option('u64', null), // cliff_time
            completeTx.pure.u64(streamAmount), // max_per_withdrawal
            completeTx.pure.u64(86400000), // min_interval_ms (1 day)
            completeTx.pure.u64(1), // max_beneficiaries
            completeTx.object('0x6'), // Clock
        ],
    });

    // Step 4: Finalize and share DAO (consumes UnsharedDao hot potato)
    completeTx.moveCall({
        target: `${launchpadPkg}::launchpad::finalize_and_share_dao`,
        typeArguments: [testCoins.asset.type, testCoins.stable.type],
        arguments: [
            completeTx.object(raiseId),
            unsharedDao,  // Consume hot potato
        ],
    });

    const completeResult = await executeTransaction(sdk, completeTx, {
        network: 'devnet',
        dryRun: false,
        showEffects: true,
        showObjectChanges: true,
        showEvents: true
    });

    console.log('✅ DAO Created!');
    console.log(`   Transaction: ${completeResult.digest}`);

    const daoCreatedEvent = completeResult.events?.find((e: any) =>
        e.type.includes('RaiseSuccessful')
    );

    let accountId: string | undefined;
    if (daoCreatedEvent) {
        console.log('\n🎉 DAO Details:');
        console.log(JSON.stringify(daoCreatedEvent.parsedJson, null, 2));
        accountId = daoCreatedEvent.parsedJson?.account_id;
    }

    // Find Account object from objectChanges
    if (!accountId) {
        const accountObject = completeResult.objectChanges?.find((c: any) =>
            c.objectType?.includes('::account::Account')
        );
        if (accountObject) {
            accountId = accountObject.objectId;
        }
    }

    if (!accountId) {
        throw new Error('Could not find Account ID from DAO creation');
    }

    console.log(`   Account ID: ${accountId}`);
    console.log('   ✅ Init actions executed atomically during DAO creation!');

    // Step 9: Claim tokens
    console.log('\n' + '='.repeat(80));
    console.log('STEP 9: CLAIM TOKENS');
    console.log('='.repeat(80));

    console.log('\n💰 Claiming contributor tokens...');

    const claimTx = sdk.launchpad.claimTokens(
        raiseId,
        testCoins.asset.type,
        testCoins.stable.type,
        '0x6'
    );

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
    console.log(`   ✅ Created fresh test coins`);
    console.log(`   ✅ Registered test stable coin for fee payments`);
    console.log(`   ✅ Registered test stable coin in factory allowlist`);
    console.log(`   ✅ Created raise with stream init action`);
    console.log(`   ✅ Staged init actions`);
    console.log(`   ✅ Locked intents and started raise`);
    console.log(`   ✅ Minted & contributed to meet minimum`);
    console.log(`   ✅ Raise ended (deadline passed)`);
    console.log(`   ✅ Settled raise`);
    console.log(`   ✅ Completed raise (DAO created + stream created)`);
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
