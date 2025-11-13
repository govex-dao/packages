// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Conditional Asset Coin for Outcome 0 (Reject)
module conditional_coins::cond0_asset;

use sui::coin;

/// One-Time Witness for COND0_ASSET
public struct COND0_ASSET has drop {}

/// Initialize function called when module is published
fun init(witness: COND0_ASSET, ctx: &mut TxContext) {
    let (treasury_cap, metadata) = coin::create_currency(
        witness,
        6, // 6 decimals to match test coins
        b"", // Empty symbol for CoinRegistry
        b"", // Empty name for CoinRegistry
        b"", // Empty description for CoinRegistry
        option::none(), // No icon for CoinRegistry
        ctx,
    );

    // Transfer both to sender
    transfer::public_transfer(treasury_cap, ctx.sender());
    transfer::public_transfer(metadata, ctx.sender());
}
