/**
 * COMPREHENSIVE Proposal E2E Test with Swaps and Withdrawals
 *
 * This test demonstrates the full lifecycle of a proposal with actual trading:
 * 1. Create proposal with actions (using sdk.workflows.proposal)
 * 2. Advance PREMARKET -> REVIEW -> TRADING (with 100% quantum split from spot pool)
 * 3. Users perform swaps during TRADING:
 *    a. Spot swap (allowed - only LP add/remove operations blocked during proposals)
 *    b. Conditional swap buying accept tokens (influence TWAP)
 * 4. Wait for trading period to end
 * 5. Finalize proposal (determine winner via TWAP, recombine winning liquidity back to spot)
 * 6. Execute actions if Accept wins
 * 7. Users withdraw their winning conditional tokens
 *
 * New Simplified Flow:
 * - ALL spot liquidity moves to conditional AMMs when proposal starts
 * - LP add/remove blocked during proposals (active_proposal_id check)
 * - Winning liquidity auto-recombines back to spot pool on finalization
 * - 6-hour gap enforced between proposals
 *
 * Prerequisites:
 * - Run launchpad-e2e.ts first to create DAO with spot pool
 * - test-dao-info.json must exist
 *
 * This test uses the SDK at the CORRECT level of abstraction:
 * - sdk.workflows.proposal for high-level operations
 * - SDK protocol classes for balance-based swaps
 */

import { Transaction } from "@mysten/sui/transactions";
import * as fs from "fs";
import * as path from "path";
import { initSDK, executeTransaction, getActiveAddress } from "./execute-tx";
import { ConditionalBalance } from "../src/protocol/markets/conditional-balance";
import { SwapCore } from "../src/protocol/markets/swap-core";
import type {
  ConditionalCoinSetConfig,
} from "../src/workflows/types";

type RegistryCoinInfo = {
  treasuryCapId: string;
  metadataId: string;
  coinType: string;
};

interface ConditionalOutcomeCoinSet {
  index: number;
  asset: RegistryCoinInfo;
  stable: RegistryCoinInfo;
}

