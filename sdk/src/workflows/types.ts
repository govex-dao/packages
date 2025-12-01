/**
 * Workflow Types - Shared type definitions for high-level workflows
 *
 * These types define the configuration interfaces for workflow orchestrators,
 * providing clean, user-friendly APIs that hide all Move complexity.
 *
 * @module workflows/types
 */

import { Transaction } from '@mysten/sui/transactions';
import type { TierSpec } from '../services/oracle-actions';

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Base configuration shared by all workflows
 */
export interface WorkflowBaseConfig {
  /** The clock object ID (defaults to 0x6) */
  clockId?: string;
}

/**
 * Result of a workflow transaction build
 */
export interface WorkflowTransaction {
  /** The built transaction */
  transaction: Transaction;
  /** Description of what the transaction does */
  description: string;
}

/**
 * SignedU128 for TWAP threshold values
 */
export interface SignedU128 {
  value: bigint;
  isNegative: boolean;
}

// ============================================================================
// ACCOUNT ACTIONS - STREAM
// ============================================================================

/**
 * Stream creation action configuration
 */
export interface CreateStreamActionConfig {
  type: 'create_stream';
  /** Vault to withdraw from */
  vaultName: string;
  /** Beneficiary address */
  beneficiary: string;
  /** Amount per iteration (in base units) */
  amountPerIteration: bigint;
  /** Start timestamp (ms) */
  startTime: number;
  /** Total number of iterations */
  iterationsTotal: bigint;
  /** Period between iterations (ms) */
  iterationPeriodMs: bigint;
  /** Optional cliff time (ms) */
  cliffTime?: number;
  /** Optional claim window (ms) - use-or-lose */
  claimWindowMs?: bigint;
  /** Max withdrawal per claim */
  maxPerWithdrawal: bigint;
  /** Whether stream is transferable */
  isTransferable: boolean;
  /** Whether stream is cancellable by DAO */
  isCancellable: boolean;
}

/**
 * Cancel stream action configuration
 */
export interface CancelStreamActionConfig {
  type: 'cancel_stream';
  /** Vault name where stream was created */
  vaultName: string;
  /** Stream object ID to cancel */
  streamId: string;
}

// ============================================================================
// ACCOUNT ACTIONS - VAULT
// ============================================================================

/**
 * Deposit to vault action configuration
 */
export interface DepositActionConfig {
  type: 'deposit';
  /** Vault name */
  vaultName: string;
  /** Amount to deposit */
  amount: bigint;
}

/**
 * Spend from vault action configuration (internal use, returns coin to PTB)
 */
export interface SpendActionConfig {
  type: 'spend';
  /** Vault name */
  vaultName: string;
  /** Amount to spend */
  amount: bigint;
  /** Whether to spend entire balance */
  spendAll: boolean;
}

/**
 * Withdraw from vault and transfer action configuration
 */
export interface WithdrawActionConfig {
  type: 'withdraw';
  /** Vault name */
  vaultName: string;
  /** Amount to withdraw */
  amount: bigint;
  /** Recipient address */
  recipient: string;
}

/**
 * Approve coin type for permissionless deposits
 */
export interface ApproveCoinTypeActionConfig {
  type: 'approve_coin_type';
  /** Vault name */
  vaultName: string;
}

/**
 * Remove coin type approval
 */
export interface RemoveApprovedCoinTypeActionConfig {
  type: 'remove_approved_coin_type';
  /** Vault name */
  vaultName: string;
}

// ============================================================================
// ACCOUNT ACTIONS - CURRENCY
// ============================================================================

/**
 * Return treasury cap action configuration
 */
export interface ReturnTreasuryCapActionConfig {
  type: 'return_treasury_cap';
  /** Recipient address */
  recipient: string;
}

/**
 * Return metadata action configuration
 */
export interface ReturnMetadataActionConfig {
  type: 'return_metadata';
  /** Recipient address */
  recipient: string;
}

/**
 * Mint tokens action configuration
 * Note: The recipient is determined at execution time for launchpad init actions
 */
export interface MintActionConfig {
  type: 'mint';
  /** Amount to mint */
  amount: bigint;
}

/**
 * Burn tokens action configuration
 * Note: Vault is determined at execution time
 */
export interface BurnActionConfig {
  type: 'burn';
  /** Amount to burn */
  amount: bigint;
}

/**
 * Disable currency operations (irreversible)
 */
export interface DisableCurrencyActionConfig {
  type: 'disable_currency';
  /** Disable minting */
  mint: boolean;
  /** Disable burning */
  burn: boolean;
  /** Disable symbol updates */
  updateSymbol: boolean;
  /** Disable name updates */
  updateName: boolean;
  /** Disable description updates */
  updateDescription: boolean;
  /** Disable icon updates */
  updateIcon: boolean;
}

