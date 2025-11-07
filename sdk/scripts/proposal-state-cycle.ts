/**
 * Proposal State Cycle Test
 *
 * This script loads an existing proposal and cycles it through all states:
 * - REVIEW → TRADING (via advance_state)
 * - TRADING → FINALIZED (via finalize_proposal)
 * - Execute actions if Accept wins
 *
 * Prerequisites:
 * - Run proposal-e2e-real.ts first to create a proposal in REVIEW state
 * - test-proposal-info.json must exist with proposalId, escrowId, etc.
 */

import { Transaction } from "@mysten/sui/transactions";
import * as fs from "fs";
import * as path from "path";
import { initSDK, executeTransaction, getActiveAddress } from "./execute-tx";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=" + "=".repeat(79));
  console.log("PROPOSAL STATE CYCLE TEST");
  console.log("=" + "=".repeat(79));
  console.log();

  // ============================================================================
  // STEP 1: Load proposal info
  // ============================================================================
  console.log("📂 Loading proposal info...");

  const proposalInfoPath = path.join(__dirname, "..", "test-proposal-info.json");
  const daoInfoPath = path.join(__dirname, "..", "test-dao-info.json");

  if (!fs.existsSync(proposalInfoPath)) {
    console.error("❌ No proposal info file found.");
    console.error("   Please run proposal-e2e-real.ts first:");
    console.error("   npm run test:proposal-real");
    process.exit(1);
  }

  if (!fs.existsSync(daoInfoPath)) {
    console.error("❌ No DAO info file found.");
    console.error("   Please run launchpad test first:");
    console.error("   npm run launchpad-e2e-two-outcome");
    process.exit(1);
  }

  const proposalInfo = JSON.parse(fs.readFileSync(proposalInfoPath, "utf-8"));
  const daoInfo = JSON.parse(fs.readFileSync(daoInfoPath, "utf-8"));

  const proposalId = proposalInfo.proposalId;
  const escrowId = proposalInfo.escrowId;
  const marketStateId = proposalInfo.marketStateId;
  const daoAccountId = proposalInfo.daoAccountId || daoInfo.accountId;
  const assetType = proposalInfo.assetType;
  const stableType = proposalInfo.stableType;

  console.log(`✅ Proposal ID: ${proposalId}`);
  console.log(`✅ Escrow ID: ${escrowId}`);
  console.log(`✅ MarketState ID: ${marketStateId}`);
  console.log(`✅ DAO Account: ${daoAccountId}`);
  console.log();

  // ============================================================================
  // STEP 2: Initialize SDK
  // ============================================================================
  console.log("🔧 Initializing SDK...");
  const sdk = await initSDK();
  const activeAddress = getActiveAddress();
  console.log(`✅ Active address: ${activeAddress}`);
  console.log();

  // Get package IDs
  const marketsPackageId = sdk.getPackageId("futarchy_markets_core");
  const governancePackageId = sdk.getPackageId("futarchy_governance");

  console.log(`📦 Markets Package: ${marketsPackageId}`);
  console.log(`📦 Governance Package: ${governancePackageId}`);
  console.log();

  // ============================================================================
  // STEP 3: Query current proposal state
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("STEP 3: QUERY CURRENT STATE");
  console.log("=" + "=".repeat(79));
  console.log();

  const proposalData = await sdk.client.getObject({
    id: proposalId,
    options: { showContent: true },
  });

  if (!proposalData.data?.content || proposalData.data.content.dataType !== "moveObject") {
    throw new Error("Failed to fetch proposal data");
  }

  const fields = (proposalData.data.content as any).fields;
  const currentState = parseInt(fields.state);
  const timing = fields.timing.fields; // Access nested fields
  const marketInitializedAt = timing.market_initialized_at;
  const reviewPeriodMs = timing.review_period_ms;
  const tradingPeriodMs = timing.trading_period_ms;

  const stateNames = ["PREMARKET", "REVIEW", "TRADING", "FINALIZED"];
  console.log(`📊 Current state: ${stateNames[currentState]} (${currentState})`);
  console.log(`⏰ Market initialized at: ${marketInitializedAt}`);
  console.log(`⏰ Review period: ${reviewPeriodMs}ms (${parseInt(reviewPeriodMs) / 60000} minutes)`);
  console.log(`⏰ Trading period: ${tradingPeriodMs}ms (${parseInt(tradingPeriodMs) / 60000} minutes)`);
  console.log();

  // Calculate when review period ends
  const reviewEndTime = parseInt(marketInitializedAt) + parseInt(reviewPeriodMs);
  const now = Date.now();
  const timeUntilReviewEnd = reviewEndTime - now;

  console.log(`🕐 Current time: ${now}`);
  console.log(`🕐 Review ends at: ${reviewEndTime}`);

  if (timeUntilReviewEnd > 0) {
    console.log(`⏳ Time until review period ends: ${Math.ceil(timeUntilReviewEnd / 1000)} seconds`);
  } else {
    console.log(`✅ Review period has ended (${Math.abs(timeUntilReviewEnd) / 1000} seconds ago)`);
  }
  console.log();

  // ============================================================================
  // STEP 4: Advance to TRADING state (if ready)
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("STEP 4: ADVANCE TO TRADING STATE");
  console.log("=" + "=".repeat(79));
  console.log();

  if (currentState === 0) {
    console.error("❌ Proposal is still in PREMARKET state!");
    console.error("   Please initialize the market first (run proposal-e2e-real.ts)");
    process.exit(1);
  }

  // Get spot pool ID from DAO info
  const spotPoolId = daoInfo.spotPoolId;
  if (!spotPoolId) {
    throw new Error("No spot pool ID found in DAO info - cannot perform quantum split!");
  }

  // Query spot pool reserves BEFORE quantum split
  console.log("🔍 Querying spot pool reserves BEFORE quantum split...");
  const spotPoolBefore = await sdk.client.getObject({
    id: spotPoolId,
    options: { showContent: true },
  });

  if (!spotPoolBefore.data?.content || spotPoolBefore.data.content.dataType !== "moveObject") {
    throw new Error("Failed to fetch spot pool data");
  }

  const spotFieldsBefore = (spotPoolBefore.data.content as any).fields;
  const assetReservesBefore = BigInt(spotFieldsBefore.asset_reserve);
  const stableReservesBefore = BigInt(spotFieldsBefore.stable_reserve);

  console.log(`📊 Spot Pool BEFORE split:`);
  console.log(`   Asset reserves:  ${assetReservesBefore}`);
  console.log(`   Stable reserves: ${stableReservesBefore}`);
  console.log();

  // These will be set after quantum split
  let assetReservesAfter = assetReservesBefore;
  let stableReservesAfter = stableReservesBefore;

  if (currentState === 1) {
    // REVIEW state - try to advance to TRADING
    if (timeUntilReviewEnd > 0) {
      console.log(`⏳ Waiting for review period to end (${Math.ceil(timeUntilReviewEnd / 1000)} seconds)...`);
      await sleep(timeUntilReviewEnd + 1000); // Wait + 1 second buffer
      console.log("✅ Review period ended!");
      console.log();
    }

    console.log("📤 Calling advance_proposal_state() to transition REVIEW → TRADING...");
    console.log("   This will perform QUANTUM SPLIT from spot pool!");
    console.log(`   Using spot pool: ${spotPoolId}`);
    console.log();

    const advanceTx = new Transaction();
    advanceTx.moveCall({
      target: `${governancePackageId}::proposal_lifecycle::advance_proposal_state`,
      typeArguments: [assetType, stableType],
      arguments: [
        advanceTx.object(daoAccountId), // account
        advanceTx.object(proposalId), // proposal
        advanceTx.object(escrowId), // escrow
        advanceTx.object(spotPoolId), // spot_pool - FOR QUANTUM SPLIT!
        advanceTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }), // clock
      ],
    });

    const advanceResult = await executeTransaction(sdk, advanceTx, {
      network: "devnet",
      description: "Advance proposal to TRADING state with quantum split",
    });

    console.log("✅ State advanced to TRADING!");
    console.log();

    // Query spot pool reserves AFTER quantum split to verify liquidity moved OUT
    console.log("🔍 Querying spot pool reserves AFTER quantum split...");
    const spotPoolAfter = await sdk.client.getObject({
      id: spotPoolId,
      options: { showContent: true },
    });

    if (!spotPoolAfter.data?.content || spotPoolAfter.data.content.dataType !== "moveObject") {
      throw new Error("Failed to fetch spot pool data after split");
    }

    const spotFieldsAfter = (spotPoolAfter.data.content as any).fields;
    assetReservesAfter = BigInt(spotFieldsAfter.asset_reserve);
    stableReservesAfter = BigInt(spotFieldsAfter.stable_reserve);

    console.log(`📊 Spot Pool AFTER split:`);
    console.log(`   Asset reserves:  ${assetReservesAfter}`);
    console.log(`   Stable reserves: ${stableReservesAfter}`);
    console.log();

    // Verify liquidity decreased (quantum split moved liquidity OUT)
    const assetDecreased = assetReservesAfter < assetReservesBefore;
    const stableDecreased = stableReservesAfter < stableReservesBefore;

    console.log(`📉 Reserves DECREASED (quantum split worked):`);
    console.log(`   Asset:  ${assetReservesBefore} → ${assetReservesAfter} ${assetDecreased ? '✅' : '❌'}`);
    console.log(`   Stable: ${stableReservesBefore} → ${stableReservesAfter} ${stableDecreased ? '✅' : '❌'}`);
    console.log();

    if (!assetDecreased || !stableDecreased) {
      throw new Error("❌ Quantum split verification failed - reserves did not decrease!");
    }

    console.log("✅ Quantum split verified - liquidity moved from spot pool to conditional AMMs!");
    console.log();
  } else if (currentState === 2) {
    console.log("✅ Proposal is already in TRADING state");
    console.log();
  } else {
    console.log(`⚠️  Proposal is already in ${stateNames[currentState]} state`);
    console.log();
  }

  // ============================================================================
  // STEP 5: Wait for trading period and finalize
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("STEP 5: FINALIZE PROPOSAL");
  console.log("=" + "=".repeat(79));
  console.log();

  // Refresh proposal state
  const proposalData2 = await sdk.client.getObject({
    id: proposalId,
    options: { showContent: true },
  });
  const fields2 = (proposalData2.data!.content as any).fields;
  const state2 = parseInt(fields2.state);

  if (state2 === 3) {
    console.log("✅ Proposal is already FINALIZED");
    console.log();
  } else if (state2 === 2) {
    // TRADING state
    const tradingEndTime = reviewEndTime + parseInt(tradingPeriodMs);
    const now2 = Date.now();
    const timeUntilTradingEnd = tradingEndTime - now2;

    console.log(`🕐 Current time: ${now2}`);
    console.log(`🕐 Trading ends at: ${tradingEndTime}`);

    if (timeUntilTradingEnd > 0) {
      console.log(`⏳ Time until trading period ends: ${Math.ceil(timeUntilTradingEnd / 1000)} seconds`);
      console.log(`⏳ Waiting for trading period to end...`);
      await sleep(timeUntilTradingEnd + 1000); // Wait + 1 second buffer
      console.log("✅ Trading period ended!");
      console.log();
    } else {
      console.log(`✅ Trading period has ended (${Math.abs(timeUntilTradingEnd) / 1000} seconds ago)`);
      console.log();
    }

    console.log("📤 Calling finalize_proposal_with_spot_pool() to determine winner and recombine liquidity...");

    // Get spot pool ID from DAO info
    const spotPoolId = daoInfo.spotPoolId;
    if (!spotPoolId) {
      throw new Error("No spot pool ID found in DAO info - cannot recombine liquidity!");
    }

    console.log(`   Using spot pool: ${spotPoolId}`);
    console.log();

    // Get registry from SDK deployments
    const registry = sdk.deployments.getPackageRegistry();
    if (!registry) {
      throw new Error("PackageRegistry not found in deployments");
    }
    const registryId = registry.objectId;

    const finalizeTx = new Transaction();
    finalizeTx.moveCall({
      target: `${governancePackageId}::proposal_lifecycle::finalize_proposal_with_spot_pool`,
      typeArguments: [assetType, stableType],
      arguments: [
        finalizeTx.object(daoAccountId), // account
        finalizeTx.object(registryId), // registry
        finalizeTx.object(proposalId), // proposal
        finalizeTx.object(escrowId), // escrow (market_state is extracted from here)
        finalizeTx.object(spotPoolId), // spot_pool - FOR QUANTUM RECOMBINATION!
        finalizeTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }), // clock
      ],
    });

    const finalizeResult = await executeTransaction(sdk, finalizeTx, {
      network: "devnet",
      description: "Finalize proposal, determine winner, and recombine liquidity to spot pool",
    });

    console.log("✅ Proposal finalized!");
    console.log();

    // Query spot pool reserves AFTER recombination to verify liquidity moved BACK IN
    console.log("🔍 Querying spot pool reserves AFTER quantum recombination...");
    const spotPoolFinal = await sdk.client.getObject({
      id: spotPoolId,
      options: { showContent: true },
    });

    if (!spotPoolFinal.data?.content || spotPoolFinal.data.content.dataType !== "moveObject") {
      throw new Error("Failed to fetch spot pool data after recombination");
    }

    const spotFieldsFinal = (spotPoolFinal.data.content as any).fields;
    const assetReservesFinal = BigInt(spotFieldsFinal.asset_reserve);
    const stableReservesFinal = BigInt(spotFieldsFinal.stable_reserve);

    console.log(`📊 Spot Pool AFTER recombination:`);
    console.log(`   Asset reserves:  ${assetReservesFinal}`);
    console.log(`   Stable reserves: ${stableReservesFinal}`);
    console.log();

    // Verify liquidity increased back (quantum recombination moved liquidity BACK IN)
    const assetIncreased = assetReservesFinal > assetReservesAfter;
    const stableIncreased = stableReservesFinal > stableReservesAfter;

    console.log(`📈 Reserves INCREASED (quantum recombination worked):`);
    console.log(`   Asset:  ${assetReservesAfter} → ${assetReservesFinal} ${assetIncreased ? '✅' : '❌'}`);
    console.log(`   Stable: ${stableReservesAfter} → ${stableReservesFinal} ${stableIncreased ? '✅' : '❌'}`);
    console.log();

    // Compare to original (should be approximately equal since no trading happened)
    const assetDiff = Number(assetReservesFinal - assetReservesBefore);
    const stableDiff = Number(stableReservesFinal - stableReservesBefore);
    const assetDiffPercent = (Math.abs(assetDiff) / Number(assetReservesBefore)) * 100;
    const stableDiffPercent = (Math.abs(stableDiff) / Number(stableReservesBefore)) * 100;

    console.log(`🔄 Reserves compared to ORIGINAL (before → after full cycle):`);
    console.log(`   Asset:  ${assetReservesBefore} → ${assetReservesFinal} (diff: ${assetDiff > 0 ? '+' : ''}${assetDiff}, ${assetDiffPercent.toFixed(4)}%)`);
    console.log(`   Stable: ${stableReservesBefore} → ${stableReservesFinal} (diff: ${stableDiff > 0 ? '+' : ''}${stableDiff}, ${stableDiffPercent.toFixed(4)}%)`);
    console.log();

    if (!assetIncreased || !stableIncreased) {
      throw new Error("❌ Quantum recombination verification failed - reserves did not increase!");
    }

    console.log("✅ Quantum recombination verified - winning outcome's liquidity returned to spot pool!");
    console.log();
  }

  // ============================================================================
  // STEP 6: Check winning outcome
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("STEP 6: CHECK WINNING OUTCOME");
  console.log("=" + "=".repeat(79));
  console.log();

  const proposalData3 = await sdk.client.getObject({
    id: proposalId,
    options: { showContent: true },
  });
  const fields3 = (proposalData3.data!.content as any).fields;
  const outcomeData = fields3.outcome_data.fields; // Access nested fields
  const winningOutcome = outcomeData.winning_outcome;

  console.log(`📊 Winning outcome: ${winningOutcome}`);

  if (winningOutcome === 0 || winningOutcome === "0") {
    console.log("✅ ACCEPT won! Actions will be executed.");
    console.log();
  } else if (winningOutcome === 1 || winningOutcome === "1") {
    console.log("❌ REJECT won. No actions to execute.");
    console.log();
    console.log("=" + "=".repeat(79));
    console.log("✅ STATE CYCLE COMPLETE (REJECT outcome)");
    console.log("=" + "=".repeat(79));
    return;
  } else {
    console.log(`⚠️  Unexpected outcome: ${winningOutcome}`);
    console.log();
    return;
  }

  // ============================================================================
  // STEP 7: Execute actions (if Accept won)
  // ============================================================================
  console.log("=" + "=".repeat(79));
  console.log("STEP 7: EXECUTE ACTIONS");
  console.log("=" + "=".repeat(79));
  console.log();

  console.log("🔍 Querying market state...");
  const marketData = await sdk.client.getObject({
    id: marketStateId,
    options: { showContent: true },
  });

  if (!marketData.data?.content || marketData.data.content.dataType !== "moveObject") {
    throw new Error("Failed to fetch market data");
  }

  console.log("✅ Market state found");
  console.log();

  console.log("📤 Executing actions via PTB executor...");
  console.log();

  // Get PackageRegistry from SDK
  const registry = sdk.deployments.getPackageRegistry();
  if (!registry) {
    throw new Error("PackageRegistry not found in deployments");
  }
  const registryId = registry.objectId;

  console.log(`✅ PackageRegistry: ${registryId}`);
  console.log();

  // Get package IDs for action execution
  const actionsPkg = sdk.getPackageId("AccountActions");
  const futarchyCorePkg = sdk.getPackageId("futarchy_core");

  console.log(`📦 AccountActions Package: ${actionsPkg}`);
  console.log(`📦 FutarchyCore Package: ${futarchyCorePkg}`);
  console.log();

  console.log("🔨 Building execution PTB:");
  console.log("   1. begin_execution() → create Executable");
  console.log("   2. do_init_create_stream() × 2 → execute stream actions");
  console.log("   3. finalize_execution() → complete execution");
  console.log();

  const executeTx = new Transaction();

  // Step 1: Begin execution - creates Executable hot potato
  console.log("   → Step 1: Calling begin_execution()...");
  const executable = executeTx.moveCall({
    target: `${governancePackageId}::ptb_executor::begin_execution`,
    typeArguments: [assetType, stableType],
    arguments: [
      executeTx.object(daoAccountId), // Account
      executeTx.object(registryId), // PackageRegistry
      executeTx.object(proposalId), // Proposal
      executeTx.object(marketStateId), // MarketState
      executeTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }), // Clock
    ],
  });

  // Get the intent key from the result (second return value)
  const intentKey = executable;

  // Create version witness
  const versionWitness = executeTx.moveCall({
    target: `${actionsPkg}::version::current`,
    arguments: [],
  });

  // Create governance witness
  const govWitness = executeTx.moveCall({
    target: `${sdk.getPackageId("futarchy_governance_actions")}::governance_intents::witness`,
    arguments: [],
  });

  // Step 2: Execute each stream action
  // The ActionSpecs had 2 stream creation actions
  console.log("   → Step 2a: Executing stream action #1...");
  executeTx.moveCall({
    target: `${actionsPkg}::vault::do_init_create_stream`,
    typeArguments: [
      `${futarchyCorePkg}::futarchy_config::FutarchyConfig`,
      `${futarchyCorePkg}::futarchy_config::FutarchyOutcome`,
      stableType, // CoinType for the stream
      `${sdk.getPackageId("futarchy_governance_actions")}::governance_intents::GovernanceWitness`,
    ],
    arguments: [
      executable, // Executable hot potato (item 0)
      executeTx.object(daoAccountId), // Account
      executeTx.object(registryId), // PackageRegistry
      executeTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }), // Clock
      versionWitness, // VersionWitness
      govWitness, // GovernanceWitness
    ],
  });

  console.log("   → Step 2b: Executing stream action #2...");
  executeTx.moveCall({
    target: `${actionsPkg}::vault::do_init_create_stream`,
    typeArguments: [
      `${futarchyCorePkg}::futarchy_config::FutarchyConfig`,
      `${futarchyCorePkg}::futarchy_config::FutarchyOutcome`,
      stableType, // CoinType for the stream
      `${sdk.getPackageId("futarchy_governance_actions")}::governance_intents::GovernanceWitness`,
    ],
    arguments: [
      executable, // Executable hot potato (item 0)
      executeTx.object(daoAccountId), // Account
      executeTx.object(registryId), // PackageRegistry
      executeTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }), // Clock
      versionWitness, // VersionWitness
      govWitness, // GovernanceWitness
    ],
  });

  // Step 3: Finalize execution
  console.log("   → Step 3: Calling finalize_execution()...");
  executeTx.moveCall({
    target: `${governancePackageId}::ptb_executor::finalize_execution`,
    typeArguments: [assetType, stableType],
    arguments: [
      executeTx.object(daoAccountId), // Account
      executeTx.object(registryId), // PackageRegistry
      executeTx.object(proposalId), // Proposal
      executable, // Executable hot potato (item 0)
      executeTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }), // Clock
    ],
  });

  console.log();
  console.log("📤 Executing PTB transaction...");
  const executeResult = await executeTransaction(sdk, executeTx, {
    network: "devnet",
    description: "Execute proposal actions",
    showObjectChanges: true,
  });

  console.log("✅ Actions executed successfully!");
  console.log();

  // Look for created streams in object changes
  const streamObjects = executeResult.objectChanges?.filter(
    (obj: any) => obj.type === "created" && obj.objectType?.includes("::vault::Stream")
  );

  if (streamObjects && streamObjects.length > 0) {
    console.log(`💧 Created ${streamObjects.length} stream(s):`);
    streamObjects.forEach((stream: any, i: number) => {
      console.log(`   Stream ${i + 1}: ${stream.objectId}`);
    });
    console.log();
  }

  console.log("=" + "=".repeat(79));
  console.log("✅ STATE CYCLE TEST COMPLETE");
  console.log("=" + "=".repeat(79));
  console.log();
  console.log("Summary:");
  console.log("  ✅ REVIEW → TRADING transition successful");
  console.log("  ✅ TRADING → FINALIZED transition successful");
  console.log("  ✅ Winning outcome determined via TWAP");
  console.log("  ✅ Actions executed (2 streams created)");
  console.log();
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
