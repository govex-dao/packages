// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// PTB execution helpers for launchpad init intents.
///
/// The frontend composes a programmable transaction that:
/// 1. Calls `begin_execution` to receive the launchpad executable hot potato.
/// 2. Invokes the relevant `do_init_*` action functions in order (routing is handled client-side).
/// 3. Calls `finalize_execution` to confirm the intent and emit events.
///
/// This keeps execution logic flexible while guaranteeing on-chain sequencing with the
/// executable's action counter.
///
/// Pattern matches futarchy_governance::ptb_executor for consistency.
module futarchy_factory::launchpad_intent_executor;

use account_actions::version;
use account_protocol::account::{Self, Account};
use account_protocol::executable::{Self, Executable};
use account_protocol::intents;
use account_protocol::package_registry::PackageRegistry;
use futarchy_core::futarchy_config::{Self as fc, FutarchyConfig};
use futarchy_factory::launchpad::{Self, Raise};
use futarchy_factory::launchpad_outcome::LaunchpadOutcome;
use std::string::{Self, String};
use sui::clock::Clock;
use sui::event;
use sui::object;
use sui::tx_context::TxContext;

// === Errors ===

// === Events ===
/// Event emitted when a launchpad init intent is executed
public struct LaunchpadIntentExecuted has copy, drop {
    raise_id: object::ID,
    account_id: object::ID,
    intent_key: String,
    timestamp: u64,
}

/// Begin execution for a successful raise by creating the launchpad executable.
/// - Verifies the raise succeeded.
/// - Executes the "launchpad_init" intent with outcome validation.
/// Returns the executable hot potato for the PTB to route to do_init_* functions.
public fun begin_execution<RaiseToken: drop, StableCoin: drop>(
    raise: &Raise<RaiseToken, StableCoin>,
    account: &mut Account,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
): Executable<LaunchpadOutcome> {
    // Create executable from the existing "launchpad_init" intent
    let (outcome, executable) = account::create_executable<FutarchyConfig, LaunchpadOutcome, _>(
        account,
        registry,
        string::utf8(b"launchpad_init"),
        clock,
        version::current(),
        fc::witness(),
        ctx,
    );

    // Validate that the raise succeeded
    assert!(launchpad::is_outcome_approved(&outcome, raise), 0);

    executable
}

/// Finalize execution after all init actions have been processed.
/// Confirms the executable and emits the execution event.
/// Note: Cannot be `entry` because Executable<LaunchpadOutcome> is not a valid entry parameter type
public fun finalize_execution<RaiseToken: drop, StableCoin: drop>(
    raise: &Raise<RaiseToken, StableCoin>,
    account: &mut Account,
    executable: Executable<LaunchpadOutcome>,
    clock: &Clock,
) {
    let intent_key = intents::key(executable::intent(&executable));

    account::confirm_execution(account, executable);

    event::emit(LaunchpadIntentExecuted {
        raise_id: object::id(raise),
        account_id: object::id(account),
        intent_key,
        timestamp: clock.timestamp_ms(),
    });
}
