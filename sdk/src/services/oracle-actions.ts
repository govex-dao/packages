/**
 * Oracle Actions Operations
 *
 * Price-based grants that unlock tokens when price conditions are met.
 * Grants have multiple tiers, each with its own price threshold and recipients.
 *
 * @module oracle-actions
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { BaseTransactionBuilder, TransactionUtils } from './transaction';
import { bcs } from '@mysten/sui/bcs';

export interface TierSpec {
  /** Price threshold for this tier (u128) */
  priceThreshold: bigint;
  /** True if trigger when price >= threshold, false if price <= threshold */
  isAbove: boolean;
  /** Recipients and their mint amounts */
  recipients: RecipientMint[];
  /** Description of this tier */
  tierDescription: string;
}

export interface RecipientMint {
  /** Address to receive tokens */
  recipient: string;
  /** Amount to mint for this recipient */
  amount: bigint | number;
}

export interface CreateGrantConfig {
  /** DAO account ID */
  accountId: string;
  /** Asset token type */
  assetType: string;
  /** Stable token type */
  stableType: string;
  /** Tiers with price conditions and recipients */
  tiers: TierSpec[];
  /** Use relative pricing (based on launchpad price) */
  useRelativePricing: boolean;
  /** Launchpad price multiplier (if useRelativePricing=true) */
  launchpadMultiplier?: number;
  /** Earliest time grant can be claimed (ms offset from now) */
  earliestExecutionOffsetMs: number;
  /** Grant expires after this many years */
  expiryYears: number;
  /** Can grant be cancelled */
  cancelable: boolean;
  /** Grant description */
  description: string;
  /** DAO ID for tracking */
  daoId: string;
  /** Clock object (defaults to 0x6) */
  clock?: string;
}

export interface ClaimGrantConfig {
  /** DAO account ID */
  accountId: string;
  /** Asset token type */
  assetType: string;
  /** Stable token type */
  stableType: string;
  /** Grant object ID */
  grantId: string;
  /** Tier index to claim */
  tierIndex: number;
  /** ClaimCap object ID */
  claimCapId: string;
  /** Spot pool ID for price checking */
  spotPoolId: string;
  /** Conditional pool IDs (for all outcomes) */
  conditionalPoolIds: string[];
  /** Clock object (defaults to 0x6) */
  clock?: string;
}

/**
 * Oracle Actions for price-based grants
 *
 * @example Create a grant with 3 price tiers
 * ```typescript
 * const tx = sdk.oracleActions.createGrant({
 *   accountId: daoId,
 *   assetType,
 *   stableType,
 *   tiers: [
 *     {
 *       priceThreshold: 1_000_000_000n, // $1
 *       isAbove: true,
 *       recipients: [{ recipient: teamAddress, amount: 100_000n }],
 *       tierDescription: "Unlock at $1",
 *     },
 *     {
 *       priceThreshold: 5_000_000_000n, // $5
 *       isAbove: true,
 *       recipients: [{ recipient: teamAddress, amount: 200_000n }],
 *       tierDescription: "Unlock at $5",
 *     },
 *   ],
 *   useRelativePricing: false,
 *   earliestExecutionOffsetMs: 30 * 24 * 60 * 60 * 1000, // 30 days
 *   expiryYears: 4,
 *   cancelable: true,
 *   description: "Team vesting based on price milestones",
 *   daoId,
 * });
 * ```
 */
export class OracleActionsOperations {
  private client: SuiClient;
  private oracleActionsPackageId: string;
  private packageRegistryId: string;
  private futarchyCorePackageId: string;

  constructor(
    client: SuiClient,
    oracleActionsPackageId: string,
    packageRegistryId: string,
    futarchyCorePackageId: string
  ) {
    this.client = client;
    this.oracleActionsPackageId = oracleActionsPackageId;
    this.packageRegistryId = packageRegistryId;
    this.futarchyCorePackageId = futarchyCorePackageId;
  }

