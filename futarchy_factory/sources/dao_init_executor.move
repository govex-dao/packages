// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Generic PTB execution helpers for DAO init intents.
///
/// Used by both launchpad and factory for executing init actions.
/// The frontend composes a programmable transaction that:
/// 1. Calls `begin_execution` to receive the executable hot potato.
/// 2. Invokes the relevant `do_*` action functions in order.
/// 3. Calls `finalize_execution` to confirm the intent and emit events.
module futarchy_factory::dao_init_executor;

use account_actions::version;
use account_protocol::account::{Self, Account};
use account_protocol::executable::{Self, Executable};
use account_protocol::intent_interface;
use account_protocol::intents::{Self, ActionSpec};
use account_protocol::package_registry::PackageRegistry;
use futarchy_core::futarchy_config::{Self as fc, FutarchyConfig};
use futarchy_factory::dao_init_outcome::{Self as dao_init_outcome, DaoInitOutcome};
use futarchy_one_shot_utils::constants;
use std::string::{Self, String};
use sui::clock::Clock;
use sui::event;

// === Errors ===

const ERaiseIdMismatch: u64 = 1;

// === Structs ===

/// Intent witness for DAO initialization intents
public struct DaoInitIntent has copy, drop {}

// === Events ===

/// Event emitted when a DAO init intent is executed
public struct DaoInitIntentExecuted has copy, drop {
    account_id: ID,
    source_id: Option<ID>,
    intent_key: String,
    timestamp: u64,
}

// === Public Accessors ===

/// Standard intent key for DAO initialization
public fun dao_init_intent_key(): vector<u8> {
    b"dao_init"
}

/// Create a DaoInitIntent witness (for PTB execution)
public fun dao_init_intent_witness(): DaoInitIntent {
    DaoInitIntent {}
}

// === Intent Creation ===

/// Create intents from action specs for factory (no source_id)
/// Called on unshared Account before sharing
public fun create_intents_from_specs_for_factory(
    account: &mut Account,
    registry: &PackageRegistry,
    specs: &vector<ActionSpec>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (specs.is_empty()) return;

    let outcome = dao_init_outcome::new_for_factory(object::id(account));
    create_intents_internal(account, registry, specs, outcome, b"DAO initialization actions", clock, ctx);
}

/// Create intents from action specs for launchpad (with source_id = raise_id)
/// Called on unshared Account before sharing
public fun create_intents_from_specs_for_launchpad(
    account: &mut Account,
    registry: &PackageRegistry,
    specs: &vector<ActionSpec>,
    raise_id: ID,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (specs.is_empty()) return;

    let outcome = dao_init_outcome::new_for_launchpad(object::id(account), raise_id);
    create_intents_internal(account, registry, specs, outcome, b"DAO initialization actions from launchpad raise", clock, ctx);
}

// === Executor Functions ===

/// Begin execution of DAO init intents (for factory - no raise validation).
/// Returns the executable hot potato for the PTB to route to do_* action functions.
public fun begin_execution(
    account: &mut Account,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
): Executable<DaoInitOutcome> {
    let (_outcome, executable) = account::create_executable<FutarchyConfig, DaoInitOutcome, _>(
        account,
        registry,
        string::utf8(dao_init_intent_key()),
        clock,
        version::current(),
        fc::witness(),
        ctx,
    );
    executable
}

/// Begin execution of DAO init intents for launchpad (validates against raise_id).
/// Returns the executable hot potato for the PTB to route to do_* action functions.
public fun begin_execution_for_launchpad(
    raise_id: ID,
    account: &mut Account,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
): Executable<DaoInitOutcome> {
    let (outcome, executable) = account::create_executable<FutarchyConfig, DaoInitOutcome, _>(
        account,
        registry,
        string::utf8(dao_init_intent_key()),
        clock,
        version::current(),
        fc::witness(),
        ctx,
    );

    assert!(dao_init_outcome::is_for_raise(&outcome, raise_id), ERaiseIdMismatch);
    executable
}

/// Finalize execution after all init actions have been processed.
/// Confirms the executable and emits the execution event.
public fun finalize_execution(
    account: &mut Account,
    executable: Executable<DaoInitOutcome>,
    clock: &Clock,
) {
    let outcome = *intents::outcome(executable::intent(&executable));
    let intent_key = intents::key(executable::intent(&executable));

    account::confirm_execution(account, executable);

    event::emit(DaoInitIntentExecuted {
        account_id: dao_init_outcome::account_id(&outcome),
        source_id: *dao_init_outcome::source_id(&outcome),
        intent_key,
        timestamp: clock.timestamp_ms(),
    });
}

// === Private Helpers ===

/// Internal helper to create intents from action specs
/// Shared logic for both factory and launchpad
fun create_intents_internal(
    account: &mut Account,
    registry: &PackageRegistry,
    specs: &vector<ActionSpec>,
    outcome: DaoInitOutcome,
    description: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let params = intents::new_params(
        string::utf8(dao_init_intent_key()),
        string::utf8(description),
        vector[clock.timestamp_ms()],  // Execute immediately
        clock.timestamp_ms() + constants::dao_init_intent_expiry_ms(),
        clock,
        ctx,
    );

    intent_interface::build_intent!(
        account,
        registry,
        params,
        outcome,
        string::utf8(dao_init_intent_key()),
        version::current(),
        DaoInitIntent {},
        ctx,
        |intent, iw| {
            let mut i = 0;
            let len = specs.length();
            while (i < len) {
                let spec = specs.borrow(i);
                intents::add_action_spec_with_typename(
                    intent,
                    intents::action_spec_type(spec),
                    *intents::action_spec_data(spec),
                    copy iw
                );
                i = i + 1;
            };
        }
    );
}

// === Test Helpers ===

#[test_only]
/// Create a new dao_init intent from action specs for testing
/// This allows adding actions to an existing DAO account
public fun create_test_intent_from_specs(
    account: &mut Account,
    registry: &PackageRegistry,
    specs: vector<ActionSpec>,
    intent_key: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (specs.is_empty()) return;

    let outcome = dao_init_outcome::new_for_factory(object::id(account));

    let expiry_ms = sui::clock::timestamp_ms(clock) + constants::dao_init_intent_expiry_ms();

    let params = intents::new_params(
        intent_key,
        string::utf8(b"Test intent for action execution"),
        vector[expiry_ms],
        expiry_ms,
        clock,
        ctx
    );

    intent_interface::build_intent!(
        account,
        registry,
        params,
        outcome,
        intent_key,
        version::current(),
        DaoInitIntent {},
        ctx,
        |intent, iw| {
            let mut i = 0;
            let len = specs.length();
            while (i < len) {
                let spec = specs.borrow(i);
                intents::add_action_spec_with_typename(
                    intent,
                    intents::action_spec_type(spec),
                    *intents::action_spec_data(spec),
                    copy iw
                );
                i = i + 1;
            };
        }
    );
}

#[test_only]
/// Begin execution of a test intent by key
public fun begin_test_execution(
    account: &mut Account,
    registry: &PackageRegistry,
    intent_key: String,
    clock: &Clock,
    ctx: &mut TxContext,
): Executable<DaoInitOutcome> {
    let (_, executable) = account::create_executable<FutarchyConfig, DaoInitOutcome, _>(
        account,
        registry,
        intent_key,
        clock,
        version::current(),
        fc::witness(),
        ctx,
    );
    executable
}
