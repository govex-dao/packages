// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

module futarchy_factory::launchpad;

use account_actions::init_actions;
use account_protocol::package_registry::PackageRegistry;
use account_protocol::account::Account;
use futarchy_core::futarchy_config::{Self, FutarchyConfig};
use futarchy_core::version;
use futarchy_factory::factory;
use futarchy_markets_core::fee;
use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_one_shot_utils::constants;
use futarchy_one_shot_utils::math;
use futarchy_types::init_action_specs::{Self as action_specs, InitActionSpecs};
use std::option::{Self, Option};
use std::string::{Self, String};
use std::type_name;
use std::vector;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin, CoinMetadata, TreasuryCap};
use sui::dynamic_field as df;
use sui::event;
use sui::object::{Self, UID, ID};
use sui::package::{Self, Publisher};
use sui::transfer as sui_transfer;
use sui::tx_context::TxContext;


// === Capabilities ===
public struct CreatorCap has key, store {
    id: UID,
    raise_id: ID,
}

// === Errors ===
const ERaiseNotActive: u64 = 1;
const EDeadlineNotReached: u64 = 2;
const EMinRaiseNotMet: u64 = 3;
const EMinRaiseAlreadyMet: u64 = 4;
const ENotAContributor: u64 = 6;
const EInvalidStateForAction: u64 = 7;
const EZeroContribution: u64 = 13;
const EStableTypeNotAllowed: u64 = 14;
const EInvalidActionData: u64 = 16;
const ESettlementAlreadyDone: u64 = 103;
const ECapChangeAfterDeadline: u64 = 105;
const ETooManyUniqueCaps: u64 = 109;
const ETooManyInitActions: u64 = 110;
const EDaoNotPreCreated: u64 = 111;
const EIntentsAlreadyLocked: u64 = 113;
const EResourcesNotFound: u64 = 114;
const EInvalidMaxRaise: u64 = 116;
const EAllowedCapsNotSorted: u64 = 121;
const EAllowedCapsEmpty: u64 = 122;
const ESupplyNotZero: u64 = 130;
const EInvalidCreatorCap: u64 = 132;
const EEarlyCompletionNotAllowed: u64 = 133;
const EInvalidCrankFee: u64 = 134;
const EBatchSizeTooLarge: u64 = 135;
const EEmptyBatch: u64 = 136;
const ENoProtocolFeesToSweep: u64 = 137;

// === Constants ===
const STATE_FUNDING: u8 = 0;
const STATE_SUCCESSFUL: u8 = 1;
const STATE_FAILED: u8 = 2;

const PERMISSIONLESS_COMPLETION_DELAY_MS: u64 = 24 * 60 * 60 * 1000;
const MAX_BATCH_SIZE: u64 = 100;
const UNLIMITED_CAP: u64 = 18446744073709551615;

public fun unlimited_cap(): u64 { UNLIMITED_CAP }

// === Structs ===
public struct LAUNCHPAD has drop {}

/// Hot potato for unshared DAO - MUST be consumed by finalize_and_share_dao
/// Enforces atomic init action execution before sharing
#[allow(lint(missing_key))]
public struct UnsharedDao<phantom RaiseToken, phantom StableCoin> {
    account: Account,
    spot_pool: UnifiedSpotPool<RaiseToken, StableCoin>,
}

public struct ContributorKey has copy, drop, store {
    contributor: address,
}

public struct Contribution has copy, drop, store {
    amount: u64,
    max_total_cap: u64,
}
public struct DaoAccountKey has copy, drop, store {}
public struct DaoQueueKey has copy, drop, store {}
public struct DaoPoolKey has copy, drop, store {}
public struct DaoMetadataKey has copy, drop, store {}
public struct CoinMetadataKey has copy, drop, store {}
public struct Raise<phantom RaiseToken, phantom StableCoin> has key, store {
    id: UID,
    creator: address,
    affiliate_id: String,
    state: u8,

    min_raise_amount: u64,
    max_raise_amount: Option<u64>,
    start_time_ms: u64,
    deadline_ms: u64,
    allow_early_completion: bool,

    raise_token_vault: Balance<RaiseToken>,
    tokens_for_sale_amount: u64,
    stable_coin_vault: Balance<StableCoin>,
    description: String,

    staged_init_specs: vector<InitActionSpecs>,
    treasury_cap: Option<TreasuryCap<RaiseToken>>,
    coin_metadata: Option<CoinMetadata<RaiseToken>>,

    allowed_caps: vector<u64>,
    cap_sums: vector<u64>,

    settlement_done: bool,
    final_raise_amount: u64,

    dao_id: Option<ID>,
    intents_locked: bool,

    verification_level: u8,
    attestation_url: String,
    admin_review_text: String,

    crank_fee_vault: Balance<sui::sui::SUI>,
}

// === Events ===
public struct InitIntentStaged has copy, drop {
    raise_id: ID,
    staged_index: u64,
    action_count: u64,
}

public struct InitIntentRemoved has copy, drop {
    raise_id: ID,
    staged_index: u64,
}

public struct FailedRaiseCleanup has copy, drop {
    raise_id: ID,
    dao_id: ID,
    timestamp: u64,
}

public struct RaiseCreated has copy, drop {
    raise_id: ID,
    creator: address,
    affiliate_id: String,
    raise_token_type: String,
    stable_coin_type: String,
    min_raise_amount: u64,
    tokens_for_sale: u64,
    start_time_ms: u64,
    deadline_ms: u64,
    description: String,
    // Generic metadata (parallel vectors for indexing)
    // Common keys: website, twitter, discord, github, whitepaper, legal_docs, project_plan, team_info
    metadata_keys: vector<String>,
    metadata_values: vector<String>,
}

public struct ContributionAdded has copy, drop {
    raise_id: ID,
    contributor: address,
    amount: u64,
    max_total_cap: u64,
}

public struct SettlementFinalized has copy, drop {
    raise_id: ID,
    final_total: u64,
}

public struct RaiseSuccessful has copy, drop {
    raise_id: ID,
    total_raised: u64,
}

public struct RaiseFailed has copy, drop {
    raise_id: ID,
    total_raised: u64,
    min_raise_amount: u64,
}

public struct TokensClaimed has copy, drop {
    raise_id: ID,
    contributor: address,
    contribution_amount: u64,
    tokens_claimed: u64,
}

public struct RefundClaimed has copy, drop {
    raise_id: ID,
    contributor: address,
    refund_amount: u64,
}

public struct RaiseEndedEarly has copy, drop {
    raise_id: ID,
    total_raised: u64,
    original_deadline: u64,
    ended_at: u64,
}

