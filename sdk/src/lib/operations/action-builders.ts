/**
 * Action Builders - High-level proposal action construction
 *
 * Provides simple, user-friendly API for building proposal actions.
 * Users describe what they want, SDK handles all the complexity.
 *
 * @module action-builders
 */

// Action builders return serializable data structures, not Transaction objects
// They are used by governance.createProposalSimple to build proposal actions

/**
 * Configuration for ActionBuilders
 */
export interface ActionBuildersConfig {
  accountActionsPackageId: string;
  futarchyActionsPackageId: string;
  futarchyCorePackageId: string;
  oracleActionsPackageId: string;
  governanceActionsPackageId: string;
}

/**
 * Proposal action - returned by action builders
 * These are passed to governance.createProposal()
 */
export interface ProposalAction {
  /** Action type identifier */
  type: string;
  /** Serialized action data */
  data: any;
  /** Package that handles this action */
  packageId: string;
  /** Module name */
  module: string;
  /** Function to call for init */
  initFunction: string;
}

/**
 * Vault spend action config
 */
export interface VaultSpendConfig {
  vaultName: string;
  coinType: string;
  amount: bigint;
  recipient: string;
}

/**
 * Vault deposit action config
 */
export interface VaultDepositConfig {
  vaultName: string;
  coinType: string;
  amount: bigint;
}

/**
 * Stream creation config
 */
export interface CreateStreamConfig {
  vaultName: string;
  coinType: string;
  beneficiary: string;
  totalAmount: bigint;
  startTimeMs: number;
  iterations: number;
  iterationPeriodMs: number;
  cliffTimeMs?: number;
  claimWindowMs?: number;
  maxPerWithdrawal?: bigint;
  isTransferable?: boolean;
  isCancellable?: boolean;
}

/**
 * Mint action config
 */
export interface MintConfig {
  amount: bigint;
  recipient: string;
}

/**
 * Transfer object config
 */
export interface TransferObjectConfig {
  objectId: string;
  objectType: string;
  recipient: string;
}

/**
 * Transfer coin config
 */
export interface TransferCoinConfig {
  coinType: string;
  amount: bigint;
  recipient: string;
}

/**
 * Config update config
 */
export interface UpdateConfigConfig {
  tradingPeriodMs?: number;
  reviewPeriodMs?: number;
  twapStartDelay?: number;
  twapStepMax?: number;
  ammTotalFeeBps?: number;
  maxOutcomes?: number;
}

/**
 * Oracle grant config
 */
export interface CreateGrantConfig {
  tiers: {
    priceThreshold: bigint;
    isAbove: boolean;
    recipients: { address: string; amount: bigint }[];
    description: string;
  }[];
  useRelativePricing: boolean;
  launchpadMultiplier?: number;
  earliestExecutionOffsetMs: number;
  expiryYears: number;
  cancelable: boolean;
  description: string;
}

/**
 * High-level action builders for proposals
 *
 * @example
 * ```typescript
 * const tx = sdk.governance.createProposal({
 *   daoId: "0x123...",
 *   title: "Fund Q1 Marketing",
 *   outcomes: ["Approve", "Reject"],
 *   onApprove: [
 *     sdk.actions.vaultSpend({
 *       vaultName: "treasury",
 *       coinType: "0x...::token::TOKEN",
 *       amount: 50_000n,
 *       recipient: "0xmarketing...",
 *     }),
 *     sdk.actions.createStream({
 *       vaultName: "treasury",
 *       coinType: "0x...::token::TOKEN",
 *       beneficiary: "0xdev...",
 *       totalAmount: 100_000n,
 *       startTimeMs: Date.now(),
 *       iterations: 12,
 *       iterationPeriodMs: 30 * 24 * 60 * 60 * 1000,
 *     }),
 *   ],
 * });
 * ```
 */
export class ActionBuilders {
  private config: ActionBuildersConfig;

  constructor(config: ActionBuildersConfig) {
    this.config = config;
  }

