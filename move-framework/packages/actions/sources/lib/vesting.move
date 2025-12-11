// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Standalone vesting module with TRUE FUND ISOLATION.
///
/// Key difference from vault streams:
/// - Funds are PHYSICALLY MOVED to a shared Vesting object on creation
/// - Cannot be drained by vault operations or other DAO spending
/// - Uncancellable vestings are GUARANTEED to recipient
///
/// Features (matching vault streams):
/// - Iteration-based vesting (discrete unlock events)
/// - Optional cliff period
/// - Optional "use or lose" claim window
/// - Transferable beneficiary (with ClaimCap)
/// - Cancellable setting
/// - Rate limiting (max per withdrawal)

module account_actions::vesting;

// === Imports ===

use std::string::String;
use std::type_name::{Self, TypeName};
use sui::{
    balance::Balance,
    coin::{Self, Coin},
    clock::Clock,
    event,
    bcs,
};
use account_protocol::{
    account::Account,
    intents::{Self, Expired},
    executable::{Self, Executable},
    executable_resources,
    version_witness::VersionWitness,
    bcs_validation,
    action_validation,
};
use account_actions::stream_utils;

// === Errors ===

const EBalanceNotEmpty: u64 = 0;
const ETooEarly: u64 = 1;
const EWrongVesting: u64 = 2;
const EVestingOver: u64 = 3;
const ENotCancellable: u64 = 4;
const ECliffNotReached: u64 = 5;
const EUnsupportedActionVersion: u64 = 6;
const EUnauthorized: u64 = 7;
const EUnauthorizedBeneficiary: u64 = 8;
const EWithdrawalLimitExceeded: u64 = 9;
const EInsufficientVestedAmount: u64 = 10;
const ENotTransferable: u64 = 11;
const EInvalidParameters: u64 = 15;
const EAmountMustBeGreaterThanZero: u64 = 16;
const EAmountMismatch: u64 = 17;

// === Action Type Markers ===

/// Create a new vesting
public struct CreateVesting has drop {}
/// Cancel a vesting (if cancellable)
public struct CancelVesting has drop {}

// === Structs ===

/// Shared object holding locked funds with iteration-based vesting schedule.
/// TRUE ISOLATION: funds live here, completely separate from vault.
public struct Vesting<phantom CoinType> has key {
    id: UID,
    /// The DAO account this vesting belongs to
    dao_address: address,
    /// Remaining balance to be vested
    balance: Balance<CoinType>,
    /// Coin type for verification
    coin_type: TypeName,
    /// Beneficiary who can claim (transferable with ClaimCap if is_transferable)
    beneficiary: address,
    // === Iteration-based vesting parameters ===
    /// Tokens that unlock per iteration (NO DIVISION - exact amount)
    amount_per_iteration: u64,
    /// Total claimed so far
    claimed_amount: u64,
    /// When vesting starts
    start_time: u64,
    /// Number of unlock events
    iterations_total: u64,
    /// Time between unlocks (ms)
    iteration_period_ms: u64,
    /// Optional cliff - nothing claimable until cliff reached
    cliff_time: Option<u64>,
    /// Optional "use or lose" window per iteration
    claim_window_ms: Option<u64>,
    /// Max amount per withdrawal (0 = unlimited)
    max_per_withdrawal: u64,
    // === Settings ===
    /// Can beneficiary be changed?
    is_transferable: bool,
    /// Can DAO cancel this? (false = GUARANTEED to recipient)
    is_cancellable: bool,
    /// Optional metadata
    metadata: Option<String>,
}

/// Cap enabling bearer to claim the vesting.
/// Transferred to primary beneficiary on creation.
public struct ClaimCap has key, store {
    id: UID,
    vesting_id: ID,
}

// === Events ===

public struct VestingCreated has copy, drop {
    vesting_id: ID,
    dao_address: address,
    beneficiary: address,
    total_amount: u64,
    amount_per_iteration: u64,
    iterations_total: u64,
    iteration_period_ms: u64,
    start_time: u64,
    is_cancellable: bool,
}

public struct VestingClaimed has copy, drop {
    vesting_id: ID,
    claimer: address,
    amount: u64,
    remaining_balance: u64,
    total_claimed: u64,
}

public struct VestingCancelled has copy, drop {
    vesting_id: ID,
    refunded_to_dao: u64,
    paid_to_beneficiary: u64,
}

public struct VestingTransferred has copy, drop {
    vesting_id: ID,
    old_beneficiary: address,
    new_beneficiary: address,
}

// === Public Functions: Claiming ===