public struct DustSwept has copy, drop {
    raise_id: ID,
    token_dust_amount: u64,
    stable_dust_amount: u64,
    token_recipient: address,
    stable_recipient: ID,
    timestamp: u64,
}

public struct TreasuryCapReturned has copy, drop {
    raise_id: ID,
    tokens_burned: u64,
    recipient: address,
    timestamp: u64,
}

public struct BatchClaimCompleted has copy, drop {
    raise_id: ID,
    cranker: address,
    attempted: u64,
    successful: u64,
    total_reward: u64,
}

public struct ProtocolFeesSwept has copy, drop {
    raise_id: ID,
    amount: u64,
    recipient: address,
    timestamp: u64,
}

public struct LaunchpadVerificationSet has copy, drop {
    raise_id: ID,
    level: u8,
    attestation_url: String,
    admin_review_text: String,
    validator: address,
    timestamp: u64,
}

// === Init ===
fun init(otw: LAUNCHPAD, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    sui_transfer::public_transfer(publisher, ctx.sender());
}

// === Public Functions ===

/// REMOVED: pre_create_dao_for_raise
///
/// This function was removed to fix ESharedNonNewObject error.
/// Sui requires objects to be shared in the same transaction they're created.
///
/// OLD FLOW (broken):
///   1. pre_create_dao_for_raise → creates Account in TX1
///   2. complete_raise → tries to share Account in TX2 → FAILS with ESharedNonNewObject
///
/// NEW FLOW (fixed):
///   1. complete_raise → creates Account + shares it in same TX → SUCCESS
///   2. Frontend PTB → manually executes init actions against shared Account
///
/// INIT ACTIONS PATTERN (Disclosure-Only):
///
/// InitActionSpecs serve as INVESTOR TRANSPARENCY - they show what will happen
/// during DAO initialization, but they are NOT auto-executed.
///
/// FLOW:
///   1. Creator stages InitActionSpecs (stored in Raise.staged_init_specs)
///   2. Investors see what actions will execute and decide to invest
///   3. complete_raise creates DAO and shares Account
///   4. Frontend PTB MANUALLY calls init functions (e.g., init_create_stream)
///      - Manual execution via PTB, NOT automatic dispatch
///      - The staged specs are for disclosure only
///
/// WHY: InitActionSpecs don't have a dispatcher. The action_type is a label
/// for transparency. Execution requires explicit PTB calls to init functions.
///
/// See: futarchy_actions/INIT_ACTION_STAGING_GUIDE.md
///
/// NOTE: DAO creation fee payment moved to complete_raise_internal.

/// Stage initialization actions for investor transparency (DISCLOSURE ONLY)
///
/// IMPORTANT: This does NOT execute the actions. It only stores them so investors
/// can see what will happen during DAO creation. Actual execution happens via
/// manual PTB calls after complete_raise (e.g., calling init_create_stream directly).
///
/// Use builders from futarchy_actions::*_init_staging to create specs.
public fun stage_launchpad_init_intent<RaiseToken, StableCoin>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    _registry: &PackageRegistry,
    creator_cap: &CreatorCap,
    spec: InitActionSpecs,
    _clock: &Clock,
    _ctx: &mut TxContext,
) {
    assert!(creator_cap.raise_id == object::id(raise), EInvalidCreatorCap);
    assert!(raise.state == STATE_FUNDING, EInvalidStateForAction);
    assert!(!raise.intents_locked, EIntentsAlreadyLocked);

    let action_count = action_specs::action_count(&spec);
    assert!(action_count > 0, EInvalidActionData);

    let mut total = 0u64;
    let staged = &raise.staged_init_specs;
    let staged_len = vector::length(staged);
    let mut i = 0;
    while (i < staged_len) {
        total = total + action_specs::action_count(vector::borrow(staged, i));
        i = i + 1;
    };
    assert!(total + action_count <= constants::launchpad_max_init_actions(), ETooManyInitActions);

    let staged_index = staged_len;
    let raise_id = object::id(raise);

    // Just store the spec - no Account needed until complete_raise
    vector::push_back(&mut raise.staged_init_specs, spec);

    event::emit(InitIntentStaged { raise_id, staged_index, action_count });
}

/// Remove the most recently staged init intent
public entry fun unstage_last_launchpad_init_intent<RaiseToken, StableCoin>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    creator_cap: &CreatorCap,
    _ctx: &mut TxContext,
) {
    assert!(creator_cap.raise_id == object::id(raise), EInvalidCreatorCap);
    assert!(raise.state == STATE_FUNDING, EInvalidStateForAction);
    assert!(!raise.intents_locked, EIntentsAlreadyLocked);

    let staged_len = vector::length(&raise.staged_init_specs);
    assert!(staged_len > 0, EInvalidStateForAction);
    let staged_index = staged_len - 1;
    let raise_id = object::id(raise);

    // Just remove from vector - no Account to clean up
    let _removed = vector::pop_back(&mut raise.staged_init_specs);

    event::emit(InitIntentRemoved { raise_id, staged_index });
}

/// Lock intents - no more can be added after this
public entry fun lock_intents_and_start_raise<RaiseToken, StableCoin>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    creator_cap: &CreatorCap,
    _ctx: &mut TxContext,
) {
    assert!(creator_cap.raise_id == object::id(raise), EInvalidCreatorCap);
    assert!(!raise.intents_locked, EInvalidStateForAction);
    raise.intents_locked = true;
}