  /**
   * Create a price-based grant with multiple tiers
   *
   * Each tier unlocks when the asset price reaches the threshold.
   * Recipients can claim their tokens once the condition is met and
   * the earliest execution time has passed.
   *
   * @param config - Grant configuration
   * @returns Transaction for creating grant
   *
   * @example
   * ```typescript
   * const tx = sdk.oracleActions.createGrant({
   *   accountId: daoId,
   *   assetType: "0xPKG::coin::MYCOIN",
   *   stableType: "0x2::sui::SUI",
   *   tiers: [
   *     {
   *       priceThreshold: 1_000_000_000n, // $1
   *       isAbove: true,
   *       recipients: [{ recipient: "0xTEAM", amount: 100_000n }],
   *       tierDescription: "First milestone at $1",
   *     },
   *   ],
   *   useRelativePricing: false,
   *   earliestExecutionOffsetMs: 30 * 24 * 60 * 60 * 1000,
   *   expiryYears: 4,
   *   cancelable: true,
   *   description: "Price-based team vesting",
   *   daoId,
   * });
   * ```
   */
  createGrant(config: CreateGrantConfig): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    const target = TransactionUtils.buildTarget(
      this.oracleActionsPackageId,
      'oracle_actions',
      'create_grant'
    );

    // Build tier specs
    const tierSpecArgs = config.tiers.map((tier) => {
      // Build recipient mints for this tier
      const recipientArgs = tier.recipients.map((r) =>
        tx.moveCall({
          target: TransactionUtils.buildTarget(
            this.oracleActionsPackageId,
            'oracle_actions',
            'new_recipient_mint'
          ),
          arguments: [
            tx.pure(bcs.Address.serialize(r.recipient).toBytes()),
            tx.pure.u64(r.amount),
          ],
        })
      );

      // Create tier spec
      return tx.moveCall({
        target: TransactionUtils.buildTarget(
          this.oracleActionsPackageId,
          'oracle_actions',
          'new_tier_spec'
        ),
        arguments: [
          tx.pure.u128(tier.priceThreshold),
          tx.pure.bool(tier.isAbove),
          tx.makeMoveVec({ elements: recipientArgs }),
          tx.pure.string(tier.tierDescription),
        ],
      });
    });

    // Create tier vector
    const tiersVec = tx.makeMoveVec({ elements: tierSpecArgs });