/**
 * Update currency metadata
 */
export interface UpdateCurrencyActionConfig {
  type: 'update_currency';
  /** New symbol (ASCII) */
  symbol?: string;
  /** New name (UTF-8) */
  name?: string;
  /** New description (UTF-8) */
  description?: string;
  /** New icon URL (ASCII) */
  iconUrl?: string;
}

// ============================================================================
// ACCOUNT ACTIONS - TRANSFER
// ============================================================================

/**
 * Transfer object action configuration
 * Note: The object is passed at execution time via PTB
 */
export interface TransferActionConfig {
  type: 'transfer';
  /** Recipient address */
  recipient: string;
}

/**
 * Transfer object to transaction sender (cranker)
 */
export interface TransferToSenderActionConfig {
  type: 'transfer_to_sender';
}

// ============================================================================
// ACCOUNT ACTIONS - PACKAGE UPGRADE
// ============================================================================

/**
 * Package upgrade action configuration
 */
export interface UpgradePackageActionConfig {
  type: 'upgrade_package';
  /** Package name */
  name: string;
  /** Build digest for the upgrade */
  digest: Uint8Array;
}

/**
 * Commit package upgrade action
 */
export interface CommitUpgradeActionConfig {
  type: 'commit_upgrade';
  /** Package name */
  name: string;
}

/**
 * Restrict package upgrade policy
 */
export interface RestrictUpgradeActionConfig {
  type: 'restrict_upgrade';
  /** Package name */
  name: string;
  /** Policy: 0 = additive, 128 = dep_only, 255 = immutable */
  policy: number;
}

/**
 * Create commit capability and transfer to recipient
 */
export interface CreateCommitCapActionConfig {
  type: 'create_commit_cap';
  /** Package name */
  name: string;
  /** Recipient address */
  recipient: string;
  /** New timelock delay for reclaiming commit authority (ms) */
  newReclaimDelayMs: bigint;
}

// ============================================================================
// ACCOUNT ACTIONS - MEMO
// ============================================================================

/**
 * Emit memo action configuration
 */
export interface MemoActionConfig {
  type: 'memo';
  /** Memo message */
  message: string;
}

// ============================================================================
// FUTARCHY ACTIONS - CONFIG
// ============================================================================

/**
 * Set proposals enabled/disabled
 */
export interface SetProposalsEnabledActionConfig {
  type: 'set_proposals_enabled';
  /** Whether proposals are enabled */
  enabled: boolean;
}

/**
 * Terminate DAO permanently
 */
export interface TerminateDaoActionConfig {
  type: 'terminate_dao';
  /** Reason for termination */
  reason: string;
  /** Delay before dissolution unlocks (ms) */
  dissolutionUnlockDelayMs: bigint;
}

/**
 * Update DAO name
 */
export interface UpdateDaoNameActionConfig {
  type: 'update_dao_name';
  /** New name */
  newName: string;
}

/**
 * Update trading params action configuration
 */
export interface UpdateTradingParamsActionConfig {
  type: 'update_trading_params';
  /** Minimum asset amount for proposals */
  minAssetAmount?: bigint;
  /** Minimum stable amount for proposals */
  minStableAmount?: bigint;
  /** Review period in ms */
  reviewPeriodMs?: bigint;
  /** Trading period in ms */
  tradingPeriodMs?: bigint;
  /** AMM total fee in basis points */
  ammTotalFeeBps?: number;
}

/**
 * Update DAO metadata
 */
export interface UpdateDaoMetadataActionConfig {
  type: 'update_dao_metadata';
  /** DAO name (ASCII) */
  daoName?: string;
  /** Icon URL */
  iconUrl?: string;
  /** Description */
  description?: string;
}

/**
 * Update TWAP config action configuration
 */
export interface UpdateTwapConfigActionConfig {
  type: 'update_twap_config';
  /** Start delay for TWAP accumulation */
  startDelay?: bigint;
  /** Maximum step for TWAP */
  stepMax?: bigint;
  /** Initial observation value */
  initialObservation?: bigint;
  /** TWAP threshold for winning (raw bigint value, will be converted to SignedU128) */
  threshold?: bigint;
}

/**
 * Update governance settings
 */