/// Create a pro-rata raise with max cap levels
public fun create_raise<RaiseToken: drop, StableCoin: drop>(
    factory: &factory::Factory,
    fee_manager: &mut fee::FeeManager,
    treasury_cap: TreasuryCap<RaiseToken>,
    coin_metadata: CoinMetadata<RaiseToken>,
    affiliate_id: String,
    tokens_for_sale: u64,
    min_raise_amount: u64,
    max_raise_amount: Option<u64>,
    allowed_caps: vector<u64>,
    start_delay_ms: Option<u64>,
    allow_early_completion: bool,
    description: String,
    // Generic metadata (parallel vectors, emitted in event for indexing)
    metadata_keys: vector<String>,
    metadata_values: vector<String>,
    launchpad_fee: Coin<sui::sui::SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Check factory is not permanently disabled
    assert!(!factory::is_permanently_disabled(factory), factory::permanently_disabled_error());

    // Collect launchpad creation fee
    fee::deposit_launchpad_creation_payment(fee_manager, launchpad_fee, clock, ctx);

    assert!(min_raise_amount > 0, EInvalidStateForAction);
    assert!(tokens_for_sale > 0, EInvalidStateForAction);
    assert!(affiliate_id.length() <= 64, EInvalidStateForAction);
    assert!(description.length() <= 1000, EInvalidStateForAction);
    assert!(coin::total_supply(&treasury_cap) == 0, ESupplyNotZero);
    assert!(factory::is_stable_type_allowed<StableCoin>(factory), EStableTypeNotAllowed);

    // Validate metadata vectors
    assert!(metadata_keys.length() == metadata_values.length(), EInvalidStateForAction);
    assert!(metadata_keys.length() <= 20, EInvalidStateForAction); // Max 20 metadata entries

    if (option::is_some(&max_raise_amount)) {
        assert!(*option::borrow(&max_raise_amount) >= min_raise_amount, EInvalidMaxRaise);
    };

    // Validate allowed_caps
    assert!(!vector::is_empty(&allowed_caps), EAllowedCapsEmpty);
    assert!(is_sorted_ascending(&allowed_caps), EAllowedCapsNotSorted);
    assert!(vector::length(&allowed_caps) <= 128, ETooManyUniqueCaps);

    // Enforce that the highest cap is UNLIMITED_CAP
    let last_cap = *vector::borrow(&allowed_caps, vector::length(&allowed_caps) - 1);
    assert!(last_cap == UNLIMITED_CAP, EInvalidStateForAction);

    init_raise<RaiseToken, StableCoin>(
        treasury_cap,
        coin_metadata,
        affiliate_id,
        tokens_for_sale,
        min_raise_amount,
        max_raise_amount,
        allowed_caps,
        start_delay_ms,
        allow_early_completion,
        description,
        metadata_keys,
        metadata_values,
        clock,
        ctx,
    );
}

/// Contribute with max_total_cap (use UNLIMITED_CAP to accept any raise amount)
public entry fun contribute<RaiseToken, StableCoin>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    factory: &factory::Factory,
    payment: Coin<StableCoin>,
    max_total_cap: u64,
    crank_fee: Coin<sui::sui::SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(raise.state == STATE_FUNDING, ERaiseNotActive);
    assert!(clock.timestamp_ms() >= raise.start_time_ms, ERaiseNotActive);
    assert!(clock.timestamp_ms() < raise.deadline_ms, ERaiseNotActive);

    let amount = payment.value();
    assert!(amount > 0, EZeroContribution);

    // Collect bid fee (configured at factory level)
    let required_fee = factory::launchpad_bid_fee(factory);
    assert!(crank_fee.value() == required_fee, EInvalidCrankFee);
    raise.crank_fee_vault.join(crank_fee.into_balance());

    assert!(
        max_total_cap == UNLIMITED_CAP || is_cap_allowed(max_total_cap, &raise.allowed_caps),
        EInvalidStateForAction
    );

    let contributor = ctx.sender();
    let key = ContributorKey { contributor };

    let mut old_amount = 0u64;
    let mut old_cap = 0u64;
    if (df::exists_(&raise.id, key)) {
        let contrib: &mut Contribution = df::borrow_mut(&mut raise.id, key);

        assert!(
            contrib.max_total_cap == max_total_cap ||
            clock.timestamp_ms() < raise.deadline_ms - (24 * 60 * 60 * 1000),
            ECapChangeAfterDeadline
        );

        old_amount = contrib.amount;
        old_cap = contrib.max_total_cap;

        contrib.amount = contrib.amount + amount;
        contrib.max_total_cap = max_total_cap;
    } else {
        df::add(&mut raise.id, key, Contribution { amount, max_total_cap });
    };

    if (old_amount > 0) {
        let cap_count = vector::length(&raise.allowed_caps);
        let mut i = 0;
        while (i < cap_count) {
            let cap = *vector::borrow(&raise.allowed_caps, i);
            // If old max cap was at or below this cap level, subtract old contribution
            if (old_cap <= cap) {
                let sum = vector::borrow_mut(&mut raise.cap_sums, i);
                *sum = *sum - old_amount;
            };
            i = i + 1;
        };
    };

    let new_total = old_amount + amount;
    let cap_count = vector::length(&raise.allowed_caps);
    let mut i = 0;
    while (i < cap_count) {
        let cap = *vector::borrow(&raise.allowed_caps, i);
        // If contributor's max cap is at or below this cap level, they can participate
        if (max_total_cap <= cap) {
            let sum = vector::borrow_mut(&mut raise.cap_sums, i);
            *sum = *sum + new_total;
        };
        i = i + 1;
    };

    raise.stable_coin_vault.join(payment.into_balance());

    event::emit(ContributionAdded {
        raise_id: object::id(raise),
        contributor,
        amount,
        max_total_cap,
    });
}

/// Settle raise: O(C) algorithm where C ≤ 128
/// Finds max valid raise S where S <= cap C
/// cap_sums maintained incrementally during contribute()
public entry fun settle_raise<RaiseToken, StableCoin>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    clock: &Clock,
    _ctx: &mut TxContext,
) {
    assert!(raise.state == STATE_FUNDING, EInvalidStateForAction);
    assert!(clock.timestamp_ms() >= raise.deadline_ms, EDeadlineNotReached);
    assert!(!raise.settlement_done, ESettlementAlreadyDone);

    let mut best_total = 0u64;
    let cap_count = vector::length(&raise.allowed_caps);
    let mut i = cap_count;
    while (i > 0) {
        i = i - 1;
        let cap = *vector::borrow(&raise.allowed_caps, i);
        let sum = *vector::borrow(&raise.cap_sums, i);
        if (sum <= cap && sum > best_total) {
            best_total = sum;
        };
    };

    let mut final_amount = best_total;
    assert!(final_amount >= raise.min_raise_amount, EMinRaiseNotMet);

    if (option::is_some(&raise.max_raise_amount)) {
        let max_raise = *option::borrow(&raise.max_raise_amount);
        if (final_amount > max_raise) {
            final_amount = max_raise;
        };
    };

    raise.final_raise_amount = final_amount;
    raise.settlement_done = true;

    event::emit(SettlementFinalized {
        raise_id: object::id(raise),
        final_total: final_amount,
    });
}

