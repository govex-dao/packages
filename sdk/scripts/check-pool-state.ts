import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

async function main() {
  const client = new SuiClient({ url: getFullnodeUrl('devnet') });
  const poolId = '0x8d36c2cb75ad44aecd88434f40b4e968e23eb22241eef2a925580e6642aab660';

  console.log('Fetching pool state...');
  const pool = await client.getObject({
    id: poolId,
    options: { showContent: true }
  });

  if (pool.data?.content?.dataType === 'moveObject') {
    const fields = pool.data.content.fields as any;
    console.log('\n=== Pool State ===');
    console.log('Asset Reserve:', fields.asset_reserve);
    console.log('Stable Reserve:', fields.stable_reserve);
    console.log('Fee BPS:', fields.fee_bps);

    if (fields.aggregator_config) {
      console.log('\n=== Aggregator Config ===');
      const aggConfig = fields.aggregator_config;
      console.log('Type:', aggConfig.type);
      console.log('Fields:', JSON.stringify(aggConfig.fields, null, 2));
    }
  }

  console.log('\n=== Full Object ===');
  console.log(JSON.stringify(pool, null, 2));
}

main().catch(console.error);