export interface UpdateGovernanceActionConfig {
  type: 'update_governance';
  /** Maximum outcomes per proposal */
  maxOutcomes?: bigint;
  /** Maximum actions per outcome */
  maxActionsPerOutcome?: bigint;
  /** Required bond amount */
  requiredBondAmount?: bigint;
  /** Maximum intents per outcome */
  maxIntentsPerOutcome?: bigint;
  /** Proposal intent expiry (ms) */
  proposalIntentExpiryMs?: bigint;
  /** Optimistic challenge fee */
  optimisticChallengeFee?: bigint;
  /** Optimistic challenge period (ms) */
  optimisticChallengePeriodMs?: bigint;
  /** Proposal creation fee */
  proposalCreationFee?: bigint;
  /** Proposal fee per outcome */
  proposalFeePerOutcome?: bigint;
  /** Accept new proposals */
  acceptNewProposals?: boolean;
  /** Enable premarket reservation lock */
  enablePremarketReservationLock?: boolean;
  /** Show proposal details */
  showProposalDetails?: boolean;
}

/**
 * Update metadata table
 */
export interface UpdateMetadataTableActionConfig {
  type: 'update_metadata_table';
  /** Keys to add/update */
  keys: string[];
  /** Values for keys */
  values: string[];
  /** Keys to remove */
  keysToRemove: string[];
}

/**
 * Update conditional metadata configuration
 */
export interface UpdateConditionalMetadataActionConfig {
  type: 'update_conditional_metadata';
  /** Use outcome index in metadata */
  useOutcomeIndex?: boolean;
  /** Conditional metadata settings (null to clear) */
  conditionalMetadata?: {
    prefix: string;
    suffix: string;
  } | null;
}

/**
 * Update sponsorship configuration
 */
export interface UpdateSponsorshipConfigActionConfig {
  type: 'update_sponsorship_config';
  /** Enable sponsorship */
  enabled?: boolean;
  /** Sponsored threshold (SignedU128) */
  sponsoredThreshold?: SignedU128;
  /** Waive advancement fees */
  waiveAdvancementFees?: boolean;
  /** Default sponsor quota amount */
  defaultSponsorQuotaAmount?: bigint;
}

// ============================================================================
// FUTARCHY ACTIONS - QUOTA
// ============================================================================

/**
 * Set quotas for addresses
 */
export interface SetQuotasActionConfig {
  type: 'set_quotas';
  /** Addresses to set quotas for */
  addresses: string[];
  /** Quota amounts */
  amounts: bigint[];
}

// ============================================================================
// FUTARCHY ACTIONS - LIQUIDITY
// ============================================================================

/**
 * Pool creation with mint action configuration
 */
export interface CreatePoolWithMintActionConfig {
  type: 'create_pool_with_mint';
  /** Vault to withdraw stable from */
  vaultName: string;
  /** Amount of asset tokens to mint */
  assetAmount: bigint;
  /** Amount of stable tokens from vault */
  stableAmount: bigint;
  /** Fee in basis points (e.g., 30 = 0.3%) */
  feeBps: number;
}

/**
 * Create pool action (without minting)
 */
export interface CreatePoolActionConfig {
  type: 'create_pool';
  /** Asset vault name */
  assetVaultName: string;
  /** Stable vault name */
  stableVaultName: string;
  /** Asset amount */
  assetAmount: bigint;
  /** Stable amount */
  stableAmount: bigint;
  /** Fee in basis points */
  feeBps: number;
}

/**
 * Update pool parameters
 */
export interface UpdatePoolParamsActionConfig {
  type: 'update_pool_params';
  /** New fee in basis points */
  feeBps?: number;
}

/**
 * Add liquidity to pool
 */
export interface AddLiquidityActionConfig {
  type: 'add_liquidity';
  /** Asset vault name */
  assetVaultName: string;
  /** Stable vault name */
  stableVaultName: string;
  /** Asset amount */
  assetAmount: bigint;
  /** Stable amount */
  stableAmount: bigint;
  /** Minimum LP tokens */
  minLpTokens: bigint;
}

/**
 * Withdraw LP token from pool
 */
export interface WithdrawLpTokenActionConfig {
  type: 'withdraw_lp_token';
  /** LP token amount */
  lpAmount: bigint;
  /** Recipient address */
  recipient: string;
}

/**
 * Remove liquidity from pool
 */
export interface RemoveLiquidityActionConfig {
  type: 'remove_liquidity';
  /** LP token amount */
  lpAmount: bigint;
  /** Minimum asset out */
  minAssetOut: bigint;
  /** Minimum stable out */
  minStableOut: bigint;
  /** Asset vault name */
  assetVaultName: string;
  /** Stable vault name */
  stableVaultName: string;
}

/**
 * Swap in pool
 */
export interface SwapActionConfig {
  type: 'swap';
  /** Amount in */
  amountIn: bigint;
  /** Minimum amount out */
  minAmountOut: bigint;
  /** Swap direction */
  direction: 'asset_to_stable' | 'stable_to_asset';
  /** Input vault name */
  inputVaultName: string;
  /** Output vault name */
  outputVaultName: string;
}