/// Allow creator to end raise early
public entry fun end_raise_early<RT, SC>(
    raise: &mut Raise<RT, SC>,
    creator_cap: &CreatorCap,
    clock: &Clock,
    _ctx: &mut TxContext,
) {
    assert!(creator_cap.raise_id == object::id(raise), EInvalidCreatorCap);
    assert!(raise.state == STATE_FUNDING, EInvalidStateForAction);
    assert!(clock.timestamp_ms() < raise.deadline_ms, EDeadlineNotReached);
    assert!(raise.allow_early_completion, EEarlyCompletionNotAllowed);
    assert!(raise.stable_coin_vault.value() >= raise.min_raise_amount, EMinRaiseNotMet);

    let original_deadline = raise.deadline_ms;
    raise.deadline_ms = clock.timestamp_ms();

    event::emit(RaiseEndedEarly {
        raise_id: object::id(raise),
        total_raised: raise.stable_coin_vault.value(),
        original_deadline,
        ended_at: clock.timestamp_ms(),
    });
}

/// Complete the raise and activate DAO (creator with optional final_raise_amount)
public entry fun complete_raise<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    creator_cap: &CreatorCap,
    final_raise_amount: u64,
    factory: &mut factory::Factory,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(creator_cap.raise_id == object::id(raise), EInvalidCreatorCap);
    assert!(raise.state == STATE_FUNDING, EInvalidStateForAction);
    assert!(clock.timestamp_ms() >= raise.deadline_ms, EDeadlineNotReached);
    assert!(raise.settlement_done, EInvalidStateForAction);

    // Validate final_raise_amount
    let total_raised = raise.stable_coin_vault.value();
    assert!(final_raise_amount >= raise.min_raise_amount, EMinRaiseNotMet);
    assert!(final_raise_amount <= total_raised, EInvalidStateForAction);
    if (option::is_some(&raise.max_raise_amount)) {
        let max = *option::borrow(&raise.max_raise_amount);
        assert!(final_raise_amount <= max, EInvalidStateForAction);
    };

    // Override the settlement's final_raise_amount with creator's choice
    raise.final_raise_amount = final_raise_amount;

    complete_raise_internal(raise, factory, registry, clock, ctx);
}

/// Permissionless completion after 24h delay (uses max automatically)
public entry fun complete_raise_permissionless<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    factory: &mut factory::Factory,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(raise.state == STATE_FUNDING, EInvalidStateForAction);
    assert!(clock.timestamp_ms() >= raise.deadline_ms, EDeadlineNotReached);
    assert!(raise.settlement_done, EInvalidStateForAction);

    let permissionless_open = raise.deadline_ms + PERMISSIONLESS_COMPLETION_DELAY_MS;
    assert!(clock.timestamp_ms() >= permissionless_open, EInvalidStateForAction);

    // Permissionless uses the total raised (max possible)
    let total_raised = raise.stable_coin_vault.value();
    let mut final_amount = total_raised;

    // But respect max_raise_amount if set
    if (option::is_some(&raise.max_raise_amount)) {
        let max = *option::borrow(&raise.max_raise_amount);
        if (final_amount > max) {
            final_amount = max;
        };
    };

    raise.final_raise_amount = final_amount;

    complete_raise_internal(raise, factory, registry, clock, ctx);
}

/// Create unshared DAO with built-in init actions - returns hot potato for custom init actions
/// PTB must call init_* functions on unshared DAO, then finalize_and_share_dao()
fun complete_raise_unshared<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    factory: &mut factory::Factory,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
): UnsharedDao<RaiseToken, StableCoin> {
    assert!(raise.state == STATE_FUNDING, EInvalidStateForAction);
    assert!(raise.settlement_done, EInvalidStateForAction);

    let final_total = raise.final_raise_amount;
    assert!(final_total >= raise.min_raise_amount, EMinRaiseNotMet);
    assert!(final_total > 0, EMinRaiseNotMet);

    // No DAO creation fee - launchpad already collected fee when raise was created

    // Create NEW DAO (unshared)
    // Uses special launchpad function that doesn't charge DAO creation fee
    let (mut account, spot_pool) = factory::create_dao_unshared_for_launchpad<RaiseToken, StableCoin>(
        factory,
        registry,
        option::none(), // treasury_cap - added below
        option::none(), // coin_metadata - added below
        clock,
        ctx,
    );

    // Store DAO ID for reference
    raise.dao_id = option::some(object::id(&account));

    // Deposit treasury cap
    let treasury_cap = raise.treasury_cap.extract();
    init_actions::init_lock_treasury_cap<FutarchyConfig, RaiseToken>(&mut account, registry, treasury_cap);

    // Deposit metadata if exists
    if (df::exists_(&raise.id, CoinMetadataKey {})) {
        let metadata: CoinMetadata<RaiseToken> = df::remove(&mut raise.id, CoinMetadataKey {});
        init_actions::init_store_object<FutarchyConfig, DaoMetadataKey, CoinMetadata<RaiseToken>>(
            &mut account,
            registry,
            DaoMetadataKey {},
            metadata,
        );
    };

    // Set launchpad initial price
    assert!(raise.tokens_for_sale_amount > 0, EInvalidStateForAction);
    assert!(raise.final_raise_amount > 0, EInvalidStateForAction);

    let raise_price = math::mul_div_mixed(
        (raise.final_raise_amount as u128),
        constants::price_multiplier_scale(),
        (raise.tokens_for_sale_amount as u128),
    );

    let config = futarchy_config::internal_config_mut(&mut account, registry, version::current());
    futarchy_config::set_launchpad_initial_price(config, raise_price);

    // Inherit verification state from launchpad to DAO
    futarchy_config::set_verification_level(config, raise.verification_level);
    futarchy_config::set_admin_review_text(config, raise.admin_review_text);

    // Note: attestation_url is stored in the launchpad Raise object and can be queried from there
    // DaoState.attestation_url is used for verification request workflow, not for inherited state

    // Deposit raised funds to DAO treasury
    let raised_funds = coin::from_balance(raise.stable_coin_vault.split(raise.final_raise_amount), ctx);
    init_actions::init_vault_deposit<FutarchyConfig, StableCoin>(
        &mut account,
        registry,
        string::utf8(b"treasury"),
        raised_funds,
        ctx,
    );

    // Return unshared DAO as hot potato - PTB must execute init actions and finalize
    UnsharedDao<RaiseToken, StableCoin> {
        account,
        spot_pool,
    }
}

/// Finalize and share the DAO after init actions complete
/// Consumes UnsharedDao hot potato, shares objects, marks raise successful
public fun finalize_and_share_dao<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    unshared: UnsharedDao<RaiseToken, StableCoin>,
) {
    let UnsharedDao { account, spot_pool } = unshared;

    raise.state = STATE_SUCCESSFUL;

    // Share DAO objects
    sui_transfer::public_share_object(account);
    unified_spot_pool::share(spot_pool);

    event::emit(RaiseSuccessful {
        raise_id: object::id(raise),
        total_raised: raise.final_raise_amount,
    });
}

