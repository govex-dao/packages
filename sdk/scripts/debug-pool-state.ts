import { initSDK } from "./execute-tx";
import * as fs from "fs";

async function main() {
  const sdk = await initSDK("devnet");

  const daoInfo = JSON.parse(
    fs.readFileSync("test-dao-info.json", "utf8")
  );

  const spotPoolId = daoInfo.spotPoolId;

  console.log(`\n=== FETCHING POOL STATE ===`);
  console.log(`Spot Pool: ${spotPoolId}\n`);

  const spotPool = await sdk.client.getObject({
    id: spotPoolId,
    options: { showContent: true },
  });

  if (spotPool.data?.content?.dataType === "moveObject") {
    const fields = spotPool.data.content.fields as any;
    console.log("Spot Pool Reserves:");
    console.log(`  Asset: ${fields.asset_reserve}`);
    console.log(`  Stable: ${fields.stable_reserve}`);
    console.log(`  Fee BPS: ${fields.fee_bps}`);
    console.log(
      `  Conditional Liquidity Ratio: ${fields.aggregator_config?.fields?.conditional_liquidity_ratio_percent || "N/A"}%`
    );
  }
}

main();
