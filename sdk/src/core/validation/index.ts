/**
 * Validation Module
 *
 * Exports all validation functions and types.
 *
 * @module core/validation
 */

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
} from './validators';