/// Public wrapper for complete_raise_unshared - for PTB init action execution
public fun begin_dao_creation<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    factory: &mut factory::Factory,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
): UnsharedDao<RaiseToken, StableCoin> {
    complete_raise_unshared(raise, factory, registry, clock, ctx)
}

// === Init Action Wrappers ===
// These wrappers allow PTB execution of init actions on UnsharedDao
// by extracting the Account reference internally

/// Execute stream init action on UnsharedDao
/// This is a thin wrapper that extracts &mut Account from UnsharedDao
/// and delegates to the actual init_create_stream implementation
public fun execute_init_stream_on_unshared<RaiseToken, StableCoin, Config: store, CoinType: drop>(
    unshared: &mut UnsharedDao<RaiseToken, StableCoin>,
    registry: &PackageRegistry,
    vault_name: String,
    beneficiary: address,
    total_amount: u64,
    start_time: u64,
    end_time: u64,
    cliff_time: Option<u64>,
    max_per_withdrawal: u64,
    min_interval_ms: u64,
    max_beneficiaries: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    account_actions::init_actions::init_create_stream<Config, CoinType>(
        &mut unshared.account,
        registry,
        vault_name,
        beneficiary,
        total_amount,
        start_time,
        end_time,
        cliff_time,
        max_per_withdrawal,
        min_interval_ms,
        max_beneficiaries,
        clock,
        ctx,
    )
}

/// Legacy function - backward compatibility for raises without init actions
fun complete_raise_internal<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    factory: &mut factory::Factory,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let unshared = complete_raise_unshared(raise, factory, registry, clock, ctx);
    finalize_and_share_dao(raise, unshared);
}

/// Claim tokens after successful raise
public entry fun claim_tokens<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(raise.state == STATE_SUCCESSFUL, EInvalidStateForAction);

    let contributor = ctx.sender();
    let key = ContributorKey { contributor };
    assert!(df::exists_(&raise.id, key), ENotAContributor);

    let contrib: Contribution = df::remove(&mut raise.id, key);

    if (contrib.max_total_cap < raise.final_raise_amount) {
        let refund = coin::from_balance(raise.stable_coin_vault.split(contrib.amount), ctx);
        sui_transfer::public_transfer(refund, contributor);
        event::emit(RefundClaimed {
            raise_id: object::id(raise),
            contributor,
            refund_amount: contrib.amount,
        });
        return
    };

    let tokens_to_claim = math::mul_div_to_64(
        contrib.amount,
        raise.tokens_for_sale_amount,
        raise.final_raise_amount
    );

    let payment_amount = math::mul_div_to_64(
        tokens_to_claim,
        raise.final_raise_amount,
        raise.tokens_for_sale_amount
    );

    let tokens = coin::from_balance(raise.raise_token_vault.split(tokens_to_claim), ctx);
    sui_transfer::public_transfer(tokens, contributor);

    event::emit(TokensClaimed {
        raise_id: object::id(raise),
        contributor,
        contribution_amount: payment_amount,
        tokens_claimed: tokens_to_claim,
    });

    let refund_amount = contrib.amount - payment_amount;
    if (refund_amount > 0) {
        let refund = coin::from_balance(raise.stable_coin_vault.split(refund_amount), ctx);
        sui_transfer::public_transfer(refund, contributor);
        event::emit(RefundClaimed {
            raise_id: object::id(raise),
            contributor,
            refund_amount,
        });
    };
}

/// Batch claim tokens for multiple contributors (cranker earns reward per successful claim)
/// Gracefully skips already-claimed contributors instead of failing
public entry fun batch_claim_tokens_for<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    factory: &factory::Factory,
    contributors: vector<address>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let cranker_reward = factory::launchpad_cranker_reward(factory);
    assert!(raise.state == STATE_SUCCESSFUL, EInvalidStateForAction);

    let batch_size = vector::length(&contributors);
    assert!(batch_size > 0, EEmptyBatch);
    assert!(batch_size <= MAX_BATCH_SIZE, EBatchSizeTooLarge);

    let mut i = 0;
    let mut successful_claims = 0u64;
    // Accumulate crank rewards to send as one coin at the end
    let mut total_crank_reward = coin::zero<sui::sui::SUI>(ctx);

    while (i < batch_size) {
        let contributor = *vector::borrow(&contributors, i);
        let key = ContributorKey { contributor };

        // Skip if already claimed (graceful degradation)
        if (!df::exists_(&raise.id, key)) {
            i = i + 1;
            continue
        };

        let contrib: Contribution = df::remove(&mut raise.id, key);

        // Handle refund case (low price cap)
        if (contrib.max_total_cap < raise.final_raise_amount) {
            let refund = coin::from_balance(raise.stable_coin_vault.split(contrib.amount), ctx);
            sui_transfer::public_transfer(refund, contributor);

            // Accumulate cranker reward
            if (raise.crank_fee_vault.value() >= cranker_reward) {
                let reward = coin::from_balance(
                    raise.crank_fee_vault.split(cranker_reward),
                    ctx
                );
                total_crank_reward.join(reward);
                successful_claims = successful_claims + 1;
            };

            event::emit(RefundClaimed {
                raise_id: object::id(raise),
                contributor,
                refund_amount: contrib.amount,
            });

            i = i + 1;
            continue
        };

        // Normal token claim
        let tokens_to_claim = math::mul_div_to_64(
            contrib.amount,
            raise.tokens_for_sale_amount,
            raise.final_raise_amount
        );

        let payment_amount = math::mul_div_to_64(
            tokens_to_claim,
            raise.final_raise_amount,
            raise.tokens_for_sale_amount
        );

        let tokens = coin::from_balance(raise.raise_token_vault.split(tokens_to_claim), ctx);
        sui_transfer::public_transfer(tokens, contributor);

        // Accumulate cranker reward
        if (raise.crank_fee_vault.value() >= cranker_reward) {
            let reward = coin::from_balance(
                raise.crank_fee_vault.split(cranker_reward),
                ctx
            );
            total_crank_reward.join(reward);
            successful_claims = successful_claims + 1;
        };

        event::emit(TokensClaimed {
            raise_id: object::id(raise),
            contributor,
            contribution_amount: payment_amount,
            tokens_claimed: tokens_to_claim,
        });

        // Handle stable refund
        let refund_amount = contrib.amount - payment_amount;
        if (refund_amount > 0) {
            let refund = coin::from_balance(raise.stable_coin_vault.split(refund_amount), ctx);
            sui_transfer::public_transfer(refund, contributor);
            event::emit(RefundClaimed {
                raise_id: object::id(raise),
                contributor,
                refund_amount,
            });
        };

        i = i + 1;
    };

    // Send accumulated crank rewards to cranker
    if (total_crank_reward.value() > 0) {
        sui_transfer::public_transfer(total_crank_reward, ctx.sender());
    } else {
        total_crank_reward.destroy_zero();
    };

    // Emit batch completion event
    event::emit(BatchClaimCompleted {
        raise_id: object::id(raise),
        cranker: ctx.sender(),
        attempted: batch_size,
        successful: successful_claims,
        total_reward: successful_claims * cranker_reward,
    });
}

