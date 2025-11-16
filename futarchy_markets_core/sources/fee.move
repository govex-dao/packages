// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

module futarchy_markets_core::fee;

use std::ascii::String as AsciiString;
use std::type_name::{Self, TypeName};
use std::u64;
use sui::balance::{Self, Balance};
use sui::bcs;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::dynamic_field;
use sui::event;
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::transfer::{public_share_object, public_transfer};

// === Introduction ===
// Manages all fees earnt by the protocol. It is also the interface for admin fee withdrawal

// === Errors ===
const EInvalidPayment: u64 = 0;
const EStableTypeNotFound: u64 = 1;
const EBadWitness: u64 = 2;
const ERecurringFeeNotDue: u64 = 3;
const EWrongStableTypeForFee: u64 = 4;
const EInsufficientTreasuryBalance: u64 = 5;
const EArithmeticOverflow: u64 = 6;
const EInvalidAdminCap: u64 = 7;
const EInvalidRecoveryFee: u64 = 9;
const EFeeExceedsHardCap: u64 = 10;
const EWrongStableCoinType: u64 = 11;
const EFeeExceedsTenXCap: u64 = 12;

// === Constants ===
const DEFAULT_DAO_CREATION_FEE: u64 = 10_000;
const DEFAULT_PROPOSAL_CREATION_FEE_PER_OUTCOME: u64 = 1000;
const DEFAULT_VERIFICATION_FEE: u64 = 10_000; // Default fee for level 1
const DEFAULT_LAUNCHPAD_CREATION_FEE: u64 = 100; // 100 MIST for testing
const FEE_UPDATE_DELAY_MS: u64 = 15_552_000_000; // 6 months (180 days)
const MAX_FEE_MULTIPLIER: u64 = 10; // Maximum 10x increase from baseline
const FEE_BASELINE_RESET_PERIOD_MS: u64 = 15_552_000_000; // 6 months - baseline resets after this

// === Structs ===

public struct FEE has drop {}

public struct FeeManager has key, store {
    id: UID,
    admin_cap_id: ID,
    dao_creation_fee: u64,
    proposal_creation_fee_per_outcome: u64,
    verification_fees: Table<u8, u64>, // Dynamic table mapping level -> fee
    launchpad_creation_fee: u64, // Fee for creating a launchpad
    // All coin fees stored uniformly in dynamic fields: FeeRegistry<CoinType> → Balance<CoinType>
}

public struct FeeAdminCap has key, store {
    id: UID,
}

/// Stores fee amounts for a specific coin type
public struct CoinFeeConfig has store {
    coin_type: TypeName,
    decimals: u8,
    dao_creation_fee: u64,
    proposal_creation_fee_per_outcome: u64,
    verification_fees: Table<u8, u64>,
    // Pending updates with 6-month delay
    pending_creation_fee: Option<u64>,
    pending_proposal_fee: Option<u64>,
    pending_fees_effective_timestamp: Option<u64>,
    // 10x cap tracking - baseline fees that reset every 6 months
    creation_fee_baseline: u64,
    proposal_fee_baseline: u64,
    baseline_reset_timestamp: u64,
}

// === Events ===

public struct DAOCreationFeeUpdated has copy, drop {
    old_fee: u64,
    new_fee: u64,
    admin: address,
    timestamp: u64,
}

public struct ProposalCreationFeeUpdated has copy, drop {
    old_fee: u64,
    new_fee_per_outcome: u64,
    admin: address,
    timestamp: u64,
}

public struct VerificationFeeUpdated has copy, drop {
    level: u8,
    old_fee: u64,
    new_fee: u64,
    admin: address,
    timestamp: u64,
}

public struct VerificationLevelAdded has copy, drop {
    level: u8,
    fee: u64,
    admin: address,
    timestamp: u64,
}

public struct VerificationLevelRemoved has copy, drop {
    level: u8,
    admin: address,
    timestamp: u64,
}

public struct DAOCreationFeeCollected has copy, drop {
    amount: u64,
    payer: address,
    timestamp: u64,
}

public struct ProposalCreationFeeCollected has copy, drop {
    amount: u64,
    payer: address,
    timestamp: u64,
}

public struct LaunchpadCreationFeeCollected has copy, drop {
    amount: u64,
    payer: address,
    timestamp: u64,
}

public struct VerificationFeeCollected has copy, drop {
    level: u8,
    amount: u64,
    payer: address,
    timestamp: u64,
}

public struct FeesCollected has copy, drop {
    amount: u64,
    coin_type: AsciiString,
    proposal_id: ID,
    timestamp: u64,
}