  // ============================================================================
  // VAULT ACTIONS
  // ============================================================================

  /**
   * Build vault spend action
   *
   * Withdraws coins from a vault to a recipient.
   *
   * @param config - Spend configuration
   * @returns Proposal action
   *
   * @example
   * ```typescript
   * sdk.actions.vaultSpend({
   *   vaultName: "treasury",
   *   coinType: "0x2::sui::SUI",
   *   amount: 1_000_000_000n,
   *   recipient: "0xabc...",
   * })
   * ```
   */
  vaultSpend(config: VaultSpendConfig): ProposalAction {
    return {
      type: 'VaultSpend',
      data: {
        vault_name: config.vaultName,
        coin_type: config.coinType,
        amount: config.amount.toString(),
        recipient: config.recipient,
      },
      packageId: this.config.accountActionsPackageId,
      module: 'vault',
      initFunction: 'add_spend_spec',
    };
  }

  /**
   * Build vault deposit action
   *
   * Deposits coins into a vault.
   *
   * @param config - Deposit configuration
   * @returns Proposal action
   */
  vaultDeposit(config: VaultDepositConfig): ProposalAction {
    return {
      type: 'VaultDeposit',
      data: {
        vault_name: config.vaultName,
        coin_type: config.coinType,
        amount: config.amount.toString(),
      },
      packageId: this.config.accountActionsPackageId,
      module: 'vault',
      initFunction: 'add_deposit_spec',
    };
  }