/// Claim refund for failed raise
public entry fun claim_refund<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(clock.timestamp_ms() >= raise.deadline_ms, EDeadlineNotReached);

    // Check if raise failed
    if (raise.settlement_done) {
        assert!(raise.final_raise_amount < raise.min_raise_amount, EMinRaiseAlreadyMet);
    } else {
        assert!(raise.stable_coin_vault.value() < raise.min_raise_amount, EMinRaiseAlreadyMet);
    };

    if (raise.state == STATE_FUNDING) {
        raise.state = STATE_FAILED;
        event::emit(RaiseFailed {
            raise_id: object::id(raise),
            total_raised: raise.stable_coin_vault.value(),
            min_raise_amount: raise.min_raise_amount,
        });
    };

    assert!(raise.state == STATE_FAILED, EInvalidStateForAction);

    let contributor = ctx.sender();
    let key = ContributorKey { contributor };
    assert!(df::exists_(&raise.id, key), ENotAContributor);

    let contrib: Contribution = df::remove(&mut raise.id, key);

    let refund = coin::from_balance(raise.stable_coin_vault.split(contrib.amount), ctx);
    sui_transfer::public_transfer(refund, contributor);

    event::emit(RefundClaimed {
        raise_id: object::id(raise),
        contributor,
        refund_amount: contrib.amount,
    });
}

/// Batch claim refunds for failed raise (cranker earns reward per successful claim)
/// Gracefully skips already-claimed contributors instead of failing
public entry fun batch_claim_refund_for<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    factory: &factory::Factory,
    contributors: vector<address>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let cranker_reward = factory::launchpad_cranker_reward(factory);
    assert!(clock.timestamp_ms() >= raise.deadline_ms, EDeadlineNotReached);

    // Check if raise failed
    if (raise.settlement_done) {
        assert!(raise.final_raise_amount < raise.min_raise_amount, EMinRaiseAlreadyMet);
    } else {
        assert!(raise.stable_coin_vault.value() < raise.min_raise_amount, EMinRaiseAlreadyMet);
    };

    if (raise.state == STATE_FUNDING) {
        raise.state = STATE_FAILED;
        event::emit(RaiseFailed {
            raise_id: object::id(raise),
            total_raised: raise.stable_coin_vault.value(),
            min_raise_amount: raise.min_raise_amount,
        });
    };

    assert!(raise.state == STATE_FAILED, EInvalidStateForAction);

    let batch_size = vector::length(&contributors);
    assert!(batch_size > 0, EEmptyBatch);
    assert!(batch_size <= MAX_BATCH_SIZE, EBatchSizeTooLarge);

    let mut i = 0;
    let mut successful_claims = 0u64;

    while (i < batch_size) {
        let contributor = *vector::borrow(&contributors, i);
        let key = ContributorKey { contributor };

        // Skip if already claimed
        if (!df::exists_(&raise.id, key)) {
            i = i + 1;
            continue
        };

        let contrib: Contribution = df::remove(&mut raise.id, key);

        let refund = coin::from_balance(raise.stable_coin_vault.split(contrib.amount), ctx);
        sui_transfer::public_transfer(refund, contributor);

        // Pay cranker
        if (raise.crank_fee_vault.value() >= cranker_reward) {
            let reward = coin::from_balance(
                raise.crank_fee_vault.split(cranker_reward),
                ctx
            );
            sui_transfer::public_transfer(reward, ctx.sender());
            successful_claims = successful_claims + 1;
        };

        event::emit(RefundClaimed {
            raise_id: object::id(raise),
            contributor,
            refund_amount: contrib.amount,
        });

        i = i + 1;
    };

    event::emit(BatchClaimCompleted {
        raise_id: object::id(raise),
        cranker: ctx.sender(),
        attempted: batch_size,
        successful: successful_claims,
        total_reward: successful_claims * cranker_reward,
    });
}

/// Cleanup resources for a failed raise
public entry fun cleanup_failed_raise<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(clock.timestamp_ms() >= raise.deadline_ms, EDeadlineNotReached);

    if (raise.settlement_done) {
        assert!(raise.final_raise_amount < raise.min_raise_amount, EMinRaiseAlreadyMet);
    } else {
        assert!(raise.stable_coin_vault.value() < raise.min_raise_amount, EMinRaiseAlreadyMet);
    };

    if (raise.state != STATE_FAILED) {
        raise.state = STATE_FAILED;
    };

    // Return treasury cap to creator
    if (raise.treasury_cap.is_some()) {
        let mut cap = raise.treasury_cap.extract();
        let bal = raise.raise_token_vault.value();
        if (bal > 0) {
            let tokens_to_burn = coin::from_balance(raise.raise_token_vault.split(bal), ctx);
            coin::burn(&mut cap, tokens_to_burn);
        };
        sui_transfer::public_transfer(cap, raise.creator);

        event::emit(TreasuryCapReturned {
            raise_id: object::id(raise),
            tokens_burned: bal,
            recipient: raise.creator,
            timestamp: clock.timestamp_ms(),
        });
    };

    // Clean up staged init specs
    // NOTE: No pre-created DAO to clean up anymore - DAO is only created in complete_raise
    if (!vector::is_empty(&raise.staged_init_specs)) {
        raise.staged_init_specs = vector::empty();
    };

    // Get DAO ID for event before clearing
    let dao_id = if (raise.dao_id.is_some()) {
        *raise.dao_id.borrow()
    } else {
        object::id_from_address(@0x0)
    };

    // Clear DAO ID if set
    if (raise.dao_id.is_some()) {
        raise.dao_id = option::none();
    };

    event::emit(FailedRaiseCleanup {
        raise_id: object::id(raise),
        dao_id,
        timestamp: clock.timestamp_ms(),
    });

    if (df::exists_(&raise.id, CoinMetadataKey {})) {
        let metadata: CoinMetadata<RaiseToken> = df::remove(&mut raise.id, CoinMetadataKey {});
        sui_transfer::public_transfer(metadata, raise.creator);
    };
}

