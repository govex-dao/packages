/**
 * Validation Layer
 *
 * Provides input validation before sending transactions to the chain.
 * Catches errors early with human-readable messages.
 *
 * @module core/validation/validators
 */

// ============================================================================
// VALIDATION ERROR
// ============================================================================

/**
 * Custom error class for SDK validation errors
 */
export class SDKValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'SDKValidationError';
  }
}

// ============================================================================
// ADDRESS VALIDATION
// ============================================================================

/**
 * Validate a Sui address
 * @param address - Address to validate
 * @param fieldName - Field name for error messages
 */
export function validateSuiAddress(address: string, fieldName = 'address'): void {
  if (typeof address !== 'string') {
    throw new SDKValidationError(`${fieldName} must be a string`, fieldName, address);
  }

  // Sui addresses are 32 bytes = 64 hex chars, prefixed with 0x
  if (!address.match(/^0x[a-fA-F0-9]{64}$/)) {
    throw new SDKValidationError(
      `Invalid Sui address for ${fieldName}: expected 0x followed by 64 hex characters, got "${address}"`,
      fieldName,
      address
    );
  }
}

/**
 * Validate an optional Sui address
 */
export function validateOptionalSuiAddress(address: string | undefined | null, fieldName = 'address'): void {
  if (address !== undefined && address !== null) {
    validateSuiAddress(address, fieldName);
  }
}

// ============================================================================
// OBJECT ID VALIDATION
// ============================================================================

/**
 * Validate a Sui object ID
 * @param id - Object ID to validate
 * @param fieldName - Field name for error messages
 */
export function validateObjectId(id: string, fieldName = 'objectId'): void {
  // Object IDs have the same format as addresses
  validateSuiAddress(id, fieldName);
}

// ============================================================================
// AMOUNT VALIDATION
// ============================================================================

/**
 * Validate a positive amount (bigint)
 */
export function validatePositiveAmount(amount: bigint, fieldName = 'amount'): void {
  if (typeof amount !== 'bigint') {
    throw new SDKValidationError(`${fieldName} must be a bigint`, fieldName, amount);
  }

  if (amount <= 0n) {
    throw new SDKValidationError(`${fieldName} must be positive, got ${amount}`, fieldName, amount);
  }
}

/**
 * Validate a non-negative amount (bigint)
 */
export function validateNonNegativeAmount(amount: bigint, fieldName = 'amount'): void {
  if (typeof amount !== 'bigint') {
    throw new SDKValidationError(`${fieldName} must be a bigint`, fieldName, amount);
  }

  if (amount < 0n) {
    throw new SDKValidationError(`${fieldName} must be non-negative, got ${amount}`, fieldName, amount);
  }
}

/**
 * Validate an amount is within range
 */
export function validateAmountInRange(amount: bigint, min: bigint, max: bigint, fieldName = 'amount'): void {
  validateNonNegativeAmount(amount, fieldName);

  if (amount < min) {
    throw new SDKValidationError(`${fieldName} must be at least ${min}, got ${amount}`, fieldName, amount);
  }

  if (amount > max) {
    throw new SDKValidationError(`${fieldName} must be at most ${max}, got ${amount}`, fieldName, amount);
  }
}

// ============================================================================
// STRING VALIDATION
// ============================================================================

/**
 * Validate a non-empty string
 */
export function validateNonEmptyString(value: string, fieldName = 'value'): void {
  if (typeof value !== 'string') {
    throw new SDKValidationError(`${fieldName} must be a string`, fieldName, value);
  }

  if (value.length === 0) {
    throw new SDKValidationError(`${fieldName} cannot be empty`, fieldName, value);
  }
}

/**
 * Validate string length
 */
export function validateStringLength(value: string, minLength: number, maxLength: number, fieldName = 'value'): void {
  validateNonEmptyString(value, fieldName);

  if (value.length < minLength) {
    throw new SDKValidationError(
      `${fieldName} must be at least ${minLength} characters, got ${value.length}`,
      fieldName,
      value
    );
  }

  if (value.length > maxLength) {
    throw new SDKValidationError(
      `${fieldName} must be at most ${maxLength} characters, got ${value.length}`,
      fieldName,
      value
    );
  }
}

/**
 * Validate vault name
 */
export function validateVaultName(name: string): void {
  validateStringLength(name, 1, 64, 'vaultName');

  // Vault names should be alphanumeric with underscores
  if (!name.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
    throw new SDKValidationError(
      `Vault name must start with a letter and contain only letters, numbers, and underscores: "${name}"`,
      'vaultName',
      name
    );
  }
}

