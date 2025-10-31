module test_stable_coin::coin {
    use sui::coin;

    public struct COIN has drop {}

    fun init(witness: COIN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9, // decimals
            b"STABLE",
            b"test_stable",
            b"Test stable coin for payments",
            option::none(),
            ctx
        );

        transfer::public_transfer(treasury, ctx.sender());
        transfer::public_transfer(metadata, ctx.sender());
    }
}
