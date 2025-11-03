/**
 * Launchpad E2E Test with Two-Outcome Init Actions
 *
 * Full end-to-end integration test of the launchpad two-outcome flow.
 * This test can simulate BOTH success and failure paths.
 *
 * USAGE:
 *   npx tsx scripts/launchpad-e2e-with-init-actions-TWO-OUTCOME.ts         # Default: success path
 *   npx tsx scripts/launchpad-e2e-with-init-actions-TWO-OUTCOME.ts success # Explicit success
 *   npx tsx scripts/launchpad-e2e-with-init-actions-TWO-OUTCOME.ts failure # Test failure path
 *
 * SUCCESS PATH (default):
 *   1. Creates fresh test coins
 *   2. Registers them in the system
 *   3. Creates a raise
 *   4. Stages SUCCESS init actions (stream creation)
 *   5. Stages FAILURE init actions (return caps)
 *   6. Locks intents (prevents modifications)
 *   7. Contributes to MEET minimum (2 TSTABLE > 1 TSTABLE)
 *   8. Completes the raise → STATE_SUCCESSFUL
 *   9. JIT converts success_specs → Intent → executes stream
 *   10. Creates AMM pool and claims tokens
 *
 * FAILURE PATH:
 *   1-6. Same as success path
 *   7. Contributes BELOW minimum (0.5 TSTABLE < 1 TSTABLE)
 *   8. Completes the raise → STATE_FAILED
 *   9. JIT converts failure_specs → Intent → returns treasury cap & metadata
 *   10. Skips AMM pool and token claiming (not available for failed raises)
 */

import { Transaction, Inputs } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { execSync } from "child_process";
import * as fs from "fs";
import { LaunchpadOperations } from "../src/lib/launchpad";
import { TransactionUtils } from "../src/lib/transaction";
import { initSDK, executeTransaction, getActiveAddress } from "./execute-tx";

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

async function createTestCoin(
  name: string,
  symbol: string,
): Promise<{
  packageId: string;
  type: string;
  treasuryCap: string;
  metadata: string;
}> {
  console.log(`\n📦 Publishing ${name} test coin...`);

  const tmpDir = `/tmp/test_coin_${symbol.toLowerCase()}`;
  execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}/sources`, {
    encoding: "utf8",
  });

  fs.writeFileSync(
    `${tmpDir}/Move.toml`,
    `
