/**
 * COMPREHENSIVE Proposal E2E Test with Swaps and Withdrawals
 *
 * This test demonstrates the full lifecycle of a proposal with actual trading:
 * 1. Create proposal with actions (using sdk.workflows.proposal)
 * 2. Advance PREMARKET → REVIEW → TRADING (with 100% quantum split from spot pool)
 * 3. Users perform swaps during TRADING:
 *    a. Spot swap (allowed - only LP add/remove operations blocked during proposals)
 *    b. Conditional swap buying accept tokens (influence TWAP)
 * 4. Wait for trading period to end
 * 5. Finalize proposal (determine winner via TWAP, recombine winning liquidity back to spot)
 * 6. Execute actions if Accept wins
 * 7. Users withdraw their winning conditional tokens
 *
 * This test demonstrates proper SDK usage with the ProposalWorkflow class.
 *
 * Prerequisites:
 * - Run launchpad-e2e.ts first to create DAO with spot pool
 * - test-dao-info.json must exist
 */

import { Transaction } from "@mysten/sui/transactions";
import * as fs from "fs";
import * as path from "path";
import { TransactionUtils } from "../src/services/transaction";
import { initSDK, executeTransaction, getActiveAddress } from "./execute-tx";

const ACCEPT_OUTCOME_INDEX = 1;

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
  console.log("COMPREHENSIVE PROPOSAL E2E TEST WITH SWAPS & WITHDRAWALS");
  console.log("=".repeat(80));
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
  const stableTreasuryCap = daoInfo.stableTreasuryCap;

  console.log(`✅ DAO Account: ${daoAccountId}`);
  console.log(`✅ Asset Type: ${assetType}`);
  console.log(`✅ Stable Type: ${stableType}`);
  console.log(`✅ Spot Pool: ${spotPoolId}`);
  console.log();

  // Load conditional coins deployment info
  const conditionalCoinsPath = path.join(__dirname, "..", "conditional-coins-info.json");
  let conditionalCoinsInfo: any = null;
  if (fs.existsSync(conditionalCoinsPath)) {
    conditionalCoinsInfo = JSON.parse(fs.readFileSync(conditionalCoinsPath, "utf-8"));
    console.log(`📦 Conditional Coins Package: ${conditionalCoinsInfo.packageId}`);
    console.log(`📦 CoinRegistry: ${conditionalCoinsInfo.registryId}`);
    console.log();
  } else {
    console.log("⚠️  Conditional coins not deployed - SWAP 2 will be skipped");
    console.log("   Run: npm run deploy-conditional-coins");
    console.log();
  }

  let conditionalOutcomes: ConditionalOutcomeCoinSet[] = [];
  if (conditionalCoinsInfo) {
    try {
      conditionalOutcomes = extractConditionalOutcomes(conditionalCoinsInfo);
    } catch (error) {
      console.log("⚠️  Failed to parse conditional coin metadata:", error);
      conditionalCoinsInfo = null;
    }

    if (conditionalCoinsInfo && conditionalOutcomes.length === 0) {
      console.log("⚠️  No conditional coin sets found - disabling typed coin flow");
      conditionalCoinsInfo = null;
    }
  }

  let cond1AssetCoinId: string | null = null;

  // ============================================================================
  // STEP 1: Initialize SDK
  // ============================================================================
  console.log("🔧 Initializing SDK...");
  const sdk = await initSDK();
  const activeAddress = getActiveAddress();
  console.log(`✅ Active address: ${activeAddress}`);
  console.log();

  // Access workflows from SDK
  const proposalWorkflow = sdk.workflows.proposal;

  // ============================================================================
  // STEP 2: Create proposal with actions using SDK workflow
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

  console.log(`📋 Creating proposal with stream action:`);
  console.log(`   Total: ${streamAmount / 1e9} stable over ${Number(streamIterations)} iterations`);
  console.log();

  // First, ensure we have enough stable coins for the proposal fee
  const proposalFeeAmount = 1_000_000_000n; // 1 stable coin fee
  console.log(`💰 Preparing proposal fee: ${Number(proposalFeeAmount) / 1e9} stable`);

  const stableCoinsForFee = await sdk.client.getCoins({
    owner: activeAddress,
    coinType: stableType,
  });

  const totalStableBalance = stableCoinsForFee.data.reduce(
    (sum, c) => sum + BigInt(c.balance),
    0n
  );

  if (totalStableBalance < proposalFeeAmount) {
    console.log(`⚠️  Insufficient stable coins (have ${totalStableBalance}, need ${proposalFeeAmount}), minting more...`);
    const mintFeeTx = new Transaction();
    const mintedCoin = mintFeeTx.moveCall({
      target: `0x2::coin::mint`,
      typeArguments: [stableType],
      arguments: [
        mintFeeTx.object(stableTreasuryCap),
        mintFeeTx.pure.u64(proposalFeeAmount * 2n),
      ],
    });
    mintFeeTx.transferObjects([mintedCoin], mintFeeTx.pure.address(activeAddress));
    await executeTransaction(sdk, mintFeeTx, { network: "devnet" });
  }

  // Get fee coins
  const feeCoins = await sdk.client.getCoins({
    owner: activeAddress,
    coinType: stableType,
  });
  const feeCoinIds = feeCoins.data.map((c) => c.coinObjectId);

  // Create proposal using SDK workflow
  const createTx = proposalWorkflow.createProposal({
    daoAccountId,
    assetType,
    stableType,
    title: "Fund Team Development with Conditional Trading",
    introduction: "This proposal will test swaps and demonstrate winning outcome execution",
    metadata: JSON.stringify({ category: "test", impact: "high" }),
    outcomeMessages: ["Reject", "Accept"],
    outcomeDetails: [
      "Reject: Do nothing (status quo)",
      "Accept: Execute stream + allow trading",
    ],
    proposer: activeAddress,
    treasuryAddress: activeAddress,
    usedQuota: false,
    feeCoins: feeCoinIds,
    feeAmount: proposalFeeAmount,
  });

  console.log("📤 Creating proposal...");
  const createResult = await executeTransaction(sdk, createTx.transaction, {
    network: "devnet",
    showObjectChanges: true,
  });

  const proposalObject = createResult.objectChanges?.find(
    (obj: any) => obj.type === "created" && obj.objectType?.includes("proposal::Proposal")
  );

  if (!proposalObject) {
    console.error("❌ Failed to create proposal");
    process.exit(1);
  }

  const proposalId = (proposalObject as any).objectId;
  console.log(`✅ Proposal created: ${proposalId}`);
  console.log();

  // ============================================================================
  // STEP 3: Add actions to Accept outcome using SDK workflow
  // ============================================================================
  console.log("📝 Adding stream action to Accept outcome (using sdk.workflows.proposal)...");

  const addActionsTx = proposalWorkflow.addActionsToOutcome({
    proposalId,
    assetType,
    stableType,
    outcomeIndex: ACCEPT_OUTCOME_INDEX,
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

  await executeTransaction(sdk, addActionsTx.transaction, { network: "devnet" });
  console.log(`✅ Actions added to Accept outcome!`);
  console.log();

  // ============================================================================
  // STEP 4: Advance to REVIEW state
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 4: ADVANCE TO REVIEW STATE (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  // Build conditional coin registry config for advance to review
  const conditionalCoinsRegistry = conditionalCoinsInfo && conditionalOutcomes.length > 0
    ? {
        registryId: conditionalCoinsInfo.registryId,
        coinSets: conditionalOutcomes.map((outcome) => ({
          outcomeIndex: outcome.index,
          assetCoinType: outcome.asset.coinType,
          assetCapId: outcome.asset.treasuryCapId,
          stableCoinType: outcome.stable.coinType,
          stableCapId: outcome.stable.treasuryCapId,
        })),
      }
    : undefined;

  const advanceTx = proposalWorkflow.advanceToReview({
    proposalId,
    daoAccountId,
    assetType,
    stableType,
    spotPoolId,
    senderAddress: activeAddress,
    conditionalCoinsRegistry,
  });

  console.log("📤 Creating escrow and advancing to REVIEW...");
  const advanceResult = await executeTransaction(sdk, advanceTx.transaction, {
    network: "devnet",
    showObjectChanges: true,
  });

  const escrowObject = advanceResult.objectChanges?.find(
    (obj: any) => obj.objectType?.includes("::coin_escrow::TokenEscrow")
  );

  if (!escrowObject) {
    console.error("❌ Failed to create escrow!");
    process.exit(1);
  }

  const escrowId = (escrowObject as any).objectId;
  console.log(`✅ Escrow created: ${escrowId}`);
  console.log(`✅ Proposal state: REVIEW`);
  console.log();

  // ============================================================================
  // STEP 5: Advance to TRADING state
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 5: ADVANCE TO TRADING STATE (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  console.log("⏳ Waiting for review period (30 seconds)...");
  await sleep(32000);
  console.log("✅ Review period ended!");
  console.log();

  console.log("📤 Advancing to TRADING state (100% quantum split)...");

  const toTradingTx = proposalWorkflow.advanceToTrading({
    daoAccountId,
    proposalId,
    escrowId,
    spotPoolId,
    assetType,
    stableType,
  });

  await executeTransaction(sdk, toTradingTx.transaction, { network: "devnet" });

  console.log("✅ Proposal state: TRADING");
  console.log("   - 100% quantum split complete: all spot liquidity → conditional AMMs");
  console.log("   - active_proposal_id set: LP add/remove operations now blocked");
  console.log();

  // Wait for review period
  console.log("⏳ Waiting 2 seconds for review period to elapse...");
  await sleep(2000);
  console.log("✅ Review period elapsed - trading is now active");
  console.log();

  // ============================================================================
  // STEP 6: PERFORM SWAPS
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 6: PERFORM SWAPS TO INFLUENCE OUTCOME (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  // First, mint some stable coins for swapping
  console.log("💰 Minting stable coins for swaps...");
  const mintAmount = 30_000_000_000n; // 30 stable coins

  const mintTx = new Transaction();
  const mintedCoin = mintTx.moveCall({
    target: `${stableType.split("::")[0]}::coin::mint`,
    arguments: [
      mintTx.object(stableTreasuryCap),
      mintTx.pure.u64(mintAmount),
      mintTx.pure.address(activeAddress),
    ],
  });

  await executeTransaction(sdk, mintTx, { network: "devnet" });
  console.log(`✅ Minted ${Number(mintAmount) / 1e9} stable coins`);
  console.log();

  // SWAP 1: Spot swap using SDK workflow
  console.log("📊 SWAP 1: Spot swap (stable → asset) using sdk.workflows.proposal.spotSwap...");

  const swapAmount1 = 1_000_000_000n;
  const coins1 = await sdk.client.getCoins({
    owner: activeAddress,
    coinType: stableType,
  });

  const swap1Tx = proposalWorkflow.spotSwap({
    spotPoolId,
    proposalId,
    escrowId,
    assetType,
    stableType,
    inputCoins: coins1.data.map((c) => c.coinObjectId),
    amountIn: swapAmount1,
    minAmountOut: 0n,
    direction: 'stable_to_asset',
    recipient: activeAddress,
  });

  await executeTransaction(sdk, swap1Tx.transaction, {
    network: "devnet",
    showObjectChanges: true,
  });

  console.log(`✅ Spot swap complete (${Number(swapAmount1) / 1e9} stable → asset)`);
  console.log("   Auto-arbitrage executed in background");
  console.log();

  // SWAP 2: Conditional swap (if conditional coins available)
  const swapAmount2 = 20_000_000_000n;

  if (conditionalCoinsInfo && conditionalOutcomes.length > 0) {
    console.log("📊 SWAP 2: Conditional coin swap using sdk.workflows.proposal.conditionalSwap...");

    const acceptOutcome = conditionalOutcomes.find((o) => o.index === ACCEPT_OUTCOME_INDEX);
    if (!acceptOutcome) {
      console.log("⚠️  SKIPPED: Missing conditional coin metadata for Accept outcome");
    } else {
      const coins2 = await sdk.client.getCoins({
        owner: activeAddress,
        coinType: stableType,
      });

      const swap2Tx = proposalWorkflow.conditionalSwap({
        proposalId,
        escrowId,
        spotPoolId,
        assetType,
        stableType,
        stableCoins: coins2.data.map((c) => c.coinObjectId),
        amountIn: swapAmount2,
        minAmountOut: 0n,
        direction: 'stable_to_asset',
        outcomeIndex: ACCEPT_OUTCOME_INDEX,
        allOutcomeCoins: conditionalOutcomes.map((o) => ({
          outcomeIndex: o.index,
          assetCoinType: o.asset.coinType,
          stableCoinType: o.stable.coinType,
        })),
        recipient: activeAddress,
      });

      const swap2Result = await executeTransaction(sdk, swap2Tx.transaction, {
        network: "devnet",
        showObjectChanges: true,
      });

      const createdAcceptCoin = swap2Result.objectChanges?.find(
        (obj: any) =>
          obj.type === "created" &&
          obj.objectType?.includes(acceptOutcome.asset.coinType) &&
          obj.owner?.AddressOwner?.toLowerCase() === activeAddress.toLowerCase()
      );
      if (createdAcceptCoin) {
        cond1AssetCoinId = (createdAcceptCoin as any).objectId;
        console.log(`✅ Conditional coin swap complete (coin: ${cond1AssetCoinId})`);
      } else {
        console.log(`✅ Conditional coin swap complete`);
      }
      console.log("   Swapped ONLY in Accept market using typed conditional coins");
      console.log();
    }
  } else {
    console.log("⚠️  SKIPPED: Conditional swap requires conditional coins to be deployed");
    console.log("   Run: npm run deploy-conditional-coins");
    console.log();
  }

  // ============================================================================
  // STEP 7: Wait for trading period and finalize
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 7: FINALIZE PROPOSAL (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  console.log("⏳ Waiting for trading period (60 seconds)...");
  await sleep(62000);
  console.log("✅ Trading period ended!");
  console.log();

  console.log("📤 Finalizing proposal...");

  const finalizeTx = proposalWorkflow.finalizeProposal({
    daoAccountId,
    proposalId,
    escrowId,
    spotPoolId,
    assetType,
    stableType,
  });

  await executeTransaction(sdk, finalizeTx.transaction, { network: "devnet" });

  console.log("✅ Proposal finalized!");
  console.log("   - Winning conditional liquidity auto-recombined back to spot pool");
  console.log("   - active_proposal_id cleared: LP operations now allowed");
  console.log();

  // Check winning outcome
  const proposalData = await sdk.client.getObject({
    id: proposalId,
    options: { showContent: true },
  });

  const fields = (proposalData.data!.content as any).fields;
  const winningOutcome = fields.outcome_data.fields.winning_outcome;

  console.log(`🏆 Winning outcome: ${winningOutcome === 0 || winningOutcome === "0" ? "REJECT" : "ACCEPT"} (${winningOutcome})`);
  console.log();

  const acceptWon = winningOutcome === 1 || winningOutcome === "1";

  // ============================================================================
  // STEP 8: Execute actions (if Accept won)
  // ============================================================================
  if (acceptWon) {
    console.log("=".repeat(80));
    console.log("STEP 8: EXECUTE ACTIONS (using sdk.workflows.proposal)");
    console.log("=".repeat(80));
    console.log();

    console.log("📤 Executing stream action...");

    const executeTx = proposalWorkflow.executeActions({
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
      console.log(`✅ Actions executed! Created ${streamObjects.length} stream(s)`);
      streamObjects.forEach((stream: any, i: number) => {
        console.log(`   Stream ${i + 1}: ${stream.objectId}`);
      });
    } else {
      console.log("✅ Actions executed!");
    }
    console.log();
  } else {
    console.log("ℹ️  Reject won - no actions to execute");
    console.log();
  }

  // ============================================================================
  // STEP 9: Redeem winning conditional tokens
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 9: REDEEM WINNING CONDITIONAL TOKENS (using sdk.workflows.proposal)");
  console.log("=".repeat(80));
  console.log();

  if (conditionalCoinsInfo && cond1AssetCoinId && acceptWon) {
    const acceptOutcomeInfo = conditionalOutcomes.find(
      (o) => o.index === ACCEPT_OUTCOME_INDEX
    );
    if (acceptOutcomeInfo) {
      console.log(`🪙 Redeeming conditional asset coin...`);

      const redeemTx = proposalWorkflow.redeemConditionalTokens(
        proposalId,
        escrowId,
        assetType,
        stableType,
        cond1AssetCoinId,
        acceptOutcomeInfo.asset.coinType,
        ACCEPT_OUTCOME_INDEX,
        true, // isAsset
        activeAddress
      );

      await executeTransaction(sdk, redeemTx.transaction, {
        network: "devnet",
        showObjectChanges: true,
      });
      console.log("✅ Redemption complete - spot asset returned to wallet");
      console.log();
    }
  } else if (!conditionalCoinsInfo) {
    console.log("ℹ️  SKIPPED: Conditional token redemption requires conditional coins");
    console.log();
  } else if (!acceptWon) {
    console.log("ℹ️  SKIPPED: Reject won, so typed conditional coins cannot be redeemed");
    console.log();
  } else {
    console.log("ℹ️  SKIPPED: No conditional asset coin found from swap");
    console.log();
  }

  // ============================================================================
  // DONE
  // ============================================================================
  console.log("=".repeat(80));
  console.log("🎉 COMPREHENSIVE TEST COMPLETE! 🎉");
  console.log("=".repeat(80));
  console.log();

  console.log("📋 Summary:");
  console.log("  ✅ Created proposal with actions (using sdk.workflows.proposal.createProposal)");
  console.log("  ✅ Added actions to outcome (using sdk.workflows.proposal.addActionsToOutcome)");
  console.log("  ✅ Advanced to REVIEW (using sdk.workflows.proposal.advanceToReview)");
  console.log("  ✅ Advanced to TRADING (using sdk.workflows.proposal.advanceToTrading)");
  console.log("  ✅ 100% quantum split: spot pool → conditional AMMs");
  console.log("  ✅ Performed spot swap (using sdk.workflows.proposal.spotSwap)");
  if (conditionalCoinsInfo) {
    console.log("  ✅ Performed conditional swap (using sdk.workflows.proposal.conditionalSwap)");
  } else {
    console.log("  ⚠️  Conditional swap skipped (no conditional coins available)");
  }
  console.log(`  ✅ Finalized proposal (using sdk.workflows.proposal.finalizeProposal) - winner: ${acceptWon ? "ACCEPT" : "REJECT"}`);
  console.log("  ✅ Auto-recombination: winning conditional liquidity → spot pool");
  if (acceptWon) {
    console.log("  ✅ Executed actions (using sdk.workflows.proposal.executeActions)");
    if (conditionalCoinsInfo && cond1AssetCoinId) {
      console.log("  ✅ Redeemed tokens (using sdk.workflows.proposal.redeemConditionalTokens)");
    }
  } else {
    console.log("  ℹ️  No actions executed (Reject won)");
  }
  console.log();

  console.log(`🔗 View proposal: https://suiscan.xyz/devnet/object/${proposalId}`);
  console.log(`🔗 View DAO: https://suiscan.xyz/devnet/object/${daoAccountId}`);
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
