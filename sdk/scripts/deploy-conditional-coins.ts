/**
 * Deploy and Register Conditional Coins
 *
 * This script:
 * 1. Deploys the conditional_coins package (4 coin types)
 * 2. Registers all TreasuryCaps in the CoinRegistry
 * 3. Saves deployment info to JSON for use in tests
 *
 * Usage:
 *   npx tsx scripts/deploy-conditional-coins.ts [--registry 0x...existing] [--fee <mist>]
 */

import { Transaction } from "@mysten/sui/transactions";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { initSDK, executeTransaction, getActiveAddress } from "./execute-tx";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const CONDITIONAL_COINS_PATH = path.join(REPO_ROOT, "packages", "conditional_coins");
const DEPLOYMENTS_DIR = path.join(REPO_ROOT, "packages", "deployments");
const SDK_DIR = path.join(REPO_ROOT, "packages", "sdk");

interface ConditionalCoinInfo {
  treasuryCapId: string;
  metadataId: string;
  coinType: string;
}

interface ConditionalCoinsDeployment {
  packageId: string;
  registryId: string;
  cond0_asset: ConditionalCoinInfo;
  cond0_stable: ConditionalCoinInfo;
  cond1_asset: ConditionalCoinInfo;
  cond1_stable: ConditionalCoinInfo;
  timestamp: string;
  network: string;
}