public struct FeesWithdrawn has copy, drop {
    amount: u64,
    coin_type: AsciiString,
    recipient: address,
    timestamp: u64,
}

// === Public Functions ===
/// Package initialization
///
/// IMPORTANT: This function creates and transfers FeeAdminCap to the package publisher.
/// For governance actions to work, the FeeAdminCap MUST be:
/// 1. Transferred to the protocol DAO account
/// 2. Registered as a managed asset with key: "protocol:fee_admin_cap"
///
/// This is typically done in deployment scripts after package publication.
fun init(witness: FEE, ctx: &mut TxContext) {
    // Verify that the witness is valid and one-time only.
    assert!(sui::types::is_one_time_witness(&witness), EBadWitness);

    let fee_admin_cap = FeeAdminCap {
        id: object::new(ctx),
    };

    let mut verification_fees = table::new<u8, u64>(ctx);
    // Start with just level 1 by default
    table::add(&mut verification_fees, 1, DEFAULT_VERIFICATION_FEE);

    let fee_manager = FeeManager {
        id: object::new(ctx),
        admin_cap_id: object::id(&fee_admin_cap),
        dao_creation_fee: DEFAULT_DAO_CREATION_FEE,
        proposal_creation_fee_per_outcome: DEFAULT_PROPOSAL_CREATION_FEE_PER_OUTCOME,
        verification_fees,
        launchpad_creation_fee: DEFAULT_LAUNCHPAD_CREATION_FEE,
    };

    public_share_object(fee_manager);
    // FeeAdminCap is transferred to publisher - must be moved to protocol DAO account
    public_transfer(fee_admin_cap, ctx.sender());

    // Consuming the witness ensures one-time initialization.
    let _ = witness;
}

// === Package Functions ===
// Generic internal fee collection function
fun deposit_payment(
    fee_manager: &mut FeeManager,
    fee_amount: u64,
    payment: Coin<SUI>,
    clock: &Clock,
): u64 {
    // Verify payment
    let payment_amount = payment.value();
    assert!(payment_amount == fee_amount, EInvalidPayment);

    // Process payment using unified deposit
    let paid_balance = payment.into_balance();
    deposit_fees<SUI>(fee_manager, paid_balance, clock);
    return payment_amount
    // Event emission will be handled by specific wrappers
}

