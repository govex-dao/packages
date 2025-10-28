module non_shared_asset::coin {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::url::{Self};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::option;

    const DECIMALS: u8 = 9;
    const SYMBOL: vector<u8> = b"NSASSET";
    const NAME: vector<u8> = b"Non-Shared Asset";
    const DESCRIPTION: vector<u8> = b"Test asset token with owned TreasuryCap for launchpad testing.";
    const ICON_URL: vector<u8> = b"https://www.govex.ai/images/govex-icon.png";

    /// The type identifier of our coin
    struct COIN has drop {}

    /// Initialize new coin type and transfer both TreasuryCap and CoinMetadata to sender
    /// NOTE: CoinMetadata must be OWNED (not frozen) for launchpad compatibility
    fun init(witness: COIN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<COIN>(
            witness,
            DECIMALS,
            SYMBOL,
            NAME,
            DESCRIPTION,
            option::some(url::new_unsafe_from_bytes(ICON_URL)),
            ctx
        );

        // Transfer BOTH as owned objects (not frozen) for launchpad compatibility
        // The launchpad contract takes ownership of both TreasuryCap and CoinMetadata
        transfer::public_transfer(metadata, tx_context::sender(ctx));
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    /// Mint new coins (only owner of TreasuryCap can mint)
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<COIN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient)
    }

    /// Burn coins
    public entry fun burn(
        treasury_cap: &mut TreasuryCap<COIN>,
        coin_to_burn: Coin<COIN>
    ): u64 {
        coin::burn(treasury_cap, coin_to_burn)
    }
}