    // Create grant
    tx.moveCall({
      target,
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.accountId), // account
        tx.object(this.packageRegistryId), // registry
        tiersVec, // tiers
        tx.pure.bool(config.useRelativePricing), // use_relative_pricing
        tx.pure.option('u64', config.launchpadMultiplier ?? null), // launchpad_multiplier
        tx.pure.u64(config.earliestExecutionOffsetMs), // earliest_execution_offset_ms
        tx.pure.u64(config.expiryYears), // expiry_years
        tx.pure.bool(config.cancelable), // cancelable
        tx.pure.string(config.description), // description
        tx.pure.id(config.daoId), // dao_id
        tx.object(config.clock || '0x6'), // clock
      ],
    });

    return tx;
  }

  /**
   * Claim tokens from a grant tier (Step 1 of 2)
   *
   * This creates a ClaimRequest that must be fulfilled in the same transaction.
   * The two-step process validates price conditions before minting.
   *
   * @param config - Claim configuration
   * @returns Transaction for claiming grant
   *
   * @example
   * ```typescript
   * const tx = sdk.oracleActions.claimGrantWithFulfill({
   *   accountId: daoId,
   *   assetType,
   *   stableType,
   *   grantId,
   *   tierIndex: 0, // First tier
   *   claimCapId,
   *   spotPoolId,
   *   conditionalPoolIds: [pool0Id, pool1Id],
   * });
   * ```
   */
  claimGrantWithFulfill(config: ClaimGrantConfig): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    const versionWitness = tx.moveCall({
      target: `${this.packageRegistryId}::version::current`,
      arguments: [],
    });

    // Step 1: Create claim request
    const claimRequest = tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.oracleActionsPackageId,
        'oracle_actions',
        'claim_grant'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.accountId), // account
        tx.object(this.packageRegistryId), // registry
        versionWitness, // version
        tx.object(config.grantId), // grant
        tx.pure.u64(config.tierIndex), // tier_index
        tx.object(config.claimCapId), // claim_cap
        tx.object(config.spotPoolId), // spot_pool
        tx.makeMoveVec({
          elements: config.conditionalPoolIds.map((id) => tx.object(id)),
        }), // conditional_pools
        tx.object(config.clock || '0x6'), // clock
      ],
    });

    // Step 2: Fulfill claim (mint tokens)
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.oracleActionsPackageId,
        'oracle_actions',
        'fulfill_claim_grant_from_account'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        `${this.futarchyCorePackageId}::futarchy_config::FutarchyConfig`,
      ],
      arguments: [
        claimRequest, // request
        tx.object(config.accountId), // account
        tx.object(this.packageRegistryId), // registry
        tx.object(config.clock || '0x6'), // clock
      ],
    });

    return tx;
  }

  /**
   * Cancel a grant (if cancelable)
   *
   * @param grantId - Grant object ID
   * @param clock - Clock object
   * @returns Transaction for cancelling grant
   */
  cancelGrant(
    grantId: string,
    assetType: string,
    stableType: string,
    clock: string = '0x6'
  ): Transaction {
    const builder = new BaseTransactionBuilder(this.client);
    const tx = builder.getTransaction();

    tx.moveCall({
      target: TransactionUtils.buildTarget(
        this.oracleActionsPackageId,
        'oracle_actions',
        'cancel_grant'
      ),
      typeArguments: [assetType, stableType],
      arguments: [tx.object(grantId), tx.object(clock)],
    });

    return tx;
  }

  /**
   * View: Get total amount claimable in grant
   */
  async getTotalAmount(
    grantId: string,
    _assetType: string,
    _stableType: string
  ): Promise<bigint> {
    const grant = await this.client.getObject({
      id: grantId,
      options: { showContent: true },
    });

    if (!grant.data?.content || grant.data.content.dataType !== 'moveObject') {
      throw new Error('Grant not found');
    }

    const fields = grant.data.content.fields as any;
    return BigInt(fields.total_amount || 0);
  }

  /**
   * View: Check if grant is cancelled
   */
  async isCanceled(
    grantId: string,
    _assetType: string,
    _stableType: string
  ): Promise<boolean> {
    const grant = await this.client.getObject({
      id: grantId,
      options: { showContent: true },
    });

    if (!grant.data?.content || grant.data.content.dataType !== 'moveObject') {
      throw new Error('Grant not found');
    }

    const fields = grant.data.content.fields as any;
    return fields.is_canceled === true;
  }

  /**
   * View: Get grant description
   */
  async getDescription(
    grantId: string,
    _assetType: string,
    _stableType: string
  ): Promise<string> {
    const grant = await this.client.getObject({
      id: grantId,
      options: { showContent: true },
    });

    if (!grant.data?.content || grant.data.content.dataType !== 'moveObject') {
      throw new Error('Grant not found');
    }

    const fields = grant.data.content.fields as any;
    return fields.description || '';
  }

  /**
   * View: Get number of tiers in grant
   */
  async getTierCount(
    grantId: string,
    _assetType: string,
    _stableType: string
  ): Promise<number> {
    const grant = await this.client.getObject({
      id: grantId,
      options: { showContent: true },
    });

    if (!grant.data?.content || grant.data.content.dataType !== 'moveObject') {
      throw new Error('Grant not found');
    }

    const fields = grant.data.content.fields as any;
    const tiers = fields.tiers as any[];
    return tiers?.length || 0;
  }

  /**
   * Helper: Calculate absolute price from launchpad price and multiplier
   *
   * @param launchpadPrice - Initial launchpad price (u128)
   * @param multiplier - Multiplier (e.g., 2 for 2x)
   * @returns Absolute price threshold
   *
   * @example
   * ```typescript
   * // If launched at $0.10, 10x = $1.00
   * const threshold = OracleActionsOperations.calculateAbsoluteThreshold(
   *   100_000_000n, // $0.10
   *   10 // 10x
   * ); // Returns 1_000_000_000n ($1.00)
   * ```
   */
  static calculateAbsoluteThreshold(
    launchpadPrice: bigint,
    multiplier: number
  ): bigint {
    return launchpadPrice * BigInt(multiplier);
  }

  /**
   * View: Get all grant IDs for a DAO
   *
   * @param accountId - DAO account ID
   * @returns Promise with array of grant IDs
   */
  async getAllGrantIds(accountId: string): Promise<string[]> {
    const tx = new Transaction();

    const versionWitness = tx.moveCall({
      target: `${this.packageRegistryId}::version::current`,
      arguments: [],
    });

    const result = await this.client.devInspectTransactionBlock({
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      transactionBlock: (() => {
        tx.moveCall({
          target: TransactionUtils.buildTarget(
            this.oracleActionsPackageId,
            'oracle_actions',
            'get_all_grant_ids'
          ),
          arguments: [
            tx.object(accountId),
            tx.object(this.packageRegistryId),
            versionWitness,
          ],
        });
        return tx;
      })(),
    });

    if (result.results && result.results[0]?.returnValues) {
      // Parse vector<ID> from BCS bytes using @mysten/sui bcs
      try {
        const [returnValue] = result.results[0].returnValues;
        if (returnValue && returnValue[0]) {
          const bytes = new Uint8Array(returnValue[0]);
          // vector<ID> is serialized as length-prefixed array of 32-byte addresses
          const dataView = new DataView(bytes.buffer);
          const length = dataView.getUint32(0, true); // ULEB128 simplified as u32 for small vectors
          const ids: string[] = [];
          let offset = 4; // Skip length prefix (simplified)
          for (let i = 0; i < length && offset + 32 <= bytes.length; i++) {
            const idBytes = bytes.slice(offset, offset + 32);
            const hex = '0x' + Array.from(idBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            ids.push(hex);
            offset += 32;
          }
          return ids;
        }
      } catch {
        // Deserialization failed, return empty array
      }
    }

    return [];
  }
}

