/**
 * Validation utilities for Move types and Sui objects
 *
 * Provides client-side validation to catch errors early and provide
 * clear error messages before sending transactions on-chain.
 *
 * @module utils/validation
 */

/**
 * Set of primitive Move types
 */
const PRIMITIVE_TYPES = new Set([
  'u8',
  'u16',
  'u32',
  'u64',
  'u128',
  'u256',
  'bool',
  'address',
]);

/**
 * Validate a Move type string
 *
 * Ensures type arguments are properly formatted before passing to tx.moveCall.
 * Prevents cryptic runtime errors from malformed type strings.
 *
 * @param type - Move type string to validate
 * @param paramName - Optional parameter name for better error messages
 * @throws {Error} If type string is invalid
 *
 * @example Valid types
 * ```typescript
 * validateMoveType('u64');                           // Primitive
 * validateMoveType('bool');                          // Primitive
 * validateMoveType('0x2::coin::Coin');              // Fully qualified
 * validateMoveType('0x2::coin::Coin<0x2::sui::SUI>'); // Generic
 * ```
 *
 * @example Invalid types (will throw)
 * ```typescript
 * validateMoveType('MyCoin');           // Missing package address
 * validateMoveType('2::coin::Coin');    // Missing 0x prefix
 * validateMoveType('0x2::coin');        // Missing type name
 * ```
 */
export function validateMoveType(type: string, paramName?: string): void {
  const param = paramName ? ` for parameter '${paramName}'` : '';

  if (!type || typeof type !== 'string') {
    throw new Error(`Invalid Move type${param}: expected string, got ${typeof type}`);
  }

  // Allow primitive types
  if (PRIMITIVE_TYPES.has(type)) {
    return;
  }

  // Validate fully qualified type: 0x[hex]::[module]::[Type]
  // Also supports generics: 0x2::coin::Coin<0x2::sui::SUI>
  const fqTypePattern = /^0x[a-fA-F0-9]+::\w+::\w+(?:<.+>)?$/;

  if (!fqTypePattern.test(type)) {
    throw new Error(
      `Invalid Move type${param}: "${type}"\n` +
        `Expected format:\n` +
        `  - Primitive: u8, u16, u32, u64, u128, u256, bool, address\n` +
        `  - Qualified: 0x[package]::[module]::[Type]\n` +
        `  - Generic:   0x2::coin::Coin<0x2::sui::SUI>\n` +
        `\nCommon mistakes:\n` +
        `  ✗ "MyCoin"           → ✓ "0x123::my_module::MyCoin"\n` +
        `  ✗ "2::coin::Coin"    → ✓ "0x2::coin::Coin"\n` +
        `  ✗ "0x2::coin"        → ✓ "0x2::coin::Coin"`
    );
  }
}

/**
 * Validate multiple Move type strings
 *
 * Convenience function for validating arrays of type arguments.
 *
 * @param types - Array of Move type strings
 * @param paramNames - Optional array of parameter names (must match length)
 * @throws {Error} If any type string is invalid
 *
 * @example
 * ```typescript
 * validateMoveTypes(
 *   ['0x2::coin::Coin<0x2::sui::SUI>', 'bool', 'u64'],
 *   ['coinType', 'flag', 'amount']
 * );
 * ```
 */
export function validateMoveTypes(types: string[], paramNames?: string[]): void {
  if (paramNames && paramNames.length !== types.length) {
    throw new Error('paramNames length must match types length');
  }

  types.forEach((type, index) => {
    const paramName = paramNames?.[index];
    validateMoveType(type, paramName);
  });
}

/**
 * Validate a Sui object ID
 *
 * Ensures object IDs are properly formatted 32-byte hex strings.
 *
 * @param id - Object ID to validate
 * @param paramName - Optional parameter name for better error messages
 * @throws {Error} If object ID is invalid
 *
 * @example Valid object IDs
 * ```typescript
 * validateObjectId('0x0000000000000000000000000000000000000000000000000000000000000006');
 * validateObjectId('0x6'); // Shortened form (auto-padded by Sui)
 * ```
 *
 * @example Invalid object IDs (will throw)
 * ```typescript
 * validateObjectId('0x123');              // Too short (not 32 bytes when expanded)
 * validateObjectId('000...006');          // Missing 0x prefix
 * validateObjectId('0xGGGG...0006');      // Invalid hex characters
 * ```
 */
