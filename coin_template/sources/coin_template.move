module coin_template::coin_template {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::url::{Self};

    // Template constants - these will be replaced by bytecode modification
    const DECIMALS: u8 = 6;
    const SYMBOL: vector<u8> = b"TMPL";
    const NAME: vector<u8> = b"Template Coin";
    const DESCRIPTION: vector<u8> = b"A template coin for Sui";
    const ICON_URL: vector<u8> = b"https://example.com/icon.png";

    /// The type identifier of our coin (one-time witness)
    public struct COIN_TEMPLATE has drop {}

    /// Initialize new coin type and transfer TreasuryCap to deployer
    fun init(witness: COIN_TEMPLATE, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<COIN_TEMPLATE>(
            witness,
            DECIMALS,
            SYMBOL,
            NAME,
            DESCRIPTION,
            option::some(url::new_unsafe_from_bytes(ICON_URL)),
            ctx
        );

        // Freeze the metadata object to make it immutable
        transfer::public_freeze_object(metadata);

        // Transfer treasury cap to deployer (gives them exclusive minting rights)
        transfer::public_transfer(treasury_cap, ctx.sender());
    }

    /// Mint new coins (only treasury cap owner can call this)
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<COIN_TEMPLATE>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient)
    }

    /// Burn coins (only treasury cap owner can call this)
    public entry fun burn(
        treasury_cap: &mut TreasuryCap<COIN_TEMPLATE>,
        coin_to_burn: Coin<COIN_TEMPLATE>
    ): u64 {
        coin::burn(treasury_cap, coin_to_burn)
    }
}
