/**
 * Oracle Init Actions
 *
 * Builders for oracle grant operations during initialization/intent staging.
 * Handles creating and canceling oracle-based token grants.
 *
 * @module oracle-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import type { TierSpec } from '../../services/oracle-actions';

// BCS definitions for oracle structs
const RecipientMintBcs = bcs.struct('RecipientMint', {
  recipient: bcs.Address,
  amount: bcs.u64(),
});

const TierSpecBcs = bcs.struct('TierSpec', {
  price_threshold: bcs.u128(),
  is_above: bcs.bool(),
  recipients: bcs.vector(RecipientMintBcs),
  tier_description: bcs.string(),
});

/**
 * Oracle initialization action builders
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Create oracle grant with price tiers
 * OracleInitActions.addCreateOracleGrant(tx, builder, oracleActionsPackageId, {
 *   assetType: '0xPACKAGE::token::TOKEN',
 *   stableType: '0x2::sui::SUI',
 *   tierSpecs: [
 *     {
 *       priceThreshold: 1000000000n, // $1
 *       isAbove: true,
 *       recipients: [
 *         { recipient: '0xUSER', amount: 1000000000n }
 *       ],
 *       tierDescription: 'Tier 1: Price above $1',
 *     }
 *   ],
 *   useRelativePricing: false,
 *   launchpadMultiplier: 1,
 *   earliestExecutionOffsetMs: 86400000, // 1 day
 *   expiryYears: 5,
 *   cancelable: true,
 *   description: 'Token grant vesting schedule',
 * });
 * ```
 */
export class OracleInitActions {
  /**
   * Add action to create oracle grant
   *
   * Creates a token grant with price-based unlock tiers.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param oracleActionsPackageId - Package ID for futarchy_oracle_actions
   * @param config - Oracle grant configuration
   */
  static addCreateOracleGrant(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    oracleActionsPackageId: string,
    config: {
      assetType: string;
      stableType: string;
      tierSpecs: TierSpec[];
      useRelativePricing: boolean;
      launchpadMultiplier: bigint | number;
      earliestExecutionOffsetMs: bigint | number;
      expiryYears: bigint | number;
      cancelable: boolean;
      description: string;
    }
  ): void {
    // Serialize tier specs to BCS
    const tierSpecsBytes = config.tierSpecs.map(tier => {
      const serialized = TierSpecBcs.serialize({
        price_threshold: tier.priceThreshold,
        is_above: tier.isAbove,
        recipients: tier.recipients.map(r => ({
          recipient: r.recipient,
          amount: BigInt(r.amount),
        })),
        tier_description: tier.tierDescription,
      }).toBytes();
      return tx.pure.vector('u8', Array.from(serialized));
    });

    // Create tier specs vector using moveCall to construct
    const tierSpecsVec = tx.makeMoveVec({
      type: `${oracleActionsPackageId}::oracle_init_actions::TierSpec`,
      elements: tierSpecsBytes.map(bytes =>
        tx.moveCall({
          target: '0x1::bcs::peel_vec_u8',
          arguments: [bytes],
        })
      ),
    });

    tx.moveCall({
      target: `${oracleActionsPackageId}::oracle_init_actions::add_create_oracle_grant_spec`,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        builder,
        tierSpecsVec,
        tx.pure.bool(config.useRelativePricing),
        tx.pure.u64(config.launchpadMultiplier),
        tx.pure.u64(config.earliestExecutionOffsetMs),
        tx.pure.u64(config.expiryYears),
        tx.pure.bool(config.cancelable),
        tx.pure.string(config.description),
      ],
    });
  }

  /**
   * Add action to cancel oracle grant
   *
   * Cancels an existing oracle grant.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param oracleActionsPackageId - Package ID for futarchy_oracle_actions
   * @param config - Configuration
   */
  static addCancelGrant(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    oracleActionsPackageId: string,
    config: {
      grantId: string;
    }
  ): void {
    tx.moveCall({
      target: `${oracleActionsPackageId}::oracle_init_actions::add_cancel_grant_spec`,
      arguments: [
        builder,
        tx.pure.id(config.grantId),
      ],
    });
  }

}