/**
 * Validate package name
 */
export function validatePackageName(name: string): void {
  validateStringLength(name, 1, 128, 'packageName');

  // Package names should be valid Move identifiers
  if (!name.match(/^[a-z][a-z0-9_]*$/)) {
    throw new SDKValidationError(
      `Package name must be a valid Move identifier (lowercase, starts with letter): "${name}"`,
      'packageName',
      name
    );
  }
}

// ============================================================================
// TYPE VALIDATION
// ============================================================================

/**
 * Validate a Move type string
 */
export function validateMoveType(typeStr: string, fieldName = 'type'): void {
  validateNonEmptyString(typeStr, fieldName);

  // Basic Move type format: 0x...::module::Type or 0x...::module::Type<...>
  if (!typeStr.match(/^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*(<.*>)?$/)) {
    throw new SDKValidationError(
      `Invalid Move type format for ${fieldName}: "${typeStr}". Expected format: 0x...::module::Type`,
      fieldName,
      typeStr
    );
  }
}

// ============================================================================
// TIMESTAMP VALIDATION
// ============================================================================

/**
 * Validate a timestamp in milliseconds
 */
export function validateTimestampMs(timestamp: number, fieldName = 'timestamp'): void {
  if (typeof timestamp !== 'number' || !Number.isInteger(timestamp)) {
    throw new SDKValidationError(`${fieldName} must be an integer`, fieldName, timestamp);
  }

  if (timestamp < 0) {
    throw new SDKValidationError(`${fieldName} must be non-negative`, fieldName, timestamp);
  }

  // Reasonable range check (year 2000 to year 2100 in ms)
  const minMs = 946684800000; // 2000-01-01
  const maxMs = 4102444800000; // 2100-01-01

  if (timestamp !== 0 && (timestamp < minMs || timestamp > maxMs)) {
    throw new SDKValidationError(
      `${fieldName} appears to be invalid (${timestamp}). Expected milliseconds between 2000 and 2100.`,
      fieldName,
      timestamp
    );
  }
}

/**
 * Validate a future timestamp
 */
export function validateFutureTimestamp(timestamp: number, fieldName = 'timestamp'): void {
  validateTimestampMs(timestamp, fieldName);

  const now = Date.now();
  if (timestamp <= now) {
    throw new SDKValidationError(
      `${fieldName} must be in the future. Got ${new Date(timestamp).toISOString()}, current time is ${new Date(now).toISOString()}`,
      fieldName,
      timestamp
    );
  }
}

// ============================================================================
// DURATION VALIDATION
// ============================================================================

/**
 * Validate a duration in milliseconds
 */
export function validateDurationMs(duration: number | bigint, fieldName = 'duration'): void {
  const durationNum = typeof duration === 'bigint' ? Number(duration) : duration;

  if (durationNum <= 0) {
    throw new SDKValidationError(`${fieldName} must be positive`, fieldName, duration);
  }

  // Max duration: 10 years in ms
  const maxDuration = 10 * 365 * 24 * 60 * 60 * 1000;
  if (durationNum > maxDuration) {
    throw new SDKValidationError(
      `${fieldName} exceeds maximum of 10 years (${maxDuration}ms)`,
      fieldName,
      duration
    );
  }
}

// ============================================================================
// BASIS POINTS VALIDATION
// ============================================================================

/**
 * Validate basis points (0-10000)
 */
export function validateBasisPoints(bps: number, fieldName = 'basisPoints'): void {
  if (typeof bps !== 'number' || !Number.isInteger(bps)) {
    throw new SDKValidationError(`${fieldName} must be an integer`, fieldName, bps);
  }

  if (bps < 0 || bps > 10000) {
    throw new SDKValidationError(`${fieldName} must be between 0 and 10000 (0% to 100%), got ${bps}`, fieldName, bps);
  }
}

// ============================================================================
// ARRAY VALIDATION
// ============================================================================

/**
 * Validate a non-empty array
 */
export function validateNonEmptyArray<T>(arr: T[], fieldName = 'array'): void {
  if (!Array.isArray(arr)) {
    throw new SDKValidationError(`${fieldName} must be an array`, fieldName, arr);
  }

  if (arr.length === 0) {
    throw new SDKValidationError(`${fieldName} cannot be empty`, fieldName, arr);
  }
}

