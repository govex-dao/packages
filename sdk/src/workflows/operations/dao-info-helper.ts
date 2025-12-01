/**
 * DAO Info Helper - Fetches DAO information from on-chain state
 *
 * @module dao-info-helper
 */

import { SuiClient } from '@mysten/sui/client';

/**
 * DAO information fetched from on-chain
 */
export interface DAOInfo {
  id: string;
  assetType: string;
  stableType: string;
  spotPoolId: string;
}

/**
 * Helper class to fetch DAO information from on-chain state
 */
export class DAOInfoHelper {
  constructor(private client: SuiClient) {}

  /**
   * Get DAO information by account ID
   *
   * @param daoId - DAO account object ID
   * @returns DAO information including asset/stable types and spot pool ID
   */
  async getInfo(daoId: string): Promise<DAOInfo> {
    const daoObject = await this.client.getObject({
      id: daoId,
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (!daoObject.data?.content || daoObject.data.content.dataType !== 'moveObject') {
      throw new Error(`DAO not found: ${daoId}`);
    }

    const type = daoObject.data.type;
    if (!type) {
      throw new Error(`Could not determine DAO type for: ${daoId}`);
    }

    // Parse type args from Account<Config<Asset, Stable>>
    // Format: package::account::Account<package::dao_config::DaoConfig<Asset, Stable>>
    const typeMatch = type.match(/<.*?<(.+?),\s*(.+?)>>/);
    if (!typeMatch) {
      throw new Error(`Could not parse DAO type parameters from: ${type}`);
    }

    const assetType = typeMatch[1].trim();
    const stableType = typeMatch[2].trim();

    // Get spot pool ID from DAO config
    const fields = (daoObject.data.content as any).fields;
    const configFields = fields?.config?.fields;

    if (!configFields?.spot_pool_id) {
      throw new Error(`DAO does not have spot pool configured: ${daoId}`);
    }

    return {
      id: daoId,
      assetType,
      stableType,
      spotPoolId: configFields.spot_pool_id,
    };
  }
}