async function main() {
  const args = process.argv.slice(2);
  let existingRegistryId: string | null = null;
  let feeOverride: bigint | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--registry") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("--registry flag requires an object ID");
      }
      existingRegistryId = value;
      i += 1;
    } else if (arg === "--fee") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("--fee flag requires a number (mist)");
      }
      feeOverride = BigInt(value);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  console.log("=".repeat(80));
  console.log("DEPLOY AND REGISTER CONDITIONAL COINS");
  console.log("=".repeat(80));
  console.log();

  // Initialize SDK
  const sdk = await initSDK();
  const activeAddress = getActiveAddress();
  console.log(`Active address: ${activeAddress}`);
  console.log();

  // Get one_shot_utils package
  const oneShotUtils = sdk.deployments.getPackage("futarchy_one_shot_utils");
  if (!oneShotUtils) {
    console.error("❌ futarchy_one_shot_utils not found in deployments!");
    process.exit(1);
  }

  // Create CoinRegistry if it doesn't exist
  let registryId = existingRegistryId;
  if (!registryId) {
    console.log("📝 Creating CoinRegistry...");
    const createRegistryTx = new Transaction();

    const registry = createRegistryTx.moveCall({
      target: `${oneShotUtils.packageId}::coin_registry::create_registry`,
      arguments: [],
    });

    createRegistryTx.moveCall({
      target: `${oneShotUtils.packageId}::coin_registry::share_registry`,
      arguments: [registry],
    });

    const registryResult = await executeTransaction(sdk, createRegistryTx, {
      network: "devnet",
      showObjectChanges: true,
    });

    // Find the shared CoinRegistry object
    const registryObject = registryResult.objectChanges?.find(
      (obj: any) =>
        obj.type === "created" &&
        obj.objectType &&
        obj.objectType.includes("::coin_registry::CoinRegistry")
    );

    if (!registryObject) {
      console.error("❌ Failed to find CoinRegistry in object changes!");
      console.error("Object changes:", JSON.stringify(registryResult.objectChanges, null, 2));
      process.exit(1);
    }

    registryId = (registryObject as any).objectId;
    console.log(`✅ CoinRegistry created: ${registryId}`);
    console.log();
  } else {
    console.log(`ℹ️  Using existing CoinRegistry: ${registryId}`);
    console.log();
  }

  if (!registryId) {
    throw new Error("CoinRegistry ID not available");
  }

  // Step 1: Deploy conditional_coins package
  console.log("📦 Deploying conditional_coins package...");
  console.log();

  const buildCmd = `cd ${CONDITIONAL_COINS_PATH} && sui move build --silence-warnings`;
  execSync(buildCmd, { stdio: "inherit" });

  const publishCmd = `cd ${CONDITIONAL_COINS_PATH} && sui client publish --gas-budget 100000000 --json`;
  const publishOutput = execSync(publishCmd, { encoding: "utf-8" });
  const publishResult = JSON.parse(publishOutput);

  if (publishResult.effects?.status?.status !== "success") {
    console.error("❌ Deployment failed!");
    console.error(publishResult);
    process.exit(1);
  }

  // Extract package ID
  const packageId = publishResult.objectChanges?.find(
    (obj: any) => obj.type === "published"
  )?.packageId;

  if (!packageId) {
    console.error("❌ Failed to extract package ID!");
    process.exit(1);
  }

  console.log(`✅ Deployed: ${packageId}`);
  console.log();

  // Extract TreasuryCaps and Metadata
  const objectChanges = publishResult.objectChanges || [];
  const caps: Record<string, ConditionalCoinInfo> = {};

  for (const coinName of ["cond0_asset", "cond0_stable", "cond1_asset", "cond1_stable"]) {
    const treasuryCap = objectChanges.find(
      (obj: any) =>
        obj.objectType?.includes(`::${coinName}::`) && obj.objectType?.includes("TreasuryCap")
    );
    const metadata = objectChanges.find(
      (obj: any) =>
        obj.objectType?.includes(`::${coinName}::`) && obj.objectType?.includes("CoinMetadata")
    );

    if (!treasuryCap || !metadata) {
      console.error(`❌ Failed to find TreasuryCap or Metadata for ${coinName}`);
      process.exit(1);
    }

    caps[coinName] = {
      treasuryCapId: treasuryCap.objectId,
      metadataId: metadata.objectId,
      coinType: treasuryCap.objectType.match(/TreasuryCap<(.+)>/)?.[1] || "",
    };

    console.log(`✅ ${coinName}:`);
    console.log(`   TreasuryCap: ${caps[coinName].treasuryCapId}`);
    console.log(`   Metadata: ${caps[coinName].metadataId}`);
  }
  console.log();

  // Step 2: Register all caps in CoinRegistry
  console.log("📝 Registering conditional coins in CoinRegistry...");
  console.log();

  const registerTx = new Transaction();
  const fee = feeOverride ?? 0n; // Default zero fee for test coins

  for (const [coinName, info] of Object.entries(caps)) {
    console.log(`   Registering ${coinName}...`);

    registerTx.moveCall({
      target: `${oneShotUtils.packageId}::coin_registry::deposit_coin_set_entry`,
      typeArguments: [info.coinType],
      arguments: [
        registerTx.object(registryId),
        registerTx.object(info.treasuryCapId),
        registerTx.object(info.metadataId),
        registerTx.pure.u64(fee),
        registerTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });
  }

  await executeTransaction(sdk, registerTx, {
    network: "devnet",
  });

  console.log("✅ All conditional coins registered in CoinRegistry!");
  console.log();

  // Step 3: Save deployment info
  const deployment: ConditionalCoinsDeployment = {
    packageId,
    registryId,
    cond0_asset: caps.cond0_asset,
    cond0_stable: caps.cond0_stable,
    cond1_asset: caps.cond1_asset,
    cond1_stable: caps.cond1_stable,
    timestamp: new Date().toISOString(),
    network: "devnet",
  };

  // Save to deployments directory
  const deploymentFile = path.join(DEPLOYMENTS_DIR, "conditional_coins.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log(`✅ Saved deployment info: ${deploymentFile}`);

  // Save to SDK directory for easy access
  const sdkFile = path.join(SDK_DIR, "conditional-coins-info.json");
  fs.writeFileSync(sdkFile, JSON.stringify(deployment, null, 2));
  console.log(`✅ Saved to SDK: ${sdkFile}`);
  console.log();

  // Process deployments to update SDK
  console.log("🔄 Processing deployments to update SDK...");
  execSync(`cd ${SDK_DIR} && npx tsx scripts/process-deployments.ts`, { stdio: "inherit" });
  console.log();

  console.log("=".repeat(80));
  console.log("✅ CONDITIONAL COINS DEPLOYED AND REGISTERED!");
  console.log("=".repeat(80));
  console.log();
  console.log("Next steps:");
  console.log("  1. Conditional coins are now in CoinRegistry");
  console.log("  2. Proposal tests can fetch them via take_coin_set()");
  console.log("  3. Run: npm run test:proposal-with-swaps");
  console.log();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