/**
 * Collect fees from pool
 */
export interface CollectFeesActionConfig {
  type: 'collect_fees';
  /** Asset vault name */
  assetVaultName: string;
  /** Stable vault name */
  stableVaultName: string;
}

/**
 * Withdraw collected fees
 */
export interface WithdrawFeesActionConfig {
  type: 'withdraw_fees';
  /** Asset amount */
  assetAmount: bigint;
  /** Stable amount */
  stableAmount: bigint;
  /** Recipient address */
  recipient: string;
}

// ============================================================================
// FUTARCHY ACTIONS - DISSOLUTION
// ============================================================================

/**
 * Create dissolution capability
 */
export interface CreateDissolutionCapabilityActionConfig {
  type: 'create_dissolution_capability';
  /** Recipient address */
  recipient: string;
}

// ============================================================================
// GOVERNANCE ACTIONS - PACKAGE REGISTRY
// ============================================================================

/**
 * Add package to registry
 */
export interface AddPackageActionConfig {
  type: 'add_package';
  /** Package name */
  name: string;
  /** Package address */
  addr: string;
  /** Package version */
  version: bigint;
  /** Action types as strings */
  actionTypes: string[];
  /** Category */
  category: string;
  /** Description */
  description: string;
}

/**
 * Remove package from registry
 */
export interface RemovePackageActionConfig {
  type: 'remove_package';
  /** Package name */
  name: string;
}

/**
 * Update package version
 */
export interface UpdatePackageVersionActionConfig {
  type: 'update_package_version';
  /** Package name */
  name: string;
  /** New package address */
  addr: string;
  /** New version */
  version: bigint;
}

/**
 * Update package metadata
 */
export interface UpdatePackageMetadataActionConfig {
  type: 'update_package_metadata';
  /** Package name */
  name: string;
  /** New action types */
  newActionTypes: string[];
  /** New category */
  newCategory: string;
  /** New description */
  newDescription: string;
}

/**
 * Pause account creation
 */
export interface PauseAccountCreationActionConfig {
  type: 'pause_account_creation';
}

/**
 * Unpause account creation
 */
export interface UnpauseAccountCreationActionConfig {
  type: 'unpause_account_creation';
}

// ============================================================================
// GOVERNANCE ACTIONS - PROTOCOL ADMIN
// ============================================================================

/**
 * Set factory paused state
 */
export interface SetFactoryPausedActionConfig {
  type: 'set_factory_paused';
  /** Paused state */
  paused: boolean;
}

/**
 * Disable factory permanently (IRREVERSIBLE)
 */
export interface DisableFactoryPermanentlyActionConfig {
  type: 'disable_factory_permanently';
}

/**
 * Add stable type to factory whitelist
 */
export interface AddStableTypeActionConfig {
  type: 'add_stable_type';
  /** Stable coin type */
  stableType: string;
}

/**
 * Remove stable type from factory whitelist
 */
export interface RemoveStableTypeActionConfig {
  type: 'remove_stable_type';
  /** Stable coin type */
  stableType: string;
}

/**
 * Update DAO creation fee
 */
export interface UpdateDaoCreationFeeActionConfig {
  type: 'update_dao_creation_fee';
  /** New fee */
  newFee: bigint;
}

/**
 * Update proposal fee per outcome
 */
export interface UpdateProposalFeeActionConfig {
  type: 'update_proposal_fee';
  /** New fee per outcome */
  newFeePerOutcome: bigint;
}

/**
 * Update verification fee for a level
 */
export interface UpdateVerificationFeeActionConfig {
  type: 'update_verification_fee';
  /** Verification level */
  level: number;
  /** New fee */
  newFee: bigint;
}

/**
 * Add verification level
 */
export interface AddVerificationLevelActionConfig {
  type: 'add_verification_level';
  /** Level number */
  level: number;
  /** Fee for this level */
  fee: bigint;
}

/**
 * Remove verification level
 */
export interface RemoveVerificationLevelActionConfig {
  type: 'remove_verification_level';
  /** Level number */
  level: number;
}

/**
 * Withdraw fees to treasury
 */
export interface WithdrawFeesToTreasuryActionConfig {
  type: 'withdraw_fees_to_treasury';
  /** Vault name */
  vaultName: string;
  /** Amount to withdraw */
  amount: bigint;
}

/**
 * Add coin fee configuration
 */