/// Beneficiary claims unlocked funds using ClaimCap
public fun claim<CoinType>(
    vesting: &mut Vesting<CoinType>,
    cap: &ClaimCap,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext
): Coin<CoinType> {
    assert!(cap.vesting_id == vesting.id.to_inner(), EWrongVesting);
    assert!(ctx.sender() == vesting.beneficiary, EUnauthorizedBeneficiary);

    do_claim_internal(vesting, amount, clock, ctx)
}

/// Internal claim logic shared by both claim functions
fun do_claim_internal<CoinType>(
    vesting: &mut Vesting<CoinType>,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<CoinType> {
    let current_time = clock.timestamp_ms();

    // Check start time
    assert!(current_time >= vesting.start_time, ETooEarly);

    // Check cliff if set
    if (vesting.cliff_time.is_some()) {
        assert!(current_time >= *vesting.cliff_time.borrow(), ECliffNotReached);
    };

    // Check balance
    assert!(vesting.balance.value() > 0, EVestingOver);

    // Check withdrawal limit
    assert!(
        stream_utils::check_withdrawal_limit(amount, vesting.max_per_withdrawal),
        EWithdrawalLimitExceeded
    );

    // Calculate available (claimable) amount using iteration-based math
    let available = stream_utils::calculate_claimable_iterations(
        vesting.amount_per_iteration,
        vesting.claimed_amount,
        vesting.start_time,
        vesting.iterations_total,
        vesting.iteration_period_ms,
        current_time,
        &vesting.cliff_time,
        &vesting.claim_window_ms,
    );

    assert!(available >= amount, EInsufficientVestedAmount);

    // Update claimed amount
    vesting.claimed_amount = vesting.claimed_amount + amount;

    let remaining = vesting.balance.value() - amount;

    event::emit(VestingClaimed {
        vesting_id: vesting.id.to_inner(),
        claimer: ctx.sender(),
        amount,
        remaining_balance: remaining,
        total_claimed: vesting.claimed_amount,
    });

    coin::from_balance(vesting.balance.split(amount), ctx)
}

// === Public Functions: Beneficiary Management ===

/// Transfer vesting to new primary beneficiary (if transferable)
/// Only current primary beneficiary can transfer
public fun transfer_beneficiary<CoinType>(
    vesting: &mut Vesting<CoinType>,
    cap: &ClaimCap,
    new_beneficiary: address,
    ctx: &TxContext,
) {
    assert!(cap.vesting_id == vesting.id.to_inner(), EWrongVesting);
    assert!(vesting.is_transferable, ENotTransferable);
    assert!(ctx.sender() == vesting.beneficiary, EUnauthorizedBeneficiary);

    let old_beneficiary = vesting.beneficiary;
    vesting.beneficiary = new_beneficiary;

    event::emit(VestingTransferred {
        vesting_id: vesting.id.to_inner(),
        old_beneficiary,
        new_beneficiary,
    });
}

// === Destruction ===

/// Destroy vesting when fully claimed
public fun destroy_empty<CoinType>(vesting: Vesting<CoinType>) {
    let Vesting { id, balance, .. } = vesting;
    assert!(balance.value() == 0, EBalanceNotEmpty);
    balance.destroy_zero();
    id.delete();
}

/// Destroy claim cap
public fun destroy_cap(cap: ClaimCap) {
    let ClaimCap { id, .. } = cap;
    id.delete();
}

// === Intent Execution Functions ===

/// Execute CreateVesting from intent
/// Takes coin from executable_resources (from prior VaultSpend action)
public fun do_create_vesting<Config: store, Outcome: store, CoinType, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &Account,
    clock: &Clock,
    _version_witness: VersionWitness,
    _intent_witness: IW,
    ctx: &mut TxContext,
) {
    executable.intent().assert_is_account(account.addr());

    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    action_validation::assert_action_type<CreateVesting>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);

    // Deserialize CreateVestingAction
    let beneficiary = bcs::peel_address(&mut reader);
    let amount_per_iteration = bcs::peel_u64(&mut reader);
    let start_time = bcs::peel_u64(&mut reader);
    let iterations_total = bcs::peel_u64(&mut reader);
    let iteration_period_ms = bcs::peel_u64(&mut reader);

    let cliff_time = if (bcs::peel_bool(&mut reader)) {
        option::some(bcs::peel_u64(&mut reader))
    } else {
        option::none()
    };

    let claim_window_ms = if (bcs::peel_bool(&mut reader)) {
        option::some(bcs::peel_u64(&mut reader))
    } else {
        option::none()
    };

    let max_per_withdrawal = bcs::peel_u64(&mut reader);
    let is_transferable = bcs::peel_bool(&mut reader);
    let is_cancellable = bcs::peel_bool(&mut reader);
    let resource_name = std::string::utf8(bcs::peel_vec_u8(&mut reader));

    bcs_validation::validate_all_bytes_consumed(reader);

    // Validate parameters
    let current_time = clock.timestamp_ms();
    assert!(
        stream_utils::validate_iteration_parameters(
            start_time,
            iterations_total,
            iteration_period_ms,
            &cliff_time,
            current_time,
        ),
        EInvalidParameters
    );
    assert!(amount_per_iteration > 0, EAmountMustBeGreaterThanZero);

    // Take coin from executable_resources (from prior action like VaultSpend)
    let coin: Coin<CoinType> = executable_resources::take_coin(
        executable::uid_mut(executable),
        resource_name,
    );

    // Verify amount matches expected total
    let expected_total = (amount_per_iteration as u128) * (iterations_total as u128);
    assert!(expected_total <= (18446744073709551615 as u128), EInvalidParameters);
    assert!(coin.value() == (expected_total as u64), EAmountMismatch);

    let total_amount = coin.value();
    let vesting_uid = object::new(ctx);
    let vesting_id = vesting_uid.to_inner();

    // Create and send ClaimCap to beneficiary
    transfer::transfer(
        ClaimCap {
            id: object::new(ctx),
            vesting_id,
        },
        beneficiary
    );

    event::emit(VestingCreated {
        vesting_id,
        dao_address: account.addr(),
        beneficiary,
        total_amount,
        amount_per_iteration,
        iterations_total,
        iteration_period_ms,
        start_time,
        is_cancellable,
    });

    // Create and share the Vesting object - FUNDS ARE NOW ISOLATED
    transfer::share_object(Vesting<CoinType> {
        id: vesting_uid,
        dao_address: account.addr(),
        balance: coin.into_balance(),
        coin_type: type_name::get<CoinType>(),
        beneficiary,
        amount_per_iteration,
        claimed_amount: 0,
        start_time,
        iterations_total,
        iteration_period_ms,
        cliff_time,
        claim_window_ms,
        max_per_withdrawal,
        is_transferable,
        is_cancellable,
        metadata: option::none(),
    });

    executable::increment_action_idx(executable);
}

