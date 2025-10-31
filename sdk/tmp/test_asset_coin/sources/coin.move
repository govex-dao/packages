module test_asset_coin::coin {
    use sui::coin;

    public struct COIN has drop {}

    fun init(witness: COIN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9, // decimals
            b"ASSET",
            b"test_asset",
            b"Test asset coin for DAO governance",
            option::none(),
            ctx
        );

        transfer::public_transfer(treasury, ctx.sender());
        transfer::public_transfer(metadata, ctx.sender());
    }
}
