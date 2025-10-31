module test_coin::coin {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    /// One Time Witness
    public struct COIN has drop {}

    /// Module initializer
    fun init(witness: COIN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9, // decimals
            b"TEST",
            b"Test Coin",
            b"Test coin for DAO testing",
            option::none(),
            ctx
        );

        // Transfer capabilities to sender
        transfer::public_transfer(treasury, tx_context::sender(ctx));
        transfer::public_freeze_object(metadata);
    }
}