/**
 * Validate array length
 */
export function validateArrayLength<T>(arr: T[], minLength: number, maxLength: number, fieldName = 'array'): void {
  if (!Array.isArray(arr)) {
    throw new SDKValidationError(`${fieldName} must be an array`, fieldName, arr);
  }

  if (arr.length < minLength) {
    throw new SDKValidationError(
      `${fieldName} must have at least ${minLength} elements, got ${arr.length}`,
      fieldName,
      arr
    );
  }

  if (arr.length > maxLength) {
    throw new SDKValidationError(
      `${fieldName} must have at most ${maxLength} elements, got ${arr.length}`,
      fieldName,
      arr
    );
  }
}

/**
 * Validate matching array lengths
 */
export function validateMatchingArrayLengths<T, U>(arr1: T[], arr2: U[], name1: string, name2: string): void {
  if (arr1.length !== arr2.length) {
    throw new SDKValidationError(
      `${name1} and ${name2} must have the same length. Got ${arr1.length} and ${arr2.length}`,
      `${name1}/${name2}`,
      { [name1]: arr1.length, [name2]: arr2.length }
    );
  }
}

// ============================================================================
// BOOLEAN VALIDATION
// ============================================================================

/**
 * Validate boolean
 */
export function validateBoolean(value: unknown, fieldName = 'value'): void {
  if (typeof value !== 'boolean') {
    throw new SDKValidationError(`${fieldName} must be a boolean`, fieldName, value);
  }
}

// ============================================================================
// DIGEST VALIDATION
// ============================================================================

/**
 * Validate a package digest (32 bytes as hex or Uint8Array)
 */
export function validateDigest(digest: string | Uint8Array, fieldName = 'digest'): void {
  if (typeof digest === 'string') {
    // Hex string: 64 characters (32 bytes)
    if (!digest.match(/^[a-fA-F0-9]{64}$/)) {
      throw new SDKValidationError(
        `${fieldName} must be 32 bytes (64 hex characters), got "${digest}"`,
        fieldName,
        digest
      );
    }
  } else if (digest instanceof Uint8Array) {
    if (digest.length !== 32) {
      throw new SDKValidationError(
        `${fieldName} must be 32 bytes, got ${digest.length} bytes`,
        fieldName,
        digest
      );
    }
  } else {
    throw new SDKValidationError(`${fieldName} must be a hex string or Uint8Array`, fieldName, digest);
  }
}

// ============================================================================
// COMPOSITE VALIDATORS
// ============================================================================

/**
 * Validate stream creation parameters
 */
export function validateStreamParams(params: {
  vaultName: string;
  beneficiary: string;
  amountPerIteration: bigint;
  startTime: number;
  iterationsTotal: bigint;
  iterationPeriodMs: bigint;
  cliffTime?: number;
  maxPerWithdrawal: bigint;
}): void {
  validateVaultName(params.vaultName);
  validateSuiAddress(params.beneficiary, 'beneficiary');
  validatePositiveAmount(params.amountPerIteration, 'amountPerIteration');
  validateTimestampMs(params.startTime, 'startTime');
  validatePositiveAmount(params.iterationsTotal, 'iterationsTotal');
  validateDurationMs(params.iterationPeriodMs, 'iterationPeriodMs');

  if (params.cliffTime !== undefined) {
    validateTimestampMs(params.cliffTime, 'cliffTime');
    if (params.cliffTime < params.startTime) {
      throw new SDKValidationError(
        `cliffTime (${params.cliffTime}) must be >= startTime (${params.startTime})`,
        'cliffTime',
        params.cliffTime
      );
    }
  }

  validatePositiveAmount(params.maxPerWithdrawal, 'maxPerWithdrawal');
}

/**
 * Validate oracle grant tier spec
 */
export function validateTierSpec(tier: {
  priceThreshold: bigint;
  isAbove: boolean;
  recipients: Array<{ address: string; amount: bigint }>;
  description: string;
}): void {
  validateNonNegativeAmount(tier.priceThreshold, 'priceThreshold');
  validateBoolean(tier.isAbove, 'isAbove');
  validateNonEmptyArray(tier.recipients, 'recipients');
  validateStringLength(tier.description, 1, 256, 'description');

  tier.recipients.forEach((r, i) => {
    validateSuiAddress(r.address, `recipients[${i}].address`);
    validatePositiveAmount(r.amount, `recipients[${i}].amount`);
  });
}