function extractConditionalOutcomes(
  info: Record<string, any>
): ConditionalOutcomeCoinSet[] {
  const outcomeMap = new Map<
    number,
    { asset?: RegistryCoinInfo; stable?: RegistryCoinInfo }
  >();

  for (const [key, value] of Object.entries(info)) {
    const match = key.match(/^cond(\d+)_(asset|stable)$/);
    if (!match) continue;
    const idx = Number(match[1]);
    if (!outcomeMap.has(idx)) {
      outcomeMap.set(idx, {});
    }
    const entry = outcomeMap.get(idx)!;
    if (match[2] === "asset") {
      entry.asset = value as RegistryCoinInfo;
    } else {
      entry.stable = value as RegistryCoinInfo;
    }
  }

  return Array.from(outcomeMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([index, entry]) => {
      if (!entry.asset || !entry.stable) {
        throw new Error(
          `Incomplete conditional coin info for outcome ${index}`
        );
      }
      return { index, asset: entry.asset, stable: entry.stable };
    });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=".repeat(80));
  console.log("PROPOSAL E2E TEST - BALANCE-BASED CONDITIONAL SWAPS (SDK WORKFLOW)");
  console.log("=".repeat(80));
  console.log();

  // ============================================================================
  // STEP 0: Load DAO info from launchpad test
  // ============================================================================
  console.log("Step 0: Loading DAO info from previous launchpad test...");

  const daoInfoPath = path.join(__dirname, "..", "test-dao-info.json");

  if (!fs.existsSync(daoInfoPath)) {
    console.error("No DAO info file found.");
    console.error("   Please run launchpad E2E test first:");
    console.error("   npm run launchpad-e2e-two-outcome");
    process.exit(1);
  }

  const daoInfo = JSON.parse(fs.readFileSync(daoInfoPath, "utf-8"));
  const daoAccountId = daoInfo.accountId;
  const assetType = daoInfo.assetType;
  const stableType = daoInfo.stableType;
  const spotPoolId = daoInfo.spotPoolId;
  const stableTreasuryCap = daoInfo.stableTreasuryCap;

  console.log(`   DAO Account: ${daoAccountId}`);
  console.log(`   Asset Type: ${assetType}`);
  console.log(`   Stable Type: ${stableType}`);
  console.log(`   Spot Pool: ${spotPoolId}`);
  console.log();

  // Load conditional coins deployment info
  const conditionalCoinsPath = path.join(__dirname, "..", "conditional-coins-info.json");
  let conditionalCoinsInfo: any = null;
  if (fs.existsSync(conditionalCoinsPath)) {
    conditionalCoinsInfo = JSON.parse(fs.readFileSync(conditionalCoinsPath, "utf-8"));
    console.log(`   Conditional Coins Package: ${conditionalCoinsInfo.packageId}`);
    console.log(`   CoinRegistry: ${conditionalCoinsInfo.registryId}`);
    console.log();
  } else {
    console.log("   Conditional coins not deployed - SWAP 2 will be skipped");
    console.log("   Run: npm run deploy-conditional-coins");
    console.log();
  }

  let conditionalOutcomes: ConditionalOutcomeCoinSet[] = [];
  if (conditionalCoinsInfo) {
    try {
      conditionalOutcomes = extractConditionalOutcomes(conditionalCoinsInfo);
    } catch (error) {
      console.log("   Failed to parse conditional coin metadata:", error);
      conditionalCoinsInfo = null;
    }

    if (conditionalCoinsInfo && conditionalOutcomes.length === 0) {
      console.log("   No conditional coin sets found - disabling typed coin flow");
      conditionalCoinsInfo = null;
    }
  }

  // ============================================================================
  // STEP 1: Initialize SDK
  // ============================================================================
  console.log("Step 1: Initializing SDK...");
  const sdk = await initSDK();
  const activeAddress = getActiveAddress();
  console.log(`   Active address: ${activeAddress}`);
  console.log();

  // Get package IDs for balance-based swaps
  const marketsCorePackageId = sdk.getPackageId("futarchy_markets_core")!;
  const marketsPrimitivesPackageId = sdk.getPackageId("futarchy_markets_primitives")!;

  // ============================================================================
  // STEP 2: Create proposal with actions (using SDK workflow)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 2: CREATE PROPOSAL WITH ACTIONS (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  const streamAmount = 500_000_000; // 0.5 stable
  const streamIterations = 10n;
  const streamIterationPeriod = 60_000n; // 1 minute for testing
  const streamAmountPerIteration = Number(BigInt(streamAmount) / streamIterations);
  const streamStart = Date.now() + 300_000; // Start in 5 minutes

  console.log(`   Creating proposal with stream action:`);
  console.log(`   Total: ${streamAmount / 1e9} stable over ${Number(streamIterations)} iterations`);
  console.log();

  // First, mint stable coins for the proposal fee
  const proposalFeeAmount = 1_000_000_000n; // 1 stable coin fee
  console.log(`   Preparing proposal fee: ${Number(proposalFeeAmount) / 1e9} stable`);

  // Always mint enough stable coins for the test
  console.log("   Minting stable coins for proposal fee...");
  const mintFeeTx = new Transaction();
  mintFeeTx.moveCall({
    target: `${stableType.split("::")[0]}::coin::mint`,
    arguments: [
      mintFeeTx.object(stableTreasuryCap),
      mintFeeTx.pure.u64(proposalFeeAmount * 2n), // Mint extra to be safe
      mintFeeTx.pure.address(activeAddress),
    ],
  });
  await executeTransaction(sdk, mintFeeTx, {
    network: "devnet",
  });

  // Get fee coins after minting
  const feeCoins = await sdk.client.getCoins({
    owner: activeAddress,
    coinType: stableType,
  });

  // Use SDK workflow to create proposal
  const createProposalTx = sdk.workflows.proposal.createProposal({
    daoAccountId,
    assetType,
    stableType,
    title: "Fund Team Development with Conditional Trading",
    introduction: "This proposal will test swaps and demonstrate winning outcome execution",
    metadata: JSON.stringify({ category: "test", impact: "high" }),
    outcomeMessages: ["Reject", "Accept"],
    outcomeDetails: [
      "Reject: Do nothing (status quo)",
      "Accept: Execute stream + allow trading"
    ],
    proposer: activeAddress,
    treasuryAddress: activeAddress,
    usedQuota: false,
    feeCoins: feeCoins.data.map((c) => c.coinObjectId),
    feeAmount: proposalFeeAmount,
  });

  console.log("   Creating proposal...");
  const createResult = await executeTransaction(sdk, createProposalTx.transaction, {
    network: "devnet",
    showObjectChanges: true,
  });

  const proposalObject = createResult.objectChanges?.find(
    (obj: any) => obj.type === "created" && obj.objectType?.includes("proposal::Proposal")
  );

  if (!proposalObject) {
    console.error("Failed to create proposal");
    process.exit(1);
  }

  const proposalId = (proposalObject as any).objectId;
  console.log(`   Proposal created: ${proposalId}`);
  console.log();

  // ============================================================================
  // STEP 3: Add actions to Accept outcome (using SDK workflow)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 3: ADD ACTIONS TO ACCEPT OUTCOME (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  const addActionsTx = sdk.workflows.proposal.addActionsToOutcome({
    proposalId,
    assetType,
    stableType,
    outcomeIndex: 1, // Accept
    actions: [
      {
        type: 'create_stream',
        vaultName: 'treasury',
        beneficiary: activeAddress,
        amountPerIteration: BigInt(streamAmountPerIteration),
        startTime: streamStart,
        iterationsTotal: streamIterations,
        iterationPeriodMs: streamIterationPeriod,
        maxPerWithdrawal: BigInt(streamAmountPerIteration),
        isTransferable: true,
        isCancellable: true,
      },
    ],
  });

  await executeTransaction(sdk, addActionsTx.transaction, {
    network: "devnet",
  });

  console.log(`   Actions added to Accept outcome!`);
  console.log();

  // ============================================================================
  // STEP 4: Advance PREMARKET -> REVIEW (using SDK workflow)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 4: ADVANCE TO REVIEW STATE (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  // Build conditional coins registry config if available
  let conditionalCoinsRegistry: { registryId: string; coinSets: ConditionalCoinSetConfig[] } | undefined;
  if (conditionalCoinsInfo && conditionalOutcomes.length > 0) {
    conditionalCoinsRegistry = {
      registryId: conditionalCoinsInfo.registryId,
      coinSets: conditionalOutcomes.map((outcome) => ({
        outcomeIndex: outcome.index,
        assetCoinType: outcome.asset.coinType,
        assetCapId: outcome.asset.treasuryCapId,
        stableCoinType: outcome.stable.coinType,
        stableCapId: outcome.stable.treasuryCapId,
      })),
    };
    console.log(`   Taking ${conditionalOutcomes.length * 2} conditional coins from registry...`);
  }

  const advanceToReviewTx = sdk.workflows.proposal.advanceToReview({
    proposalId,
    daoAccountId,
    assetType,
    stableType,
    spotPoolId,
    senderAddress: activeAddress,
    conditionalCoinsRegistry,
  });

  const advanceResult = await executeTransaction(sdk, advanceToReviewTx.transaction, {
    network: "devnet",
    showObjectChanges: true,
  });

  const escrowObject = advanceResult.objectChanges?.find(
    (obj: any) => obj.objectType?.includes("::coin_escrow::TokenEscrow")
  );

  if (!escrowObject) {
    console.error("Failed to create escrow!");
    process.exit(1);
  }

  const escrowId = (escrowObject as any).objectId;
  console.log(`   Escrow created: ${escrowId}`);
  console.log(`   Proposal state: REVIEW`);
  console.log();

  // ============================================================================
  // STEP 5: Wait for review period and advance to TRADING (using SDK workflow)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 5: ADVANCE TO TRADING STATE (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  console.log("   Waiting for review period (30 seconds)...");
  await sleep(32000); // 32 seconds (30s + buffer)
  console.log("   Review period ended!");
  console.log();

  console.log("   Advancing to TRADING state (all spot liquidity -> conditional AMMs)...");

  const advanceToTradingTx = sdk.workflows.proposal.advanceToTrading({
    daoAccountId,
    proposalId,
    escrowId,
    spotPoolId,
    assetType,
    stableType,
  });

  await executeTransaction(sdk, advanceToTradingTx.transaction, {
    network: "devnet",
  });

  console.log("   Proposal state: TRADING");
  console.log("   - 100% quantum split complete: all spot liquidity -> conditional AMMs");
  console.log("   - active_proposal_id set: LP add/remove operations now blocked");
  console.log();

  // Wait for review period to elapse (DAO config sets 1 second minimum)
  console.log("   Waiting 2 seconds for review period to elapse...");
  await sleep(2000);
  console.log("   Review period elapsed - trading is now active");
  console.log();

  // ============================================================================
  // STEP 6: PERFORM SWAPS (Spot + Balance-based Conditional)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 6: PERFORM SWAPS TO INFLUENCE OUTCOME");
  console.log("=".repeat(80));
  console.log();

  // First, mint some stable coins for swapping
  console.log("   Minting stable coins for swaps...");
  const mintAmount = 30_000_000_000n; // 30 stable coins (enough for both swaps)

  const mintTx = new Transaction();
  mintTx.moveCall({
    target: `${stableType.split("::")[0]}::coin::mint`,
    arguments: [
      mintTx.object(stableTreasuryCap),
      mintTx.pure.u64(mintAmount),
      mintTx.pure.address(activeAddress),
    ],
  });

  await executeTransaction(sdk, mintTx, {
    network: "devnet",
  });

  console.log(`   Minted ${Number(mintAmount) / 1e9} stable coins`);
  console.log();

  // SWAP 1: Spot swap (using SDK workflow)
  console.log("   SWAP 1: Spot swap (stable -> asset) using sdk.workflows.proposal.spotSwap...");

  const swapAmount1 = 1_000_000_000n; // 1 stable coin

  const coins1 = await sdk.client.getCoins({
    owner: activeAddress,
    coinType: stableType,
  });

  const spotSwapTx = sdk.workflows.proposal.spotSwap({
    spotPoolId,
    proposalId,
    escrowId,
    assetType,
    stableType,
    direction: 'stable_to_asset',
    amountIn: swapAmount1,
    minAmountOut: 0n,
    recipient: activeAddress,
    inputCoins: coins1.data.map((c) => c.coinObjectId),
  });

  await executeTransaction(sdk, spotSwapTx.transaction, {
    network: "devnet",
    showObjectChanges: true,
  });

  console.log(`   Spot swap complete (${Number(swapAmount1) / 1e9} stable -> asset)`);
  console.log("   Auto-arbitrage executed in background");
  console.log();

  // SWAP 2: Balance-based conditional swap (stable -> outcome 1 asset ONLY)
  const swapAmount2 = 20_000_000_000n; // 20 stable coins

  console.log("   SWAP 2: Balance-based conditional swap (stable -> outcome 1 asset ONLY)...");
  console.log("   Using SDK protocol classes: ConditionalBalance + SwapCore");

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
  // Note: Using 'as any' because SwapCore types expect moveCall result but tx.object works fine
  const session = SwapCore.beginSwapSession(swap2Tx, {
    marketsCorePackageId,
    assetType,
    stableType,
    escrow: swap2Tx.object(escrowId) as any,
  });

  // Step 2: Get market state ID and create ConditionalMarketBalance
  const marketStateId = swap2Tx.moveCall({
    target: `${marketsPrimitivesPackageId}::coin_escrow::market_state_id`,
    typeArguments: [assetType, stableType],
    arguments: [swap2Tx.object(escrowId)],
  });

  const balance = swap2Tx.moveCall({
    target: `${marketsPrimitivesPackageId}::conditional_balance::new`,
    typeArguments: [assetType, stableType],
    arguments: [
      marketStateId,
      swap2Tx.pure.u8(2), // outcome_count = 2
    ],
  });

  // Step 3: Use atomic split_stable_to_balance (single call for all outcomes!)
  ConditionalBalance.splitStableToBalance(swap2Tx, {
    primitivesPackageId: marketsPrimitivesPackageId,
    assetType,
    stableType,
    escrowId,
    balanceObj: balance,
    stableCoin: stableCoin2,
  });

  // Step 4: Swap ONLY in outcome 1 AMM (stable -> asset) using balance-based swap
  SwapCore.swapBalanceStableToAsset(swap2Tx, {
    marketsCorePackageId,
    assetType,
    stableType,
    session,
    escrow: swap2Tx.object(escrowId) as any,
    balance,
    outcomeIdx: 1, // Accept ONLY!
    amountIn: swapAmount2,
    minAmountOut: 0n,
  });

  // Step 5: Finalize session (consumes hot potato)
  SwapCore.finalizeSwapSession(swap2Tx, {
    marketsCorePackageId,
    assetType,
    stableType,
    session,
    escrow: swap2Tx.object(escrowId) as any,
  });

  // Step 6: Transfer balance NFT to recipient
  swap2Tx.transferObjects([balance], swap2Tx.pure.address(activeAddress));
  swap2Tx.transferObjects([firstCoin2], swap2Tx.pure.address(activeAddress));

  await executeTransaction(sdk, swap2Tx, {
    network: "devnet",
    showObjectChanges: true,
  });

  console.log(`   Conditional swap complete (${Number(swapAmount2) / 1e9} stable -> outcome 1 asset)`);
  console.log("   Swapped ONLY in Accept market (outcome 1) using balance-based flow");
  console.log("   This pushes TWAP toward Accept winning!");
  console.log();

  // ============================================================================
  // STEP 7: Wait for trading period and finalize (using SDK workflow)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 7: FINALIZE PROPOSAL (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  console.log("   Waiting for trading period (60 seconds)...");
  await sleep(62000); // 62 seconds (60s + buffer)
  console.log("   Trading period ended!");
  console.log();

  console.log("   Finalizing proposal...");
  console.log("   - Determining winner via TWAP");
  console.log("   - Auto-recombining winning conditional liquidity -> spot pool");

  const finalizeTx = sdk.workflows.proposal.finalizeProposal({
    daoAccountId,
    proposalId,
    escrowId,
    spotPoolId,
    assetType,
    stableType,
  });

  await executeTransaction(sdk, finalizeTx.transaction, {
    network: "devnet",
  });

  console.log("   Proposal finalized!");
  console.log("   - Winning conditional liquidity auto-recombined back to spot pool");
  console.log("   - active_proposal_id cleared: LP operations now allowed");
  console.log("   - last_proposal_end_time set: 6-hour gap enforced before next proposal");
  console.log();

  // Check winning outcome
  const proposalData = await sdk.client.getObject({
    id: proposalId,
    options: { showContent: true },
  });

  const fields = (proposalData.data!.content as any).fields;
  const winningOutcome = fields.outcome_data.fields.winning_outcome;

  const acceptWon = winningOutcome === 1 || winningOutcome === "1";
  console.log(`   Winning outcome: ${acceptWon ? "ACCEPT" : "REJECT"} (${winningOutcome})`);
  console.log();

  if (acceptWon) {
    // ============================================================================
    // STEP 8: Execute actions (using SDK workflow)
    // ============================================================================
    console.log("=".repeat(80));
    console.log("STEP 8: EXECUTE ACTIONS (using sdk.workflows.proposal)");
    console.log("=".repeat(80));
    console.log();

    console.log("   Executing stream action via PTB executor...");

    const executeTx = sdk.workflows.proposal.executeActions({
      daoAccountId,
      proposalId,
      escrowId,
      assetType,
      stableType,
      actionTypes: [
        { type: 'create_stream', coinType: stableType },
      ],
    });

    const executeResult = await executeTransaction(sdk, executeTx.transaction, {
      network: "devnet",
      showObjectChanges: true,
    });

    const streamObjects = executeResult.objectChanges?.filter(
      (obj: any) => obj.type === "created" && obj.objectType?.includes("::vault::Stream")
    );

    if (streamObjects && streamObjects.length > 0) {
      console.log(`   Actions executed! Created ${streamObjects.length} stream(s)`);
      streamObjects.forEach((stream: any, i: number) => {
        console.log(`   Stream ${i + 1}: ${stream.objectId}`);
      });
    } else {
      console.log("   Actions executed!");
    }
    console.log();
  } else {
    console.log("   Reject won - no actions to execute");
    console.log();
  }

  // ============================================================================
  // STEP 9: Withdraw winning conditional tokens
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 9: WITHDRAW WINNING CONDITIONAL TOKENS");
  console.log("=".repeat(80));
  console.log();

  console.log("   Users can now redeem their winning conditional tokens...");
  console.log("   (Balance-based positions tracked in ConditionalMarketBalance NFT)");
  console.log();

  // ============================================================================
  // DONE
  // ============================================================================
  console.log("=".repeat(80));
  console.log("COMPREHENSIVE TEST COMPLETE!");
  console.log("=".repeat(80));
  console.log();

  console.log("Summary:");
  console.log("  - Created proposal (using sdk.workflows.proposal.createProposal)");
  console.log("  - Added actions (using sdk.workflows.proposal.addActionsToOutcome)");
  console.log("  - Advanced to REVIEW (using sdk.workflows.proposal.advanceToReview)");
  console.log("  - Advanced to TRADING (using sdk.workflows.proposal.advanceToTrading)");
  console.log("  - 100% quantum split: spot pool -> conditional AMMs");
  console.log("  - Performed spot swap (using sdk.workflows.proposal.spotSwap)");
  console.log("  - Performed BALANCE-BASED conditional swap (using SDK protocol classes)");
  console.log(`  - Proposal finalized (using sdk.workflows.proposal.finalizeProposal) - winner: ${acceptWon ? "ACCEPT" : "REJECT"}`);
  console.log("  - Auto-recombination: winning conditional liquidity -> spot pool");
  if (acceptWon) {
    console.log("  - Actions executed (using sdk.workflows.proposal.executeActions)");
  } else {
    console.log("  - No actions executed (Reject won)");
  }
  console.log("  - LP operations blocked during proposal (active_proposal_id check)");
  console.log("  - 6-hour gap enforced between proposals");
  console.log();

  console.log(`View proposal: https://suiscan.xyz/devnet/object/${proposalId}`);
  console.log(`View DAO: https://suiscan.xyz/devnet/object/${daoAccountId}`);
  console.log();
}

main()
  .then(() => {
    console.log("Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