/// Execute CancelVesting from intent
/// Returns unvested funds to caller (typically deposited back to vault)
public fun do_cancel_vesting<Outcome: store, CoinType, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &Account,
    vesting: Vesting<CoinType>,
    clock: &Clock,
    _version_witness: VersionWitness,
    _intent_witness: IW,
    ctx: &mut TxContext,
): Coin<CoinType> {
    executable.intent().assert_is_account(account.addr());

    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    action_validation::assert_action_type<CancelVesting>(spec);

    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);

    let expected_vesting_id = bcs::peel_address(&mut reader).to_id();

    bcs_validation::validate_all_bytes_consumed(reader);

    // Verify correct vesting
    assert!(object::id(&vesting) == expected_vesting_id, EWrongVesting);
    assert!(vesting.dao_address == account.addr(), EUnauthorized);
    assert!(vesting.is_cancellable, ENotCancellable);

    let current_time = clock.timestamp_ms();

    let Vesting {
        id,
        dao_address: _,
        mut balance,
        coin_type: _,
        beneficiary,
        amount_per_iteration,
        claimed_amount,
        start_time,
        iterations_total,
        iteration_period_ms,
        cliff_time,
        claim_window_ms,
        max_per_withdrawal: _,
        is_transferable: _,
        is_cancellable: _,
        metadata: _,
    } = vesting;

    let balance_remaining = balance.value();

    let (to_pay_beneficiary, to_refund, _) = stream_utils::split_vested_unvested_iterations(
        amount_per_iteration,
        claimed_amount,
        balance_remaining,
        start_time,
        iterations_total,
        iteration_period_ms,
        current_time,
        &cliff_time,
        &claim_window_ms,
    );

    // Pay vested amount to beneficiary
    if (to_pay_beneficiary > 0) {
        let beneficiary_coin = coin::from_balance(balance.split(to_pay_beneficiary), ctx);
        transfer::public_transfer(beneficiary_coin, beneficiary);
    };

    event::emit(VestingCancelled {
        vesting_id: id.to_inner(),
        refunded_to_dao: to_refund,
        paid_to_beneficiary: to_pay_beneficiary,
    });

    id.delete();

    executable::increment_action_idx(executable);

    // Return remaining (unvested) funds to caller
    coin::from_balance(balance, ctx)
}

// === Delete Functions for Expired Intents ===

public fun delete_create_vesting(expired: &mut Expired) {
    let _spec = intents::remove_action_spec(expired);
}

public fun delete_cancel_vesting(expired: &mut Expired) {
    let _spec = intents::remove_action_spec(expired);
}