/**
 * Oracle Action Markers
 *
 * Static utilities for getting action type markers for PTB construction.
 *
 * @example Get create grant marker
 * ```typescript
 * const marker = OracleActionMarkers.createOracleGrantMarker(tx, oracleActionsPackageId);
 * ```
 */
export class OracleActionMarkers {
  static createOracleGrantMarker(
    tx: Transaction,
    oracleActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        oracleActionsPackageId,
        'oracle_actions',
        'create_oracle_grant_marker'
      ),
      arguments: [],
    });
  }

  static cancelGrantMarker(
    tx: Transaction,
    oracleActionsPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        oracleActionsPackageId,
        'oracle_actions',
        'cancel_grant_marker'
      ),
      arguments: [],
    });
  }
}

/**
 * Oracle Action Constructors
 *
 * Static utilities for creating action structs for PTB execution.
 *
 * @example Create oracle grant action
 * ```typescript
 * const action = OracleActionConstructors.newCreateOracleGrant(tx, {
 *   oracleActionsPackageId,
 *   assetType,
 *   stableType,
 *   tiers: [tierSpec1, tierSpec2],
 *   useRelativePricing: false,
 *   launchpadMultiplier: null,
 *   earliestExecutionOffsetMs: 30 * 24 * 60 * 60 * 1000n,
 *   expiryYears: 4n,
 *   cancelable: true,
 *   description: "Team vesting grant",
 *   daoId: "0xdao...",
 * });
 * ```
 */
export class OracleActionConstructors {
  /**
   * Create new RecipientMint struct
   */
  static newRecipientMint(
    tx: Transaction,
    oracleActionsPackageId: string,
    recipient: string,
    amount: bigint
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        oracleActionsPackageId,
        'oracle_actions',
        'new_recipient_mint'
      ),
      arguments: [
        tx.pure(bcs.Address.serialize(recipient).toBytes()),
        tx.pure.u64(amount),
      ],
    });
  }

  /**
   * Create new TierSpec struct
   */
  static newTierSpec(
    tx: Transaction,
    oracleActionsPackageId: string,
    priceThreshold: bigint,
    isAbove: boolean,
    recipients: ReturnType<Transaction['moveCall']>[],
    tierDescription: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        oracleActionsPackageId,
        'oracle_actions',
        'new_tier_spec'
      ),
      arguments: [
        tx.pure.u128(priceThreshold),
        tx.pure.bool(isAbove),
        tx.makeMoveVec({ elements: recipients }),
        tx.pure.string(tierDescription),
      ],
    });
  }

  /**
   * Create CreateOracleGrant action for PTB
   */
  static newCreateOracleGrant(
    tx: Transaction,
    config: {
      oracleActionsPackageId: string;
      assetType: string;
      stableType: string;
      tiers: ReturnType<Transaction['moveCall']>[];
      useRelativePricing: boolean;
      launchpadMultiplier: bigint | null;
      earliestExecutionOffsetMs: bigint;
      expiryYears: bigint;
      cancelable: boolean;
      description: string;
      daoId: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.oracleActionsPackageId,
        'oracle_actions',
        'new_create_oracle_grant'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.makeMoveVec({ elements: config.tiers }),
        tx.pure.bool(config.useRelativePricing),
        tx.pure.option('u64', config.launchpadMultiplier),
        tx.pure.u64(config.earliestExecutionOffsetMs),
        tx.pure.u64(config.expiryYears),
        tx.pure.bool(config.cancelable),
        tx.pure.string(config.description),
        tx.pure.id(config.daoId),
      ],
    });
  }

  /**
   * Create CancelGrant action for PTB
   */
  static newCancelGrant(
    tx: Transaction,
    oracleActionsPackageId: string,
    grantId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        oracleActionsPackageId,
        'oracle_actions',
        'new_cancel_grant'
      ),
      arguments: [tx.pure.id(grantId)],
    });
  }
}