/// Sweep remaining dust after claim period
public entry fun sweep_dust<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    creator_cap: &CreatorCap,
    dao_account: &mut Account,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(raise.state == STATE_SUCCESSFUL, EInvalidStateForAction);
    assert!(creator_cap.raise_id == object::id(raise), EInvalidCreatorCap);
    assert!(raise.dao_id.is_some(), EDaoNotPreCreated);
    assert!(object::id(dao_account) == *raise.dao_id.borrow(), EInvalidStateForAction);

    assert!(
        clock.timestamp_ms() >= raise.deadline_ms + constants::launchpad_claim_period_ms(),
        EDeadlineNotReached,
    );

    let remaining_token_balance = raise.raise_token_vault.value();
    if (remaining_token_balance > 0) {
        let dust_tokens = coin::from_balance(raise.raise_token_vault.split(remaining_token_balance), ctx);
        sui_transfer::public_transfer(dust_tokens, raise.creator);
    };

    let remaining_stable_balance = raise.stable_coin_vault.value();
    if (remaining_stable_balance > 0) {
        let dust_stable = coin::from_balance(raise.stable_coin_vault.split(remaining_stable_balance), ctx);
        init_actions::init_vault_deposit<FutarchyConfig, StableCoin>(
            dao_account,
            registry,
            string::utf8(b"treasury"),
            dust_stable,
            ctx,
        );
    };

    event::emit(DustSwept {
        raise_id: object::id(raise),
        token_dust_amount: remaining_token_balance,
        stable_dust_amount: remaining_stable_balance,
        token_recipient: raise.creator,
        stable_recipient: object::id(dao_account),
        timestamp: clock.timestamp_ms(),
    });
}

