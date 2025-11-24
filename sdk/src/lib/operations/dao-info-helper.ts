/**
 * DAO Info Helper - Auto-fetch DAO information
 *
 * Fetches all necessary DAO info from just the DAO ID.
 * This eliminates the need for users to know asset types, pool IDs, etc.
 *
 * @module dao-info-helper
 */

import { SuiClient } from '@mysten/sui/client';

/**
 * Complete DAO information
 */
export interface DAOInfo {
  /** DAO account ID */
  id: string;

  /** Asset coin type (e.g., "0x...::token::TOKEN") */
  assetType: string;

  /** Stable coin type (e.g., "0x2::sui::SUI") */
  stableType: string;

  /** Spot pool ID */
  spotPoolId: string;

  /** DAO name */
  name: string;

  /** DAO description */
  description: string;

  /** Icon URL */
  iconUrl: string;

  /** Trading period in ms */
  tradingPeriodMs: number;

  /** Review period in ms */
  reviewPeriodMs: number;

  /** Whether proposals are enabled */
  proposalsEnabled: boolean;

  /** Package registry ID */
  packageRegistryId: string;
}

/**
 * Helper to fetch complete DAO info from just the DAO ID
 */
export class DAOInfoHelper {
  private client: SuiClient;
  private cache: Map<string, { info: DAOInfo; timestamp: number }> = new Map();
  private cacheTtlMs: number = 60000; // 1 minute cache

  constructor(client: SuiClient) {
    this.client = client;
  }

  /**
   * Get complete DAO info from just the DAO ID
   *
   * This fetches and caches all necessary information about a DAO.
   * Users don't need to know asset types, pool IDs, etc.
   *
   * @param daoId - DAO account ID
   * @returns Complete DAO info
   *
   * @example
   * ```typescript
   * const info = await daoHelper.getInfo("0x123...");
   * console.log(info.assetType, info.spotPoolId);
   * ```
   */
  async getInfo(daoId: string): Promise<DAOInfo> {
    // Check cache
    const cached = this.cache.get(daoId);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.info;
    }

    // Fetch DAO object
    const daoObj = await this.client.getObject({
      id: daoId,
      options: { showContent: true, showType: true },
    });

    if (!daoObj.data?.content || daoObj.data.content.dataType !== 'moveObject') {
      throw new Error(`DAO not found: ${daoId}`);
    }

    // Parse the DAO fields
    const fields = daoObj.data.content.fields as any;

    // Get config from dynamic fields or nested structure
    const config = fields.config?.fields || {};
    const metadata = config.metadata?.fields || {};
    const daoConfig = config.dao_config?.fields || {};
    const tradingParams = daoConfig.trading_params?.fields || {};
    const metadataConfig = daoConfig.metadata_config?.fields || {};

    // Extract asset and stable types from the FutarchyConfig
    // The config stores these as type parameters
    let assetType = '';
    let stableType = '';

    // Try to find spot pool to get types
    const spotPoolId = await this.findSpotPool(daoId);
    if (spotPoolId) {
      const poolInfo = await this.getPoolTypes(spotPoolId);
      assetType = poolInfo.assetType;
      stableType = poolInfo.stableType;
    }

    const info: DAOInfo = {
      id: daoId,
      assetType,
      stableType,
      spotPoolId: spotPoolId || '',
      name: metadataConfig.name || metadata.name || '',
      description: metadataConfig.description || metadata.description || '',
      iconUrl: metadataConfig.icon_url || metadata.icon_url || '',
      tradingPeriodMs: Number(tradingParams.trading_period_ms || 0),
      reviewPeriodMs: Number(tradingParams.review_period_ms || 0),
      proposalsEnabled: config.proposals_enabled !== false,
      packageRegistryId: '', // Would need to be passed in or discovered
    };

    // Cache the result
    this.cache.set(daoId, { info, timestamp: Date.now() });

    return info;
  }

  /**
   * Find the spot pool for a DAO
   */
  private async findSpotPool(daoId: string): Promise<string | null> {
    // Query events to find the spot pool created with this DAO
    try {
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `::unified_spot_pool::PoolCreated`,
        },
        limit: 50,
      });

      for (const event of events.data) {
        const parsedJson = event.parsedJson as any;
        if (parsedJson?.dao_id === daoId || parsedJson?.account_id === daoId) {
          return parsedJson.pool_id;
        }
      }
    } catch {
      // Ignore errors
    }

    // Alternative: query owned objects
    try {
      const objects = await this.client.getOwnedObjects({
        owner: daoId,
        filter: {
          MatchAll: [
            { StructType: `::unified_spot_pool::UnifiedSpotPool` },
          ],
        },
        options: { showType: true },
      });

      if (objects.data.length > 0) {
        return objects.data[0].data?.objectId || null;
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  /**
   * Get asset and stable types from a pool
   */
  private async getPoolTypes(poolId: string): Promise<{ assetType: string; stableType: string }> {
    const poolObj = await this.client.getObject({
      id: poolId,
      options: { showType: true },
    });

    if (!poolObj.data?.type) {
      return { assetType: '', stableType: '' };
    }

    // Parse type: "0xPKG::unified_spot_pool::UnifiedSpotPool<AssetType, StableType>"
    const typeMatch = poolObj.data.type.match(/<(.+),\s*(.+)>/);
    if (typeMatch) {
      return {
        assetType: typeMatch[1].trim(),
        stableType: typeMatch[2].trim(),
      };
    }

    return { assetType: '', stableType: '' };
  }

  /**
   * Clear cache for a specific DAO or all DAOs
   */
  clearCache(daoId?: string): void {
    if (daoId) {
      this.cache.delete(daoId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get asset type for a DAO
   */
  async getAssetType(daoId: string): Promise<string> {
    const info = await this.getInfo(daoId);
    return info.assetType;
  }

  /**
   * Get stable type for a DAO
   */
  async getStableType(daoId: string): Promise<string> {
    const info = await this.getInfo(daoId);
    return info.stableType;
  }

  /**
   * Get spot pool ID for a DAO
   */
  async getSpotPoolId(daoId: string): Promise<string> {
    const info = await this.getInfo(daoId);
    return info.spotPoolId;
  }
}
