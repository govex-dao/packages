import { readFileSync } from 'fs';
import { join } from 'path';
import { GovexSDK } from '../src';
import { UnifiedSpotPool } from '../src/lib/markets-core/unified-spot-pool';

/**
 * Cleanup script: Extract stuck escrow from spot pool
 *
 * This happens when a proposal test fails after quantum split but before finalization.
 * The escrow gets stuck in the pool and blocks future proposals.
 */
async function main() {
  console.log('================================================================================');
  console.log('CLEANUP: EXTRACT STUCK ESCROW FROM SPOT POOL');
  console.log('================================================================================\n');

  // Load DAO info
  const daoInfoPath = join(__dirname, '..', 'test-dao-info.json');
  const daoInfo = JSON.parse(readFileSync(daoInfoPath, 'utf-8'));

  console.log('📂 Loading pool info...');
  console.log(`✅ Spot Pool: ${daoInfo.spotPoolId}`);
  console.log(`✅ Asset Type: ${daoInfo.assetType}`);
  console.log(`✅ Stable Type: ${daoInfo.stableType}\n`);

  // Initialize SDK
  const sdk = await GovexSDK.init({ network: 'devnet' });
  console.log('✅ SDK initialized\n');

  // Check if pool has active escrow
  console.log('🔍 Checking for active escrow...');
  const pool = await sdk.client.getObject({
    id: daoInfo.spotPoolId,
    options: { showContent: true }
  });

  if (pool.data?.content?.dataType === 'moveObject') {
    const fields = pool.data.content.fields as any;
    const aggConfig = fields.aggregator_config?.fields;

    if (!aggConfig || !aggConfig.active_escrow || aggConfig.active_escrow === null) {
      console.log('✅ Pool is clean - no active escrow found');
      return;
    }

    console.log(`⚠️  Found stuck escrow: ${aggConfig.active_escrow}`);
    console.log(`   Last usage: ${new Date(parseInt(aggConfig.last_proposal_usage)).toISOString()}\n`);

    // Extract escrow
    console.log('🧹 Extracting escrow from pool...');

    const tx = sdk.transaction();

    // Call extract_active_escrow
    UnifiedSpotPool.extractActiveEscrow(tx, {
      marketsCorePackageId: sdk.config.packages.futarchy_markets_core,
      assetType: daoInfo.assetType,
      stableType: daoInfo.stableType,
      pool: tx.object(daoInfo.spotPoolId),
    });

    const result = await sdk.executeTransaction(tx);
    console.log(`✅ Escrow extracted!`);
    console.log(`   Digest: ${result.digest}\n`);

    // Verify cleanup
    console.log('✅ Verifying cleanup...');
    const cleanPool = await sdk.client.getObject({
      id: daoInfo.spotPoolId,
      options: { showContent: true }
    });

    if (cleanPool.data?.content?.dataType === 'moveObject') {
      const cleanFields = cleanPool.data.content.fields as any;
      const cleanAggConfig = cleanFields.aggregator_config?.fields;

      if (!cleanAggConfig?.active_escrow || cleanAggConfig.active_escrow === null) {
        console.log('✅ Pool successfully cleaned - ready for next proposal!\n');
      } else {
        console.log('❌ Escrow still present - cleanup may have failed\n');
      }
    }
  }
}

main().catch((error) => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
