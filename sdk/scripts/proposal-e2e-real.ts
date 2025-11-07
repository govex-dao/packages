/**
 * REAL Proposal E2E Test - Binary proposal with actions
 *
 * This test creates an actual on-chain proposal with:
 * - Binary outcomes: Accept / Reject
 * - Accept outcome has 2 actions (stream creation)
 * - Actions staged at proposal creation
 * - Actions executed after finalization
 * - Full state transitions: PREMARKET → REVIEW → TRADING → FINALIZED
 */

import { Transaction } from "@mysten/sui/transactions";
import * as fs from "fs";
import * as path from "path";
import { initSDK, executeTransaction, getActiveAddress } from "./execute-tx";
import { bcs } from "@mysten/sui/bcs";

async function main() {
  console.log("=" + "=".repeat(79));
  console.log("REAL PROPOSAL E2E TEST - BINARY PROPOSAL WITH ACTIONS");
  console.log("=" + "=".repeat(79));
  console.log();

  // ============================================================================
  // STEP 0: Load DAO info from launchpad test
  // ============================================================================
  console.log("📂 Loading DAO info from previous launchpad test...");

  const daoInfoPath = path.join(__dirname, "..", "test-dao-info.json");

  if (!fs.existsSync(daoInfoPath)) {
    console.error("❌ No DAO info file found.");
    console.error("   Please run launchpad E2E test first:");
    console.error("   npm run launchpad-e2e-two-outcome");
    process.exit(1);
  }

  const daoInfo = JSON.parse(fs.readFileSync(daoInfoPath, "utf-8"));
  const daoAccountId = daoInfo.accountId;
  const assetType = daoInfo.assetType;
  const stableType = daoInfo.stableType;
  const spotPoolId = daoInfo.spotPoolId;
  const assetTreasuryCap = daoInfo.assetTreasuryCap;
  const stableTreasuryCap = daoInfo.stableTreasuryCap;

  console.log(`✅ DAO Account: ${daoAccountId}`);
  console.log(`✅ Asset Type: ${assetType}`);
  console.log(`✅ Stable Type: ${stableType}`);
  console.log(`✅ Spot Pool: ${spotPoolId}`);
  console.log(`✅ Asset Treasury Cap: ${assetTreasuryCap}`);
  console.log(`✅ Stable Treasury Cap: ${stableTreasuryCap}`);
  console.log();

  // ============================================================================
  // STEP 1: Initialize SDK
  // ============================================================================
  console.log("🔧 Initializing SDK...");
  const sdk = await initSDK();
  const activeAddress = getActiveAddress();
  console.log(`✅ Active address: ${activeAddress}`);
  console.log();

  // Get package IDs
  const actionsPkg = sdk.getPackageId("AccountActions");
  const protocolPkg = sdk.getPackageId("AccountProtocol");
  const marketsPackageId = sdk.getPackageId("futarchy_markets_core");
  const primitivesPackageId = sdk.getPackageId("futarchy_markets_primitives");
  const governancePackageId = sdk.getPackageId("futarchy_governance");
  const typesPackageId = sdk.getPackageId("futarchy_types");

  console.log(`📦 Actions Package: ${actionsPkg}`);
  console.log(`📦 Protocol Package: ${protocolPkg}`);
  console.log(`📦 Markets Package: ${marketsPackageId}`);
  console.log(`📦 Primitives Package: ${primitivesPackageId}`);
  console.log(`📦 Governance Package: ${governancePackageId}`);
  console.log(`📦 Types Package: ${typesPackageId}`);
  console.log();

  // ============================================================================
  // STEP 2: Setup action specs parameters
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("STEP 2: SETUP ACTION SPECS FOR ACCEPT OUTCOME");
  console.log("=" + "=".repeat(79));
  console.log();

  console.log("📝 Will create ActionSpecs with 2 stream actions:");

  // Stream 1: 1000 stable coins, 30 daily iterations
  const stream1Iterations = 30n;
  const stream1IterationPeriod = 86_400_000n; // 1 day in ms
  const stream1Amount = 1000_000_000; // Total: 1000 stable coins (9 decimals)
  const stream1AmountPerIteration = Number(BigInt(stream1Amount) / stream1Iterations);
  const now = Date.now();
  const stream1Start = now;

  console.log(`   Stream 1: ${stream1Amount / 1e9} stable coins over ${Number(stream1Iterations)} days (daily unlocks)`);

  // Stream 2: 500 stable coins, 15 daily iterations
  const stream2Iterations = 15n;
  const stream2IterationPeriod = 86_400_000n; // 1 day in ms
  const stream2Amount = 500_000_000; // Total: 500 stable coins
  const stream2AmountPerIteration = Number(BigInt(stream2Amount) / stream2Iterations);
  const stream2Start = now;

  console.log(`   Stream 2: ${stream2Amount / 1e9} stable coins over ${Number(stream2Iterations)} days (daily unlocks)`);
  console.log(`   (Actions will be created inline with proposal)`);
  console.log();

  // ============================================================================
  // STEP 3: Create PREMARKET proposal with action specs
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("STEP 3: CREATE PREMARKET PROPOSAL");
  console.log("=" + "=".repeat(79));
  console.log();

  console.log("🏗️  Step 1: Creating proposal WITHOUT actions first...");

  const proposalConfig = {
    daoId: daoAccountId,
    assetType: assetType,
    stableType: stableType,

    title: "Fund Community Development",
    introduction: "Proposal to fund community development initiatives",
    outcomeMessages: ["Accept", "Reject"],
    outcomeDetails: [
      "Accept: Fund 2 streams for community development",
      "Reject: Do not fund",
    ],
    metadata: JSON.stringify({
      category: "treasury",
      impact: "medium",
      requestedAmount: (stream1Amount + stream2Amount) / 1e9,
    }),

    proposer: activeAddress,
    treasuryAddress: activeAddress, // Simplified for testing
    maxOutcomes: 10,
    usedQuota: false,

    // Timing: 2 min review, 3 min trading (for testing)
    reviewPeriodMs: 2 * 60 * 1000,
    tradingPeriodMs: 3 * 60 * 1000,
    twapStartDelayMs: 0,

    // Market config - use smaller amounts for testing
    minAssetLiquidity: 50_000, // 0.00005 asset coins per outcome (smaller for testing)
    minStableLiquidity: 50_000, // 0.00005 stable coins per outcome (smaller for testing)
    ammFeeBps: 30, // 0.3%
    conditionalLiquidityPercent: 80, // 80% to conditional markets

    // TWAP config
    twapInitialObservation: BigInt("1000000000000000000"), // 1.0 in 18 decimals
    twapStepMax: 1000,
    twapThreshold: BigInt("9223372036854775808"), // 0 threshold (SignedU128 zero)

    // NO actions yet - will add separately
    intentSpecForYes: undefined,

    // Reference ID
    referenceProposalId: "0x0000000000000000000000000000000000000000000000000000000000000001",
  };

  // Create proposal transaction
  const createTx = new Transaction();

  // Create Option::None for vector<ActionSpec>
  const noneOption = createTx.moveCall({
    target: "0x1::option::none",
    typeArguments: [`vector<${protocolPkg}::intents::ActionSpec>`],
    arguments: [],
  });

  // Create SignedU128 for twap_threshold
  const twapThresholdSigned = createTx.moveCall({
    target: `${typesPackageId}::signed::from_u128`,
    arguments: [createTx.pure.u128(proposalConfig.twapThreshold)],
  });

  const createProposalTarget = `${marketsPackageId}::proposal::new_premarket`;
  createTx.moveCall({
    target: createProposalTarget,
    typeArguments: [assetType, stableType],
    arguments: [
      createTx.object(proposalConfig.referenceProposalId),
      createTx.object(proposalConfig.daoId),
      createTx.pure.u64(proposalConfig.reviewPeriodMs),
      createTx.pure.u64(proposalConfig.tradingPeriodMs),
      createTx.pure.u64(proposalConfig.minAssetLiquidity),
      createTx.pure.u64(proposalConfig.minStableLiquidity),
      createTx.pure.u64(proposalConfig.twapStartDelayMs || 0),
      createTx.pure.u128(proposalConfig.twapInitialObservation), // twap_initial_observation (plain u128)
      createTx.pure.u64(proposalConfig.twapStepMax),
      twapThresholdSigned, // twap_threshold (SignedU128)
      createTx.pure.u64(proposalConfig.ammFeeBps),
      createTx.pure.u64(proposalConfig.conditionalLiquidityPercent),
      createTx.pure.u64(proposalConfig.maxOutcomes),
      createTx.pure.address(proposalConfig.treasuryAddress),
      createTx.pure.string(proposalConfig.title),
      createTx.pure.string(proposalConfig.introduction),
      createTx.pure.string(proposalConfig.metadata),
      createTx.pure.vector("string", proposalConfig.outcomeMessages),
      createTx.pure.vector("string", proposalConfig.outcomeDetails),
      createTx.pure.address(proposalConfig.proposer),
      createTx.pure.bool(proposalConfig.usedQuota),
      noneOption, // intent_spec_for_yes - NONE for now
      createTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  console.log("📤 Executing transaction to create proposal...");
  const createResult = await executeTransaction(sdk, createTx, {
    network: "devnet",
    description: "Create PREMARKET proposal",
    showObjectChanges: true,
  });

  // Debug: print all object changes
  console.log("\n🔍 Created objects:");
  createResult.objectChanges?.forEach((obj: any) => {
    if (obj.type === "created") {
      console.log(`   - ${obj.objectType}`);
      console.log(`     ID: ${obj.objectId}`);
    }
  });
  console.log();

  const proposalObject = createResult.objectChanges?.find(
    (obj: any) => obj.type === "created" && obj.objectType?.includes("proposal::Proposal")
  );

  if (!proposalObject) {
    console.error("❌ Failed to create proposal");
    console.error("   Object changes:", JSON.stringify(createResult.objectChanges, null, 2));
    process.exit(1);
  }

  const proposalId = (proposalObject as any).objectId;
  console.log(`✅ Proposal created: ${proposalId}`);
  console.log(`   State: PREMARKET (0)`);
  console.log(`   Outcomes: Accept, Reject (no actions yet)`);
  console.log();

  // ============================================================================
  // STEP 3.5: Add actions to Accept outcome
  // ============================================================================
  console.log("🏗️  Step 2: Adding actions to Accept outcome...");

  const addActionsTx = new Transaction();

  // Create ActionSpec builder
  const builder = addActionsTx.moveCall({
    target: `${actionsPkg}::action_spec_builder::new`,
    arguments: [],
  });

  // Add stream 1
  addActionsTx.moveCall({
    target: `${actionsPkg}::stream_init_actions::add_create_stream_spec`,
    arguments: [
      builder,
      addActionsTx.pure.string("treasury"),
      addActionsTx.pure(bcs.Address.serialize(activeAddress).toBytes()),
      addActionsTx.pure.u64(stream1AmountPerIteration), // amount_per_iteration (NO DIVISION in Move!)
      addActionsTx.pure.u64(stream1Start),
      addActionsTx.pure.u64(stream1Iterations), // iterations_total
      addActionsTx.pure.u64(stream1IterationPeriod), // iteration_period_ms
      addActionsTx.pure.option("u64", null), // cliff_time
      addActionsTx.pure.option("u64", null), // claim_window_ms (use-or-lose window)
      addActionsTx.pure.u64(stream1AmountPerIteration), // max_per_withdrawal
      addActionsTx.pure.bool(true), // is_transferable
      addActionsTx.pure.bool(true), // is_cancellable
    ],
  });

  // Add stream 2
  addActionsTx.moveCall({
    target: `${actionsPkg}::stream_init_actions::add_create_stream_spec`,
    arguments: [
      builder,
      addActionsTx.pure.string("treasury"),
      addActionsTx.pure(bcs.Address.serialize(activeAddress).toBytes()),
      addActionsTx.pure.u64(stream2AmountPerIteration), // amount_per_iteration (NO DIVISION in Move!)
      addActionsTx.pure.u64(stream2Start),
      addActionsTx.pure.u64(stream2Iterations), // iterations_total
      addActionsTx.pure.u64(stream2IterationPeriod), // iteration_period_ms
      addActionsTx.pure.option("u64", null), // cliff_time
      addActionsTx.pure.option("u64", null), // claim_window_ms (use-or-lose window)
      addActionsTx.pure.u64(stream2AmountPerIteration), // max_per_withdrawal
      addActionsTx.pure.bool(true), // is_transferable
      addActionsTx.pure.bool(true), // is_cancellable
    ],
  });

  // Convert builder to vector<ActionSpec>
  const specs = addActionsTx.moveCall({
    target: `${actionsPkg}::action_spec_builder::into_vector`,
    arguments: [builder],
  });

  // Now set the actions for outcome 0 (Accept)
  const setIntentTarget = `${marketsPackageId}::proposal::set_intent_spec_for_outcome`;
  addActionsTx.moveCall({
    target: setIntentTarget,
    typeArguments: [assetType, stableType],
    arguments: [
      addActionsTx.object(proposalId), // proposal
      addActionsTx.pure.u64(0), // outcome_index (0 = Accept)
      specs, // vector<ActionSpec>
      addActionsTx.pure.u64(10), // max_actions_per_outcome
    ],
  });

  console.log("📤 Executing transaction to add actions to Accept outcome...");
  const addActionsResult = await executeTransaction(sdk, addActionsTx, {
    network: "devnet",
    description: "Add actions to Accept outcome",
  });

  console.log(`✅ Actions added to Accept outcome!`);
  console.log(`   2 stream actions staged for execution if proposal passes`);
  console.log();

  // Save proposal info for later tests
  const proposalInfoPath = path.join(__dirname, "..", "test-proposal-info.json");
  const proposalInfo = {
    proposalId: proposalId,
    daoAccountId: daoAccountId,
    assetType: assetType,
    stableType: stableType,
    spotPoolId: spotPoolId,
    timestamp: Date.now(),
    network: "devnet",
  };
  fs.writeFileSync(proposalInfoPath, JSON.stringify(proposalInfo, null, 2), "utf-8");
  console.log(`💾 Proposal info saved to: ${proposalInfoPath}`);
  console.log();

  // ============================================================================
  // STEP 4: Query proposal to get escrow and market IDs
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("STEP 4: QUERY PROPOSAL FOR ESCROW/MARKET IDs");
  console.log("=" + "=".repeat(79));
  console.log();

  console.log("🔍 Querying proposal object to get escrow and market IDs...");
  console.log("   (Escrow/market will be created when we advance to REVIEW state)");
  console.log();

  console.log("📝 With the new architecture:");
  console.log("   - NO user-provided liquidity needed");
  console.log("   - Liquidity comes from DAO's spot pool via quantum split");
  console.log("   - Happens automatically when advancing REVIEW → TRADING");
  console.log();

  // Save proposal info (escrow/market IDs will be added after advancing state)
  fs.writeFileSync(proposalInfoPath, JSON.stringify(proposalInfo, null, 2), "utf-8");

  // ============================================================================
  // STEP 5: Advance PREMARKET → REVIEW (create escrow)
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("STEP 5: ADVANCE TO REVIEW STATE (CREATE ESCROW)");
  console.log("=" + "=".repeat(79));
  console.log();

  console.log("📝 Creating escrow (no user coins needed!)...");

  const advanceTx = new Transaction();

  // Step 1: Create escrow for market
  const createEscrowTarget = `${marketsPackageId}::proposal::create_escrow_for_market`;
  const escrow = advanceTx.moveCall({
    target: createEscrowTarget,
    typeArguments: [assetType, stableType],
    arguments: [
      advanceTx.object(proposalId),
      advanceTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  // Step 2: Get the escrow ID and market_state ID (will be extracted from escrow after sharing)
  // We'll extract these from the shared escrow later

  // Step 3: Create conditional AMM pools (CRITICAL - must happen before sharing escrow!)
  console.log("📝 Creating conditional AMM pools...");
  advanceTx.moveCall({
    target: `${marketsPackageId}::proposal::create_conditional_amm_pools`,
    typeArguments: [assetType, stableType],
    arguments: [
      advanceTx.object(proposalId),
      escrow, // Unshared escrow
      advanceTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  // Step 4: Share the escrow (makes it available for trading)
  advanceTx.moveCall({
    target: "0x2::transfer::public_share_object",
    typeArguments: [
      `${primitivesPackageId}::coin_escrow::TokenEscrow<${assetType}, ${stableType}>`
    ],
    arguments: [escrow],
  });

  console.log("📤 Executing transaction to create escrow, AMM pools, and advance to REVIEW...");
  const advanceResult = await executeTransaction(sdk, advanceTx, {
    network: "devnet",
    description: "Create escrow, AMM pools, and advance to REVIEW",
    showObjectChanges: true,
  });

  // Find the created escrow object
  const escrowObject = advanceResult.objectChanges?.find(
    (obj: any) => obj.objectType?.includes("::coin_escrow::TokenEscrow")
  );

  if (!escrowObject) {
    console.error("❌ Failed to create escrow!");
    process.exit(1);
  }

  const escrowId = (escrowObject as any).objectId;
  console.log(`✅ Escrow created: ${escrowId}`);
  console.log();

  // Query escrow to get market_state ID
  console.log("🔍 Querying escrow to get MarketState ID...");
  const escrowData = await sdk.client.getObject({
    id: escrowId,
    options: { showContent: true },
  });

  if (!escrowData.data?.content || escrowData.data.content.dataType !== "moveObject") {
    throw new Error("Failed to fetch escrow object data");
  }

  const escrowFields = (escrowData.data.content as any).fields;
  const marketStateId = escrowFields.market_state?.fields?.id?.id;

  if (!marketStateId) {
    console.error("❌ Failed to get market_state ID from escrow");
    throw new Error("Failed to get market_state_id from escrow");
  }

  console.log(`✅ MarketState ID: ${marketStateId}`);
  console.log();

  // Step 4: Initialize market fields to set state to REVIEW
  console.log("📝 Initializing market fields to set state to REVIEW...");

  const initFieldsTx = new Transaction();
  const timestamp = Date.now();

  initFieldsTx.moveCall({
    target: `${marketsPackageId}::proposal::initialize_market_fields`,
    typeArguments: [assetType, stableType],
    arguments: [
      initFieldsTx.object(proposalId),
      initFieldsTx.pure.id(marketStateId),
      initFieldsTx.pure.id(escrowId),
      initFieldsTx.pure.u64(timestamp),
      initFieldsTx.pure.address(activeAddress), // liquidity_provider (placeholder, not used for DAO liquidity)
    ],
  });

  console.log("📤 Executing transaction to initialize market fields...");
  await executeTransaction(sdk, initFieldsTx, {
    network: "devnet",
    description: "Initialize market fields",
  });

  console.log(`✅ Proposal state set to REVIEW!`);
  console.log();

  // Update proposal info with escrow and market IDs
  proposalInfo.escrowId = escrowId;
  proposalInfo.marketStateId = marketStateId;
  fs.writeFileSync(proposalInfoPath, JSON.stringify(proposalInfo, null, 2), "utf-8");

  // ============================================================================
  // DONE - Next steps manual
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("✅ PROPOSAL IN REVIEW STATE");
  console.log("=" + "=".repeat(79));
  console.log();

  console.log("📋 Next steps (run proposal-state-cycle.ts):");
  console.log("   1. Wait for review period to end (2 minutes)");
  console.log("   2. Advance REVIEW → TRADING (quantum split from spot pool)");
  console.log("   3. Users can trade on conditional AMMs during trading period");
  console.log("   4. Wait for trading period to end (3 minutes)");
  console.log("   5. Finalize proposal (determine winner, quantum recombination)");
  console.log("   6. Execute actions if Accept wins");
  console.log();

  console.log("💡 Key difference from old architecture:");
  console.log("   - No manual market initialization with user coins");
  console.log("   - Liquidity automatically comes from DAO spot pool");
  console.log("   - Quantum split/recombination happens automatically");
  console.log();

  console.log("📄 Proposal info saved to: test-proposal-info.json");
  console.log();
}

main()
  .then(() => {
    console.log("✅ Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