// Function to collect DAO creation fee
public fun deposit_dao_creation_payment(
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let fee_amount = fee_manager.dao_creation_fee;

    let payment_amount = deposit_payment(fee_manager, fee_amount, payment, clock);

    // Emit event
    event::emit(DAOCreationFeeCollected {
        amount: payment_amount,
        payer: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// Function to collect launchpad creation fee
public fun deposit_launchpad_creation_payment(
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let fee_amount = fee_manager.launchpad_creation_fee;

    let payment_amount = deposit_payment(fee_manager, fee_amount, payment, clock);

    // Emit event
    event::emit(LaunchpadCreationFeeCollected {
        amount: payment_amount,
        payer: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// Function to collect proposal creation fee
public fun deposit_proposal_creation_payment(
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    outcome_count: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    // Use u128 arithmetic to prevent overflow
    let fee_amount_u128 =
        (fee_manager.proposal_creation_fee_per_outcome as u128) * (outcome_count as u128);

    // Check that result fits in u64
    assert!(fee_amount_u128 <= (u64::max_value!() as u128), EArithmeticOverflow); // u64::max_value()
    let fee_amount = (fee_amount_u128 as u64);

    // deposit_payment asserts the payment amount is exactly the fee_amount
    let payment_amount = deposit_payment(fee_manager, fee_amount, payment, clock);

    // Emit event
    event::emit(ProposalCreationFeeCollected {
        amount: payment_amount,
        payer: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// Function to collect verification fee for a specific level
public fun deposit_verification_payment(
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    verification_level: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(table::contains(&fee_manager.verification_fees, verification_level), EInvalidPayment);
    let fee_amount = *table::borrow(&fee_manager.verification_fees, verification_level);
    let payment_amount = deposit_payment(fee_manager, fee_amount, payment, clock);

    // Emit event
    event::emit(VerificationFeeCollected {
        level: verification_level,
        amount: payment_amount,
        payer: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// === Admin Functions ===

/// UNIFIED withdrawal function for ANY coin type (including SUI)
/// Used by governance actions to deposit fees into treasury vault
/// If amount is 0, withdraws all available fees
public fun withdraw_fees_as_coin<CoinType>(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<CoinType> {
    // Verify the admin cap belongs to this fee manager
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);

    // Check if this coin type exists in the fee registry
    if (
        !dynamic_field::exists_with_type<FeeRegistry<CoinType>, Balance<CoinType>>(
            &fee_manager.id,
            FeeRegistry<CoinType> {},
        )
    ) {
        // Return empty coin if no fees of this type have been collected
        return coin::zero<CoinType>(ctx)
    };

    let fee_balance = dynamic_field::borrow_mut<FeeRegistry<CoinType>, Balance<CoinType>>(
        &mut fee_manager.id,
        FeeRegistry<CoinType> {},
    );

    let withdrawal_amount = if (amount == 0) {
        fee_balance.value()
    } else {
        amount
    };

    if (withdrawal_amount == 0) {
        return coin::zero<CoinType>(ctx)
    };

    assert!(fee_balance.value() >= withdrawal_amount, EInsufficientTreasuryBalance);

    let withdrawn = fee_balance.split(withdrawal_amount);
    let coin = withdrawn.into_coin(ctx);

    let type_name = type_name::with_defining_ids<CoinType>();
    let type_str = type_name.into_string();

    event::emit(FeesWithdrawn {
        amount: withdrawal_amount,
        coin_type: type_str,
        recipient: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });

    coin
}

// Admin function to update DAO creation fee
public entry fun update_dao_creation_fee(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    new_fee: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);
    let old_fee = fee_manager.dao_creation_fee;
    fee_manager.dao_creation_fee = new_fee;

    event::emit(DAOCreationFeeUpdated {
        old_fee,
        new_fee,
        admin: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// Admin function to update proposal creation fee
public entry fun update_proposal_creation_fee(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    new_fee_per_outcome: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);
    let old_fee = fee_manager.proposal_creation_fee_per_outcome;
    fee_manager.proposal_creation_fee_per_outcome = new_fee_per_outcome;

    event::emit(ProposalCreationFeeUpdated {
        old_fee,
        new_fee_per_outcome,
        admin: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// Admin function to update launchpad creation fee
public entry fun update_launchpad_creation_fee(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    new_fee: u64,
    _clock: &Clock,
    _ctx: &mut TxContext,
) {
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);
    fee_manager.launchpad_creation_fee = new_fee;
}

// Admin function to add a new verification level
public entry fun add_verification_level(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    level: u8,
    fee: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);
    assert!(!table::contains(&fee_manager.verification_fees, level), EInvalidPayment);

    table::add(&mut fee_manager.verification_fees, level, fee);

    event::emit(VerificationLevelAdded {
        level,
        fee,
        admin: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// Admin function to remove a verification level
public entry fun remove_verification_level(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    level: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);
    assert!(table::contains(&fee_manager.verification_fees, level), EInvalidPayment);

    table::remove(&mut fee_manager.verification_fees, level);

    event::emit(VerificationLevelRemoved {
        level,
        admin: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// Admin function to update verification fee for a specific level
public entry fun update_verification_fee(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    level: u8,
    new_fee: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);
    assert!(table::contains(&fee_manager.verification_fees, level), EInvalidPayment);

    let old_fee = *table::borrow(&fee_manager.verification_fees, level);
    *table::borrow_mut(&mut fee_manager.verification_fees, level) = new_fee;

    event::emit(VerificationFeeUpdated {
        level,
        old_fee,
        new_fee,
        admin: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// === AMM Fees ===

/// Unified registry type for ALL coin fee balances (including SUI)
public struct FeeRegistry<phantom T> has copy, drop, store {}

/// Generic fee deposit - works for ANY coin type including SUI
/// Use this for SUI fees (DAO/proposal/launchpad creation)
public fun deposit_fees<CoinType>(
    fee_manager: &mut FeeManager,
    fees: Balance<CoinType>,
    clock: &Clock,
) {
    deposit_fees_with_proposal(fee_manager, fees, object::id_from_address(@0x0), clock);
}

/// Generic fee deposit with proposal_id - works for ANY coin type
/// Use this for AMM swap fees that are tied to a specific proposal
public fun deposit_fees_with_proposal<CoinType>(
    fee_manager: &mut FeeManager,
    fees: Balance<CoinType>,
    proposal_id: ID,
    clock: &Clock,
) {
    let amount = fees.value();

    if (
        dynamic_field::exists_with_type<FeeRegistry<CoinType>, Balance<CoinType>>(
            &fee_manager.id,
            FeeRegistry<CoinType> {},
        )
    ) {
        let fee_balance = dynamic_field::borrow_mut<FeeRegistry<CoinType>, Balance<CoinType>>(
            &mut fee_manager.id,
            FeeRegistry<CoinType> {},
        );
        fee_balance.join(fees);
    } else {
        dynamic_field::add(&mut fee_manager.id, FeeRegistry<CoinType> {}, fees);
    };

    let type_name = type_name::with_defining_ids<CoinType>();
    let type_str = type_name.into_string();
    event::emit(FeesCollected {
        amount,
        coin_type: type_str,
        proposal_id,
        timestamp: clock.timestamp_ms(),
    });
}

// === View Functions ===
public fun get_dao_creation_fee(fee_manager: &FeeManager): u64 {
    fee_manager.dao_creation_fee
}

public fun get_proposal_creation_fee_per_outcome(fee_manager: &FeeManager): u64 {
    fee_manager.proposal_creation_fee_per_outcome
}

public fun get_launchpad_creation_fee(fee_manager: &FeeManager): u64 {
    fee_manager.launchpad_creation_fee
}

public fun get_verification_fee_for_level(fee_manager: &FeeManager, level: u8): u64 {
    assert!(table::contains(&fee_manager.verification_fees, level), EInvalidPayment);
    *table::borrow(&fee_manager.verification_fees, level)
}

public fun has_verification_level(fee_manager: &FeeManager, level: u8): bool {
    table::contains(&fee_manager.verification_fees, level)
}

public fun get_sui_balance(fee_manager: &FeeManager): u64 {
    get_fee_balance<SUI>(fee_manager)
}

/// Generic function to get fee balance for any coin type
public fun get_fee_balance<CoinType>(fee_manager: &FeeManager): u64 {
    if (
        dynamic_field::exists_with_type<FeeRegistry<CoinType>, Balance<CoinType>>(
            &fee_manager.id,
            FeeRegistry<CoinType> {},
        )
    ) {
        let fee_balance = dynamic_field::borrow<FeeRegistry<CoinType>, Balance<CoinType>>(
            &fee_manager.id,
            FeeRegistry<CoinType> {},
        );
        fee_balance.value()
    } else {
        0
    }
}

// === Coin-specific Fee Management ===

/// Add a new coin type with its fee configuration
public fun add_coin_fee_config(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    coin_type: TypeName,
    decimals: u8,
    dao_creation_fee: u64,
    proposal_fee_per_outcome: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);

    // Create verification fees table
    let mut verification_fees = table::new<u8, u64>(ctx);
    // Add default verification levels
    table::add(&mut verification_fees, 1, DEFAULT_VERIFICATION_FEE);

    let config = CoinFeeConfig {
        coin_type,
        decimals,
        dao_creation_fee,
        proposal_creation_fee_per_outcome: proposal_fee_per_outcome,
        verification_fees,
        pending_creation_fee: option::none(),
        pending_proposal_fee: option::none(),
        pending_fees_effective_timestamp: option::none(),
        // Initialize baselines to current fees
        creation_fee_baseline: dao_creation_fee,
        proposal_fee_baseline: proposal_fee_per_outcome,
        baseline_reset_timestamp: clock.timestamp_ms(),
    };

    // Store using coin type as key
    dynamic_field::add(&mut fee_manager.id, coin_type, config);
}

/// Entry wrapper for add_coin_fee_config that takes coin type as generic parameter
public entry fun add_coin_fee_config_entry<CoinType>(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    decimals: u8,
    dao_creation_fee: u64,
    proposal_fee_per_outcome: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let coin_type = type_name::get<CoinType>();
    add_coin_fee_config(
        fee_manager,
        admin_cap,
        coin_type,
        decimals,
        dao_creation_fee,
        proposal_fee_per_outcome,
        clock,
        ctx,
    );
}

/// Update creation fee for a specific coin type (with 6-month delay and 10x cap)
public fun update_coin_creation_fee(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    coin_type: TypeName,
    new_fee: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);
    assert!(dynamic_field::exists_(&fee_manager.id, coin_type), EStableTypeNotFound);

    let config: &mut CoinFeeConfig = dynamic_field::borrow_mut(&mut fee_manager.id, coin_type);
    let current_time = clock.timestamp_ms();

    // Check if 6 months have passed since baseline was set - if so, reset baseline
    if (current_time >= config.baseline_reset_timestamp + FEE_BASELINE_RESET_PERIOD_MS) {
        config.creation_fee_baseline = config.dao_creation_fee;
        config.baseline_reset_timestamp = current_time;
    };

    // Enforce 10x cap from baseline
    assert!(new_fee <= config.creation_fee_baseline * MAX_FEE_MULTIPLIER, EFeeExceedsTenXCap);

    // Allow immediate decrease, delayed increase
    if (new_fee <= config.dao_creation_fee) {
        // Fee decrease - apply immediately
        config.dao_creation_fee = new_fee;
    } else {
        // Fee increase - apply after delay
        let effective_timestamp = current_time + FEE_UPDATE_DELAY_MS;
        config.pending_creation_fee = option::some(new_fee);
        config.pending_fees_effective_timestamp = option::some(effective_timestamp);
    };
}

/// Update proposal fee for a specific coin type (with 6-month delay and 10x cap)
public fun update_coin_proposal_fee(
    fee_manager: &mut FeeManager,
    admin_cap: &FeeAdminCap,
    coin_type: TypeName,
    new_fee_per_outcome: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(admin_cap) == fee_manager.admin_cap_id, EInvalidAdminCap);
    assert!(dynamic_field::exists_(&fee_manager.id, coin_type), EStableTypeNotFound);

    let config: &mut CoinFeeConfig = dynamic_field::borrow_mut(&mut fee_manager.id, coin_type);
    let current_time = clock.timestamp_ms();

    // Check if 6 months have passed since baseline was set - if so, reset baseline
    if (current_time >= config.baseline_reset_timestamp + FEE_BASELINE_RESET_PERIOD_MS) {
        config.proposal_fee_baseline = config.proposal_creation_fee_per_outcome;
        config.baseline_reset_timestamp = current_time;
    };

    // Enforce 10x cap from baseline
    assert!(
        new_fee_per_outcome <= config.proposal_fee_baseline * MAX_FEE_MULTIPLIER,
        EFeeExceedsTenXCap,
    );

    // Allow immediate decrease, delayed increase
    if (new_fee_per_outcome <= config.proposal_creation_fee_per_outcome) {
        // Fee decrease - apply immediately
        config.proposal_creation_fee_per_outcome = new_fee_per_outcome;
    } else {
        // Fee increase - apply after delay
        let effective_timestamp = current_time + FEE_UPDATE_DELAY_MS;
        config.pending_proposal_fee = option::some(new_fee_per_outcome);
        config.pending_fees_effective_timestamp = option::some(effective_timestamp);
    };
}

/// Apply pending fee updates if the delay has passed
public fun apply_pending_coin_fees(
    fee_manager: &mut FeeManager,
    coin_type: TypeName,
    clock: &Clock,
) {
    if (!dynamic_field::exists_(&fee_manager.id, coin_type)) {
        return
    };

    let config: &mut CoinFeeConfig = dynamic_field::borrow_mut(&mut fee_manager.id, coin_type);

    if (config.pending_fees_effective_timestamp.is_some()) {
        let effective_time = *config.pending_fees_effective_timestamp.borrow();

        if (clock.timestamp_ms() >= effective_time) {
            // Apply all pending fees
            if (config.pending_creation_fee.is_some()) {
                config.dao_creation_fee = *config.pending_creation_fee.borrow();
                config.pending_creation_fee = option::none();
            };

            if (config.pending_proposal_fee.is_some()) {
                config.proposal_creation_fee_per_outcome = *config.pending_proposal_fee.borrow();
                config.pending_proposal_fee = option::none();
            };

            config.pending_fees_effective_timestamp = option::none();
        }
    }
}

/// Get fee config for a specific coin type
public fun get_coin_fee_config(fee_manager: &FeeManager, coin_type: TypeName): &CoinFeeConfig {
    assert!(dynamic_field::exists_(&fee_manager.id, coin_type), EStableTypeNotFound);
    dynamic_field::borrow(&fee_manager.id, coin_type)
}

// ======== Test Functions ========
#[test_only]
public fun create_fee_manager_for_testing(ctx: &mut TxContext) {
    let admin_cap = FeeAdminCap {
        id: object::new(ctx),
    };

    let mut verification_fees = table::new<u8, u64>(ctx);
    // Start with just level 1 by default
    table::add(&mut verification_fees, 1, DEFAULT_VERIFICATION_FEE);

    let fee_manager = FeeManager {
        id: object::new(ctx),
        admin_cap_id: object::id(&admin_cap),
        dao_creation_fee: DEFAULT_DAO_CREATION_FEE,
        proposal_creation_fee_per_outcome: DEFAULT_PROPOSAL_CREATION_FEE_PER_OUTCOME,
        verification_fees,
        launchpad_creation_fee: DEFAULT_LAUNCHPAD_CREATION_FEE,
    };

    public_share_object(fee_manager);
    public_transfer(admin_cap, ctx.sender());
}

#[test_only]
public fun create_fake_admin_cap_for_testing(ctx: &mut TxContext): FeeAdminCap {
    FeeAdminCap {
        id: object::new(ctx),
    }
}
