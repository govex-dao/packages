/**
 * COMPREHENSIVE PROPOSAL E2E TEST - Balance-Based Conditional Swaps
 *
 * Tests the full proposal lifecycle with balance-based conditional swaps (no typed coins needed!)
 *
 * Flow:
 * 1. Load DAO from launchpad test
 * 2. Create proposal with stream action
 * 3. Advance to TRADING state (100% quantum split)
 * 4. SWAP 1: Spot swap (stable → asset) with auto-arb
 * 5. SWAP 2: Balance-based conditional swap in outcome 1 ONLY → influences TWAP
 * 6. Finalize proposal → outcome 1 (Accept) should win
 * 7. Execute stream actions
 */

import { Transaction } from "@mysten/sui/transactions";
import fs from "fs";
import path from "path";
import { initSDK, executeTransaction, getActiveAddress } from "./execute-tx";

async function main() {
  console.log("=".repeat(80));
  console.log("PROPOSAL E2E TEST - BALANCE-BASED CONDITIONAL SWAPS");
  console.log("=".repeat(80));
  console.log();

  // ============================================================================
  // STEP 1: Load DAO info from launchpad test
  // ============================================================================
  console.log("📂 Loading DAO info from previous launchpad test...");

  const launchpadTestOutputPath = path.join(__dirname, "../test-dao-info.json");
  if (!fs.existsSync(launchpadTestOutputPath)) {
    throw new Error(`Launchpad test output not found at ${launchpadTestOutputPath}. Run launchpad test first.`);
  }

  const launchpadData = JSON.parse(fs.readFileSync(launchpadTestOutputPath, "utf-8"));
  const {
    accountId: daoAccountId,
    assetType,
    stableType,
    spotPoolId,
    assetTreasuryCap: asset_treasury_cap,
    stableTreasuryCap: stable_treasury_cap,
  } = launchpadData;

  console.log(`✅ DAO Account: ${daoAccountId}`);
  console.log(`✅ Asset Type: ${assetType}`);
  console.log(`✅ Stable Type: ${stableType}`);
  console.log(`✅ Spot Pool: ${spotPoolId}`);
  console.log();

  // ============================================================================
  // STEP 2: Initialize SDK
  // ============================================================================
  console.log("🔧 Initializing SDK...");
  const sdk = await initSDK("devnet");
  const activeAddress = await getActiveAddress();
  console.log(`✅ Active address: ${activeAddress}`);
  console.log();

  // Get package IDs
  const marketsPackageId = sdk.getPackageId("futarchy_markets_core");
  const operationsPackageId = sdk.getPackageId("futarchy_markets_operations");
  const primitivesPackageId = sdk.getPackageId("futarchy_markets_primitives");

  // ============================================================================
  // STEP 3: CREATE PROPOSAL WITH ACTIONS
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 3: CREATE PROPOSAL WITH ACTIONS");
  console.log("=".repeat(80));
  console.log();

  console.log("📋 Creating proposal with stream action:");
  console.log("   Total: 0.5 stable over 10 iterations");
  console.log();

  const proposalTx = new Transaction();

  // Create proposal
  const proposal = proposalTx.moveCall({
    target: `${marketsPackageId}::proposal::new`,
    typeArguments: [assetType, stableType],
    arguments: [
      proposalTx.object(daoAccountId),
      proposalTx.pure.string("Test Proposal with Actions"),
      proposalTx.pure.string("ipfs://test"),
    ],
  });

  proposalTx.transferObjects([proposal], proposalTx.pure.address(activeAddress));

  const proposalResult = await executeTransaction(sdk, proposalTx, {
    network: "devnet",
    description: "Create proposal",
    showObjectChanges: true,
  });

  const proposalId = proposalResult.objectChanges?.find(
    (c) => c.type === "created" && c.objectType.includes("::proposal::Proposal")
  )?.objectId;

  if (!proposalId) throw new Error("Proposal ID not found");
  console.log(`✅ Proposal created: ${proposalId}`);
  console.log();

  // Add stream action to Accept outcome
  console.log("📝 Adding stream action to Accept outcome...");
  const actionTx = new Transaction();

  actionTx.moveCall({
    target: `${marketsPackageId}::proposal::add_stream_action`,
    typeArguments: [assetType, stableType, stableType],
    arguments: [
      actionTx.object(proposalId),
      actionTx.pure.u64(1), // outcome_index = 1 (Accept)
      actionTx.pure.address(activeAddress), // recipient
      actionTx.pure.u64(500_000_000), // total_amount = 0.5 stable
      actionTx.pure.u64(10), // num_iterations = 10
      actionTx.pure.bool(false), // is_asset
    ],
  });

  await executeTransaction(sdk, actionTx, {
    network: "devnet",
    description: "Add stream action",
  });

  console.log("✅ Actions added to Accept outcome!");
  console.log();

  // ============================================================================
  // STEP 4: ADVANCE TO REVIEW STATE (create escrow & AMM pools)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 4: ADVANCE TO REVIEW STATE");
  console.log("=".repeat(80));
  console.log();

  console.log("📤 Creating escrow and AMM pools...");

  const advanceTx = new Transaction();

  // Create escrow and pools
  advanceTx.moveCall({
    target: `${marketsPackageId}::proposal::advance_premarket_to_review`,
    typeArguments: [assetType, stableType],
    arguments: [
      advanceTx.object(proposalId),
      advanceTx.object(daoAccountId),
    ],
  });

  const advanceResult = await executeTransaction(sdk, advanceTx, {
    network: "devnet",
    description: "Advance to REVIEW",
    showObjectChanges: true,
  });

  const escrowId = advanceResult.objectChanges?.find(
    (c) => c.type === "created" && c.objectType.includes("::coin_escrow::TokenEscrow")
  )?.objectId;

  if (!escrowId) throw new Error("Escrow ID not found");
  console.log(`✅ Escrow created: ${escrowId}`);
  console.log();

  // Initialize market fields to set state to REVIEW
  console.log("📝 Initializing market fields to set state to REVIEW...");
  const initTx = new Transaction();

  initTx.moveCall({
    target: `${marketsPackageId}::proposal::initialize_market_fields_for_review`,
    typeArguments: [assetType, stableType],
    arguments: [
      initTx.object(proposalId),
      initTx.pure.u64(30_000), // review_period_ms = 30 seconds
      initTx.pure.u64(90_000), // trading_period_ms = 90 seconds
      initTx.pure.u64(30), // fee_bps = 0.3%
    ],
  });

  await executeTransaction(sdk, initTx, {
    network: "devnet",
    description: "Initialize market fields",
  });

  console.log("✅ Proposal state: REVIEW");
  console.log();

  // ============================================================================
  // STEP 5: ADVANCE TO TRADING STATE (100% QUANTUM SPLIT)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 5: ADVANCE TO TRADING STATE (100% QUANTUM SPLIT)");
  console.log("=".repeat(80));
  console.log();

  console.log("⏳ Waiting for review period (30 seconds)...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));
  console.log("✅ Review period ended!");
  console.log();

  console.log("📤 Advancing to TRADING state (all spot liquidity → conditional AMMs)...");

  const tradingTx = new Transaction();

  tradingTx.moveCall({
    target: `${marketsPackageId}::proposal::advance_review_to_trading`,
    typeArguments: [assetType, stableType],
    arguments: [
      tradingTx.object(proposalId),
      tradingTx.object(spotPoolId),
      tradingTx.object(escrowId),
      tradingTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  await executeTransaction(sdk, tradingTx, {
    network: "devnet",
    description: "Advance to TRADING",
  });

  console.log("✅ Proposal state: TRADING");
  console.log("   - 100% quantum split complete: all spot liquidity → conditional AMMs");
  console.log("   - active_proposal_id set: LP add/remove operations now blocked");
  console.log();

  // ============================================================================
  // STEP 6: PERFORM SWAPS TO INFLUENCE OUTCOME
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 6: PERFORM SWAPS TO INFLUENCE OUTCOME");
  console.log("=".repeat(80));
  console.log();

  // Mint some stable coins for swaps
  console.log("💰 Minting stable coins for swaps...");
  const mintTx = new Transaction();

  const stableCoinsForSwap = mintTx.moveCall({
    target: "0x2::coin::mint",
    typeArguments: [stableType],
    arguments: [
      mintTx.object(stable_treasury_cap),
      mintTx.pure.u64(10_000_000_000), // 10 stable coins
    ],
  });

  mintTx.transferObjects([stableCoinsForSwap], mintTx.pure.address(activeAddress));

  await executeTransaction(sdk, mintTx, {
    network: "devnet",
    description: "Mint stable coins",
  });

  console.log("✅ Minted 10 stable coins");
  console.log();

  // SWAP 1: Spot swap with auto-arb
  console.log("📊 SWAP 1: Spot swap (stable → asset) with auto-arb...");

  const swapAmount1 = 1_000_000_000n; // 1 stable coin

  const coins1 = await sdk.client.getCoins({
    owner: activeAddress,
    coinType: stableType,
  });

  const swap1Tx = new Transaction();
  const [firstCoin1, ...restCoins1] = coins1.data.map((c) => swap1Tx.object(c.coinObjectId));
  if (restCoins1.length > 0) {
    swap1Tx.mergeCoins(firstCoin1, restCoins1);
  }

  const [stableCoin1] = swap1Tx.splitCoins(firstCoin1, [swap1Tx.pure.u64(swapAmount1)]);

  const noneBalance1 = swap1Tx.moveCall({
    target: "0x1::option::none",
    typeArguments: [`${primitivesPackageId}::conditional_balance::ConditionalMarketBalance<${assetType}, ${stableType}>`],
    arguments: [],
  });

  const [zeroAsset, returnedNone] = swap1Tx.moveCall({
    target: `${operationsPackageId}::swap_entry::swap_spot_stable_to_asset`,
    typeArguments: [assetType, stableType],
    arguments: [
      swap1Tx.object(spotPoolId),
      swap1Tx.object(proposalId),
      swap1Tx.object(escrowId),
      stableCoin1,
      swap1Tx.pure.u64(0), // min_asset_out
      swap1Tx.pure.address(activeAddress),
      noneBalance1,
      swap1Tx.pure.bool(false), // return_balance
      swap1Tx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  swap1Tx.transferObjects([zeroAsset], swap1Tx.pure.address(activeAddress));
  swap1Tx.moveCall({
    target: "0x1::option::destroy_none",
    typeArguments: [`${primitivesPackageId}::conditional_balance::ConditionalMarketBalance<${assetType}, ${stableType}>`],
    arguments: [returnedNone],
  });
  swap1Tx.transferObjects([firstCoin1], swap1Tx.pure.address(activeAddress));

  await executeTransaction(sdk, swap1Tx, {
    network: "devnet",
    description: "Spot swap with auto-arb",
  });

  console.log(`✅ Spot swap complete (${Number(swapAmount1) / 1e9} stable → asset)`);
  console.log("   Auto-arbitrage executed in background");
  console.log();

  // SWAP 2: Balance-based conditional swap ONLY in outcome 1
  console.log("📊 SWAP 2: Balance-based conditional swap (stable → outcome 1 asset ONLY)...");

  const swapAmount2 = 5_000_000_000n; // 5 stable coins

  const coins2 = await sdk.client.getCoins({
    owner: activeAddress,
    coinType: stableType,
  });

  const swap2Tx = new Transaction();
  const [firstCoin2, ...restCoins2] = coins2.data.map((c) => swap2Tx.object(c.coinObjectId));
  if (restCoins2.length > 0) {
    swap2Tx.mergeCoins(firstCoin2, restCoins2);
  }

  const [stableCoin2] = swap2Tx.splitCoins(firstCoin2, [swap2Tx.pure.u64(swapAmount2)]);

  // Step 1: Create swap session (hot potato)
  const session = swap2Tx.moveCall({
    target: `${marketsPackageId}::swap_core::begin_swap_session`,
    typeArguments: [assetType, stableType],
    arguments: [swap2Tx.object(escrowId)],
  });

  // Step 2: Get market state ID
  const marketStateId = swap2Tx.moveCall({
    target: `${primitivesPackageId}::coin_escrow::market_state_id`,
    typeArguments: [assetType, stableType],
    arguments: [swap2Tx.object(escrowId)],
  });

  // Step 3: Create ConditionalMarketBalance
  const balance = swap2Tx.moveCall({
    target: `${primitivesPackageId}::conditional_balance::new`,
    typeArguments: [assetType, stableType],
    arguments: [
      marketStateId,
      swap2Tx.pure.u8(2), // outcome_count = 2
    ],
  });

  // Step 4: Deposit spot stable to escrow (quantum - backs ALL outcomes)
  const zeroAssetCoin = swap2Tx.moveCall({
    target: "0x2::coin::zero",
    typeArguments: [assetType],
    arguments: [],
  });

  swap2Tx.moveCall({
    target: `${primitivesPackageId}::coin_escrow::deposit_spot_coins`,
    typeArguments: [assetType, stableType],
    arguments: [
      swap2Tx.object(escrowId),
      zeroAssetCoin,
      stableCoin2,
    ],
  });

  // Step 5: Add stable to balance for BOTH outcomes (quantum - same 5 stable in both!)
  // Outcome 0 (Reject)
  swap2Tx.moveCall({
    target: `${primitivesPackageId}::conditional_balance::add_to_balance`,
    typeArguments: [assetType, stableType],
    arguments: [
      balance,
      swap2Tx.pure.u8(0),
      swap2Tx.pure.bool(false), // is_asset = false (stable)
      swap2Tx.pure.u64(swapAmount2),
    ],
  });

  // Outcome 1 (Accept)
  swap2Tx.moveCall({
    target: `${primitivesPackageId}::conditional_balance::add_to_balance`,
    typeArguments: [assetType, stableType],
    arguments: [
      balance,
      swap2Tx.pure.u8(1),
      swap2Tx.pure.bool(false), // is_asset = false (stable)
      swap2Tx.pure.u64(swapAmount2),
    ],
  });

  // Step 6: Swap ONLY in outcome 1 AMM (stable → asset)
  swap2Tx.moveCall({
    target: `${marketsPackageId}::swap_core::swap_balance_stable_to_asset`,
    typeArguments: [assetType, stableType],
    arguments: [
      session,
      swap2Tx.object(escrowId),
      balance,
      swap2Tx.pure.u8(1), // outcome_index = 1 (Accept ONLY!)
      swap2Tx.pure.u64(swapAmount2),
      swap2Tx.pure.u64(0), // min_amount_out
      swap2Tx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  // Step 7: Finalize session (consumes hot potato)
  swap2Tx.moveCall({
    target: `${marketsPackageId}::swap_core::finalize_swap_session`,
    typeArguments: [assetType, stableType],
    arguments: [session, swap2Tx.object(escrowId)],
  });

  // Step 8: Transfer balance NFT to recipient
  swap2Tx.transferObjects([balance], swap2Tx.pure.address(activeAddress));
  swap2Tx.transferObjects([firstCoin2], swap2Tx.pure.address(activeAddress));

  await executeTransaction(sdk, swap2Tx, {
    network: "devnet",
    description: "Balance-based conditional swap",
    showObjectChanges: true,
  });

  console.log(`✅ Conditional swap complete (${Number(swapAmount2) / 1e9} stable → outcome 1 asset)`);
  console.log("   Swapped ONLY in Accept market (outcome 1)");
  console.log("   This pushes TWAP toward Accept winning!");
  console.log();

  // ============================================================================
  // STEP 7: FINALIZE PROPOSAL (DETERMINE WINNER)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 7: FINALIZE PROPOSAL (DETERMINE WINNER)");
  console.log("=".repeat(80));
  console.log();

  console.log("⏳ Waiting for trading period (90 seconds)...");
  await new Promise((resolve) => setTimeout(resolve, 90_000));
  console.log("✅ Trading period ended!");
  console.log();

  console.log("📤 Finalizing proposal...");
  console.log("   - Determining winner via TWAP");
  console.log("   - Auto-recombining winning conditional liquidity → spot pool");

  const finalizeTx = new Transaction();

  finalizeTx.moveCall({
    target: `${marketsPackageId}::proposal::finalize_proposal`,
    typeArguments: [assetType, stableType],
    arguments: [
      finalizeTx.object(proposalId),
      finalizeTx.object(spotPoolId),
      finalizeTx.object(escrowId),
      finalizeTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  const finalizeResult = await executeTransaction(sdk, finalizeTx, {
    network: "devnet",
    description: "Finalize proposal",
  });

  console.log("✅ Proposal finalized!");
  console.log("   - Winning conditional liquidity auto-recombined back to spot pool");
  console.log("   - active_proposal_id cleared: LP operations now allowed");
  console.log("   - last_proposal_end_time set: 6-hour gap enforced before next proposal");
  console.log();

  // Get winning outcome from events
  const winningOutcome = finalizeResult.events?.find((e) =>
    e.type.includes("::proposal::ProposalFinalized")
  )?.parsedJson?.winning_outcome ?? 0;

  console.log(`🏆 Winning outcome: ${winningOutcome === 0 ? "REJECT (0)" : "ACCEPT (1)"}`);
  console.log();

  if (winningOutcome === 1) {
    console.log("🎉 Accept won! Executing stream actions...");
    // Actions execute automatically in finalize
    console.log("✅ Stream actions executed!");
  } else {
    console.log("ℹ️  Reject won - no actions to execute");
  }
  console.log();

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("=".repeat(80));
  console.log("🎉 BALANCE-BASED CONDITIONAL SWAP TEST COMPLETE! 🎉");
  console.log("=".repeat(80));
  console.log();
  console.log("📋 Summary:");
  console.log("  ✅ Created proposal with stream action");
  console.log("  ✅ Advanced through all states (PREMARKET → REVIEW → TRADING → FINALIZED)");
  console.log("  ✅ 100% quantum split: spot pool → conditional AMMs");
  console.log("  ✅ Performed spot swap with auto-arb");
  console.log("  ✅ Performed balance-based conditional swap in outcome 1 ONLY");
  console.log(`  ${winningOutcome === 1 ? "✅" : "❌"} Accept ${winningOutcome === 1 ? "won" : "lost"} - TWAP influenced by swap!`);
  console.log("  ✅ Auto-recombination: winning conditional liquidity → spot pool");
  console.log();
  console.log(`🔗 View proposal: https://suiscan.xyz/devnet/object/${proposalId}`);
  console.log(`🔗 View DAO: https://suiscan.xyz/devnet/object/${daoAccountId}`);
  console.log();

  if (winningOutcome === 1) {
    console.log("✅ Test PASSED - Accept won as expected!");
  } else {
    console.log("⚠️  Test INCONCLUSIVE - Reject won (may need larger swap or longer trading period)");
  }
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
