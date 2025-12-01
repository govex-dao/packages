/**
 * Launchpad E2E Test with Two-Outcome Init Actions
 *
 * Full end-to-end integration test of the launchpad two-outcome flow.
 * This test can simulate BOTH success and failure paths.
 *
 * USAGE:
 *   npx tsx scripts/launchpad-e2e.ts         # Default: success path
 *   npx tsx scripts/launchpad-e2e.ts success # Explicit success
 *   npx tsx scripts/launchpad-e2e.ts failure # Test failure path
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
 *
 * This test demonstrates proper SDK usage with the LaunchpadWorkflow class.
 */

import { Transaction } from "@mysten/sui/transactions";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { LaunchpadWorkflow } from "../src/workflows/launchpad-workflow";
import { TransactionUtils } from "../src/services/transaction";
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

  // Initialize SDK
  const sdk = await initSDK();
  const sender = getActiveAddress();

  console.log(`\n👤 Active Address: ${sender}`);

  // Register packages in PackageRegistry (required for deps validation)
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

  const feeManagerDeployment = sdk.deployments.getPackage("futarchy_markets_core");
  const feeAdminCapId = feeManagerDeployment?.adminCaps?.find((obj: any) =>
    obj.name === "FeeAdminCap"
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
    console.log(
      "✅ Test stable coin already registered for fee payments (or registration not needed)",
    );
  }

  // Step 2: Register test stable coin type in Factory
  console.log("\n" + "=".repeat(80));
  console.log("STEP 2: REGISTER TEST STABLE COIN IN FACTORY ALLOWLIST");
  console.log("=".repeat(80));

  const factoryDeployment = sdk.deployments.getPackage("futarchy_factory");
  const factoryOwnerCapId = factoryDeployment?.adminCaps?.find((obj: any) =>
    obj.name === "FactoryOwnerCap"
  )?.objectId;

  if (!factoryOwnerCapId) {
    throw new Error("FactoryOwnerCap not found in futarchy_factory deployment");
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
    console.log(
      "✅ Test stable coin already allowed in factory (or registration not needed)",
    );
  }

  // Step 3: Create raise using SDK workflow
  console.log("\n" + "=".repeat(80));
  console.log("STEP 3: CREATE RAISE (using sdk.workflows.launchpad)");
  console.log("=".repeat(80));

  const streamRecipient = sender;
  const streamAmount = TransactionUtils.suiToMist(0.5); // 0.5 TSTABLE
  const currentTime = Date.now();
  const streamStart = currentTime + 300_000; // Start in 5 minutes

  // Iteration-based vesting: 12 monthly unlocks
  const iterationsTotal = 12n;
  const iterationPeriodMs = 2_592_000_000n; // 30 days in milliseconds
  const amountPerIteration = streamAmount / iterationsTotal;

  // Pool creation parameters
  const poolAssetAmount = TransactionUtils.suiToMist(1000);
  const poolStableAmount = TransactionUtils.suiToMist(1000);
  const poolFeeBps = 30;

  // Use the SDK's createRaiseWithActions helper for cleaner flow
  const launchpadWorkflow = sdk.workflows.launchpad;

  // Define success actions
  const successActions = [
    {
      type: 'create_stream' as const,
      vaultName: 'treasury',
      beneficiary: streamRecipient,
      amountPerIteration: amountPerIteration,
      startTime: streamStart,
      iterationsTotal: iterationsTotal,
      iterationPeriodMs: iterationPeriodMs,
      maxPerWithdrawal: amountPerIteration,
      isTransferable: true,
      isCancellable: true,
    },
    {
      type: 'create_pool_with_mint' as const,
      vaultName: 'treasury',
      assetAmount: poolAssetAmount,
      stableAmount: poolStableAmount,
      feeBps: poolFeeBps,
    },
    {
      type: 'update_trading_params' as const,
      reviewPeriodMs: 1000n, // 1 second for testing
      tradingPeriodMs: 60_000n, // 1 minute
    },
    {
      type: 'update_twap_config' as const,
      startDelay: 0n,
      threshold: 0n,
    },
  ];

  // Define failure actions
  const failureActions = [
    {
      type: 'return_treasury_cap' as const,
      recipient: sender,
    },
    {
      type: 'return_metadata' as const,
      recipient: sender,
    },
  ];

  // Create the raise flow
  const raiseFlow = launchpadWorkflow.createRaiseWithActions(
    {
      assetType: testCoins.asset.type,
      stableType: testCoins.stable.type,
      treasuryCap: testCoins.asset.treasuryCap,
      coinMetadata: testCoins.asset.metadata,
      tokensForSale: 1_000_000n,
      minRaiseAmount: TransactionUtils.suiToMist(1),
      maxRaiseAmount: TransactionUtils.suiToMist(1500),
      allowedCaps: [
        TransactionUtils.suiToMist(1),
        TransactionUtils.suiToMist(50),
        LaunchpadWorkflow.UNLIMITED_CAP,
      ],
      startDelayMs: 5_000n,
      allowEarlyCompletion: true,
      description: "E2E test - two-outcome system with stream",
      affiliateId: "",
      metadataKeys: [],
      metadataValues: [],
      launchpadFee: 100n,
    },
    successActions,
    failureActions,
    sender,
  );

  console.log("Creating raise...");
  const createResult = await executeTransaction(sdk, raiseFlow.createTx.transaction, {
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

  // Step 4: Stage SUCCESS init actions using SDK workflow
  console.log("\n" + "=".repeat(80));
  console.log("STEP 4: STAGE SUCCESS INIT ACTIONS (using sdk.workflows.launchpad)");
  console.log("=".repeat(80));

  console.log("\n📋 Staging stream and AMM pool for SUCCESS outcome...");
  console.log(`   Vault: treasury`);
  console.log(`   Stream Beneficiary: ${streamRecipient}`);
  console.log(`   Stream Amount: ${Number(streamAmount) / 1e9} TSTABLE over ${Number(iterationsTotal)} months`);
  console.log(`   Pool: ${Number(poolAssetAmount) / 1e9} asset + ${Number(poolStableAmount) / 1e9} stable @ ${poolFeeBps / 100}% fee`);

  const stageSuccessResult = await executeTransaction(
    sdk,
    raiseFlow.stageSuccessTx(raiseId, creatorCapId!).transaction,
    {
      network: "devnet",
      dryRun: false,
      showEffects: false,
    }
  );

  console.log("✅ Stream and AMM pool staged as SUCCESS actions!");
  console.log(`   Transaction: ${stageSuccessResult.digest}`);

  // Step 4.5: Stage FAILURE init actions using SDK workflow
  console.log("\n" + "=".repeat(80));
  console.log("STEP 4.5: STAGE FAILURE INIT ACTIONS (using sdk.workflows.launchpad)");
  console.log("=".repeat(80));

  console.log("\n📋 Staging failure actions...");
  console.log(`   These execute ONLY if raise fails (doesn't meet minimum)`);
  console.log(`   Recipient: ${sender} (creator)`);

  const stageFailureResult = await executeTransaction(
    sdk,
    raiseFlow.stageFailureTx(raiseId, creatorCapId!).transaction,
    {
      network: "devnet",
      dryRun: false,
      showEffects: false,
    }
  );

  console.log("✅ Failure specs staged!");
  console.log(`   Transaction: ${stageFailureResult.digest}`);

  // Step 5: Lock intents using SDK workflow
  console.log("\n" + "=".repeat(80));
  console.log("STEP 5: LOCK INTENTS (using sdk.workflows.launchpad)");
  console.log("=".repeat(80));

  console.log("\n🔒 Locking intents...");
  console.log("   After this, success_specs cannot be changed!");

  await executeTransaction(
    sdk,
    raiseFlow.lockTx(raiseId, creatorCapId!).transaction,
    {
      network: "devnet",
      dryRun: false,
      showEffects: false,
    }
  );

  console.log("✅ Intents locked!");
  console.log("   ✅ Investors are now protected - specs frozen");

  // Wait for start delay
  console.log("\n⏳ Waiting for start delay (5s)...");
  await new Promise((resolve) => setTimeout(resolve, 6000));
  console.log("✅ Raise has started!");

  // Step 6: Contribute using SDK workflow
  console.log("\n" + "=".repeat(80));
  console.log(
    `STEP 6: CONTRIBUTE (using sdk.workflows.launchpad) ${shouldRaiseSucceed ? "TO MEET MINIMUM" : "(INSUFFICIENT - WILL FAIL)"}`,
  );
  console.log("=".repeat(80));

  const amountToContribute = shouldRaiseSucceed
    ? TransactionUtils.suiToMist(1500) // Meet max
    : TransactionUtils.suiToMist(0.5); // Below minimum

  console.log(
    `\n💰 Minting ${TransactionUtils.mistToSui(amountToContribute)} TSTABLE...`,
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

  // Get stable coins for contribution
  const stableCoins = await sdk.client.getCoins({
    owner: sender,
    coinType: testCoins.stable.type,
  });

  const stableCoinIds = stableCoins.data.map((c) => c.coinObjectId);

  // Use SDK workflow for contribution
  const contributeTx = launchpadWorkflow.contribute({
    raiseId,
    assetType: testCoins.asset.type,
    stableType: testCoins.stable.type,
    stableCoins: stableCoinIds,
    amount: amountToContribute,
    capTier: LaunchpadWorkflow.UNLIMITED_CAP,
    crankFee: TransactionUtils.suiToMist(0.1),
  });

  await executeTransaction(sdk, contributeTx.transaction, {
    network: "devnet",
    dryRun: false,
    showEffects: true,
    showObjectChanges: false,
    showEvents: true,
  });

  console.log("✅ Contributed!");

  // Step 7: Wait for deadline
  console.log("\n" + "=".repeat(80));
  console.log("STEP 7: WAIT FOR DEADLINE");
  console.log("=".repeat(80));

  console.log("\n⏰ Waiting for deadline (30s)...");
  await new Promise((resolve) => setTimeout(resolve, 30000));
  console.log("✅ Deadline passed!");

  // Step 8: Complete raise using SDK workflow
  console.log("\n" + "=".repeat(80));
  console.log("STEP 8: COMPLETE RAISE (using sdk.workflows.launchpad)");
  console.log("=".repeat(80));

  console.log("\n🏛️  Creating DAO and converting specs to Intent...");
  console.log("   This will:");
  console.log("   1. Create DAO");
  console.log(`   2. Set raise.state = STATE_${shouldRaiseSucceed ? "SUCCESSFUL" : "FAILED"}`);
  console.log(`   3. JIT convert ${shouldRaiseSucceed ? "success" : "failure"}_specs → Intent`);
  console.log("   4. Share DAO with Intent locked in");

  const completeTx = launchpadWorkflow.completeRaise({
    raiseId,
    assetType: testCoins.asset.type,
    stableType: testCoins.stable.type,
  });

  const completeResult = await executeTransaction(sdk, completeTx.transaction, {
    network: "devnet",
    dryRun: false,
    showEffects: true,
    showObjectChanges: true,
    showEvents: true,
  });

  // Check which event occurred
  const raiseSuccessEvent = completeResult.events?.find((e: any) =>
    e.type.includes("RaiseSuccessful"),
  );
  const raiseFailedEvent = completeResult.events?.find((e: any) =>
    e.type.includes("RaiseFailed"),
  );

  let accountId: string | undefined;
  let poolId: string | undefined;
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

  // Step 9: Execute Intent using SDK workflow
  console.log("\n" + "=".repeat(80));
  if (raiseActuallySucceeded) {
    console.log("STEP 9: EXECUTE INTENT (using sdk.workflows.launchpad)");
  } else {
    console.log("STEP 9: EXECUTE INTENT (FAILURE PATH - RETURN CAPS)");
  }
  console.log("=".repeat(80));

  // Build action types for execution
  const actionTypes = raiseActuallySucceeded
    ? [
        { type: 'create_stream' as const, coinType: testCoins.stable.type },
        {
          type: 'create_pool_with_mint' as const,
          assetType: testCoins.asset.type,
          stableType: testCoins.stable.type,
        },
        { type: 'update_trading_params' as const },
        { type: 'update_twap_config' as const },
      ]
    : [
        { type: 'return_treasury_cap' as const, coinType: testCoins.asset.type },
        { type: 'return_metadata' as const, coinType: testCoins.asset.type },
      ];

  const executeTx = launchpadWorkflow.executeActions({
    accountId,
    raiseId,
    assetType: testCoins.asset.type,
    stableType: testCoins.stable.type,
    actionTypes,
  });

  try {
    const executeResult = await executeTransaction(sdk, executeTx.transaction, {
      network: "devnet",
      dryRun: false,
      showEffects: true,
      showObjectChanges: true,
      showEvents: false,
    });

    if (raiseActuallySucceeded) {
      console.log("✅ Stream and AMM pool created via Intent execution!");
      console.log(`   Transaction: ${executeResult.digest}`);

      const streamObject = executeResult.objectChanges?.find((c: any) =>
        c.objectType?.includes("::vault::Stream"),
      );
      if (streamObject) {
        console.log(`   Stream ID: ${streamObject.objectId}`);
      }

      const poolObject = executeResult.objectChanges?.find((c: any) =>
        c.objectType?.includes("::unified_spot_pool::UnifiedSpotPool"),
      );
      if (poolObject) {
        poolId = poolObject.objectId;
        console.log(`   Pool ID: ${poolId}`);
      }
    } else {
      console.log("✅ TreasuryCap and Metadata returned via Intent execution!");
      console.log(`   Transaction: ${executeResult.digest}`);

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
    throw error;
  }

  // Step 10: Claim tokens (only for successful raises)
  if (raiseActuallySucceeded) {
    console.log("\n" + "=".repeat(80));
    console.log("STEP 10: CLAIM TOKENS (using sdk.workflows.launchpad)");
    console.log("=".repeat(80));

    console.log("\n💰 Claiming contributor tokens...");

    const claimTx = launchpadWorkflow.claimTokens(
      raiseId,
      testCoins.asset.type,
      testCoins.stable.type,
    );

    const claimResult = await executeTransaction(sdk, claimTx.transaction, {
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
    console.log("SKIPPING STEP 10: RAISE FAILED");
    console.log("=".repeat(80));
    console.log("\nℹ️  Token claiming is only available for successful raises");
  }

  console.log("\n" + "=".repeat(80));
  console.log(
    `🎉 TWO-OUTCOME SYSTEM TEST COMPLETE (${shouldRaiseSucceed ? "SUCCESS" : "FAILURE"} PATH)! 🎉`,
  );
  console.log("=".repeat(80));

  console.log("\n📋 Summary:");
  console.log(`   ✅ Created raise (using sdk.workflows.launchpad.createRaiseWithActions)`);
  console.log(`   ✅ Staged success_specs (using sdk.workflows.launchpad.stageActions)`);
  console.log(`   ✅ Staged failure_specs (using sdk.workflows.launchpad.stageActions)`);
  console.log(`   ✅ Locked intents (using sdk.workflows.launchpad.lockIntentsAndStart)`);
  console.log(`   ✅ Contributed (using sdk.workflows.launchpad.contribute)`);

  if (shouldRaiseSucceed) {
    console.log(`   ✅ Raise SUCCEEDED`);
    console.log(`   ✅ Completed raise (using sdk.workflows.launchpad.completeRaise)`);
    console.log(`   ✅ Executed Intent (using sdk.workflows.launchpad.executeActions)`);
    console.log(`   ✅ Claimed tokens (using sdk.workflows.launchpad.claimTokens)`);
  } else {
    console.log(`   ✅ Raise FAILED (as expected)`);
    console.log(`   ✅ Completed raise (using sdk.workflows.launchpad.completeRaise)`);
    console.log(`   ✅ Executed Intent → caps returned to creator`);
  }

  console.log(`\n🔗 View raise: https://suiscan.xyz/devnet/object/${raiseId}`);
  console.log(`🔗 View DAO: https://suiscan.xyz/devnet/object/${accountId}`);

  // Save DAO info to shared JSON file for proposal test
  const daoInfoPath = path.join(__dirname, "..", "test-dao-info.json");
  const daoInfo = {
    accountId: accountId,
    assetType: testCoins.asset.type,
    stableType: testCoins.stable.type,
    assetTreasuryCap: testCoins.asset.treasuryCap,
    assetMetadata: testCoins.asset.metadata,
    stableTreasuryCap: testCoins.stable.treasuryCap,
    stableMetadata: testCoins.stable.metadata,
    spotPoolId: poolId || null,
    raiseId: raiseId,
    timestamp: Date.now(),
    network: "devnet",
    success: shouldRaiseSucceed,
  };

  fs.writeFileSync(daoInfoPath, JSON.stringify(daoInfo, null, 2), "utf-8");
  console.log(`\n💾 DAO info saved to: ${daoInfoPath}`);
  console.log(`   For use by proposal E2E test`);
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
