/**
 * Core Module Exports
 *
 * This module provides the foundational infrastructure for the SDK:
 * - Action Registry: Single source of truth for all 60+ action definitions
 * - Validation: Input validation before sending transactions
 * - Error Mapping: Human-readable Move error translations
 * - Staging: Functions for staging actions to intents
 *
 * @module core
 */

// ============================================================================
// ACTION REGISTRY
// ============================================================================

export {
  // Type definitions
  type ParamType,
  type ParamDef,
  type PackageId,
  type ActionCategory,
  type ActionDefinition,

  // Action arrays by category
  TRANSFER_ACTIONS,
  VAULT_ACTIONS,
  CURRENCY_ACTIONS,
  STREAM_ACTIONS,
  MEMO_ACTIONS,
  PACKAGE_UPGRADE_ACTIONS,
  ACCESS_CONTROL_ACTIONS,
  CONFIG_ACTIONS,
  QUOTA_ACTIONS,
  LIQUIDITY_ACTIONS,
  DISSOLUTION_ACTIONS,
  PACKAGE_REGISTRY_ACTIONS,
  PROTOCOL_ADMIN_ACTIONS,
  ORACLE_ACTIONS,

  // Combined registry
  ALL_ACTIONS,
  ACTION_BY_ID,
  ACTIONS_BY_CATEGORY,
  ACTIONS_BY_PACKAGE,
  LAUNCHPAD_ACTIONS,
  PROPOSAL_ACTIONS,

  // Lookup functions
  getAction,
  findAction,
  getActionsByCategory,
  getActionsByPackage,
  isValidAction,
  getAllActionIds,
  getAllCategories,
  getActionCount,

  // Type helpers
  paramTypeToTsType,
  generateActionConfigInterface,
  toCamelCase,

  // Package resolution
  type PackageIdConfig,
  resolvePackageId,
  getStagingTarget,
  getExecutionTarget,
} from './action-registry';

// ============================================================================
// VALIDATION
// ============================================================================

export {
  // Error class
  SDKValidationError,

  // Address validation
  validateSuiAddress,
  validateOptionalSuiAddress,
  validateObjectId,

  // Amount validation
  validatePositiveAmount,
  validateNonNegativeAmount,
  validateAmountInRange,

  // String validation
  validateNonEmptyString,
  validateStringLength,
  validateVaultName,
  validatePackageName,
  validateMoveType,

  // Timestamp validation
  validateTimestampMs,
  validateFutureTimestamp,
  validateDurationMs,

  // Other validation
  validateBasisPoints,
  validateNonEmptyArray,
  validateArrayLength,
  validateMatchingArrayLengths,
  validateBoolean,
  validateDigest,

  // Composite validators
  validateStreamParams,
  validateTierSpec,
} from './validation/validators';

// ============================================================================
// ERROR MAPPING
// ============================================================================

export {
  // Error codes
  MOVE_ERROR_CODES,

  // Error class
  SDKMoveError,

  // Translation
  translateMoveError,
  withErrorTranslation,

  // Helpers
  isMoveError,
  isInsufficientBalanceError,
  isDaoTerminatedError,
  isProposalsDisabledError,
  isSlippageError,
} from './errors/error-mapping';

// ============================================================================
// STAGING
// ============================================================================

export {
  // Staging function generator
  addStagingCall,
  type StagingPackageConfig,
  type StagingCallParams,
  type StagedActionResult,

  // Helpers
  getLaunchpadActionIds,
  getProposalActionIds,
  isLaunchpadSupported,
  isProposalSupported,
  validateActionsForContext,
} from './staging';
