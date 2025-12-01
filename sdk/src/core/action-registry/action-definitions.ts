/**
 * Action Definitions - Single Source of Truth
 *
 * This file defines ALL action types supported by the Futarchy protocol.
 * All staging functions, execution functions, types, and documentation
 * are generated from these definitions.
 *
 * @module core/action-registry/action-definitions
 */

// ============================================================================
// PARAMETER TYPE DEFINITIONS
// ============================================================================

/**
 * Supported parameter types for action definitions
 */
export type ParamType =
  | 'u8'
  | 'u64'
  | 'u128'
  | 'bool'
  | 'string'
  | 'address'
  | 'id'
  | 'vector<u8>'
  | 'vector<string>'
  | 'vector<address>'
  | 'option<u64>'
  | 'option<u128>'
  | 'option<bool>'
  | 'option<string>'
  | 'option<vector<u8>>'
  | 'option<signed_u128>'
  | 'signed_u128'
  | 'tier_specs'
  | 'conditional_metadata';

/**
 * Parameter definition
 */
export interface ParamDef {
  name: string;
  type: ParamType;
  description: string;
  optional?: boolean;
}

/**
 * Package identifiers
 */
export type PackageId =
  | 'accountActions'
  | 'futarchyActions'
  | 'futarchyGovernanceActions'
  | 'futarchyOracleActions';

/**
 * Action category for grouping
 */
export type ActionCategory =
  | 'transfer'
  | 'vault'
  | 'currency'
  | 'stream'
  | 'memo'
  | 'package_upgrade'
  | 'access_control'
  | 'config'
  | 'quota'
  | 'liquidity'
  | 'dissolution'
  | 'package_registry'
  | 'protocol_admin'
  | 'oracle';

/**
 * Complete action definition
 */
export interface ActionDefinition {
  /** Unique action identifier (used as type discriminator) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Action category */
  category: ActionCategory;
  /** Package that owns this action */
  package: PackageId;
  /** Module containing staging function */
  stagingModule: string;
  /** Staging function name */
  stagingFunction: string;
  /** Module containing execution function (if different) */
  executionModule?: string;
  /** Execution function name */
  executionFunction?: string;
  /** Marker type for action validation (full path) */
  markerType: string;
  /** Parameters for staging */
  params: ParamDef[];
  /** Type parameters required (for generic functions) */
  typeParams?: string[];
  /** Description */
  description: string;
  /** Whether this action is supported in launchpad flows */
  launchpadSupported: boolean;
  /** Whether this action is supported in proposal flows */
  proposalSupported: boolean;
}

// ============================================================================
// ACCOUNT ACTIONS - TRANSFER
// ============================================================================

export const TRANSFER_ACTIONS: ActionDefinition[] = [
  {
    id: 'withdraw',
    name: 'Withdraw and Transfer',
    category: 'transfer',
    package: 'accountActions',
    stagingModule: 'transfer_init_actions',
    stagingFunction: 'add_withdraw_and_transfer_spec',
    executionModule: 'vault',
    executionFunction: 'do_init_withdraw_and_transfer',
    markerType: 'account_actions::vault::Withdraw',
    typeParams: ['CoinType'],
    params: [
      { name: 'vaultName', type: 'string', description: 'Name of the vault to withdraw from' },
      { name: 'amount', type: 'u64', description: 'Amount to withdraw' },
      { name: 'recipient', type: 'address', description: 'Recipient address' },
    ],
    description: 'Withdraw coins from a vault and transfer to a recipient',
    launchpadSupported: true,
    proposalSupported: true,
  },
  {
    id: 'transfer',
    name: 'Transfer Object',
    category: 'transfer',
    package: 'accountActions',
    stagingModule: 'transfer_init_actions',
    stagingFunction: 'add_transfer_object_spec',
    executionModule: 'transfer',
    executionFunction: 'do_transfer',
    markerType: 'account_actions::transfer::TransferObject',
    typeParams: ['ObjectType'],
    params: [{ name: 'recipient', type: 'address', description: 'Recipient address' }],
    description: 'Transfer an object to a recipient (object passed at execution time)',
    launchpadSupported: true,
    proposalSupported: true,
  },
  {
    id: 'transfer_to_sender',
    name: 'Transfer to Sender',
    category: 'transfer',
    package: 'accountActions',
    stagingModule: 'transfer_init_actions',
    stagingFunction: 'add_transfer_to_sender_spec',
    executionModule: 'transfer',
    executionFunction: 'do_transfer_to_sender',
    markerType: 'account_actions::transfer::TransferToSender',
    typeParams: ['ObjectType'],
    params: [],
    description: 'Transfer an object to the transaction sender (cranker)',
    launchpadSupported: true,
    proposalSupported: true,
  },
];

// ============================================================================
// ACCOUNT ACTIONS - VAULT
// ============================================================================

