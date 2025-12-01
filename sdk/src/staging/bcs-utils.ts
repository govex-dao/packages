/**
 * BCS (Binary Canonical Serialization) utilities for action serialization
 *
 * Provides helpers for serializing action data to match Move struct layouts.
 * All action builders use these utilities to ensure correct BCS encoding.
 */

import { bcs } from "@mysten/sui/bcs";

/**
 * Serialize optional string field
 * Matches Move: Option<String>
 */
export function serializeOptionString(value: string | undefined | null): Uint8Array {
    if (value === undefined || value === null) {
        return bcs.option(bcs.string()).serialize(null).toBytes();
    }
    return bcs.option(bcs.string()).serialize(value).toBytes();
}

/**
 * Serialize optional u64 field
 * Matches Move: Option<u64>
 */
export function serializeOptionU64(value: bigint | number | undefined | null): Uint8Array {
    if (value === undefined || value === null) {
        return bcs.option(bcs.u64()).serialize(null).toBytes();
    }
    return bcs.option(bcs.u64()).serialize(BigInt(value)).toBytes();
}

/**
 * Serialize optional u128 field
 * Matches Move: Option<u128>
 */
export function serializeOptionU128(value: bigint | number | undefined | null): Uint8Array {
    if (value === undefined || value === null) {
        return bcs.option(bcs.u128()).serialize(null).toBytes();
    }
    return bcs.option(bcs.u128()).serialize(BigInt(value)).toBytes();
}

/**
 * Serialize optional bool field
 * Matches Move: Option<bool>
 */
export function serializeOptionBool(value: boolean | undefined | null): Uint8Array {
    if (value === undefined || value === null) {
        return bcs.option(bcs.bool()).serialize(null).toBytes();
    }
    return bcs.option(bcs.bool()).serialize(value).toBytes();
}

/**
 * Concatenate multiple BCS byte arrays
 * Used when serializing structs with multiple fields
 */
export function concatBytes(...arrays: Uint8Array[]): number[] {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return Array.from(result);
}

/**
 * Serialize a vector of strings
 * Matches Move: vector<String>
 */
export function serializeVectorString(values: string[]): Uint8Array {
    return bcs.vector(bcs.string()).serialize(values).toBytes();
}

/**
 * Serialize a vector of u64
 * Matches Move: vector<u64>
 */
export function serializeVectorU64(values: (bigint | number)[]): Uint8Array {
    return bcs.vector(bcs.u64()).serialize(values.map(v => BigInt(v))).toBytes();
}

/**
 * Build a TypeName string for an action
 * Format: "package_id::module::Type"
 *
 * @param packageId - Package ID (0x... address)
 * @param module - Module name
 * @param type - Type name
 */
export function buildActionType(packageId: string, module: string, type: string): string {
    return `${packageId}::${module}::${type}`;
}
