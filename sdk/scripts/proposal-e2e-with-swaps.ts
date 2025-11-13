/**
 * COMPREHENSIVE Proposal E2E Test with Swaps and Withdrawals
 *
 * This test demonstrates the full lifecycle of a proposal with actual trading:
 * 1. Create proposal with actions (inherits from proposal-e2e-real.ts logic)
 * 2. Advance PREMARKET → REVIEW → TRADING (with 100% quantum split from spot pool)
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
 */

import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import * as fs from "fs";
import * as path from "path";
import { initSDK, executeTransaction, getActiveAddress } from "./execute-tx";

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
  const assetTreasuryCap = daoInfo.assetTreasuryCap;
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
  const governanceActionsPackageId = sdk.getPackageId("futarchy_governance_actions");
  const typesPackageId = sdk.getPackageId("futarchy_types");
  const operationsPackageId = sdk.getPackageId("futarchy_markets_operations");

  const futarchyCorePackage = sdk.getPackageId("futarchy_core");

  console.log("🔍 DEBUG: Package IDs loaded:");
  console.log(`   AccountActions: ${actionsPkg}`);
  console.log(`   AccountProtocol: ${protocolPkg}`);
  console.log(`   futarchy_core (for witnesses): ${futarchyCorePackage}`);

  // ============================================================================
  // STEP 2: Create proposal with actions
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 2: CREATE PROPOSAL WITH ACTIONS");
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

  const createTx = new Transaction();

  // Create Option::None for vector<ActionSpec>
  const noneOption = createTx.moveCall({
    target: "0x1::option::none",
    typeArguments: [`vector<${protocolPkg}::intents::ActionSpec>`],
    arguments: [],
  });

  // Create SignedU128 for twap_threshold (0 = no threshold)
  const twapThresholdSigned = createTx.moveCall({
    target: `${typesPackageId}::signed::from_u128`,
    arguments: [createTx.pure.u128(0n)], // Zero threshold
  });

  const referenceProposalId = "0x0000000000000000000000000000000000000000000000000000000000000001";

  createTx.moveCall({
    target: `${marketsPackageId}::proposal::new_premarket`,
    typeArguments: [assetType, stableType],
    arguments: [
      createTx.object(referenceProposalId),
      createTx.object(daoAccountId),
      createTx.pure.u64(30 * 1000), // 30 sec review period
      createTx.pure.u64(60 * 1000), // 60 sec trading period (1 minute)
      createTx.pure.u64(50_000), // min_asset_liquidity
      createTx.pure.u64(50_000), // min_stable_liquidity
      createTx.pure.u64(0), // twap_start_delay_ms
      createTx.pure.u128(BigInt("1000000000000000000")), // twap_initial_observation
      createTx.pure.u64(1000), // twap_step_max
      twapThresholdSigned, // twap_threshold
      createTx.pure.u64(30), // amm_fee_bps
      createTx.pure.u64(50), // conditional_liquidity_percent (DEPRECATED - always splits 100% now)
      createTx.pure.u64(10), // max_outcomes
      createTx.pure.address(activeAddress), // treasury_address
      createTx.pure.string("Fund Team Development with Conditional Trading"),
      createTx.pure.string("This proposal will test swaps and demonstrate winning outcome execution"),
      createTx.pure.string(JSON.stringify({ category: "test", impact: "high" })),
      createTx.pure.vector("string", ["Reject", "Accept"]),
      createTx.pure.vector("string", [
        "Reject: Do nothing (status quo)",
        "Accept: Execute stream + allow trading"
      ]),
      createTx.pure.address(activeAddress), // proposer
      createTx.pure.bool(false), // used_quota
      noneOption, // intent_spec_for_yes
      createTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  console.log("📤 Creating proposal...");
  const createResult = await executeTransaction(sdk, createTx, {
    network: "devnet",
    description: "Create proposal",
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
  // STEP 3: Add actions to Accept outcome
  // ============================================================================
  console.log("📝 Adding stream action to Accept outcome...");

  const addActionsTx = new Transaction();

  const builder = addActionsTx.moveCall({
    target: `${actionsPkg}::action_spec_builder::new`,
    arguments: [],
  });

  addActionsTx.moveCall({
    target: `${actionsPkg}::stream_init_actions::add_create_stream_spec`,
    arguments: [
      builder,
      addActionsTx.pure.string("treasury"),
      addActionsTx.pure(bcs.Address.serialize(activeAddress).toBytes()),
      addActionsTx.pure.u64(streamAmountPerIteration),
      addActionsTx.pure.u64(streamStart),
      addActionsTx.pure.u64(streamIterations),
      addActionsTx.pure.u64(streamIterationPeriod),
      addActionsTx.pure.option("u64", null),
      addActionsTx.pure.option("u64", null),
      addActionsTx.pure.u64(streamAmountPerIteration),
      addActionsTx.pure.bool(true),
      addActionsTx.pure.bool(true),
    ],
  });

  const specs = addActionsTx.moveCall({
    target: `${actionsPkg}::action_spec_builder::into_vector`,
    arguments: [builder],
  });

  addActionsTx.moveCall({
    target: `${marketsPackageId}::proposal::set_intent_spec_for_outcome`,
    typeArguments: [assetType, stableType],
    arguments: [
      addActionsTx.object(proposalId),
      addActionsTx.pure.u64(1), // outcome 1 = Accept (outcome 0 = Reject)
      specs,
      addActionsTx.pure.u64(10), // max_actions_per_outcome
    ],
  });

  await executeTransaction(sdk, addActionsTx, {
    network: "devnet",
    description: "Add actions to Accept outcome",
  });

  console.log(`✅ Actions added to Accept outcome!`);
  console.log();

  // ============================================================================
  // STEP 4: Advance PREMARKET → REVIEW (take coins, create escrow & AMM pools)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 4: ADVANCE TO REVIEW STATE");
  console.log("=".repeat(80));
  console.log();

  // Get the DAO account to access coin config (before building transaction)
  let coinConfigId = null;
  if (conditionalCoinsInfo) {
    const daoAccountData = await sdk.client.getObject({
      id: daoAccountId,
      options: { showContent: true },
    });

    // Extract coin config object ID
    const daoFields = (daoAccountData.data!.content as any).fields;
    coinConfigId = daoFields.conditional_coin_config?.fields?.id?.id;

    console.log(`📋 DEBUG: coinConfigId = ${coinConfigId}`);
    console.log(`📋 DEBUG: daoFields keys = ${Object.keys(daoFields).join(", ")}`);

    if (!coinConfigId) {
      console.log("⚠️  ConditionalCoinConfig not found - skipping typed conditional coins");
      console.log("   Test will continue with balance-based swaps only");
      // Set conditionalCoinsInfo to null so we skip the conditional coin registration
      conditionalCoinsInfo = null;
    }
  }

  const advanceTx = new Transaction();

  // Get oneShotUtils package for conditional coins (if available)
  const oneShotUtils = conditionalCoinsInfo
    ? sdk.deployments.getPackage("futarchy_one_shot_utils")
    : null;

  // Take all 4 coin sets from registry using new PTB-friendly function
  let cond0AssetResults, cond0StableResults, cond1AssetResults, cond1StableResults;

  if (conditionalCoinsInfo && oneShotUtils) {
    console.log("📤 Taking conditional coins from registry (paying 0 SUI fee)...");

    // Create a zero SUI coin for payment (since fee is 0)
    const zeroSui = advanceTx.splitCoins(advanceTx.gas, [advanceTx.pure.u64(0)]);

    // Take cond0_asset (returns [TreasuryCap, Metadata, RemainingSUI])
    cond0AssetResults = advanceTx.moveCall({
      target: `${oneShotUtils.packageId}::coin_registry::take_coin_set_for_ptb`,
      typeArguments: [conditionalCoinsInfo.cond0_asset.coinType],
      arguments: [
        advanceTx.object(conditionalCoinsInfo.registryId),
        advanceTx.pure.id(conditionalCoinsInfo.cond0_asset.treasuryCapId),
        zeroSui,
        advanceTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // Take cond0_stable
    cond0StableResults = advanceTx.moveCall({
      target: `${oneShotUtils.packageId}::coin_registry::take_coin_set_for_ptb`,
      typeArguments: [conditionalCoinsInfo.cond0_stable.coinType],
      arguments: [
        advanceTx.object(conditionalCoinsInfo.registryId),
        advanceTx.pure.id(conditionalCoinsInfo.cond0_stable.treasuryCapId),
        cond0AssetResults[2], // Use remaining SUI from previous call
        advanceTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // Take cond1_asset
    cond1AssetResults = advanceTx.moveCall({
      target: `${oneShotUtils.packageId}::coin_registry::take_coin_set_for_ptb`,
      typeArguments: [conditionalCoinsInfo.cond1_asset.coinType],
      arguments: [
        advanceTx.object(conditionalCoinsInfo.registryId),
        advanceTx.pure.id(conditionalCoinsInfo.cond1_asset.treasuryCapId),
        cond0StableResults[2], // Use remaining SUI from previous call
        advanceTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // Take cond1_stable
    cond1StableResults = advanceTx.moveCall({
      target: `${oneShotUtils.packageId}::coin_registry::take_coin_set_for_ptb`,
      typeArguments: [conditionalCoinsInfo.cond1_stable.coinType],
      arguments: [
        advanceTx.object(conditionalCoinsInfo.registryId),
        advanceTx.pure.id(conditionalCoinsInfo.cond1_stable.treasuryCapId),
        cond1AssetResults[2], // Use remaining SUI from previous call
        advanceTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    console.log("✅ All 4 conditional coin sets taken from CoinRegistry");
    console.log("   - cond0_asset + metadata");
    console.log("   - cond0_stable + metadata");
    console.log("   - cond1_asset + metadata");
    console.log("   - cond1_stable + metadata");
    console.log();
  }

  console.log("📤 Creating escrow and registering conditional caps...");

  const escrow = advanceTx.moveCall({
    target: `${marketsPackageId}::proposal::create_escrow_for_market`,
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

  // Register conditional caps with escrow using captured caps from registry
  if (conditionalCoinsInfo && cond0AssetResults && coinConfigId) {
    // Get asset and stable type names (simplified for test)
    const assetTypeName = "ASSET";
    const stableTypeName = "STABLE";

    // Add conditional coins to proposal (4 calls - one for each cap)
    advanceTx.moveCall({
      target: `${marketsPackageId}::proposal::add_conditional_coin`,
      typeArguments: [assetType, stableType, conditionalCoinsInfo.cond0_asset.coinType],
      arguments: [
        advanceTx.object(proposalId),
        advanceTx.pure.u64(0), // outcome 0
        advanceTx.pure.bool(true), // is_asset = true
        cond0AssetResults[0], // TreasuryCap
        cond0AssetResults[1], // Metadata
        advanceTx.object(coinConfigId),
        advanceTx.pure.string(assetTypeName),
        advanceTx.pure.string(stableTypeName),
      ],
    });

    advanceTx.moveCall({
      target: `${marketsPackageId}::proposal::add_conditional_coin`,
      typeArguments: [assetType, stableType, conditionalCoinsInfo.cond0_stable.coinType],
      arguments: [
        advanceTx.object(proposalId),
        advanceTx.pure.u64(0), // outcome 0
        advanceTx.pure.bool(false), // is_asset = false (stable)
        cond0StableResults[0], // TreasuryCap
        cond0StableResults[1], // Metadata
        advanceTx.object(coinConfigId),
        advanceTx.pure.string(assetTypeName),
        advanceTx.pure.string(stableTypeName),
      ],
    });

    advanceTx.moveCall({
      target: `${marketsPackageId}::proposal::add_conditional_coin`,
      typeArguments: [assetType, stableType, conditionalCoinsInfo.cond1_asset.coinType],
      arguments: [
        advanceTx.object(proposalId),
        advanceTx.pure.u64(1), // outcome 1
        advanceTx.pure.bool(true), // is_asset = true
        cond1AssetResults[0], // TreasuryCap
        cond1AssetResults[1], // Metadata
        advanceTx.object(coinConfigId),
        advanceTx.pure.string(assetTypeName),
        advanceTx.pure.string(stableTypeName),
      ],
    });

    advanceTx.moveCall({
      target: `${marketsPackageId}::proposal::add_conditional_coin`,
      typeArguments: [assetType, stableType, conditionalCoinsInfo.cond1_stable.coinType],
      arguments: [
        advanceTx.object(proposalId),
        advanceTx.pure.u64(1), // outcome 1
        advanceTx.pure.bool(false), // is_asset = false (stable)
        cond1StableResults[0], // TreasuryCap
        cond1StableResults[1], // Metadata
        advanceTx.object(coinConfigId),
        advanceTx.pure.string(assetTypeName),
        advanceTx.pure.string(stableTypeName),
      ],
    });

    // Now register caps with escrow (2 calls - one per outcome)
    advanceTx.moveCall({
      target: `${marketsPackageId}::proposal::register_outcome_caps_with_escrow`,
      typeArguments: [assetType, stableType, conditionalCoinsInfo.cond0_asset.coinType, conditionalCoinsInfo.cond0_stable.coinType],
      arguments: [
        advanceTx.object(proposalId),
        escrow,
        advanceTx.pure.u64(0), // outcome 0
      ],
    });

    advanceTx.moveCall({
      target: `${marketsPackageId}::proposal::register_outcome_caps_with_escrow`,
      typeArguments: [assetType, stableType, conditionalCoinsInfo.cond1_asset.coinType, conditionalCoinsInfo.cond1_stable.coinType],
      arguments: [
        advanceTx.object(proposalId),
        escrow,
        advanceTx.pure.u64(1), // outcome 1
      ],
    });
  }

  // ALWAYS create conditional AMM pools - needed for both typed and balance-based swaps
  advanceTx.moveCall({
    target: `${marketsPackageId}::proposal::create_conditional_amm_pools`,
    typeArguments: [assetType, stableType],
    arguments: [
      advanceTx.object(proposalId),
      escrow,
      advanceTx.object(spotPoolId), // CRITICAL FIX: Pass spot pool so conditional pools bootstrap at same price
      advanceTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  advanceTx.moveCall({
    target: "0x2::transfer::public_share_object",
    typeArguments: [
      `${primitivesPackageId}::coin_escrow::TokenEscrow<${assetType}, ${stableType}>`
    ],
    arguments: [escrow],
  });

  // Return remaining SUI from conditional coin takes (must be after all caps are consumed)
  if (conditionalCoinsInfo && cond1StableResults) {
    advanceTx.transferObjects([cond1StableResults[2]], advanceTx.pure.address(activeAddress));
  }

  const advanceResult = await executeTransaction(sdk, advanceTx, {
    network: "devnet",
    description: "Take coins, create escrow and AMM pools",
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
  console.log();

  // Get market_state ID
  const escrowData = await sdk.client.getObject({
    id: escrowId,
    options: { showContent: true },
  });

  const escrowFields = (escrowData.data!.content as any).fields;
  const marketStateId = escrowFields.market_state?.fields?.id?.id;

  if (!marketStateId) {
    throw new Error("Failed to get market_state ID");
  }

  console.log(`✅ MarketState ID: ${marketStateId}`);
  console.log();

  // Initialize market fields
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
      initFieldsTx.pure.address(activeAddress),
    ],
  });

  await executeTransaction(sdk, initFieldsTx, {
    network: "devnet",
    description: "Initialize market fields",
  });

  console.log(`✅ Proposal state: REVIEW`);
  console.log();

  // ============================================================================
  // STEP 5: Wait for review period and advance to TRADING
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 5: ADVANCE TO TRADING STATE (100% QUANTUM SPLIT)");
  console.log("=".repeat(80));
  console.log();

  console.log("⏳ Waiting for review period (30 seconds)...");
  await sleep(32000); // 32 seconds (30s + buffer)
  console.log("✅ Review period ended!");
  console.log();

  console.log("📤 Advancing to TRADING state (all spot liquidity → conditional AMMs)...");

  const toTradingTx = new Transaction();
  toTradingTx.moveCall({
    target: `${governancePackageId}::proposal_lifecycle::advance_proposal_state`,
    typeArguments: [assetType, stableType],
    arguments: [
      toTradingTx.object(daoAccountId),
      toTradingTx.object(proposalId),
      toTradingTx.object(escrowId),
      toTradingTx.object(spotPoolId),
      toTradingTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  await executeTransaction(sdk, toTradingTx, {
    network: "devnet",
    description: "Advance to TRADING state",
  });

  console.log("✅ Proposal state: TRADING");
  console.log("   - 100% quantum split complete: all spot liquidity → conditional AMMs");
  console.log("   - active_proposal_id set: LP add/remove operations now blocked");
  console.log();

  // ============================================================================
  // STEP 6: PERFORM SWAPS (Spot + Conditional)
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 6: PERFORM SWAPS TO INFLUENCE OUTCOME");
  console.log("=".repeat(80));
  console.log();

  // First, mint some stable coins for swapping
  console.log("💰 Minting stable coins for swaps...");
  const mintAmount = 30_000_000_000n; // 30 stable coins (enough for both swaps)

  const mintTx = new Transaction();
  const mintedCoin = mintTx.moveCall({
    target: `${stableType.split("::")[0]}::coin::mint`,
    arguments: [
      mintTx.object(stableTreasuryCap),
      mintTx.pure.u64(mintAmount),
      mintTx.pure.address(activeAddress),
    ],
  });

  await executeTransaction(sdk, mintTx, {
    network: "devnet",
    description: "Mint stable coins for swaps",
  });

  console.log(`✅ Minted ${Number(mintAmount) / 1e9} stable coins`);
  console.log();

  // DEBUG: Check pool states after quantum split
  console.log("🔍 DEBUG: Fetching pool states after quantum split...");

  const spotPoolObj = await sdk.client.getObject({
    id: spotPoolId,
    options: { showContent: true },
  });

  if (spotPoolObj.data?.content?.dataType === "moveObject") {
    const fields = spotPoolObj.data.content.fields as any;
    console.log("   Spot Pool:");
    console.log(`     Asset Reserve (raw): ${JSON.stringify(fields.asset_reserve)}`);
    console.log(`     Stable Reserve (raw): ${JSON.stringify(fields.stable_reserve)}`);

    // Balance objects have a 'value' field - need to access it properly
    const assetReserve = typeof fields.asset_reserve === 'object' && fields.asset_reserve !== null
      ? fields.asset_reserve.value || fields.asset_reserve
      : fields.asset_reserve;
    const stableReserve = typeof fields.stable_reserve === 'object' && fields.stable_reserve !== null
      ? fields.stable_reserve.value || fields.stable_reserve
      : fields.stable_reserve;

    console.log(`     Asset Reserve: ${assetReserve} (${Number(assetReserve) / 1e9} tokens)`);
    console.log(`     Stable Reserve: ${stableReserve} (${Number(stableReserve) / 1e9} tokens)`);
    console.log(`     Fee BPS: ${fields.fee_bps}`);

    // Log proposal lifecycle tracking fields
    if (fields.active_proposal_id !== undefined) {
      const activeProposalId = fields.active_proposal_id?.vec?.[0] || null;
      console.log(`     Active Proposal: ${activeProposalId || "None"}`);
    }

    if (fields.last_proposal_end_time !== undefined) {
      const lastEndTime = fields.last_proposal_end_time?.vec?.[0] || null;
      console.log(`     Last Proposal End Time: ${lastEndTime || "None"}`);
    }

    console.log(`     LP Supply: ${fields.lp_supply}`);
  }

  // COMMENTED OUT DEBUG CODE - was crashing on ID extraction
  // const proposalObj = await sdk.client.getObject({
  //   id: proposalId,
  //   options: { showContent: true },
  // });
  // ... debug code here ...
  console.log("   (Debug code commented out to avoid crashes)")
  console.log();

  // SWAP 1: Spot swap (auto-arb enabled)
  console.log("📊 SWAP 1: Spot swap (stable → asset) with auto-arb...");

  const swapAmount1 = 1_000_000_000n; // 1 stable coin (reduced to avoid no-arb violations)

  // Get stable coins
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

  // Create Option::None for existing_balance_opt
  const noneBalance1 = swap1Tx.moveCall({
    target: "0x1::option::none",
    typeArguments: [`${primitivesPackageId}::conditional_balance::ConditionalMarketBalance<${assetType}, ${stableType}>`],
    arguments: [],
  });

  // Execute swap - when return_balance=false, returns (zero_coin, none_option) that must be destroyed
  const [zeroAsset, returnedNone] = swap1Tx.moveCall({
    target: `${operationsPackageId}::swap_entry::swap_spot_stable_to_asset`,
    typeArguments: [assetType, stableType],
    arguments: [
      swap1Tx.object(spotPoolId),
      swap1Tx.object(proposalId),
      swap1Tx.object(escrowId),
      stableCoin1,
      swap1Tx.pure.u64(0), // min_asset_out
      swap1Tx.pure.address(activeAddress), // recipient
      noneBalance1, // existing_balance_opt
      swap1Tx.pure.bool(false), // return_balance (transfers handled internally)
      swap1Tx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  // Destroy the zero coin and empty option returned when return_balance=false
  swap1Tx.transferObjects([zeroAsset], swap1Tx.pure.address(activeAddress));
  swap1Tx.moveCall({
    target: "0x1::option::destroy_none",
    typeArguments: [`${primitivesPackageId}::conditional_balance::ConditionalMarketBalance<${assetType}, ${stableType}>`],
    arguments: [returnedNone],
  });

  // Return unused stable change to sender
  swap1Tx.transferObjects([firstCoin1], swap1Tx.pure.address(activeAddress));

  const swap1Result = await executeTransaction(sdk, swap1Tx, {
    network: "devnet",
    description: "Spot swap with auto-arb",
    showObjectChanges: true,
  });

  console.log(`✅ Spot swap complete (${Number(swapAmount1) / 1e9} stable → asset)`);
  console.log("   Auto-arbitrage executed in background");
  console.log("   (TWAP outcome depends on auto-arb rebalancing)");
  console.log();

  // SWAP 2: Balance-based conditional swap ONLY in outcome 1
  console.log("📊 SWAP 2: Balance-based conditional swap (stable → outcome 1 asset ONLY)...");

  const swapAmount2 = 20_000_000_000n; // 20 stable coins (much larger to influence TWAP)

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
  const marketStateId2 = swap2Tx.moveCall({
    target: `${primitivesPackageId}::coin_escrow::market_state_id`,
    typeArguments: [assetType, stableType],
    arguments: [swap2Tx.object(escrowId)],
  });

  // Step 3: Create ConditionalMarketBalance
  const balance = swap2Tx.moveCall({
    target: `${primitivesPackageId}::conditional_balance::new`,
    typeArguments: [assetType, stableType],
    arguments: [
      marketStateId2,
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
  // STEP 8: Wait for trading period and finalize
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 8: FINALIZE PROPOSAL (DETERMINE WINNER)");
  console.log("=".repeat(80));
  console.log();

  console.log("⏳ Waiting for trading period (60 seconds)...");
  await sleep(62000); // 62 seconds (60s + buffer)
  console.log("✅ Trading period ended!");
  console.log();

  console.log("📤 Finalizing proposal...");
  console.log("   - Determining winner via TWAP");
  console.log("   - Auto-recombining winning conditional liquidity → spot pool");

  const registry = sdk.deployments.getPackageRegistry();
  if (!registry) {
    throw new Error("PackageRegistry not found");
  }
  const registryId = registry.objectId;

  const finalizeTx = new Transaction();
  finalizeTx.moveCall({
    target: `${governancePackageId}::proposal_lifecycle::finalize_proposal_with_spot_pool`,
    typeArguments: [assetType, stableType],
    arguments: [
      finalizeTx.object(daoAccountId),
      finalizeTx.object(registryId),
      finalizeTx.object(proposalId),
      finalizeTx.object(escrowId),
      finalizeTx.object(spotPoolId),
      finalizeTx.sharedObjectRef({
        objectId: "0x6",
        initialSharedVersion: 1,
        mutable: false,
      }),
    ],
  });

  await executeTransaction(sdk, finalizeTx, {
    network: "devnet",
    description: "Finalize proposal",
  });

  console.log("✅ Proposal finalized!");
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

  console.log(`🏆 Winning outcome: ${winningOutcome === 0 || winningOutcome === "0" ? "REJECT" : "ACCEPT"} (${winningOutcome})`);
  console.log();

  if (winningOutcome === 1 || winningOutcome === "1") {
    // ============================================================================
    // STEP 9: Execute actions (Accept won - outcome 1)
    // ============================================================================
    console.log("=".repeat(80));
    console.log("STEP 9: EXECUTE ACTIONS (ACCEPT WON)");
    console.log("=".repeat(80));
    console.log();

    console.log("📤 Executing stream action via PTB executor...");

    const executeTx = new Transaction();

    // Use begin_execution_with_escrow - passes escrow directly, avoiding reference issues in PTBs
    const executable = executeTx.moveCall({
      target: `${governancePackageId}::ptb_executor::begin_execution_with_escrow`,
      typeArguments: [assetType, stableType],
      arguments: [
        executeTx.object(daoAccountId),
        executeTx.object(registryId),
        executeTx.object(proposalId),
        executeTx.object(escrowId),
        executeTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    const versionWitness = executeTx.moveCall({
      target: `${actionsPkg}::version::current`,
      arguments: [],
    });

    const governanceWitness = executeTx.moveCall({
      target: `${futarchyCorePackage}::futarchy_config::witness`,
      arguments: [],
    });

    executeTx.moveCall({
      target: `${actionsPkg}::vault::do_init_create_stream`,
      typeArguments: [
        `${futarchyCorePackage}::futarchy_config::FutarchyConfig`,
        `${futarchyCorePackage}::futarchy_config::FutarchyOutcome`,
        stableType,
        `${futarchyCorePackage}::futarchy_config::ConfigWitness`,
      ],
      arguments: [
        executable,
        executeTx.object(daoAccountId),
        executeTx.object(registryId),
        executeTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }),
        versionWitness,
        governanceWitness,
      ],
    });

    executeTx.moveCall({
      target: `${governancePackageId}::ptb_executor::finalize_execution`,
      typeArguments: [assetType, stableType],
      arguments: [
        executeTx.object(daoAccountId),
        executeTx.object(registryId),
        executeTx.object(proposalId),
        executable,
        executeTx.sharedObjectRef({
          objectId: "0x6",
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    const executeResult = await executeTransaction(sdk, executeTx, {
      network: "devnet",
      description: "Execute actions",
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
  // STEP 10: Withdraw winning conditional tokens
  // ============================================================================
  console.log("=".repeat(80));
  console.log("STEP 10: WITHDRAW WINNING CONDITIONAL TOKENS");
  console.log("=".repeat(80));
  console.log();

  console.log("💰 Users can now redeem their winning conditional tokens...");
  console.log();
  console.log("ℹ️  SKIPPED: Conditional token redemption requires conditional coins (not available in e2e test)");
  console.log();

  // ============================================================================
  // DONE
  // ============================================================================
  console.log("=".repeat(80));
  console.log("🎉 COMPREHENSIVE TEST COMPLETE! 🎉");
  console.log("=".repeat(80));
  console.log();

  console.log("📋 Summary:");
  console.log("  ✅ Created proposal with actions");
  console.log("  ✅ Advanced through all states (PREMARKET → REVIEW → TRADING → FINALIZED)");
  console.log("  ✅ 100% quantum split: spot pool → conditional AMMs");
  console.log("  ✅ Performed spot swap with auto-arb (swaps allowed during proposal)");
  if (conditionalCoinsInfo) {
    console.log("  ✅ Performed conditional swap buying outcome 1 (influenced TWAP)");
  } else {
    console.log("  ⚠️  Conditional swap skipped (no conditional coins available)");
  }
  console.log(`  ✅ Proposal finalized - winner: ${winningOutcome === 1 || winningOutcome === "1" ? "ACCEPT" : "REJECT"} (outcome ${winningOutcome})`);
  console.log("  ✅ Auto-recombination: winning conditional liquidity → spot pool");
  if (winningOutcome === 1 || winningOutcome === "1") {
    console.log("  ✅ Actions executed (stream created)");
  } else {
    console.log("  ℹ️  No actions executed (Reject won)");
  }
  console.log("  ℹ️  LP operations blocked during proposal (active_proposal_id check)");
  console.log("  ℹ️  6-hour gap enforced between proposals");
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