export const VAULT_ACTIONS: ActionDefinition[] = [
  {
    id: 'deposit',
    name: 'Deposit',
    category: 'vault',
    package: 'accountActions',
    stagingModule: 'vault_init_actions',
    stagingFunction: 'add_deposit_spec',
    executionModule: 'vault',
    executionFunction: 'do_deposit',
    markerType: 'account_actions::vault::VaultDeposit',
    typeParams: ['CoinType'],
    params: [
      { name: 'vaultName', type: 'string', description: 'Name of the vault' },
      { name: 'amount', type: 'u64', description: 'Amount to deposit' },
    ],
    description: 'Deposit coins into a vault',
    launchpadSupported: true,
    proposalSupported: true,
  },
  {
    id: 'spend',
    name: 'Spend',
    category: 'vault',
    package: 'accountActions',
    stagingModule: 'vault_init_actions',
    stagingFunction: 'add_spend_spec',
    executionModule: 'vault',
    executionFunction: 'do_spend',
    markerType: 'account_actions::vault::VaultSpend',
    typeParams: ['CoinType'],
    params: [
      { name: 'vaultName', type: 'string', description: 'Name of the vault' },
      { name: 'amount', type: 'u64', description: 'Amount to spend' },
      { name: 'spendAll', type: 'bool', description: 'Whether to spend entire balance' },
    ],
    description: 'Spend/withdraw coins from a vault (returns coin to PTB)',
    launchpadSupported: true,
    proposalSupported: true,
  },
  {
    id: 'approve_coin_type',
    name: 'Approve Coin Type',
    category: 'vault',
    package: 'accountActions',
    stagingModule: 'vault_init_actions',
    stagingFunction: 'add_approve_coin_type_spec',
    executionModule: 'vault',
    executionFunction: 'do_approve_coin_type',
    markerType: 'account_actions::vault::VaultApproveCoinType',
    params: [{ name: 'vaultName', type: 'string', description: 'Name of the vault' }],
    typeParams: ['CoinType'],
    description: 'Approve a coin type for permissionless deposits',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'remove_approved_coin_type',
    name: 'Remove Approved Coin Type',
    category: 'vault',
    package: 'accountActions',
    stagingModule: 'vault_init_actions',
    stagingFunction: 'add_remove_approved_coin_type_spec',
    executionModule: 'vault',
    executionFunction: 'do_remove_approved_coin_type',
    markerType: 'account_actions::vault::VaultRemoveApprovedCoinType',
    params: [{ name: 'vaultName', type: 'string', description: 'Name of the vault' }],
    typeParams: ['CoinType'],
    description: 'Remove approval for a coin type',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'cancel_stream',
    name: 'Cancel Stream',
    category: 'vault',
    package: 'accountActions',
    stagingModule: 'vault_init_actions',
    stagingFunction: 'add_cancel_stream_spec',
    executionModule: 'vault',
    executionFunction: 'do_cancel_stream',
    markerType: 'account_actions::vault::CancelStream',
    typeParams: ['CoinType'],
    params: [
      { name: 'vaultName', type: 'string', description: 'Name of the vault' },
      { name: 'streamId', type: 'id', description: 'ID of the stream to cancel' },
    ],
    description: 'Cancel a vesting stream',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// ACCOUNT ACTIONS - CURRENCY
// ============================================================================

export const CURRENCY_ACTIONS: ActionDefinition[] = [
  {
    id: 'mint',
    name: 'Mint',
    category: 'currency',
    package: 'accountActions',
    stagingModule: 'currency_init_actions',
    stagingFunction: 'add_mint_spec',
    executionModule: 'currency',
    executionFunction: 'do_mint',
    markerType: 'account_actions::currency::CurrencyMint',
    typeParams: ['CoinType'],
    params: [{ name: 'amount', type: 'u64', description: 'Amount to mint' }],
    description: 'Mint new tokens (coin returned to PTB)',
    launchpadSupported: true,
    proposalSupported: true,
  },
  {
    id: 'burn',
    name: 'Burn',
    category: 'currency',
    package: 'accountActions',
    stagingModule: 'currency_init_actions',
    stagingFunction: 'add_burn_spec',
    executionModule: 'currency',
    executionFunction: 'do_burn',
    markerType: 'account_actions::currency::CurrencyBurn',
    typeParams: ['CoinType'],
    params: [{ name: 'amount', type: 'u64', description: 'Amount to burn' }],
    description: 'Burn tokens (coin passed at execution time)',
    launchpadSupported: true,
    proposalSupported: true,
  },
  {
    id: 'return_treasury_cap',
    name: 'Return Treasury Cap',
    category: 'currency',
    package: 'accountActions',
    stagingModule: 'currency_init_actions',
    stagingFunction: 'add_return_treasury_cap_spec',
    executionModule: 'currency',
    executionFunction: 'do_init_remove_treasury_cap',
    markerType: 'account_actions::currency::RemoveTreasuryCap',
    typeParams: ['CoinType'],
    params: [{ name: 'recipient', type: 'address', description: 'Recipient address' }],
    description: 'Return TreasuryCap to an address (used in failure intents)',
    launchpadSupported: true,
    proposalSupported: false,
  },
  {
    id: 'return_metadata',
    name: 'Return Metadata',
    category: 'currency',
    package: 'accountActions',
    stagingModule: 'currency_init_actions',
    stagingFunction: 'add_return_metadata_spec',
    executionModule: 'currency',
    executionFunction: 'do_init_remove_metadata',
    markerType: 'account_actions::currency::RemoveMetadata',
    typeParams: ['KeyType', 'CoinType'],
    params: [{ name: 'recipient', type: 'address', description: 'Recipient address' }],
    description: 'Return CoinMetadata to an address (used in failure intents)',
    launchpadSupported: true,
    proposalSupported: false,
  },
  {
    id: 'disable_currency',
    name: 'Disable Currency',
    category: 'currency',
    package: 'accountActions',
    stagingModule: 'currency_init_actions',
    stagingFunction: 'add_disable_spec',
    executionModule: 'currency',
    executionFunction: 'do_disable',
    markerType: 'account_actions::currency::CurrencyDisable',
    typeParams: ['CoinType'],
    params: [
      { name: 'mint', type: 'bool', description: 'Disable minting' },
      { name: 'burn', type: 'bool', description: 'Disable burning' },
      { name: 'updateSymbol', type: 'bool', description: 'Disable symbol updates' },
      { name: 'updateName', type: 'bool', description: 'Disable name updates' },
      { name: 'updateDescription', type: 'bool', description: 'Disable description updates' },
      { name: 'updateIcon', type: 'bool', description: 'Disable icon updates' },
    ],
    description: 'Permanently disable currency operations (irreversible)',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_currency',
    name: 'Update Currency',
    category: 'currency',
    package: 'accountActions',
    stagingModule: 'currency_init_actions',
    stagingFunction: 'add_update_spec',
    executionModule: 'currency',
    executionFunction: 'do_update',
    markerType: 'account_actions::currency::CurrencyUpdate',
    typeParams: ['CoinType'],
    params: [
      { name: 'symbol', type: 'option<vector<u8>>', description: 'New symbol (ASCII)', optional: true },
      { name: 'name', type: 'option<vector<u8>>', description: 'New name (UTF-8)', optional: true },
      {
        name: 'description',
        type: 'option<vector<u8>>',
        description: 'New description (UTF-8)',
        optional: true,
      },
      { name: 'iconUrl', type: 'option<vector<u8>>', description: 'New icon URL (ASCII)', optional: true },
    ],
    description: 'Update coin metadata',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// ACCOUNT ACTIONS - STREAM
// ============================================================================

export const STREAM_ACTIONS: ActionDefinition[] = [
  {
    id: 'create_stream',
    name: 'Create Stream',
    category: 'stream',
    package: 'accountActions',
    stagingModule: 'stream_init_actions',
    stagingFunction: 'add_create_stream_spec',
    executionModule: 'vault',
    executionFunction: 'do_init_create_stream',
    markerType: 'account_actions::vault::CreateStream',
    typeParams: ['CoinType'],
    params: [
      { name: 'vaultName', type: 'string', description: 'Source vault name' },
      { name: 'beneficiary', type: 'address', description: 'Beneficiary address' },
      { name: 'amountPerIteration', type: 'u64', description: 'Amount per iteration' },
      { name: 'startTime', type: 'u64', description: 'Start timestamp (ms)' },
      { name: 'iterationsTotal', type: 'u64', description: 'Total number of iterations' },
      { name: 'iterationPeriodMs', type: 'u64', description: 'Period between iterations (ms)' },
      { name: 'cliffTime', type: 'option<u64>', description: 'Cliff timestamp (ms)', optional: true },
      { name: 'claimWindowMs', type: 'option<u64>', description: 'Claim window duration (ms)', optional: true },
      { name: 'maxPerWithdrawal', type: 'u64', description: 'Maximum amount per withdrawal' },
      { name: 'isTransferable', type: 'bool', description: 'Whether stream is transferable' },
      { name: 'isCancellable', type: 'bool', description: 'Whether stream is cancellable' },
    ],
    description: 'Create a vesting stream',
    launchpadSupported: true,
    proposalSupported: true,
  },
];

// ============================================================================
// ACCOUNT ACTIONS - MEMO
// ============================================================================

export const MEMO_ACTIONS: ActionDefinition[] = [
  {
    id: 'memo',
    name: 'Emit Memo',
    category: 'memo',
    package: 'accountActions',
    stagingModule: 'memo_init_actions',
    stagingFunction: 'add_emit_memo_spec',
    executionModule: 'memo',
    executionFunction: 'do_emit_memo',
    markerType: 'account_actions::memo::Memo',
    params: [{ name: 'message', type: 'string', description: 'Memo message' }],
    description: 'Emit a memo event (for logging purposes)',
    launchpadSupported: true,
    proposalSupported: true,
  },
];

// ============================================================================
// ACCOUNT ACTIONS - PACKAGE UPGRADE
// ============================================================================

export const PACKAGE_UPGRADE_ACTIONS: ActionDefinition[] = [
  {
    id: 'upgrade_package',
    name: 'Upgrade Package',
    category: 'package_upgrade',
    package: 'accountActions',
    stagingModule: 'package_upgrade_init_actions',
    stagingFunction: 'add_upgrade_spec',
    executionModule: 'package_upgrade',
    executionFunction: 'do_upgrade',
    markerType: 'account_actions::package_upgrade::PackageUpgrade',
    params: [
      { name: 'name', type: 'string', description: 'Package name' },
      { name: 'digest', type: 'vector<u8>', description: 'Build digest for the upgrade' },
    ],
    description: 'Create an upgrade ticket for a package',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'commit_upgrade',
    name: 'Commit Upgrade',
    category: 'package_upgrade',
    package: 'accountActions',
    stagingModule: 'package_upgrade_init_actions',
    stagingFunction: 'add_commit_spec',
    executionModule: 'package_upgrade',
    executionFunction: 'do_commit',
    markerType: 'account_actions::package_upgrade::PackageCommit',
    params: [{ name: 'name', type: 'string', description: 'Package name' }],
    description: 'Commit a package upgrade',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'restrict_upgrade',
    name: 'Restrict Upgrade',
    category: 'package_upgrade',
    package: 'accountActions',
    stagingModule: 'package_upgrade_init_actions',
    stagingFunction: 'add_restrict_spec',
    executionModule: 'package_upgrade',
    executionFunction: 'do_restrict',
    markerType: 'account_actions::package_upgrade::PackageRestrict',
    params: [
      { name: 'name', type: 'string', description: 'Package name' },
      { name: 'policy', type: 'u8', description: 'Upgrade policy (0=additive, 128=dep_only, 255=immutable)' },
    ],
    description: 'Restrict upgrade policy for a package',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'create_commit_cap',
    name: 'Create Commit Cap',
    category: 'package_upgrade',
    package: 'accountActions',
    stagingModule: 'package_upgrade_init_actions',
    stagingFunction: 'add_create_commit_cap_spec',
    executionModule: 'package_upgrade',
    executionFunction: 'do_create_commit_cap',
    markerType: 'account_actions::package_upgrade::PackageCreateCommitCap',
    params: [
      { name: 'name', type: 'string', description: 'Package name' },
      { name: 'recipient', type: 'address', description: 'Recipient of the commit cap' },
      { name: 'newReclaimDelayMs', type: 'u64', description: 'New timelock delay for reclaiming' },
    ],
    description: 'Create and transfer a commit capability',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// ACCOUNT ACTIONS - ACCESS CONTROL
// ============================================================================

export const ACCESS_CONTROL_ACTIONS: ActionDefinition[] = [
  {
    id: 'borrow_access',
    name: 'Borrow Access',
    category: 'access_control',
    package: 'accountActions',
    stagingModule: 'access_control_init_actions',
    stagingFunction: 'add_borrow_spec',
    executionModule: 'access_control',
    executionFunction: 'do_borrow',
    markerType: 'account_actions::access_control::Borrow',
    typeParams: ['CapType'],
    params: [],
    description: 'Borrow access to a managed object',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'return_access',
    name: 'Return Access',
    category: 'access_control',
    package: 'accountActions',
    stagingModule: 'access_control_init_actions',
    stagingFunction: 'add_return_spec',
    executionModule: 'access_control',
    executionFunction: 'do_return',
    markerType: 'account_actions::access_control::Return',
    typeParams: ['CapType'],
    params: [],
    description: 'Return access to a managed object',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// FUTARCHY ACTIONS - CONFIG
// ============================================================================

export const CONFIG_ACTIONS: ActionDefinition[] = [
  {
    id: 'set_proposals_enabled',
    name: 'Set Proposals Enabled',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_set_proposals_enabled_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_set_proposals_enabled',
    markerType: 'futarchy_actions::config_actions::SetProposalsEnabled',
    params: [{ name: 'enabled', type: 'bool', description: 'Whether proposals are enabled' }],
    description: 'Enable or disable proposal creation',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'terminate_dao',
    name: 'Terminate DAO',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_terminate_dao_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_terminate_dao',
    markerType: 'futarchy_actions::config_actions::TerminateDao',
    params: [
      { name: 'reason', type: 'string', description: 'Termination reason' },
      { name: 'dissolutionUnlockDelayMs', type: 'u64', description: 'Delay before dissolution unlocks' },
    ],
    description: 'Permanently terminate the DAO',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_dao_name',
    name: 'Update DAO Name',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_update_name_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_update_name',
    markerType: 'futarchy_actions::config_actions::UpdateName',
    params: [{ name: 'newName', type: 'string', description: 'New DAO name' }],
    description: 'Update the DAO name',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_trading_params',
    name: 'Update Trading Params',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_update_trading_params_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_update_trading_params',
    markerType: 'futarchy_actions::config_actions::TradingParamsUpdate',
    params: [
      { name: 'minAssetAmount', type: 'option<u64>', description: 'Minimum asset amount', optional: true },
      { name: 'minStableAmount', type: 'option<u64>', description: 'Minimum stable amount', optional: true },
      { name: 'reviewPeriodMs', type: 'option<u64>', description: 'Review period (ms)', optional: true },
      { name: 'tradingPeriodMs', type: 'option<u64>', description: 'Trading period (ms)', optional: true },
      { name: 'ammTotalFeeBps', type: 'option<u64>', description: 'AMM fee in basis points', optional: true },
    ],
    description: 'Update trading parameters',
    launchpadSupported: true,
    proposalSupported: true,
  },
  {
    id: 'update_dao_metadata',
    name: 'Update DAO Metadata',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_update_metadata_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_update_metadata',
    markerType: 'futarchy_actions::config_actions::MetadataUpdate',
    params: [
      { name: 'daoName', type: 'option<string>', description: 'DAO name (ASCII)', optional: true },
      { name: 'iconUrl', type: 'option<string>', description: 'Icon URL', optional: true },
      { name: 'description', type: 'option<string>', description: 'Description', optional: true },
    ],
    description: 'Update DAO metadata',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_twap_config',
    name: 'Update TWAP Config',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_update_twap_config_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_update_twap_config',
    markerType: 'futarchy_actions::config_actions::TwapConfigUpdate',
    params: [
      { name: 'startDelay', type: 'option<u64>', description: 'TWAP start delay', optional: true },
      { name: 'stepMax', type: 'option<u64>', description: 'Maximum TWAP step', optional: true },
      { name: 'initialObservation', type: 'option<u128>', description: 'Initial observation', optional: true },
      { name: 'threshold', type: 'option<signed_u128>', description: 'TWAP threshold', optional: true },
    ],
    description: 'Update TWAP configuration',
    launchpadSupported: true,
    proposalSupported: true,
  },
  {
    id: 'update_governance',
    name: 'Update Governance',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_update_governance_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_update_governance',
    markerType: 'futarchy_actions::config_actions::GovernanceUpdate',
    params: [
      { name: 'maxOutcomes', type: 'option<u64>', description: 'Maximum outcomes', optional: true },
      { name: 'maxActionsPerOutcome', type: 'option<u64>', description: 'Max actions per outcome', optional: true },
      { name: 'requiredBondAmount', type: 'option<u64>', description: 'Required bond amount', optional: true },
      { name: 'maxIntentsPerOutcome', type: 'option<u64>', description: 'Max intents per outcome', optional: true },
      { name: 'proposalIntentExpiryMs', type: 'option<u64>', description: 'Proposal intent expiry', optional: true },
      { name: 'optimisticChallengeFee', type: 'option<u64>', description: 'Optimistic challenge fee', optional: true },
      {
        name: 'optimisticChallengePeriodMs',
        type: 'option<u64>',
        description: 'Optimistic challenge period',
        optional: true,
      },
      { name: 'proposalCreationFee', type: 'option<u64>', description: 'Proposal creation fee', optional: true },
      { name: 'proposalFeePerOutcome', type: 'option<u64>', description: 'Fee per outcome', optional: true },
      { name: 'acceptNewProposals', type: 'option<bool>', description: 'Accept new proposals', optional: true },
      {
        name: 'enablePremarketReservationLock',
        type: 'option<bool>',
        description: 'Enable premarket reservation lock',
        optional: true,
      },
      { name: 'showProposalDetails', type: 'option<bool>', description: 'Show proposal details', optional: true },
    ],
    description: 'Update governance settings',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_metadata_table',
    name: 'Update Metadata Table',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_update_metadata_table_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_update_metadata_table',
    markerType: 'futarchy_actions::config_actions::MetadataTableUpdate',
    params: [
      { name: 'keys', type: 'vector<string>', description: 'Keys to add/update' },
      { name: 'values', type: 'vector<string>', description: 'Values for the keys' },
      { name: 'keysToRemove', type: 'vector<string>', description: 'Keys to remove' },
    ],
    description: 'Update metadata key-value table',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_conditional_metadata',
    name: 'Update Conditional Metadata',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_update_conditional_metadata_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_update_conditional_metadata',
    markerType: 'futarchy_actions::config_actions::UpdateConditionalMetadata',
    params: [
      { name: 'useOutcomeIndex', type: 'option<bool>', description: 'Use outcome index', optional: true },
      {
        name: 'conditionalMetadata',
        type: 'conditional_metadata',
        description: 'Conditional metadata config',
        optional: true,
      },
    ],
    description: 'Update conditional metadata configuration',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_sponsorship_config',
    name: 'Update Sponsorship Config',
    category: 'config',
    package: 'futarchyActions',
    stagingModule: 'config_init_actions',
    stagingFunction: 'add_update_sponsorship_config_spec',
    executionModule: 'config_actions',
    executionFunction: 'do_update_sponsorship_config',
    markerType: 'futarchy_actions::config_actions::SponsorshipConfigUpdate',
    params: [
      { name: 'enabled', type: 'option<bool>', description: 'Sponsorship enabled', optional: true },
      {
        name: 'sponsoredThreshold',
        type: 'option<signed_u128>',
        description: 'Sponsored threshold',
        optional: true,
      },
      {
        name: 'waiveAdvancementFees',
        type: 'option<bool>',
        description: 'Waive advancement fees',
        optional: true,
      },
      {
        name: 'defaultSponsorQuotaAmount',
        type: 'option<u64>',
        description: 'Default sponsor quota',
        optional: true,
      },
    ],
    description: 'Update sponsorship configuration',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// FUTARCHY ACTIONS - QUOTA
// ============================================================================

export const QUOTA_ACTIONS: ActionDefinition[] = [
  {
    id: 'set_quotas',
    name: 'Set Quotas',
    category: 'quota',
    package: 'futarchyActions',
    stagingModule: 'quota_init_actions',
    stagingFunction: 'add_set_quotas_spec',
    executionModule: 'quota_actions',
    executionFunction: 'do_set_quotas',
    markerType: 'futarchy_actions::quota_actions::SetQuotas',
    params: [
      { name: 'users', type: 'vector<address>', description: 'User addresses' },
      { name: 'quotaAmount', type: 'u64', description: 'Quota amount per period' },
      { name: 'quotaPeriodMs', type: 'u64', description: 'Quota period (ms)' },
      { name: 'reducedFee', type: 'u64', description: 'Reduced fee amount' },
      { name: 'sponsorQuotaAmount', type: 'u64', description: 'Sponsor quota amount' },
    ],
    description: 'Set proposal quotas for users',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// FUTARCHY ACTIONS - LIQUIDITY
// ============================================================================

export const LIQUIDITY_ACTIONS: ActionDefinition[] = [
  {
    id: 'create_pool_with_mint',
    name: 'Create Pool With Mint',
    category: 'liquidity',
    package: 'futarchyActions',
    stagingModule: 'liquidity_init_actions',
    stagingFunction: 'add_create_pool_with_mint_spec',
    executionModule: 'liquidity_init_actions',
    executionFunction: 'do_init_create_pool_with_mint',
    markerType: 'futarchy_actions::liquidity_init_actions::CreatePoolWithMint',
    params: [
      { name: 'vaultName', type: 'string', description: 'Vault name for stable coins' },
      { name: 'assetAmount', type: 'u64', description: 'Asset amount to add (will be minted)' },
      { name: 'stableAmount', type: 'u64', description: 'Stable amount from vault' },
      { name: 'feeBps', type: 'u64', description: 'AMM fee in basis points' },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Create AMM pool with minted asset and vault stable',
    launchpadSupported: true,
    proposalSupported: false,
  },
  {
    id: 'create_pool',
    name: 'Create Pool',
    category: 'liquidity',
    package: 'futarchyActions',
    stagingModule: 'liquidity_actions',
    stagingFunction: 'add_create_pool_spec',
    executionModule: 'liquidity_actions',
    executionFunction: 'do_create_pool',
    markerType: 'futarchy_actions::liquidity_actions::CreatePool',
    params: [
      { name: 'assetVaultName', type: 'string', description: 'Asset vault name' },
      { name: 'stableVaultName', type: 'string', description: 'Stable vault name' },
      { name: 'assetAmount', type: 'u64', description: 'Asset amount' },
      { name: 'stableAmount', type: 'u64', description: 'Stable amount' },
      { name: 'feeBps', type: 'u64', description: 'AMM fee in basis points' },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Create AMM pool from vault funds (no minting)',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_pool_params',
    name: 'Update Pool Parameters',
    category: 'liquidity',
    package: 'futarchyActions',
    stagingModule: 'liquidity_actions',
    stagingFunction: 'add_update_pool_params_spec',
    executionModule: 'liquidity_actions',
    executionFunction: 'do_update_pool_params',
    markerType: 'futarchy_actions::liquidity_actions::UpdatePoolParams',
    params: [
      { name: 'feeBps', type: 'option<u64>', description: 'New AMM fee in basis points', optional: true },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Update pool parameters (fee)',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'add_liquidity',
    name: 'Add Liquidity',
    category: 'liquidity',
    package: 'futarchyActions',
    stagingModule: 'liquidity_actions',
    stagingFunction: 'add_add_liquidity_spec',
    executionModule: 'liquidity_actions',
    executionFunction: 'do_add_liquidity',
    markerType: 'futarchy_actions::liquidity_actions::AddLiquidity',
    params: [
      { name: 'assetVaultName', type: 'string', description: 'Asset vault name' },
      { name: 'stableVaultName', type: 'string', description: 'Stable vault name' },
      { name: 'assetAmount', type: 'u64', description: 'Asset amount' },
      { name: 'stableAmount', type: 'u64', description: 'Stable amount' },
      { name: 'minLpTokens', type: 'u64', description: 'Minimum LP tokens to receive' },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Add liquidity to pool from vaults',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'remove_liquidity',
    name: 'Remove Liquidity',
    category: 'liquidity',
    package: 'futarchyActions',
    stagingModule: 'liquidity_actions',
    stagingFunction: 'add_remove_liquidity_spec',
    executionModule: 'liquidity_actions',
    executionFunction: 'do_remove_liquidity',
    markerType: 'futarchy_actions::liquidity_actions::RemoveLiquidity',
    params: [
      { name: 'lpAmount', type: 'u64', description: 'LP token amount to burn' },
      { name: 'minAssetOut', type: 'u64', description: 'Minimum asset tokens to receive' },
      { name: 'minStableOut', type: 'u64', description: 'Minimum stable tokens to receive' },
      { name: 'assetVaultName', type: 'string', description: 'Asset vault for received tokens' },
      { name: 'stableVaultName', type: 'string', description: 'Stable vault for received tokens' },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Remove liquidity from pool to vaults',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'withdraw_lp_token',
    name: 'Withdraw LP Token',
    category: 'liquidity',
    package: 'futarchyActions',
    stagingModule: 'liquidity_actions',
    stagingFunction: 'add_withdraw_lp_token_spec',
    executionModule: 'liquidity_actions',
    executionFunction: 'do_withdraw_lp_token',
    markerType: 'futarchy_actions::liquidity_actions::WithdrawLpToken',
    params: [
      { name: 'lpAmount', type: 'u64', description: 'LP token amount to withdraw' },
      { name: 'recipient', type: 'address', description: 'Recipient address' },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Withdraw LP tokens to an address',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'swap',
    name: 'Swap',
    category: 'liquidity',
    package: 'futarchyActions',
    stagingModule: 'liquidity_actions',
    stagingFunction: 'add_swap_spec',
    executionModule: 'liquidity_actions',
    executionFunction: 'do_swap',
    markerType: 'futarchy_actions::liquidity_actions::Swap',
    params: [
      { name: 'amountIn', type: 'u64', description: 'Input amount' },
      { name: 'minAmountOut', type: 'u64', description: 'Minimum output amount' },
      { name: 'isAssetToStable', type: 'bool', description: 'Swap direction (true = asset→stable)' },
      { name: 'inputVaultName', type: 'string', description: 'Input vault name' },
      { name: 'outputVaultName', type: 'string', description: 'Output vault name' },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Swap tokens in pool',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'collect_fees',
    name: 'Collect Fees',
    category: 'liquidity',
    package: 'futarchyActions',
    stagingModule: 'liquidity_actions',
    stagingFunction: 'add_collect_fees_spec',
    executionModule: 'liquidity_actions',
    executionFunction: 'do_collect_fees',
    markerType: 'futarchy_actions::liquidity_actions::CollectFees',
    params: [
      { name: 'assetVaultName', type: 'string', description: 'Asset vault for collected fees' },
      { name: 'stableVaultName', type: 'string', description: 'Stable vault for collected fees' },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Collect accumulated fees from pool',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'withdraw_fees',
    name: 'Withdraw Fees',
    category: 'liquidity',
    package: 'futarchyActions',
    stagingModule: 'liquidity_actions',
    stagingFunction: 'add_withdraw_fees_spec',
    executionModule: 'liquidity_actions',
    executionFunction: 'do_withdraw_fees',
    markerType: 'futarchy_actions::liquidity_actions::WithdrawFees',
    params: [
      { name: 'assetAmount', type: 'u64', description: 'Asset fee amount to withdraw' },
      { name: 'stableAmount', type: 'u64', description: 'Stable fee amount to withdraw' },
      { name: 'recipient', type: 'address', description: 'Recipient address' },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Withdraw collected fees to an address',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// FUTARCHY ACTIONS - DISSOLUTION
// ============================================================================

export const DISSOLUTION_ACTIONS: ActionDefinition[] = [
  {
    id: 'create_dissolution_capability',
    name: 'Create Dissolution Capability',
    category: 'dissolution',
    package: 'futarchyActions',
    stagingModule: 'dissolution_init_actions',
    stagingFunction: 'add_create_dissolution_capability_spec',
    executionModule: 'dissolution_actions',
    executionFunction: 'do_create_dissolution_capability',
    markerType: 'futarchy_actions::dissolution_actions::CreateDissolutionCapability',
    params: [],
    typeParams: ['AssetType'],
    description: 'Create a dissolution capability for DAO termination',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// GOVERNANCE ACTIONS - PACKAGE REGISTRY
// ============================================================================

export const PACKAGE_REGISTRY_ACTIONS: ActionDefinition[] = [
  {
    id: 'add_package',
    name: 'Add Package',
    category: 'package_registry',
    package: 'futarchyGovernanceActions',
    stagingModule: 'package_registry_init_actions',
    stagingFunction: 'add_add_package_spec',
    executionModule: 'package_registry_actions',
    executionFunction: 'do_add_package',
    markerType: 'futarchy_governance_actions::package_registry_actions::AddPackage',
    params: [
      { name: 'name', type: 'string', description: 'Package name' },
      { name: 'addr', type: 'address', description: 'Package address' },
      { name: 'version', type: 'u64', description: 'Package version' },
      { name: 'actionTypes', type: 'vector<string>', description: 'Supported action types' },
      { name: 'category', type: 'string', description: 'Package category' },
      { name: 'description', type: 'string', description: 'Package description' },
    ],
    description: 'Add a package to the registry',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'remove_package',
    name: 'Remove Package',
    category: 'package_registry',
    package: 'futarchyGovernanceActions',
    stagingModule: 'package_registry_init_actions',
    stagingFunction: 'add_remove_package_spec',
    executionModule: 'package_registry_actions',
    executionFunction: 'do_remove_package',
    markerType: 'futarchy_governance_actions::package_registry_actions::RemovePackage',
    params: [{ name: 'name', type: 'string', description: 'Package name' }],
    description: 'Remove a package from the registry',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_package_version',
    name: 'Update Package Version',
    category: 'package_registry',
    package: 'futarchyGovernanceActions',
    stagingModule: 'package_registry_init_actions',
    stagingFunction: 'add_update_package_version_spec',
    executionModule: 'package_registry_actions',
    executionFunction: 'do_update_package_version',
    markerType: 'futarchy_governance_actions::package_registry_actions::UpdatePackageVersion',
    params: [
      { name: 'name', type: 'string', description: 'Package name' },
      { name: 'addr', type: 'address', description: 'New package address' },
      { name: 'version', type: 'u64', description: 'New version number' },
    ],
    description: 'Update package version in registry',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_package_metadata',
    name: 'Update Package Metadata',
    category: 'package_registry',
    package: 'futarchyGovernanceActions',
    stagingModule: 'package_registry_init_actions',
    stagingFunction: 'add_update_package_metadata_spec',
    executionModule: 'package_registry_actions',
    executionFunction: 'do_update_package_metadata',
    markerType: 'futarchy_governance_actions::package_registry_actions::UpdatePackageMetadata',
    params: [
      { name: 'name', type: 'string', description: 'Package name' },
      { name: 'newActionTypes', type: 'vector<string>', description: 'New action types' },
      { name: 'newCategory', type: 'string', description: 'New category' },
      { name: 'newDescription', type: 'string', description: 'New description' },
    ],
    description: 'Update package metadata',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'pause_account_creation',
    name: 'Pause Account Creation',
    category: 'package_registry',
    package: 'futarchyGovernanceActions',
    stagingModule: 'package_registry_init_actions',
    stagingFunction: 'add_pause_account_creation_spec',
    executionModule: 'package_registry_actions',
    executionFunction: 'do_pause_account_creation',
    markerType: 'futarchy_governance_actions::package_registry_actions::PauseAccountCreation',
    params: [],
    description: 'Pause new account creation',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'unpause_account_creation',
    name: 'Unpause Account Creation',
    category: 'package_registry',
    package: 'futarchyGovernanceActions',
    stagingModule: 'package_registry_init_actions',
    stagingFunction: 'add_unpause_account_creation_spec',
    executionModule: 'package_registry_actions',
    executionFunction: 'do_unpause_account_creation',
    markerType: 'futarchy_governance_actions::package_registry_actions::UnpauseAccountCreation',
    params: [],
    description: 'Unpause account creation',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// GOVERNANCE ACTIONS - PROTOCOL ADMIN
// ============================================================================

export const PROTOCOL_ADMIN_ACTIONS: ActionDefinition[] = [
  {
    id: 'set_factory_paused',
    name: 'Set Factory Paused',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_set_factory_paused_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_set_factory_paused',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::SetFactoryPaused',
    params: [{ name: 'paused', type: 'bool', description: 'Whether factory is paused' }],
    description: 'Pause or unpause the factory',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'disable_factory_permanently',
    name: 'Disable Factory Permanently',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_disable_factory_permanently_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_disable_factory_permanently',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::DisableFactoryPermanently',
    params: [],
    description: 'Permanently disable the factory (irreversible)',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'add_stable_type',
    name: 'Add Stable Type',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_add_stable_type_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_add_stable_type',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::AddStableType',
    params: [],
    typeParams: ['StableType'],
    description: 'Add a stable coin type',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'remove_stable_type',
    name: 'Remove Stable Type',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_remove_stable_type_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_remove_stable_type',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::RemoveStableType',
    params: [],
    typeParams: ['StableType'],
    description: 'Remove a stable coin type',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_dao_creation_fee',
    name: 'Update DAO Creation Fee',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_update_dao_creation_fee_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_update_dao_creation_fee',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::UpdateDaoCreationFee',
    params: [{ name: 'newFee', type: 'u64', description: 'New DAO creation fee' }],
    description: 'Update the DAO creation fee',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_proposal_fee',
    name: 'Update Proposal Fee',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_update_proposal_fee_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_update_proposal_fee',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::UpdateProposalFee',
    params: [{ name: 'newFeePerOutcome', type: 'u64', description: 'New fee per outcome' }],
    description: 'Update the proposal fee per outcome',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_verification_fee',
    name: 'Update Verification Fee',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_update_verification_fee_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_update_verification_fee',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::UpdateVerificationFee',
    params: [
      { name: 'level', type: 'u8', description: 'Verification level' },
      { name: 'newFee', type: 'u64', description: 'New fee for this level' },
    ],
    description: 'Update verification fee for a level',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'add_verification_level',
    name: 'Add Verification Level',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_add_verification_level_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_add_verification_level',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::AddVerificationLevel',
    params: [
      { name: 'level', type: 'u8', description: 'Verification level' },
      { name: 'fee', type: 'u64', description: 'Fee for this level' },
    ],
    description: 'Add a new verification level',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'remove_verification_level',
    name: 'Remove Verification Level',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_remove_verification_level_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_remove_verification_level',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::RemoveVerificationLevel',
    params: [{ name: 'level', type: 'u8', description: 'Verification level to remove' }],
    description: 'Remove a verification level',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'withdraw_fees_to_treasury',
    name: 'Withdraw Fees to Treasury',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_withdraw_fees_to_treasury_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_withdraw_fees_to_treasury',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::WithdrawFeesToTreasury',
    params: [
      { name: 'vaultName', type: 'string', description: 'Target vault name' },
      { name: 'amount', type: 'u64', description: 'Amount to withdraw' },
    ],
    typeParams: ['CoinType'],
    description: 'Withdraw collected fees to treasury vault',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'add_coin_fee_config',
    name: 'Add Coin Fee Config',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_add_coin_fee_config_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_add_coin_fee_config',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::AddCoinFeeConfig',
    params: [
      { name: 'decimals', type: 'u8', description: 'Coin decimals' },
      { name: 'daoCreationFee', type: 'u64', description: 'DAO creation fee' },
      { name: 'proposalFeePerOutcome', type: 'u64', description: 'Proposal fee per outcome' },
    ],
    typeParams: ['StableType'],
    description: 'Add fee configuration for a coin type',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_coin_creation_fee',
    name: 'Update Coin Creation Fee',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_update_coin_creation_fee_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_update_coin_creation_fee',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::UpdateCoinCreationFee',
    params: [{ name: 'newFee', type: 'u64', description: 'New creation fee' }],
    typeParams: ['StableType'],
    description: 'Update coin-specific creation fee',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'update_coin_proposal_fee',
    name: 'Update Coin Proposal Fee',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_update_coin_proposal_fee_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_update_coin_proposal_fee',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::UpdateCoinProposalFee',
    params: [{ name: 'newFeePerOutcome', type: 'u64', description: 'New fee per outcome' }],
    typeParams: ['StableType'],
    description: 'Update coin-specific proposal fee',
    launchpadSupported: false,
    proposalSupported: true,
  },
  {
    id: 'apply_pending_coin_fees',
    name: 'Apply Pending Coin Fees',
    category: 'protocol_admin',
    package: 'futarchyGovernanceActions',
    stagingModule: 'protocol_admin_init_actions',
    stagingFunction: 'add_apply_pending_coin_fees_spec',
    executionModule: 'protocol_admin_actions',
    executionFunction: 'do_apply_pending_coin_fees',
    markerType: 'futarchy_governance_actions::protocol_admin_actions::ApplyPendingCoinFees',
    params: [],
    typeParams: ['StableType'],
    description: 'Apply pending coin fee changes',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// ORACLE ACTIONS
// ============================================================================

export const ORACLE_ACTIONS: ActionDefinition[] = [
  {
    id: 'create_oracle_grant',
    name: 'Create Oracle Grant',
    category: 'oracle',
    package: 'futarchyOracleActions',
    stagingModule: 'oracle_init_actions',
    stagingFunction: 'add_create_oracle_grant_spec',
    executionModule: 'oracle_actions',
    executionFunction: 'do_create_oracle_grant',
    markerType: 'futarchy_oracle::oracle_actions::CreateOracleGrant',
    params: [
      { name: 'tierSpecs', type: 'tier_specs', description: 'Price tier specifications' },
      { name: 'useRelativePricing', type: 'bool', description: 'Use relative pricing' },
      { name: 'launchpadMultiplier', type: 'u64', description: 'Launchpad price multiplier' },
      { name: 'earliestExecutionOffsetMs', type: 'u64', description: 'Earliest execution offset (ms)' },
      { name: 'expiryYears', type: 'u64', description: 'Grant expiry in years' },
      { name: 'cancelable', type: 'bool', description: 'Whether grant is cancelable' },
      { name: 'description', type: 'string', description: 'Grant description' },
    ],
    typeParams: ['AssetType', 'StableType'],
    description: 'Create a price-based oracle grant',
    launchpadSupported: true,
    proposalSupported: true,
  },
  {
    id: 'cancel_oracle_grant',
    name: 'Cancel Oracle Grant',
    category: 'oracle',
    package: 'futarchyOracleActions',
    stagingModule: 'oracle_init_actions',
    stagingFunction: 'add_cancel_grant_spec',
    executionModule: 'oracle_actions',
    executionFunction: 'do_cancel_grant',
    markerType: 'futarchy_oracle::oracle_actions::CancelGrant',
    params: [{ name: 'grantId', type: 'id', description: 'Grant ID to cancel' }],
    typeParams: ['AssetType', 'StableType'],
    description: 'Cancel an oracle grant',
    launchpadSupported: false,
    proposalSupported: true,
  },
];

// ============================================================================
// COMBINED REGISTRY
// ============================================================================

/**
 * All action definitions combined
 */
export const ALL_ACTIONS: ActionDefinition[] = [
  ...TRANSFER_ACTIONS,
  ...VAULT_ACTIONS,
  ...CURRENCY_ACTIONS,
  ...STREAM_ACTIONS,
  ...MEMO_ACTIONS,
  ...PACKAGE_UPGRADE_ACTIONS,
  ...ACCESS_CONTROL_ACTIONS,
  ...CONFIG_ACTIONS,
  ...QUOTA_ACTIONS,
  ...LIQUIDITY_ACTIONS,
  ...DISSOLUTION_ACTIONS,
  ...PACKAGE_REGISTRY_ACTIONS,
  ...PROTOCOL_ADMIN_ACTIONS,
  ...ORACLE_ACTIONS,
];

/**
 * Action definitions indexed by ID for fast lookup
 */
export const ACTION_BY_ID: Record<string, ActionDefinition> = ALL_ACTIONS.reduce(
  (acc, action) => {
    acc[action.id] = action;
    return acc;
  },
  {} as Record<string, ActionDefinition>
);

/**
 * Actions grouped by category
 */
export const ACTIONS_BY_CATEGORY: Record<ActionCategory, ActionDefinition[]> = ALL_ACTIONS.reduce(
  (acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = [];
    }
    acc[action.category].push(action);
    return acc;
  },
  {} as Record<ActionCategory, ActionDefinition[]>
);

/**
 * Actions grouped by package
 */
export const ACTIONS_BY_PACKAGE: Record<PackageId, ActionDefinition[]> = ALL_ACTIONS.reduce(
  (acc, action) => {
    if (!acc[action.package]) {
      acc[action.package] = [];
    }
    acc[action.package].push(action);
    return acc;
  },
  {} as Record<PackageId, ActionDefinition[]>
);

/**
 * Launchpad-supported actions
 */
export const LAUNCHPAD_ACTIONS = ALL_ACTIONS.filter((a) => a.launchpadSupported);

/**
 * Proposal-supported actions
 */
export const PROPOSAL_ACTIONS = ALL_ACTIONS.filter((a) => a.proposalSupported);
