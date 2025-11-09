/**
 * Platform-agnostic hex encoding/decoding utilities
 *
 * These utilities work in both Node.js and browser environments,
 * unlike Buffer which is Node.js-only.
 *
 * @module utils/hex
 */

/**
 * Convert a hex string to a byte array
 *
 * @param hex - Hex string (with or without '0x' prefix)
 * @returns Array of bytes (0-255)
 *
 * @example
 * ```typescript
 * hexToBytes('0x1a2b3c') // [26, 43, 60]
 * hexToBytes('1a2b3c')   // [26, 43, 60]
 * ```
 */
export function hexToBytes(hex: string): number[] {
  // Remove 0x prefix if present
  const cleaned = hex.replace(/^0x/i, '');

  // Validate hex string
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new Error(`Invalid hex string: ${hex}`);
  }

  // Hex strings must have even length (2 chars per byte)
  if (cleaned.length % 2 !== 0) {
    throw new Error(`Hex string must have even length: ${hex}`);
  }

  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
  }

  return bytes;
}

/**
 * Convert a byte array to a hex string
 *
 * @param bytes - Array of bytes (0-255)
 * @param prefix - Whether to add '0x' prefix (default: true)
 * @returns Hex string
 *
 * @example
 * ```typescript
 * bytesToHex([26, 43, 60])           // '0x1a2b3c'
 * bytesToHex([26, 43, 60], false)    // '1a2b3c'
 * ```
 */
export function bytesToHex(bytes: number[] | Uint8Array, prefix = true): string {
  const hex = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  return prefix ? `0x${hex}` : hex;
}