export function validateObjectId(id: string, paramName?: string): void {
  const param = paramName ? ` for parameter '${paramName}'` : '';

  if (!id || typeof id !== 'string') {
    throw new Error(`Invalid object ID${param}: expected string, got ${typeof id}`);
  }

  // Must start with 0x
  if (!id.startsWith('0x')) {
    throw new Error(`Invalid object ID${param}: "${id}" (must start with "0x")`);
  }

  // Remove 0x prefix for validation
  const hex = id.slice(2);

  // Must be valid hex
  if (!/^[a-fA-F0-9]+$/.test(hex)) {
    throw new Error(`Invalid object ID${param}: "${id}" (contains non-hex characters)`);
  }

  // Can be shortened (like 0x6) or full length (64 hex chars = 32 bytes)
  // Sui accepts both forms
  if (hex.length > 64) {
    throw new Error(
      `Invalid object ID${param}: "${id}" (too long, max 64 hex characters after 0x)`
    );
  }
}

/**
 * Validate a Sui address
 *
 * Addresses are 32-byte values like object IDs.
 * This is an alias for validateObjectId with better semantics.
 *
 * @param address - Address to validate
 * @param paramName - Optional parameter name for better error messages
 * @throws {Error} If address is invalid
 */
export function validateAddress(address: string, paramName?: string): void {
  validateObjectId(address, paramName);
}

/**
 * Validate a number is within u64 range
 *
 * JavaScript numbers can exceed u64 max (2^64 - 1), which causes
 * runtime errors when passed to Move functions expecting u64.
 *
 * @param value - Number to validate
 * @param paramName - Optional parameter name for better error messages
 * @throws {Error} If value is out of u64 range
 *
 * @example
 * ```typescript
 * validateU64(1000);                    // OK
 * validateU64(Number.MAX_SAFE_INTEGER); // OK
 * validateU64(-1);                      // Error: negative
 * validateU64(1.5);                     // Error: not integer
 * ```
 */
export function validateU64(value: number | bigint, paramName?: string): void {
  const param = paramName ? ` for parameter '${paramName}'` : '';

  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new Error(`Invalid u64${param}: ${value} (must be >= 0)`);
    }
    if (value > 18446744073709551615n) {
      throw new Error(`Invalid u64${param}: ${value} (must be <= 2^64 - 1)`);
    }
    return;
  }

  if (typeof value !== 'number') {
    throw new Error(`Invalid u64${param}: expected number or bigint, got ${typeof value}`);
  }

  if (!Number.isInteger(value)) {
    throw new Error(`Invalid u64${param}: ${value} (must be an integer)`);
  }

  if (value < 0) {
    throw new Error(`Invalid u64${param}: ${value} (must be >= 0)`);
  }

  if (value > Number.MAX_SAFE_INTEGER) {
    throw new Error(
      `Invalid u64${param}: ${value} exceeds MAX_SAFE_INTEGER. ` +
        `Use bigint or string for values > ${Number.MAX_SAFE_INTEGER}`
    );
  }
}

/**
 * Validate an array is non-empty
 *
 * Prevents wasteful transactions from passing empty arrays.
 *
 * @param arr - Array to validate
 * @param paramName - Optional parameter name for better error messages
 * @throws {Error} If array is empty
 */
export function validateNonEmptyArray<T>(arr: T[], paramName?: string): void {
  const param = paramName ? ` '${paramName}'` : '';

  if (!Array.isArray(arr)) {
    throw new Error(`Invalid array${param}: expected array, got ${typeof arr}`);
  }

  if (arr.length === 0) {
    throw new Error(`Invalid array${param}: must not be empty`);
  }
}