// === View Functions ===

public fun balance_value<CoinType>(self: &Vesting<CoinType>): u64 {
    self.balance.value()
}

public fun vesting_beneficiary<CoinType>(self: &Vesting<CoinType>): address {
    self.beneficiary
}

public fun vesting_dao<CoinType>(self: &Vesting<CoinType>): address {
    self.dao_address
}

public fun vesting_is_cancellable<CoinType>(self: &Vesting<CoinType>): bool {
    self.is_cancellable
}

public fun vesting_is_transferable<CoinType>(self: &Vesting<CoinType>): bool {
    self.is_transferable
}

public fun vesting_claimed_amount<CoinType>(self: &Vesting<CoinType>): u64 {
    self.claimed_amount
}

public fun vesting_iterations_total<CoinType>(self: &Vesting<CoinType>): u64 {
    self.iterations_total
}

public fun vesting_amount_per_iteration<CoinType>(self: &Vesting<CoinType>): u64 {
    self.amount_per_iteration
}

public fun vesting_iteration_period_ms<CoinType>(self: &Vesting<CoinType>): u64 {
    self.iteration_period_ms
}

public fun vesting_start_time<CoinType>(self: &Vesting<CoinType>): u64 {
    self.start_time
}

public fun vesting_cliff_time<CoinType>(self: &Vesting<CoinType>): &Option<u64> {
    &self.cliff_time
}

public fun vesting_claim_window_ms<CoinType>(self: &Vesting<CoinType>): &Option<u64> {
    &self.claim_window_ms
}

public fun vesting_max_per_withdrawal<CoinType>(self: &Vesting<CoinType>): u64 {
    self.max_per_withdrawal
}

public fun vesting_metadata<CoinType>(self: &Vesting<CoinType>): &Option<String> {
    &self.metadata
}

public fun cap_vesting_id(cap: &ClaimCap): ID {
    cap.vesting_id
}

/// Calculate currently claimable amount
public fun calculate_claimable<CoinType>(
    vesting: &Vesting<CoinType>,
    clock: &Clock,
): u64 {
    stream_utils::calculate_claimable_iterations(
        vesting.amount_per_iteration,
        vesting.claimed_amount,
        vesting.start_time,
        vesting.iterations_total,
        vesting.iteration_period_ms,
        clock.timestamp_ms(),
        &vesting.cliff_time,
        &vesting.claim_window_ms,
    )
}

/// Get total vesting amount (amount_per_iteration * iterations_total)
public fun total_amount<CoinType>(vesting: &Vesting<CoinType>): u64 {
    let total = (vesting.amount_per_iteration as u128) * (vesting.iterations_total as u128);
    (total as u64)
}

/// Get next vesting time
public fun next_vest_time<CoinType>(
    vesting: &Vesting<CoinType>,
    clock: &Clock,
): Option<u64> {
    let current_time = clock.timestamp_ms();

    // Check cliff
    if (vesting.cliff_time.is_some()) {
        let cliff = *vesting.cliff_time.borrow();
        if (current_time < cliff) {
            return option::some(cliff)
        };
    };

    // Check start
    if (current_time < vesting.start_time) {
        return option::some(vesting.start_time)
    };

    // Calculate current iteration
    let elapsed = current_time - vesting.start_time;
    let current_iteration = elapsed / vesting.iteration_period_ms;

    // All done?
    if (current_iteration >= vesting.iterations_total) {
        return option::none()
    };

    // Next iteration time
    option::some(vesting.start_time + ((current_iteration + 1) * vesting.iteration_period_ms))
}

// === Test Functions ===

#[test_only]
public fun create_vesting_for_testing<CoinType>(
    coin: Coin<CoinType>,
    dao_address: address,
    beneficiary: address,
    amount_per_iteration: u64,
    start_time: u64,
    iterations_total: u64,
    iteration_period_ms: u64,
    is_cancellable: bool,
    ctx: &mut TxContext,
): (ClaimCap, Vesting<CoinType>) {
    let vesting_uid = object::new(ctx);
    let vesting_id = vesting_uid.to_inner();

    (
        ClaimCap {
            id: object::new(ctx),
            vesting_id,
        },
        Vesting {
            id: vesting_uid,
            dao_address,
            balance: coin.into_balance(),
            coin_type: type_name::get<CoinType>(),
            beneficiary,
            amount_per_iteration,
            claimed_amount: 0,
            start_time,
            iterations_total,
            iteration_period_ms,
            cliff_time: option::none(),
            claim_window_ms: option::none(),
            max_per_withdrawal: 0,
            is_transferable: true,
            is_cancellable,
            metadata: option::none(),
        }
    )
}