export interface AddCoinFeeConfigActionConfig {
  type: 'add_coin_fee_config';
  /** Coin type */
  coinType: string;
  /** Decimals */
  decimals: number;
  /** DAO creation fee */
  daoCreationFee: bigint;
  /** Proposal fee per outcome */
  proposalFeePerOutcome: bigint;
}

/**
 * Update coin creation fee (with delay)
 */
export interface UpdateCoinCreationFeeActionConfig {
  type: 'update_coin_creation_fee';
  /** Coin type */
  coinType: string;
  /** New fee */
  newFee: bigint;
}

/**
 * Update coin proposal fee (with delay)
 */
export interface UpdateCoinProposalFeeActionConfig {
  type: 'update_coin_proposal_fee';
  /** Coin type */
  coinType: string;
  /** New fee per outcome */
  newFeePerOutcome: bigint;
}

/**
 * Apply pending coin fees after delay
 */
export interface ApplyPendingCoinFeesActionConfig {
  type: 'apply_pending_coin_fees';
  /** Coin type */
  coinType: string;
}

// ============================================================================
// ORACLE ACTIONS
// ============================================================================

// TierSpec and RecipientMint are exported from services/oracle-actions

/**
 * Create oracle grant with price-based unlocks
 */
export interface CreateOracleGrantActionConfig {
  type: 'create_oracle_grant';
  /** Tier specifications */
  tierSpecs: TierSpec[];
  /** Use relative pricing */
  useRelativePricing: boolean;
  /** Launchpad multiplier */
  launchpadMultiplier: bigint;
  /** Earliest execution offset (ms) */
  earliestExecutionOffsetMs: bigint;
  /** Grant expiry in years */
  expiryYears: bigint;
  /** Whether grant is cancelable */
  cancelable: boolean;
  /** Description */
  description: string;
}

/**
 * Cancel oracle grant
 */
export interface CancelOracleGrantActionConfig {
  type: 'cancel_oracle_grant';
  /** Grant ID to cancel */
  grantId: string;
}

// ============================================================================
// UNION OF ALL ACTION CONFIGS
// ============================================================================

/**
 * Union of all action configurations for staging
 */
export type ActionConfig =
  // Stream
  | CreateStreamActionConfig
  | CancelStreamActionConfig
  // Vault
  | DepositActionConfig
  | SpendActionConfig
  | WithdrawActionConfig
  | ApproveCoinTypeActionConfig
  | RemoveApprovedCoinTypeActionConfig
  // Currency
  | ReturnTreasuryCapActionConfig
  | ReturnMetadataActionConfig
  | MintActionConfig
  | BurnActionConfig
  | DisableCurrencyActionConfig
  | UpdateCurrencyActionConfig
  // Transfer
  | TransferActionConfig
  | TransferToSenderActionConfig
  // Package Upgrade
  | UpgradePackageActionConfig
  | CommitUpgradeActionConfig
  | RestrictUpgradeActionConfig
  | CreateCommitCapActionConfig
  // Memo
  | MemoActionConfig
  // Futarchy Config
  | SetProposalsEnabledActionConfig
  | TerminateDaoActionConfig
  | UpdateDaoNameActionConfig
  | UpdateTradingParamsActionConfig
  | UpdateDaoMetadataActionConfig
  | UpdateTwapConfigActionConfig
  | UpdateGovernanceActionConfig
  | UpdateMetadataTableActionConfig
  | UpdateConditionalMetadataActionConfig
  | UpdateSponsorshipConfigActionConfig
  // Futarchy Quota
  | SetQuotasActionConfig
  // Futarchy Liquidity
  | CreatePoolWithMintActionConfig
  | CreatePoolActionConfig
  | UpdatePoolParamsActionConfig
  | AddLiquidityActionConfig
  | WithdrawLpTokenActionConfig
  | RemoveLiquidityActionConfig
  | SwapActionConfig
  | CollectFeesActionConfig
  | WithdrawFeesActionConfig
  // Futarchy Dissolution
  | CreateDissolutionCapabilityActionConfig
  // Governance - Package Registry
  | AddPackageActionConfig
  | RemovePackageActionConfig
  | UpdatePackageVersionActionConfig
  | UpdatePackageMetadataActionConfig
  | PauseAccountCreationActionConfig
  | UnpauseAccountCreationActionConfig
  // Governance - Protocol Admin
  | SetFactoryPausedActionConfig
  | DisableFactoryPermanentlyActionConfig
  | AddStableTypeActionConfig
  | RemoveStableTypeActionConfig
  | UpdateDaoCreationFeeActionConfig
  | UpdateProposalFeeActionConfig
  | UpdateVerificationFeeActionConfig
  | AddVerificationLevelActionConfig
  | RemoveVerificationLevelActionConfig
  | WithdrawFeesToTreasuryActionConfig
  | AddCoinFeeConfigActionConfig
  | UpdateCoinCreationFeeActionConfig
  | UpdateCoinProposalFeeActionConfig
  | ApplyPendingCoinFeesActionConfig
  // Oracle
  | CreateOracleGrantActionConfig
  | CancelOracleGrantActionConfig;