/**
 * Oracle Action Executors
 *
 * Static utilities for executing oracle actions in PTB (for governance).
 *
 * @example Execute create oracle grant via governance
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get executable from governance
 * const [executable, intentKey] = GovernanceIntents.executeProposalIntent(tx, {...});
 * const versionWitness = ...;
 * const intentWitness = ...;
 *
 * // Execute create grant
 * OracleActionExecutors.doCreateOracleGrant(tx, {
 *   oracleActionsPackageId,
 *   daoId,
 *   registryId,
 *   assetType,
 *   stableType,
 *   outcomeType,
 *   intentWitnessType,
 *   clock: '0x6',
 * }, executable, versionWitness, intentWitness);
 * ```
 */
export class OracleActionExecutors {
  static doCreateOracleGrant(
    tx: Transaction,
    config: {
      oracleActionsPackageId: string;
      daoId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.oracleActionsPackageId,
        'oracle_actions',
        'do_create_oracle_grant'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static doCancelGrant(
    tx: Transaction,
    config: {
      oracleActionsPackageId: string;
      daoId: string;
      registryId: string;
      assetType: string;
      stableType: string;
      outcomeType: string;
      intentWitnessType: string;
      clock?: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.oracleActionsPackageId,
        'oracle_actions',
        'do_cancel_grant'
      ),
      typeArguments: [
        config.assetType,
        config.stableType,
        config.outcomeType,
        config.intentWitnessType,
      ],
      arguments: [
        executable,
        tx.object(config.daoId),
        tx.object(config.registryId),
        versionWitness,
        intentWitness,
        tx.object(config.clock || '0x6'),
      ],
    });
  }
}

/**
 * Oracle Action Delete Functions
 *
 * Static utilities for deleting expired action specs.
 *
 * @example Delete CreateOracleGrant from expired intent
 * ```typescript
 * OracleActionDelete.deleteCreateOracleGrant(tx, oracleActionsPackageId, assetType, stableType, expired);
 * ```
 */
export class OracleActionDelete {
  static deleteCreateOracleGrant(
    tx: Transaction,
    oracleActionsPackageId: string,
    assetType: string,
    stableType: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        oracleActionsPackageId,
        'oracle_actions',
        'delete_create_oracle_grant'
      ),
      typeArguments: [assetType, stableType],
      arguments: [expired],
    });
  }

  static deleteCancelGrant(
    tx: Transaction,
    oracleActionsPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        oracleActionsPackageId,
        'oracle_actions',
        'delete_cancel_grant'
      ),
      arguments: [expired],
    });
  }
}

/**
 * Oracle Action Helpers
 *
 * Static utilities for price calculations and helpers.
 *
 * @example Calculate absolute threshold from relative
 * ```typescript
 * const absoluteThreshold = OracleActionHelpers.relativeToAbsoluteThreshold(
 *   tx,
 *   oracleActionsPackageId,
 *   launchpadPrice,
 *   multiplier
 * );
 * ```
 */
export class OracleActionHelpers {
  /**
   * Convert relative price (multiplier) to absolute threshold
   */
  static relativeToAbsoluteThreshold(
    tx: Transaction,
    oracleActionsPackageId: string,
    launchpadPrice: bigint,
    multiplier: bigint
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        oracleActionsPackageId,
        'oracle_actions',
        'relative_to_absolute_threshold'
      ),
      arguments: [tx.pure.u128(launchpadPrice), tx.pure.u64(multiplier)],
    });
  }

  /**
   * Create absolute price condition
   */
  static absolutePriceCondition(
    tx: Transaction,
    oracleActionsPackageId: string,
    priceThreshold: bigint,
    isAbove: boolean
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        oracleActionsPackageId,
        'oracle_actions',
        'absolute_price_condition'
      ),
      arguments: [tx.pure.u128(priceThreshold), tx.pure.bool(isAbove)],
    });
  }
}