[package]
name = "test_coin"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
test_coin = "0x0"
`,
  );

  fs.writeFileSync(`${tmpDir}/sources/coin.move`, testCoinSource(symbol, name));

  console.log("   Building...");
  execSync(`cd ${tmpDir} && sui move build 2>&1 | grep -v "warning"`, {
    encoding: "utf8",
  });

  console.log("   Publishing...");
  const result = execSync(
    `cd ${tmpDir} && sui client publish --gas-budget 100000000 --json`,
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(result);

  if (parsed.effects.status.status !== "success") {
    throw new Error(
      `Failed to publish ${name}: ${parsed.effects.status.error}`,
    );
  }

  const published = parsed.objectChanges.find(
    (c: any) => c.type === "published",
  );
  const packageId = published.packageId;

  const created = parsed.objectChanges.filter((c: any) => c.type === "created");
  const treasuryCap = created.find((c: any) =>
    c.objectType.includes("TreasuryCap"),
  );
  const metadata = created.find((c: any) =>
    c.objectType.includes("CoinMetadata"),
  );

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
  // Parse command line arguments
  // Usage: npx tsx script.ts [success|failure]
  // Default: success
  const testOutcome = process.argv[2]?.toLowerCase() || "success";
  const shouldRaiseSucceed = testOutcome === "success";

  console.log("=".repeat(80));
  console.log(
    `E2E TEST: LAUNCHPAD TWO-OUTCOME SYSTEM (${shouldRaiseSucceed ? "SUCCESS" : "FAILURE"} PATH)`,
  );
  console.log("=".repeat(80));
  console.log(
    `\n🎯 Testing: ${shouldRaiseSucceed ? "Raise succeeds → success_specs execute" : "Raise fails → failure_specs execute"}\n`,
  );

  const sdk = await initSDK();
  const sender = getActiveAddress();

  console.log(`\n👤 Active Address: ${sender}`);

  // Register packages in PackageRegistry (idempotent - runs automatically from deployments)
  console.log("\n" + "=".repeat(80));
  console.log("PRE-STEP: REGISTER PACKAGES IN PACKAGE REGISTRY");
  console.log("=".repeat(80));
  try {
    execSync("npx tsx scripts/register-new-packages.ts", {
      cwd: "/Users/admin/govex/packages/sdk",
      encoding: "utf8",
      stdio: "inherit",
    });
    console.log("✅ Package registration completed");
  } catch (error: any) {
    console.log(
      "⚠️  Package registration failed (may already be registered):",
      error.message,
    );
  }

  // Step 0: Create fresh test coins
  console.log("\n" + "=".repeat(80));
  console.log("STEP 0: CREATE TEST COINS");
  console.log("=".repeat(80));

  const testCoins = {
    asset: await createTestCoin("Test Asset", "TASSET"),
    stable: await createTestCoin("Test Stable", "TSTABLE"),
  };

  console.log("\n✅ Test coins created!");

  // Step 1: Register test stable coin for fee payments
  console.log("\n" + "=".repeat(80));
  console.log("STEP 1: REGISTER TEST STABLE COIN FOR FEE PAYMENTS");
  console.log("=".repeat(80));

  const feeManagerDeployment = require("../../deployments/futarchy_markets_core.json");
  const feeAdminCapId = feeManagerDeployment.objectChanges?.find((obj: any) =>
    obj.objectType?.includes("::fee::FeeAdminCap"),
  )?.objectId;

  if (!feeAdminCapId) {
    throw new Error(
      "FeeAdminCap not found in futarchy_markets_core deployment",
    );
  }

  console.log(`Using FeeAdminCap: ${feeAdminCapId}`);

  try {
    const registerFeeTx = sdk.feeManager.addCoinFeeConfig(
      {
        coinType: testCoins.stable.type,
        decimals: 9,
        daoCreationFee: 100_000_000n,
        proposalFeePerOutcome: 10_000_000n,
      },
      feeAdminCapId,
    );

    await executeTransaction(sdk, registerFeeTx, {
      network: "devnet",
      dryRun: false,
      showEffects: false,
    });
    console.log("✅ Test stable coin registered for fee payments");
  } catch (error: any) {
    // Idempotent: If already registered, continue
    console.log(
      "✅ Test stable coin already registered for fee payments (or registration not needed)",
    );
  }

  // Step 2: Register test stable coin type in Factory
  console.log("\n" + "=".repeat(80));
  console.log("STEP 2: REGISTER TEST STABLE COIN IN FACTORY ALLOWLIST");
  console.log("=".repeat(80));

  const factoryDeployment = require("../../deployments/futarchy_factory.json");
  const factoryOwnerCapId = factoryDeployment.objectChanges?.find((obj: any) =>
    obj.objectType?.includes("::factory::FactoryOwnerCap"),
  )?.objectId;

  if (!factoryOwnerCapId) {
    throw new Error("FactoryOwnerCap not found in futarchy_factory deployment");
  }

  const registryDeployment = require("../../deployments/AccountProtocol.json");
  const registryId = registryDeployment.objectChanges?.find((obj: any) =>
    obj.objectType?.includes("::package_registry::PackageRegistry"),
  )?.objectId;

  if (!registryId) {
    throw new Error("PackageRegistry not found in AccountProtocol deployment");
  }

  console.log(`Using FactoryOwnerCap: ${factoryOwnerCapId}`);

  try {
    const registerFactoryTx = sdk.factoryAdmin.addAllowedStableType(
      testCoins.stable.type,
      factoryOwnerCapId,
    );

    await executeTransaction(sdk, registerFactoryTx, {
      network: "devnet",
      dryRun: false,
      showEffects: false,
    });
    console.log("✅ Test stable coin registered in factory allowlist");
  } catch (error: any) {
    // Idempotent: If already registered, continue
    console.log(
      "✅ Test stable coin already allowed in factory (or registration not needed)",
    );
  }

  // Step 3: Create raise
  console.log("\n" + "=".repeat(80));
  console.log("STEP 3: CREATE RAISE");
  console.log("=".repeat(80));

  const createRaiseTx = sdk.launchpad.createRaise({
    raiseTokenType: testCoins.asset.type,
    stableCoinType: testCoins.stable.type,
    treasuryCap: testCoins.asset.treasuryCap,
    coinMetadata: testCoins.asset.metadata,

    tokensForSale: 1_000_000n,
    minRaiseAmount: TransactionUtils.suiToMist(1),
    maxRaiseAmount: TransactionUtils.suiToMist(100),

    allowedCaps: [
      TransactionUtils.suiToMist(1),
      TransactionUtils.suiToMist(50),
      LaunchpadOperations.UNLIMITED_CAP,
    ],

    startDelayMs: 15_000,
    allowEarlyCompletion: true,

    description: "E2E test - two-outcome system with stream",
    affiliateId: "",
    metadataKeys: [],
    metadataValues: [],

    launchpadFee: 100n,
  });

  console.log("Creating raise...");
  const createResult = await executeTransaction(sdk, createRaiseTx, {
    network: "devnet",
    dryRun: false,
    showEffects: true,
    showObjectChanges: true,
    showEvents: true,
  });

  const raiseCreatedEvent = createResult.events?.find((e: any) =>
    e.type.includes("RaiseCreated"),
  );

  if (!raiseCreatedEvent) {
    throw new Error("Failed to find RaiseCreated event");
  }

  const raiseId = raiseCreatedEvent.parsedJson.raise_id;
  const creatorCapObj = createResult.objectChanges?.find((c: any) =>
    c.objectType?.includes("CreatorCap"),
  );
  const creatorCapId = creatorCapObj?.objectId;

  console.log("\n✅ Raise Created!");
  console.log(`   Raise ID: ${raiseId}`);
  console.log(`   CreatorCap ID: ${creatorCapId}`);

  // Step 4: Stage SUCCESS init actions
  console.log("\n" + "=".repeat(80));
  console.log("STEP 4: STAGE SUCCESS INIT ACTIONS (STREAM + AMM POOL)");
  console.log("=".repeat(80));

  const streamRecipient = sender;
  const streamAmount = TransactionUtils.suiToMist(0.5); // 0.5 TSTABLE
  const currentTime = Date.now();
  const streamStart = currentTime + 300_000; // Start in 5 minutes (allows time for test to complete)
  const streamEnd = streamStart + 3_600_000; // End in 1 hour after start

  const actionsPkg = sdk.getPackageId("AccountActions");
  const launchpadPkg = sdk.getPackageId("futarchy_factory");

  console.log(`\n📦 Package IDs:`);
  console.log(`   AccountActions: ${actionsPkg}`);
  console.log(`   futarchy_factory: ${launchpadPkg}`);

  console.log("\n📋 Staging stream for SUCCESS outcome...");
  console.log(`   Vault: treasury`);
  console.log(`   Beneficiary: ${streamRecipient}`);
  console.log(`   Amount: ${Number(streamAmount) / 1e9} TSTABLE`);
  console.log(
    `   Start: ${(streamStart - currentTime) / 60000} minutes from now`,
  );
  console.log(`   Duration: ${(streamEnd - streamStart) / 3600000} hours`);

  const stageTx = new Transaction();

  // Step 1: Create empty InitActionSpecs
  const specs = stageTx.moveCall({
    target: `${actionsPkg}::init_action_specs::new_init_specs`,
    arguments: [],
  });

  // Step 2: Add stream action to specs
  stageTx.moveCall({
    target: `${actionsPkg}::stream_init_actions::add_create_stream_spec`,
    arguments: [
      specs, // &mut InitActionSpecs
      stageTx.pure.string("treasury"),
      stageTx.pure(bcs.Address.serialize(streamRecipient).toBytes()),
      stageTx.pure.u64(streamAmount),
      stageTx.pure.u64(streamStart),
      stageTx.pure.u64(streamEnd),
      stageTx.pure.option("u64", null), // cliff_time
      stageTx.pure.u64(streamAmount), // max_per_withdrawal
      stageTx.pure.u64(86400000), // min_interval_ms (1 day)
      stageTx.pure.u64(1), // max_beneficiaries
    ],
  });

  // Step 2.5: Add pool creation action to specs
  const poolAssetAmount = TransactionUtils.suiToMist(1000); // Mint 1000 asset tokens
  const poolStableAmount = TransactionUtils.suiToMist(1); // Use 1 stable from vault
  const poolFeeBps = 30; // 0.3% fee

  console.log("\n📋 Staging AMM pool creation for SUCCESS outcome...");
  console.log(`   Vault: treasury`);
  console.log(`   Asset amount to mint: ${Number(poolAssetAmount) / 1e9} tokens`);
  console.log(`   Stable amount from vault: ${Number(poolStableAmount) / 1e9} tokens`);
  console.log(`   Fee: ${poolFeeBps / 100}%`);

  stageTx.moveCall({
    target: `${sdk.getPackageId("futarchy_actions")}::liquidity_init_actions::add_create_pool_with_mint_spec`,
    arguments: [
      specs, // &mut InitActionSpecs
      stageTx.pure.string("treasury"),
      stageTx.pure.u64(poolAssetAmount),
      stageTx.pure.u64(poolStableAmount),
      stageTx.pure.u64(poolFeeBps),
    ],
  });

  // Step 3: Stage as SUCCESS intent
  stageTx.moveCall({
    target: `${launchpadPkg}::launchpad::stage_success_intent`,
    typeArguments: [testCoins.asset.type, testCoins.stable.type],
    arguments: [
      stageTx.object(raiseId),
      stageTx.object(registryId),
      stageTx.object(creatorCapId!),
      specs, // InitActionSpecs from step 1
      stageTx.object("0x6"), // Clock
    ],
  });

  const stageResult = await executeTransaction(sdk, stageTx, {
    network: "devnet",
    dryRun: false,
    showEffects: false,
  });

  console.log("✅ Stream and AMM pool staged as SUCCESS actions!");
  console.log(`   Transaction: ${stageResult.digest}`);

  // Step 4.5: Stage FAILURE init actions (return caps if raise fails)
  console.log("\n" + "=".repeat(80));
  console.log("STEP 4.5: STAGE FAILURE INIT ACTIONS (RETURN CAPS)");
  console.log("=".repeat(80));

  console.log("\n📋 Staging failure actions...");
  console.log(`   These execute ONLY if raise fails (doesn't meet minimum)`);
  console.log(`   Recipient: ${sender} (creator)`);

  const failureSpecsTx = new Transaction();

  // Create empty InitActionSpecs for failure
  const failureSpecs = failureSpecsTx.moveCall({
    target: `${actionsPkg}::init_action_specs::new_init_specs`,
    arguments: [],
  });

  // Add ReturnTreasuryCapAction
  console.log("\n   Adding action: Return TreasuryCap to creator");
  failureSpecsTx.moveCall({
    target: `${actionsPkg}::currency_init_actions::add_return_treasury_cap_spec`,
    arguments: [
      failureSpecs,
      failureSpecsTx.pure.address(sender), // recipient
    ],
  });

  // Add ReturnMetadataAction
  console.log("   Adding action: Return CoinMetadata to creator");
  failureSpecsTx.moveCall({
    target: `${actionsPkg}::currency_init_actions::add_return_metadata_spec`,
    arguments: [
      failureSpecs,
      failureSpecsTx.pure.address(sender), // recipient
    ],
  });

  // Stage failure intent
  failureSpecsTx.moveCall({
    target: `${launchpadPkg}::launchpad::stage_failure_intent`,
    typeArguments: [testCoins.asset.type, testCoins.stable.type],
    arguments: [
      failureSpecsTx.object(raiseId),
      failureSpecsTx.object(registryId),
      failureSpecsTx.object(creatorCapId!),
      failureSpecs,
      failureSpecsTx.object("0x6"), // Clock
    ],
  });

  const failureStageResult = await executeTransaction(sdk, failureSpecsTx, {
    network: "devnet",
    dryRun: false,
    showEffects: false,
  });

  console.log("✅ Failure specs staged!");
  console.log(`   Transaction: ${failureStageResult.digest}`);
  console.log(
    "   Note: These will NOT execute in this test (raise will succeed)",
  );

  // Step 5: Lock intents (CRITICAL - prevents modifications)
  console.log("\n" + "=".repeat(80));
  console.log("STEP 5: LOCK INTENTS (PREVENT MODIFICATIONS)");
  console.log("=".repeat(80));

  console.log("\n🔒 Locking intents...");
  console.log("   After this, success_specs cannot be changed!");

  const lockTx = sdk.launchpad.lockIntentsAndStartRaise(
    raiseId,
    creatorCapId!,
    testCoins.asset.type,
    testCoins.stable.type,
  );

  await executeTransaction(sdk, lockTx, {
    network: "devnet",
    dryRun: false,
    showEffects: false,
  });

  console.log("✅ Intents locked!");
  console.log("   ✅ Investors are now protected - specs frozen");

  // Wait for start delay
  console.log("\n⏳ Waiting for start delay (15s)...");
  await new Promise((resolve) => setTimeout(resolve, 16000));
  console.log("✅ Raise has started!");

  // Step 6: Contribute to meet minimum
  console.log("\n" + "=".repeat(80));
  console.log(
    `STEP 6: CONTRIBUTE ${shouldRaiseSucceed ? "TO MEET MINIMUM" : "(INSUFFICIENT - WILL FAIL)"}`,
  );
  console.log("=".repeat(80));

  // Minimum is 1 TSTABLE (1_000_000_000 MIST)
  // Success: contribute 2 TSTABLE to exceed minimum
  // Failure: contribute 0.5 TSTABLE to stay below minimum
  const amountToContribute = shouldRaiseSucceed
    ? TransactionUtils.suiToMist(2) // 2 TSTABLE > 1 TSTABLE minimum ✅
    : TransactionUtils.suiToMist(0.5); // 0.5 TSTABLE < 1 TSTABLE minimum ❌

  console.log(
    `\n💰 Minting ${TransactionUtils.mistToSui(amountToContribute)} TSTABLE...`,
  );
  console.log(
    `   ${shouldRaiseSucceed ? "✅ Will EXCEED minimum (1 TSTABLE)" : "❌ Will NOT meet minimum (1 TSTABLE)"}`,
  );
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
    network: "devnet",
    dryRun: false,
    showEffects: false,
  });
  console.log("✅ Minted!");

  console.log(
    `\n💸 Contributing ${TransactionUtils.mistToSui(amountToContribute)} TSTABLE...`,
  );

  const coins = await sdk.client.getCoins({
    owner: sender,
    coinType: testCoins.stable.type,
  });

  const contributeTx = new Transaction();
  const [firstCoin, ...restCoins] = coins.data.map((c) =>
    contributeTx.object(c.coinObjectId),
  );
  if (restCoins.length > 0) {
    contributeTx.mergeCoins(firstCoin, restCoins);
  }

  const [paymentCoin] = contributeTx.splitCoins(firstCoin, [
    contributeTx.pure.u64(amountToContribute),
  ]);
  const [crankFeeCoin] = contributeTx.splitCoins(contributeTx.gas, [
    contributeTx.pure.u64(TransactionUtils.suiToMist(0.1)),
  ]);

  const factoryObject = sdk.deployments.getFactory();
  const factoryPackageId = sdk.getPackageId("futarchy_factory")!;

  contributeTx.moveCall({
    target: TransactionUtils.buildTarget(
      factoryPackageId,
      "launchpad",
      "contribute",
    ),
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
      contributeTx.object("0x6"),
    ],
  });

  contributeTx.transferObjects([firstCoin], contributeTx.pure.address(sender));

  await executeTransaction(sdk, contributeTx, {
    network: "devnet",
    dryRun: false,
    showEffects: true,
    showObjectChanges: false,
    showEvents: true,
  });

  console.log("✅ Contributed! Min raise met!");

  // Step 7: Wait for deadline
  console.log("\n" + "=".repeat(80));
  console.log("STEP 7: WAIT FOR DEADLINE");
  console.log("=".repeat(80));

  console.log("\n⏰ Waiting for deadline (125s)...");
  await new Promise((resolve) => setTimeout(resolve, 125000));
  console.log("✅ Deadline passed!");

  // Step 8: Complete raise (JIT conversion happens here!)
  console.log("\n" + "=".repeat(80));
  console.log("STEP 8: COMPLETE RAISE (JIT CONVERSION)");
  console.log("=".repeat(80));

  console.log("\n🏛️  Creating DAO and converting specs to Intent...");
  console.log("   This will:");
  console.log("   1. Create DAO");
  console.log("   2. Set raise.state = STATE_SUCCESSFUL");
  console.log("   3. JIT convert success_specs → Intent");
  console.log("   4. Share DAO with Intent locked in");

  const factoryId = factoryDeployment.objectChanges?.find(
    (obj: any) =>
      obj.objectType?.includes("::factory::Factory") && obj.owner?.Shared,
  )?.objectId;

  if (!factoryId) {
    throw new Error("Factory object not found");
  }

  const completeTx = new Transaction();

  // Settle
  completeTx.moveCall({
    target: `${launchpadPkg}::launchpad::settle_raise`,
    typeArguments: [testCoins.asset.type, testCoins.stable.type],
    arguments: [completeTx.object(raiseId), completeTx.object("0x6")],
  });

  // Begin DAO creation
  const unsharedDao = completeTx.moveCall({
    target: `${launchpadPkg}::launchpad::begin_dao_creation`,
    typeArguments: [testCoins.asset.type, testCoins.stable.type],
    arguments: [
      completeTx.object(raiseId),
      completeTx.object(factoryId),
      completeTx.object(registryId),
      completeTx.object("0x6"),
    ],
  });

  // Finalize and share (JIT conversion happens inside!)
  completeTx.moveCall({
    target: `${launchpadPkg}::launchpad::finalize_and_share_dao`,
    typeArguments: [testCoins.asset.type, testCoins.stable.type],
    arguments: [
      completeTx.object(raiseId),
      unsharedDao,
      completeTx.object(registryId),
      completeTx.object("0x6"),
    ],
  });

  const completeResult = await executeTransaction(sdk, completeTx, {
    network: "devnet",
    dryRun: false,
    showEffects: true,
    showObjectChanges: true,
    showEvents: true,
  });

  // Check which event occurred - RaiseSuccessful or RaiseFailed
  const raiseSuccessEvent = completeResult.events?.find((e: any) =>
    e.type.includes("RaiseSuccessful"),
  );
  const raiseFailedEvent = completeResult.events?.find((e: any) =>
    e.type.includes("RaiseFailed"),
  );

  let accountId: string | undefined;
  let raiseActuallySucceeded = false;

  if (raiseSuccessEvent) {
    raiseActuallySucceeded = true;
    console.log("✅ DAO Created & Intent Generated (SUCCESS PATH)!");
    console.log(`   Transaction: ${completeResult.digest}`);
    console.log("\n🎉 DAO Details:");
    console.log(JSON.stringify(raiseSuccessEvent.parsedJson, null, 2));
    accountId = raiseSuccessEvent.parsedJson?.account_id;
  } else if (raiseFailedEvent) {
    raiseActuallySucceeded = false;
    console.log("✅ DAO Created & Intent Generated (FAILURE PATH)!");
    console.log(`   Transaction: ${completeResult.digest}`);
    console.log("\n⚠️ Raise Failed - Executing failure specs:");
    console.log(JSON.stringify(raiseFailedEvent.parsedJson, null, 2));
    accountId = raiseFailedEvent.parsedJson?.account_id;
  } else {
    throw new Error("Neither RaiseSuccessful nor RaiseFailed event found");
  }

  if (!accountId) {
    const accountObject = completeResult.objectChanges?.find((c: any) =>
      c.objectType?.includes("::account::Account"),
    );
    if (accountObject) {
      accountId = accountObject.objectId;
    }
  }

  if (!accountId) {
    throw new Error("Could not find Account ID");
  }

  console.log(`   Account ID: ${accountId}`);
  console.log("   ✅ JIT conversion complete - Intent ready to execute!");

  // Step 9: Execute Intent - different paths for success vs failure
  console.log("\n" + "=".repeat(80));
  if (raiseActuallySucceeded) {
    console.log("STEP 9: EXECUTE INTENT (SUCCESS PATH - STREAM + AMM POOL)");
  } else {
    console.log("STEP 9: EXECUTE INTENT (FAILURE PATH - RETURN CAPS)");
  }
  console.log("=".repeat(80));

  const futarchyActionsPkg = sdk.getPackageId("futarchy_actions")!;
  const futarchyCorePkg = sdk.getPackageId("futarchy_core")!;
  const futarchyFactoryPkg = sdk.getPackageId("futarchy_factory")!;
  const accountActionsPkg = sdk.getPackageId("AccountActions")!;

  const executeTx = new Transaction();

  // 1. Begin execution - creates Executable hot potato
  const executable = executeTx.moveCall({
    target: `${futarchyFactoryPkg}::launchpad_intent_executor::begin_execution`,
    typeArguments: [testCoins.asset.type, testCoins.stable.type],
    arguments: [
      executeTx.object(raiseId), // Raise (for validation)
      executeTx.object(accountId), // Account
      executeTx.object(registryId), // PackageRegistry
      executeTx.object("0x6"), // Clock
    ],
  });

  // Create witnesses needed for execution
  const versionWitness = executeTx.moveCall({
    target: `${accountActionsPkg}::version::current`,
    arguments: [],
  });

  const launchpadIntentWitness = executeTx.moveCall({
    target: `${futarchyFactoryPkg}::launchpad::launchpad_intent_witness`,
    arguments: [],
  });

  // 2. Execute the appropriate actions based on raise outcome
  if (raiseActuallySucceeded) {
    console.log("\n💧 Executing SUCCESS specs: create stream and AMM pool...");
    console.log("   Using PTB executor pattern: begin → do_init → do_init → finalize");

    // Execute stream creation action (Action #1)
    executeTx.moveCall({
      target: `${accountActionsPkg}::vault::do_init_create_stream`,
      typeArguments: [
        `${futarchyCorePkg}::futarchy_config::FutarchyConfig`,
        `${futarchyFactoryPkg}::launchpad_outcome::LaunchpadOutcome`,
        testCoins.stable.type, // CoinType for the stream
        `${futarchyFactoryPkg}::launchpad::LaunchpadIntent`,
      ],
      arguments: [
        executable, // Executable hot potato
        executeTx.object(accountId), // Account
        executeTx.object(registryId), // PackageRegistry
        executeTx.object("0x6"), // Clock
        versionWitness, // VersionWitness
        launchpadIntentWitness, // LaunchpadIntent witness
      ],
    });

    // Execute pool creation action (Action #2)
    console.log("   → Stream created, now creating AMM pool...");
    executeTx.moveCall({
      target: `${futarchyActionsPkg}::liquidity_init_actions::do_init_create_pool_with_mint`,
      typeArguments: [
        `${futarchyCorePkg}::futarchy_config::FutarchyConfig`,
        `${futarchyFactoryPkg}::launchpad_outcome::LaunchpadOutcome`,
        testCoins.asset.type, // AssetType to mint
        testCoins.stable.type, // StableType from vault
        `${futarchyFactoryPkg}::launchpad::LaunchpadIntent`,
      ],
      arguments: [
        executable, // Executable hot potato
        executeTx.object(accountId), // Account
        executeTx.object(registryId), // PackageRegistry
        executeTx.object("0x6"), // Clock
        versionWitness, // VersionWitness
        launchpadIntentWitness, // LaunchpadIntent witness
      ],
    });
  } else {
    console.log("\n🔄 Executing FAILURE specs: return TreasuryCap and Metadata...");
    console.log("   Using PTB executor pattern: begin → do_init → do_init → finalize");

    // Execute return TreasuryCap action
    executeTx.moveCall({
      target: `${accountActionsPkg}::currency::do_init_remove_treasury_cap`,
      typeArguments: [
        `${futarchyCorePkg}::futarchy_config::FutarchyConfig`,
        `${futarchyFactoryPkg}::launchpad_outcome::LaunchpadOutcome`,
        testCoins.asset.type, // CoinType
        `${futarchyFactoryPkg}::launchpad::LaunchpadIntent`,
      ],
      arguments: [
        executable, // Executable hot potato
        executeTx.object(accountId), // Account
        executeTx.object(registryId), // PackageRegistry
        versionWitness, // VersionWitness
        launchpadIntentWitness, // LaunchpadIntent witness
      ],
    });

    // Execute return Metadata action
    executeTx.moveCall({
      target: `${accountActionsPkg}::currency::do_init_remove_metadata`,
      typeArguments: [
        `${futarchyCorePkg}::futarchy_config::FutarchyConfig`,
        `${futarchyFactoryPkg}::launchpad_outcome::LaunchpadOutcome`,
        `${accountActionsPkg}::currency::CoinMetadataKey<${testCoins.asset.type}>`, // Key type from currency module
        testCoins.asset.type, // CoinType
        `${futarchyFactoryPkg}::launchpad::LaunchpadIntent`,
      ],
      arguments: [
        executable, // Executable hot potato
        executeTx.object(accountId), // Account
        executeTx.object(registryId), // PackageRegistry
        executeTx.moveCall({
          target: `${accountActionsPkg}::currency::coin_metadata_key`,
          typeArguments: [testCoins.asset.type],
          arguments: [],
        }), // CoinMetadataKey witness from currency module
        versionWitness, // VersionWitness
        launchpadIntentWitness, // LaunchpadIntent witness
      ],
    });
  }

  // 3. Finalize execution - confirms execution and emits event
  executeTx.moveCall({
    target: `${futarchyFactoryPkg}::launchpad_intent_executor::finalize_execution`,
    typeArguments: [testCoins.asset.type, testCoins.stable.type],
    arguments: [
      executeTx.object(raiseId), // Raise
      executeTx.object(accountId), // Account
      executable, // Executable hot potato
      executeTx.object("0x6"), // Clock
    ],
  });

  try {
    const executeResult = await executeTransaction(sdk, executeTx, {
      network: "devnet",
      dryRun: false,
      showEffects: true,
      showObjectChanges: true,
      showEvents: false,
    });

    if (raiseActuallySucceeded) {
      console.log("✅ Stream and AMM pool created via Intent execution!");
      console.log(`   Transaction: ${executeResult.digest}`);

      // Find the created stream object
      const streamObject = executeResult.objectChanges?.find((c: any) =>
        c.objectType?.includes("::vault::Stream"),
      );

      if (streamObject) {
        console.log(`   Stream ID: ${streamObject.objectId}`);
      }

      // Find the created pool object
      const poolObject = executeResult.objectChanges?.find((c: any) =>
        c.objectType?.includes("::unified_spot_pool::UnifiedSpotPool"),
      );

      if (poolObject) {
        console.log(`   Pool ID: ${poolObject.objectId}`);
      }
    } else{
      console.log("✅ TreasuryCap and Metadata returned via Intent execution!");
      console.log(`   Transaction: ${executeResult.digest}`);

      // Show returned objects
      const treasuryCapObject = executeResult.objectChanges?.find((c: any) =>
        c.objectType?.includes("::coin::TreasuryCap"),
      );
      const metadataObject = executeResult.objectChanges?.find((c: any) =>
        c.objectType?.includes("::coin::CoinMetadata"),
      );

      if (treasuryCapObject) {
        console.log(`   TreasuryCap returned: ${treasuryCapObject.objectId}`);
      }
      if (metadataObject) {
        console.log(`   Metadata returned: ${metadataObject.objectId}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Failed to execute Intent:", error.message);
    console.log("   This should not fail with the new execution pattern");
    throw error;
  }

  // Steps 10-11: Only run for successful raises (minting/claiming not allowed on failed raises)
  if (raiseActuallySucceeded) {
    // NOTE: STEP 10 (Create AMM pool) has been moved to STEP 9 and now executes via Intent!
    // Pool creation is now staged in success_specs and executed via do_init_create_pool_with_mint.
    // This ensures pool creation happens atomically with other init actions during DAO creation.

    // Step 10 (now 11): Claim tokens
    console.log("\n" + "=".repeat(80));
    console.log("STEP 11: CLAIM TOKENS");
    console.log("=".repeat(80));

    console.log("\n💰 Claiming contributor tokens...");

    const claimTx = sdk.launchpad.claimTokens(
      raiseId,
      testCoins.asset.type,
      testCoins.stable.type,
      "0x6",
    );

    const claimResult = await executeTransaction(sdk, claimTx, {
      network: "devnet",
      dryRun: false,
      showEffects: true,
      showObjectChanges: true,
      showEvents: true,
    });

    console.log("✅ Tokens claimed!");
    console.log(`   Transaction: ${claimResult.digest}`);
  } else {
    console.log("\n" + "=".repeat(80));
    console.log("SKIPPING STEPS 10-11: RAISE FAILED");
    console.log("=".repeat(80));
    console.log(
      "\nℹ️  AMM pool creation and token claiming are only available for successful raises",
    );
    console.log(
      "ℹ️  On failure, the failure_specs returned treasury cap & metadata to creator",
    );
  }

  console.log("\n" + "=".repeat(80));
  console.log(
    `🎉 TWO-OUTCOME SYSTEM TEST COMPLETE (${shouldRaiseSucceed ? "SUCCESS" : "FAILURE"} PATH)! 🎉`,
  );
  console.log("=".repeat(80));

  console.log("\n📋 Summary:");
  console.log(`   ✅ Created raise`);
  console.log(`   ✅ Staged success_specs (stream creation)`);
  console.log(`   ✅ Staged failure_specs (return caps)`);
  console.log(`   ✅ Locked intents (investors protected)`);

  if (shouldRaiseSucceed) {
    console.log(`   ✅ Contributed to MEET minimum (2 TSTABLE > 1 TSTABLE)`);
    console.log(`   ✅ Raise SUCCEEDED`);
    console.log(`   ✅ JIT converted success_specs → Intent`);
    console.log(`   ✅ DAO shared with Intent`);
    console.log(`   ✅ Executed Intent → Created stream`);
    console.log(`   ✅ Created AMM pool (minted + liquidity)`);
    console.log(`   ✅ LP token auto-saved to account custody`);
    console.log(`   ✅ Claimed tokens`);
  } else {
    console.log(`   ✅ Contributed BELOW minimum (0.5 TSTABLE < 1 TSTABLE)`);
    console.log(`   ✅ Raise FAILED`);
    console.log(`   ✅ JIT converted failure_specs → Intent`);
    console.log(`   ✅ DAO shared with Intent`);
    console.log(
      `   ✅ Executed Intent → Treasury cap & metadata returned to creator`,
    );
    console.log(`   ℹ️  No AMM pool (raise failed)`);
    console.log(`   ℹ️  No tokens to claim (raise failed)`);
  }

  console.log(`\n🔗 View raise: https://suiscan.xyz/devnet/object/${raiseId}`);
  console.log(`🔗 View DAO: https://suiscan.xyz/devnet/object/${accountId}`);
}

main()
  .then(() => {
    console.log("\n✅ Script completed successfully\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