// ============================================================================
// LAUNCHPAD WORKFLOW TYPES
// ============================================================================

/**
 * Configuration for creating a new raise
 */
export interface CreateRaiseConfig extends WorkflowBaseConfig {
  /** Asset token type (e.g., "0x123::coin::COIN") */
  assetType: string;
  /** Stable token type (e.g., "0x2::sui::SUI") */
  stableType: string;
  /** Treasury cap object ID */
  treasuryCap: string;
  /** Coin metadata object ID */
  coinMetadata: string;

  /** Number of tokens for sale */
  tokensForSale: bigint;
  /** Minimum raise amount (in stable) */
  minRaiseAmount: bigint;
  /** Maximum raise amount (in stable) */
  maxRaiseAmount?: bigint;

  /** Allowed contribution caps (array of amounts) */
  allowedCaps: bigint[];
  /** Allow early completion when max is reached */
  allowEarlyCompletion: boolean;

  /** Start delay in milliseconds */
  startDelayMs?: number;
  /** Description of the raise */
  description: string;
  /** Optional affiliate ID */
  affiliateId?: string;
  /** Optional metadata keys */
  metadataKeys?: string[];
  /** Optional metadata values */
  metadataValues?: string[];
  /** Launchpad fee amount (in SUI MIST) */
  launchpadFee: bigint;
  /** Extra tokens to mint and return to caller (for creator allocation) */
  extraMintToCaller?: bigint;
}

/**
 * Configuration for staging success/failure actions
 */
export interface StageActionsConfig extends WorkflowBaseConfig {
  /** Raise object ID */
  raiseId: string;
  /** Creator cap object ID */
  creatorCapId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Actions to stage */
  actions: ActionConfig[];
  /** Whether these are success or failure actions */
  outcome: 'success' | 'failure';
}

/**
 * Configuration for contributing to a raise
 */
export interface ContributeConfig extends WorkflowBaseConfig {
  /** Raise object ID */
  raiseId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Amount to contribute (in stable) */
  amount: bigint;
  /** Cap tier to use (or UNLIMITED_CAP) */
  capTier: bigint;
  /** Crank fee amount */
  crankFee: bigint;
  /** Stable coin object IDs to use for payment */
  stableCoins: string[];
}

/**
 * Configuration for completing a raise
 */
export interface CompleteRaiseConfig extends WorkflowBaseConfig {
  /** Raise object ID */
  raiseId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
}

/**
 * Configuration for executing launchpad init actions
 */
export interface ExecuteLaunchpadActionsConfig extends WorkflowBaseConfig {
  /** Raise object ID */
  raiseId: string;
  /** Account (DAO) object ID */
  accountId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Action types to execute (in order) */
  actionTypes: LaunchpadActionType[];
}

/**
 * Supported launchpad action types for execution
 */
export type LaunchpadActionType =
  | { type: 'create_stream'; coinType: string }
  | { type: 'create_pool_with_mint'; assetType: string; stableType: string }
  | { type: 'update_trading_params' }
  | { type: 'update_twap_config' }
  | { type: 'return_treasury_cap'; coinType: string }
  | { type: 'return_metadata'; coinType: string };

// ============================================================================
// PROPOSAL WORKFLOW TYPES
// ============================================================================

/**
 * Configuration for creating a new proposal
 */
export interface CreateProposalConfig extends WorkflowBaseConfig {
  /** DAO account object ID */
  daoAccountId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Proposal title */
  title: string;
  /** Introduction/description */
  introduction: string;
  /** Metadata JSON string */
  metadata: string;
  /** Outcome messages (e.g., ["Reject", "Accept"]) */
  outcomeMessages: string[];
  /** Outcome details/descriptions */
  outcomeDetails: string[];
  /** Proposer address */
  proposer: string;
  /** Treasury address for fees */
  treasuryAddress: string;
  /** Whether to use quota */
  usedQuota: boolean;
  /** Fee payment coin object IDs */
  feeCoins: string[];
  /** Fee amount */
  feeAmount: bigint;
}

/**
 * Configuration for adding actions to a proposal outcome
 */
export interface AddProposalActionsConfig extends WorkflowBaseConfig {
  /** Proposal object ID */
  proposalId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Outcome index (0 = Reject, 1 = Accept, etc.) */
  outcomeIndex: number;
  /** Actions to add */
  actions: ActionConfig[];
  /** Max actions per outcome (default 10) */
  maxActionsPerOutcome?: number;
}