  /**
   * Build create stream action
   *
   * Creates a vesting stream from a vault.
   *
   * @param config - Stream configuration
   * @returns Proposal action
   *
   * @example
   * ```typescript
   * sdk.actions.createStream({
   *   vaultName: "treasury",
   *   coinType: "0x...::token::TOKEN",
   *   beneficiary: "0xdev...",
   *   totalAmount: 100_000n,
   *   startTimeMs: Date.now(),
   *   iterations: 12,
   *   iterationPeriodMs: 30 * 24 * 60 * 60 * 1000, // monthly
   *   isTransferable: true,
   *   isCancellable: true,
   * })
   * ```
   */
  createStream(config: CreateStreamConfig): ProposalAction {
    // Calculate amount per iteration
    const amountPerIteration = config.totalAmount / BigInt(config.iterations);

    return {
      type: 'CreateStream',
      data: {
        vault_name: config.vaultName,
        coin_type: config.coinType,
        beneficiary: config.beneficiary,
        amount_per_iteration: amountPerIteration.toString(),
        start_time: config.startTimeMs,
        iterations_total: config.iterations,
        iteration_period_ms: config.iterationPeriodMs,
        cliff_time: config.cliffTimeMs ?? null,
        claim_window_ms: config.claimWindowMs ?? null,
        max_per_withdrawal: config.maxPerWithdrawal?.toString() ?? config.totalAmount.toString(),
        is_transferable: config.isTransferable ?? true,
        is_cancellable: config.isCancellable ?? true,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'stream_init_actions',
      initFunction: 'add_create_stream_spec',
    };
  }

  /**
   * Build cancel stream action
   *
   * Cancels an existing vesting stream.
   *
   * @param streamId - Stream object ID
   * @returns Proposal action
   */
  cancelStream(streamId: string): ProposalAction {
    return {
      type: 'CancelStream',
      data: {
        stream_id: streamId,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'vault_init_actions',
      initFunction: 'add_cancel_stream_spec',
    };
  }

  /**
   * Build approve coin type action
   *
   * Approves a coin type for permissionless deposits to vault.
   *
   * @param vaultName - Vault name
   * @param coinType - Coin type to approve
   * @returns Proposal action
   */
  approveCoinType(vaultName: string, coinType: string): ProposalAction {
    return {
      type: 'ApproveCoinType',
      data: {
        vault_name: vaultName,
        coin_type: coinType,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'vault_init_actions',
      initFunction: 'add_approve_coin_type_spec',
    };
  }

  // ============================================================================
  // CURRENCY ACTIONS
  // ============================================================================

  /**
   * Build mint action
   *
   * Mints new tokens to a recipient.
   *
   * @param config - Mint configuration
   * @returns Proposal action
   *
   * @example
   * ```typescript
   * sdk.actions.mint({
   *   amount: 1_000_000n,
   *   recipient: "0xteam...",
   * })
   * ```
   */
  mint(config: MintConfig): ProposalAction {
    return {
      type: 'CurrencyMint',
      data: {
        amount: config.amount.toString(),
        recipient: config.recipient,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'currency_actions',
      initFunction: 'add_mint_spec',
    };
  }

  /**
   * Build burn action
   *
   * Burns tokens from the DAO's holdings.
   *
   * @param amount - Amount to burn
   * @returns Proposal action
   */
  burn(amount: bigint): ProposalAction {
    return {
      type: 'CurrencyBurn',
      data: {
        amount: amount.toString(),
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'currency_actions',
      initFunction: 'add_burn_spec',
    };
  }

  // ============================================================================
  // TRANSFER ACTIONS
  // ============================================================================

  /**
   * Build transfer object action
   *
   * Transfers an object from the DAO to a recipient.
   *
   * @param config - Transfer configuration
   * @returns Proposal action
   */
  transferObject(config: TransferObjectConfig): ProposalAction {
    return {
      type: 'TransferObject',
      data: {
        object_id: config.objectId,
        object_type: config.objectType,
        recipient: config.recipient,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'transfer_init_actions',
      initFunction: 'add_transfer_object_spec',
    };
  }

  /**
   * Build transfer coin action
   *
   * Transfers coins from the DAO to a recipient.
   *
   * @param config - Transfer configuration
   * @returns Proposal action
   */
  transferCoin(config: TransferCoinConfig): ProposalAction {
    return {
      type: 'TransferCoin',
      data: {
        coin_type: config.coinType,
        amount: config.amount.toString(),
        recipient: config.recipient,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'transfer_init_actions',
      initFunction: 'add_transfer_coin_spec',
    };
  }

  // ============================================================================
  // CONFIG ACTIONS
  // ============================================================================

  /**
   * Build update trading params action
   *
   * Updates DAO trading parameters.
   *
   * @param config - Config to update (only specified fields are changed)
   * @returns Proposal action
   *
   * @example
   * ```typescript
   * sdk.actions.updateTradingParams({
   *   tradingPeriodMs: 7 * 24 * 60 * 60 * 1000, // 7 days
   *   ammTotalFeeBps: 50, // 0.5%
   * })
   * ```
   */
  updateTradingParams(config: UpdateConfigConfig): ProposalAction {
    return {
      type: 'UpdateTradingParams',
      data: {
        trading_period_ms: config.tradingPeriodMs ?? null,
        review_period_ms: config.reviewPeriodMs ?? null,
        twap_start_delay: config.twapStartDelay ?? null,
        twap_step_max: config.twapStepMax ?? null,
        amm_total_fee_bps: config.ammTotalFeeBps ?? null,
        max_outcomes: config.maxOutcomes ?? null,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'config_init_actions',
      initFunction: 'add_update_trading_params_spec',
    };
  }

  // ============================================================================
  // QUOTA ACTIONS
  // ============================================================================

  /**
   * Build update quotas action
   *
   * Updates proposal quotas for team members.
   *
   * @param quotas - Map of address to quota amount
   * @returns Proposal action
   *
   * @example
   * ```typescript
   * sdk.actions.updateQuotas({
   *   "0xalice...": 5,
   *   "0xbob...": 3,
   * })
   * ```
   */
  updateQuotas(quotas: Record<string, number>): ProposalAction {
    return {
      type: 'UpdateQuotas',
      data: {
        quotas: Object.entries(quotas).map(([address, amount]) => ({
          address,
          amount,
        })),
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'quota_init_actions',
      initFunction: 'add_update_quotas_spec',
    };
  }

  // ============================================================================
  // ORACLE GRANT ACTIONS
  // ============================================================================

  /**
   * Build create oracle grant action
   *
   * Creates a price-based token grant.
   *
   * @param config - Grant configuration
   * @returns Proposal action
   *
   * @example
   * ```typescript
   * sdk.actions.createGrant({
   *   tiers: [
   *     {
   *       priceThreshold: 1_000_000_000n, // $1
   *       isAbove: true,
   *       recipients: [{ address: "0xteam...", amount: 100_000n }],
   *       description: "First milestone",
   *     },
   *   ],
   *   useRelativePricing: false,
   *   earliestExecutionOffsetMs: 30 * 24 * 60 * 60 * 1000,
   *   expiryYears: 4,
   *   cancelable: true,
   *   description: "Team price-based vesting",
   * })
   * ```
   */
  createGrant(config: CreateGrantConfig): ProposalAction {
    return {
      type: 'CreateOracleGrant',
      data: {
        tiers: config.tiers.map((tier) => ({
          price_threshold: tier.priceThreshold.toString(),
          is_above: tier.isAbove,
          recipients: tier.recipients.map((r) => ({
            address: r.address,
            amount: r.amount.toString(),
          })),
          description: tier.description,
        })),
        use_relative_pricing: config.useRelativePricing,
        launchpad_multiplier: config.launchpadMultiplier ?? null,
        earliest_execution_offset_ms: config.earliestExecutionOffsetMs,
        expiry_years: config.expiryYears,
        cancelable: config.cancelable,
        description: config.description,
      },
      packageId: this.config.oracleActionsPackageId,
      module: 'oracle_init_actions',
      initFunction: 'add_create_oracle_grant_spec',
    };
  }

  /**
   * Build cancel grant action
   *
   * Cancels an existing oracle grant.
   *
   * @param grantId - Grant object ID
   * @returns Proposal action
   */
  cancelGrant(grantId: string): ProposalAction {
    return {
      type: 'CancelGrant',
      data: {
        grant_id: grantId,
      },
      packageId: this.config.oracleActionsPackageId,
      module: 'oracle_init_actions',
      initFunction: 'add_cancel_grant_spec',
    };
  }

  // ============================================================================
  // MANAGED OBJECT ACTIONS
  // ============================================================================

  /**
   * Build add managed object action
   *
   * Adds an object to DAO storage with a name.
   *
   * @param name - Object name
   * @param objectId - Object ID
   * @param objectType - Object type
   * @returns Proposal action
   */
  addManagedObject(name: string, objectId: string, objectType: string): ProposalAction {
    return {
      type: 'AddManagedObject',
      data: {
        name,
        object_id: objectId,
        object_type: objectType,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'config_init_actions',
      initFunction: 'add_managed_object_spec',
    };
  }

  /**
   * Build remove managed object action
   *
   * Removes an object from DAO storage.
   *
   * @param name - Object name
   * @param objectType - Object type
   * @param recipient - Where to send the removed object
   * @returns Proposal action
   */
  removeManagedObject(name: string, objectType: string, recipient: string): ProposalAction {
    return {
      type: 'RemoveManagedObject',
      data: {
        name,
        object_type: objectType,
        recipient,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'config_init_actions',
      initFunction: 'remove_managed_object_spec',
    };
  }

  // ============================================================================
  // MEMO ACTION
  // ============================================================================

  /**
   * Build memo action
   *
   * Emits a memo event (no state change, just for logging).
   *
   * @param message - Memo message
   * @returns Proposal action
   */
  memo(message: string): ProposalAction {
    return {
      type: 'Memo',
      data: {
        message,
      },
      packageId: this.config.futarchyActionsPackageId,
      module: 'memo_init_actions',
      initFunction: 'add_memo_spec',
    };
  }
}