/// Sweep remaining protocol fees after raise is settled (SUCCESS or FAILED)
/// Can be called by factory admin after all claims are processed
/// Difference between bid fee (0.1 SUI) and cranker rewards (0.05 SUI per claim) goes to protocol
public entry fun sweep_protocol_fees<RaiseToken, StableCoin>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    _owner_cap: &factory::FactoryOwnerCap,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Only holder of FactoryOwnerCap can call this (verified by Sui runtime)

    // Can only sweep after raise is settled (either SUCCESS or FAILED)
    assert!(
        raise.state == STATE_SUCCESSFUL || raise.state == STATE_FAILED,
        EInvalidStateForAction
    );

    // Must have some fees to sweep
    let remaining_fees = raise.crank_fee_vault.value();
    assert!(remaining_fees > 0, ENoProtocolFeesToSweep);

    // Extract all remaining fees
    let protocol_fees = coin::from_balance(
        raise.crank_fee_vault.split(remaining_fees),
        ctx
    );

    // Send to factory admin
    sui_transfer::public_transfer(protocol_fees, ctx.sender());

    event::emit(ProtocolFeesSwept {
        raise_id: object::id(raise),
        amount: remaining_fees,
        recipient: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

fun init_raise<RaiseToken: drop, StableCoin: drop>(
    mut treasury_cap: TreasuryCap<RaiseToken>,
    coin_metadata: CoinMetadata<RaiseToken>,
    affiliate_id: String,
    tokens_for_sale: u64,
    min_raise_amount: u64,
    max_raise_amount: Option<u64>,
    allowed_caps: vector<u64>,
    start_delay_ms: Option<u64>,
    allow_early_completion: bool,
    description: String,
    metadata_keys: vector<String>,
    metadata_values: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Validate coin set (supply must be zero, types must match)
    futarchy_one_shot_utils::coin_registry::validate_coin_set(&treasury_cap, &coin_metadata);

    let minted_tokens = coin::mint(&mut treasury_cap, tokens_for_sale, ctx);

    // Calculate start_time: creation_time + delay (if delay provided, otherwise start immediately)
    let current_time = clock.timestamp_ms();
    let start_time = if (option::is_some(&start_delay_ms)) {
        current_time + *option::borrow(&start_delay_ms)
    } else {
        current_time
    };

    // Deadline is start_time + duration
    let deadline = start_time + constants::launchpad_duration_ms();

    let mut raise = Raise<RaiseToken, StableCoin> {
        id: object::new(ctx),
        creator: ctx.sender(),
        affiliate_id,
        state: STATE_FUNDING,
        min_raise_amount,
        max_raise_amount,
        start_time_ms: start_time,
        deadline_ms: deadline,
        allow_early_completion,
        raise_token_vault: minted_tokens.into_balance(),
        tokens_for_sale_amount: tokens_for_sale,
        stable_coin_vault: balance::zero(),
        description,
        staged_init_specs: vector::empty(),
        treasury_cap: option::some(treasury_cap),
        coin_metadata: option::some(coin_metadata),
        allowed_caps,
        cap_sums: vector::empty(),
        settlement_done: false,
        final_raise_amount: 0,
        dao_id: option::none(),
        intents_locked: false,
        verification_level: 0,
        attestation_url: string::utf8(b""),
        admin_review_text: string::utf8(b""),
        crank_fee_vault: balance::zero(),
    };

    let cap_count = vector::length(&raise.allowed_caps);
    let mut i = 0;
    while (i < cap_count) {
        vector::push_back(&mut raise.cap_sums, 0);
        i = i + 1;
    };

    let raise_id = object::id(&raise);

    event::emit(RaiseCreated {
        raise_id,
        creator: raise.creator,
        affiliate_id: raise.affiliate_id,
        raise_token_type: string::from_ascii(type_name::with_defining_ids<RaiseToken>().into_string()),
        stable_coin_type: string::from_ascii(type_name::with_defining_ids<StableCoin>().into_string()),
        min_raise_amount,
        tokens_for_sale,
        start_time_ms: raise.start_time_ms,
        deadline_ms: raise.deadline_ms,
        description: raise.description,
        metadata_keys,
        metadata_values,
    });

    let creator_cap = CreatorCap {
        id: object::new(ctx),
        raise_id,
    };
    sui_transfer::public_transfer(creator_cap, raise.creator);

    sui_transfer::public_share_object(raise);
}

// === Helper Functions ===

fun is_sorted_ascending(v: &vector<u64>): bool {
    let len = vector::length(v);
    if (len <= 1) return true;

    let mut i = 0;
    while (i < len - 1) {
        if (*vector::borrow(v, i) >= *vector::borrow(v, i + 1)) {
            return false
        };
        i = i + 1;
    };
    true
}

fun is_cap_allowed(cap: u64, allowed_caps: &vector<u64>): bool {
    let len = vector::length(allowed_caps);
    let mut left = 0;
    let mut right = len;

    while (left < right) {
        let mid = left + (right - left) / 2;
        let mid_val = *vector::borrow(allowed_caps, mid);

        if (mid_val == cap) {
            return true
        } else if (mid_val < cap) {
            left = mid + 1;
        } else {
            right = mid;
        };
    };
    false
}

// === View Functions ===

public fun total_raised<RT, SC>(r: &Raise<RT, SC>): u64 {
    r.stable_coin_vault.value()
}

public fun state<RT, SC>(r: &Raise<RT, SC>): u8 { r.state }

public fun start_time<RT, SC>(r: &Raise<RT, SC>): u64 { r.start_time_ms }

public fun deadline<RT, SC>(r: &Raise<RT, SC>): u64 { r.deadline_ms }

public fun description<RT, SC>(r: &Raise<RT, SC>): &String { &r.description }

public fun contribution_of<RT, SC>(r: &Raise<RT, SC>, addr: address): u64 {
    let key = ContributorKey { contributor: addr };
    if (df::exists_(&r.id, key)) {
        let contrib: &Contribution = df::borrow(&r.id, key);
        contrib.amount
    } else {
        0
    }
}

public fun settlement_done<RT, SC>(r: &Raise<RT, SC>): bool { r.settlement_done }

public fun final_raise_amount<RT, SC>(r: &Raise<RT, SC>): u64 { r.final_raise_amount }

public fun allowed_caps<RT, SC>(r: &Raise<RT, SC>): &vector<u64> { &r.allowed_caps }

public fun cap_sums<RT, SC>(r: &Raise<RT, SC>): &vector<u64> { &r.cap_sums }

public fun verification_level<RT, SC>(r: &Raise<RT, SC>): u8 {
    r.verification_level
}

public fun attestation_url<RT, SC>(r: &Raise<RT, SC>): &String {
    &r.attestation_url
}

public fun admin_review_text<RT, SC>(r: &Raise<RT, SC>): &String {
    &r.admin_review_text
}

// === Admin Functions ===

public fun set_launchpad_verification<RT, SC>(
    raise: &mut Raise<RT, SC>,
    _validator_cap: &factory::ValidatorAdminCap,
    level: u8,
    attestation_url: String,
    review_text: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    raise.verification_level = level;
    raise.attestation_url = attestation_url;
    raise.admin_review_text = review_text;

    event::emit(LaunchpadVerificationSet {
        raise_id: object::id(raise),
        level,
        attestation_url,
        admin_review_text: review_text,
        validator: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// === Test Functions ===

#[test_only]
/// Test version of complete_raise that doesn't share objects (which fails in test environment)
/// Instead, it transfers them to the sender for testing
public fun complete_raise_test<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    creator_cap: &CreatorCap,
    final_raise_amount: u64,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(creator_cap.raise_id == object::id(raise), EInvalidCreatorCap);
    assert!(raise.state == STATE_FUNDING, EInvalidStateForAction);
    assert!(clock.timestamp_ms() >= raise.deadline_ms, EDeadlineNotReached);
    assert!(raise.settlement_done, EInvalidStateForAction);
    assert!(raise.dao_id.is_some(), EDaoNotPreCreated);

    // Validate final_raise_amount
    let total_raised = raise.stable_coin_vault.value();
    assert!(final_raise_amount >= raise.min_raise_amount, EMinRaiseNotMet);
    assert!(final_raise_amount <= total_raised, EInvalidStateForAction);
    if (option::is_some(&raise.max_raise_amount)) {
        let max = *option::borrow(&raise.max_raise_amount);
        assert!(final_raise_amount <= max, EInvalidStateForAction);
    };

    // Override the settlement's final_raise_amount with creator's choice
    raise.final_raise_amount = final_raise_amount;

    // No DAO creation fee - launchpad already collected it

    let final_total = raise.final_raise_amount;
    assert!(final_total >= raise.min_raise_amount, EMinRaiseNotMet);
    assert!(final_total > 0, EMinRaiseNotMet);

    let mut account: Account = df::remove(&mut raise.id, DaoAccountKey {});
    let mut spot_pool: UnifiedSpotPool<RaiseToken, StableCoin> = df::remove(&mut raise.id, DaoPoolKey {});

    // Deposit treasury cap
    let treasury_cap = raise.treasury_cap.extract();
    init_actions::init_lock_treasury_cap<FutarchyConfig, RaiseToken>(&mut account, registry, treasury_cap);

    // Deposit metadata if exists
    if (df::exists_(&raise.id, CoinMetadataKey {})) {
        let metadata: CoinMetadata<RaiseToken> = df::remove(&mut raise.id, CoinMetadataKey {});
        init_actions::init_store_object<FutarchyConfig, DaoMetadataKey, CoinMetadata<RaiseToken>>(
            &mut account,
            registry,
            DaoMetadataKey {},
            metadata,
        );
    };

    // Set launchpad initial price
    assert!(raise.tokens_for_sale_amount > 0, EInvalidStateForAction);
    assert!(raise.final_raise_amount > 0, EInvalidStateForAction);

    let raise_price = math::mul_div_mixed(
        (raise.final_raise_amount as u128),
        constants::price_multiplier_scale(),
        (raise.tokens_for_sale_amount as u128),
    );

    let config = futarchy_config::internal_config_mut(&mut account, registry, version::current());
    futarchy_config::set_launchpad_initial_price(config, raise_price);

    // Inherit verification state from launchpad to DAO
    futarchy_config::set_verification_level(config, raise.verification_level);
    futarchy_config::set_admin_review_text(config, raise.admin_review_text);

    // Note: attestation_url is stored in the launchpad Raise object and can be queried from there
    // DaoState.attestation_url is used for verification request workflow, not for inherited state

    // Deposit raised funds to DAO treasury
    let raised_funds = coin::from_balance(raise.stable_coin_vault.split(raise.final_raise_amount), ctx);
    init_actions::init_vault_deposit<FutarchyConfig, StableCoin>(
        &mut account,
        registry,
        string::utf8(b"treasury"),
        raised_funds,
        ctx,
    );

    raise.state = STATE_SUCCESSFUL;

    // In test environment, transfer objects to sender instead of sharing
    // This avoids the test framework limitation with share_object
    sui_transfer::public_transfer(account, ctx.sender());
    sui_transfer::public_transfer(spot_pool, ctx.sender());

    event::emit(RaiseSuccessful {
        raise_id: object::id(raise),
        total_raised: raise.final_raise_amount,
    });
}