/**
 * Configuration for advancing proposal to review state
 */
export interface AdvanceToReviewConfig extends WorkflowBaseConfig {
  /** Proposal object ID */
  proposalId: string;
  /** DAO account object ID */
  daoAccountId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Spot pool object ID */
  spotPoolId: string;
  /** Sender address (for receiving unused fees back) */
  senderAddress: string;
  /** Conditional coin registry config (if using typed conditional coins from registry) */
  conditionalCoinsRegistry?: ConditionalCoinsRegistryConfig;
}

/**
 * Conditional coin set configuration for a single outcome
 */
export interface ConditionalCoinSetConfig {
  /** Outcome index */
  outcomeIndex: number;
  /** Asset conditional coin type (fully qualified) */
  assetCoinType: string;
  /** Asset TreasuryCap ID (used as key in registry) */
  assetCapId: string;
  /** Stable conditional coin type (fully qualified) */
  stableCoinType: string;
  /** Stable TreasuryCap ID (used as key in registry) */
  stableCapId: string;
}

/**
 * Configuration for conditional coins from a registry
 */
export interface ConditionalCoinsRegistryConfig {
  /** CoinRegistry object ID that holds the conditional coin caps */
  registryId: string;
  /** Coin sets per outcome */
  coinSets: ConditionalCoinSetConfig[];
}

/**
 * Configuration for advancing proposal to trading state
 */
export interface AdvanceToTradingConfig extends WorkflowBaseConfig {
  /** Proposal object ID */
  proposalId: string;
  /** DAO account object ID */
  daoAccountId: string;
  /** Escrow object ID */
  escrowId: string;
  /** Spot pool object ID */
  spotPoolId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
}

/**
 * Configuration for finalizing a proposal
 */
export interface FinalizeProposalConfig extends WorkflowBaseConfig {
  /** Proposal object ID */
  proposalId: string;
  /** DAO account object ID */
  daoAccountId: string;
  /** Escrow object ID */
  escrowId: string;
  /** Spot pool object ID */
  spotPoolId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
}

/**
 * Configuration for executing proposal actions
 */
export interface ExecuteProposalActionsConfig extends WorkflowBaseConfig {
  /** Proposal object ID */
  proposalId: string;
  /** DAO account object ID */
  daoAccountId: string;
  /** Escrow object ID */
  escrowId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Action types to execute (in order) */
  actionTypes: ProposalActionType[];
}

/**
 * Supported proposal action types for execution
 */
export type ProposalActionType =
  | { type: 'create_stream'; coinType: string }
  | { type: 'mint'; coinType: string }
  | { type: 'burn'; coinType: string }
  | { type: 'deposit'; coinType: string }
  | { type: 'withdraw'; coinType: string }
  | { type: 'transfer'; objectType: string }
  | { type: 'memo' };

// ============================================================================
// SWAP WORKFLOW TYPES
// ============================================================================

/**
 * Configuration for a spot swap
 */
export interface SpotSwapConfig extends WorkflowBaseConfig {
  /** Spot pool object ID */
  spotPoolId: string;
  /** Proposal object ID (if during active proposal) */
  proposalId?: string;
  /** Escrow object ID (if during active proposal) */
  escrowId?: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Direction of swap */
  direction: 'stable_to_asset' | 'asset_to_stable';
  /** Amount to swap (in input token) */
  amountIn: bigint;
  /** Minimum output amount */
  minAmountOut: bigint;
  /** Recipient address */
  recipient: string;
  /** Input coin object IDs */
  inputCoins: string[];
}

/**
 * Configuration for a conditional swap
 */
export interface ConditionalSwapConfig extends WorkflowBaseConfig {
  /** Escrow object ID */
  escrowId: string;
  /** Spot pool object ID */
  spotPoolId: string;
  /** Proposal object ID */
  proposalId: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Outcome index to swap in (this is where the swap will occur) */
  outcomeIndex: number;
  /** Direction of swap */
  direction: 'stable_to_asset' | 'asset_to_stable';
  /** Amount to swap */
  amountIn: bigint;
  /** Minimum output amount */
  minAmountOut: bigint;
  /** Recipient address */
  recipient: string;
  /**
   * All conditional coin types for each outcome
   * Key is outcome index (0, 1, etc.)
   * Required because stable splitting must happen across ALL outcomes
   */
  allOutcomeCoins: Array<{
    outcomeIndex: number;
    assetCoinType: string;
    stableCoinType: string;
  }>;
  /** Input stable coins (for splitting) */
  stableCoins: string[];
}

// ============================================================================
// INTENT EXECUTION TYPES
// ============================================================================

/**
 * Configuration for intent execution
 */
export interface IntentExecutionConfig extends WorkflowBaseConfig {
  /** Type of intent */
  intentType: 'launchpad' | 'proposal';
  /** Account object ID */
  accountId: string;
  /** For launchpad: raise ID */
  raiseId?: string;
  /** For proposal: proposal ID */
  proposalId?: string;
  /** For proposal: escrow ID */
  escrowId?: string;
  /** Asset type */
  assetType: string;
  /** Stable type */
  stableType: string;
  /** Actions to execute (in order) */
  actions: IntentActionConfig[];
}

/**
 * Intent action configuration with type info for execution
 */
export type IntentActionConfig =
  // Account Actions - Stream
  | { action: 'create_stream'; coinType: string }
  | { action: 'cancel_stream'; coinType: string }
  // Account Actions - Vault
  | { action: 'deposit'; coinType: string }
  | { action: 'spend'; coinType: string }
  | { action: 'withdraw'; coinType: string }
  | { action: 'approve_coin_type'; coinType: string }
  | { action: 'remove_approved_coin_type'; coinType: string }
  // Account Actions - Currency
  | { action: 'return_treasury_cap'; coinType: string }
  | { action: 'return_metadata'; coinType: string; keyType: string }
  | { action: 'mint'; coinType: string }
  | { action: 'burn'; coinType: string }
  | { action: 'disable_currency'; coinType: string }
  | { action: 'update_currency'; coinType: string }
  // Account Actions - Transfer
  | { action: 'transfer'; objectType: string }
  | { action: 'transfer_to_sender'; objectType: string }
  // Account Actions - Package Upgrade
  | { action: 'upgrade_package' }
  | { action: 'commit_upgrade' }
  | { action: 'restrict_upgrade' }
  | { action: 'create_commit_cap' }
  // Account Actions - Access Control
  | { action: 'borrow_access'; capType: string }
  | { action: 'return_access'; capType: string }
  // Account Actions - Memo
  | { action: 'memo' }
  // Futarchy Config Actions
  | { action: 'set_proposals_enabled' }
  | { action: 'terminate_dao' }
  | { action: 'update_dao_name' }
  | { action: 'update_trading_params' }
  | { action: 'update_dao_metadata' }
  | { action: 'update_twap_config' }
  | { action: 'update_governance' }
  | { action: 'update_metadata_table' }
  | { action: 'update_conditional_metadata' }
  | { action: 'update_sponsorship_config' }
  // Futarchy Quota Actions
  | { action: 'set_quotas' }
  // Futarchy Liquidity Actions
  | { action: 'create_pool_with_mint'; assetType: string; stableType: string }
  | { action: 'create_pool'; assetType: string; stableType: string }
  | { action: 'update_pool_params' }
  | { action: 'add_liquidity'; assetType: string; stableType: string }
  | { action: 'withdraw_lp_token'; assetType: string; stableType: string }
  | { action: 'remove_liquidity'; assetType: string; stableType: string }
  | { action: 'swap'; assetType: string; stableType: string }
  | { action: 'collect_fees'; assetType: string; stableType: string }
  | { action: 'withdraw_fees'; assetType: string; stableType: string }
  // Futarchy Dissolution Actions
  | { action: 'create_dissolution_capability'; assetType: string }
  // Governance - Package Registry Actions
  | { action: 'add_package' }
  | { action: 'remove_package' }
  | { action: 'update_package_version' }
  | { action: 'update_package_metadata' }
  | { action: 'pause_account_creation' }
  | { action: 'unpause_account_creation' }
  // Governance - Protocol Admin Actions
  | { action: 'set_factory_paused' }
  | { action: 'disable_factory_permanently' }
  | { action: 'add_stable_type'; stableType: string }
  | { action: 'remove_stable_type'; stableType: string }
  | { action: 'update_dao_creation_fee' }
  | { action: 'update_proposal_fee' }
  | { action: 'update_verification_fee' }
  | { action: 'add_verification_level' }
  | { action: 'remove_verification_level' }
  | { action: 'withdraw_fees_to_treasury'; coinType: string }
  | { action: 'add_coin_fee_config'; coinType: string }
  | { action: 'update_coin_creation_fee'; coinType: string }
  | { action: 'update_coin_proposal_fee'; coinType: string }
  | { action: 'apply_pending_coin_fees'; coinType: string }
  // Oracle Actions
  | { action: 'create_oracle_grant'; assetType: string; stableType: string }
  | { action: 'cancel_oracle_grant'; assetType: string; stableType: string };
