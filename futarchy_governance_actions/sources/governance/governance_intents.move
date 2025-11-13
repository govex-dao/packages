// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Governance module for creating and executing intents from approved proposals
/// This module provides a simplified interface for governance operations
module futarchy_governance_actions::governance_intents;

// === Imports ===
use std::string::{Self, String};
use std::option::{Self, Option};
use std::vector;
use sui::{
    clock::Clock,
    tx_context::TxContext,
    object,
};
use account_protocol::{
    account::{Self, Account},
    executable::{Self, Executable},
    intents::{Self, Intent, Params},
    intent_interface,
    package_registry::PackageRegistry,
};
use account_protocol::intents::ActionSpec;
use futarchy_core::version;
use futarchy_core::{
    futarchy_config::{Self, FutarchyConfig},
};
use futarchy_governance_actions::intent_janitor;
use futarchy_markets_core::proposal::{Self, Proposal};
use futarchy_markets_primitives::market_state::MarketState;

// === Aliases ===
use fun intent_interface::build_intent as Account.build_intent;

// === Witness ===
/// Single witness for governance intents
public struct GovernanceWitness has copy, drop {}

/// Get the governance witness
public fun witness(): GovernanceWitness {
    GovernanceWitness {}
}

// === Execution Functions ===

/// Execute a governance intent from an approved proposal
/// This creates an Intent just-in-time from the stored IntentSpec blueprint
/// and immediately converts it to an executable for execution
/// Returns the executable hot potato for action execution
public fun execute_proposal_intent<AssetType, StableType, Outcome: store + drop + copy>(
    account: &mut Account,
    registry: &PackageRegistry,
    proposal: &mut Proposal<AssetType, StableType>,
    _market: &MarketState,
    outcome_index: u64,
    outcome: Outcome,
    clock: &Clock,
    ctx: &mut TxContext
): Executable<Outcome> {
    // Get the intent spec from the proposal for the specified outcome
    let mut intent_spec_opt = proposal::take_intent_spec_for_outcome(proposal, outcome_index);

    // Extract the intent spec - if no spec exists, this indicates no action was defined for this outcome
    assert!(option::is_some(&intent_spec_opt), 4); // EIntentNotFound
    let intent_spec = option::extract(&mut intent_spec_opt);
    option::destroy_none(intent_spec_opt);

    // Create and store Intent temporarily, then immediately create Executable
    let intent_key = create_and_store_intent_from_spec(
        account,
        registry,
        intent_spec,
        outcome,
        clock,
        ctx
    );

    // Now create the executable from the stored intent
    // IMPORTANT: Must use futarchy_config::witness() (ConfigWitness) to match the Config module
    // The witness module must match the Config module for the security check in account::create_executable
    let (_outcome, executable) = account::create_executable<FutarchyConfig, Outcome, _>(
        account,
        registry,
        intent_key,
        clock,
        version::current(),
        futarchy_config::witness(),
        ctx,
    );

    executable
}

// === Helper Functions ===

/// Create and store an Intent from a vector of ActionSpecs
/// Returns the intent key for immediate execution
public fun create_and_store_intent_from_spec<Outcome: store + drop + copy>(
    account: &mut Account,
    registry: &PackageRegistry,
    specs: vector<ActionSpec>,
    outcome: Outcome,
    clock: &Clock,
    ctx: &mut TxContext
): String {
    // Generate a guaranteed-unique key using Sui's native ID generation
    // This ensures uniqueness even when multiple proposals execute in the same block
    let intent_key = ctx.fresh_object_address().to_string();

    // Create intent parameters with immediate execution
    let params = intents::new_params(
        intent_key,
        b"Just-in-time Proposal Execution".to_string(),
        vector[clock.timestamp_ms()], // Execute immediately
        clock.timestamp_ms() + 3_600_000, // 1 hour expiry
        clock,
        ctx
    );

    // Create the intent using the account module
    let mut intent = account::create_intent(
        account,
        registry,
        params,
        outcome,
        b"ProposalExecution".to_string(),
        version::current(),
        witness(),
        ctx
    );

    // Add all actions from the specs vector to the intent
    // Extract type and data from each ActionSpec and add to intent
    let mut i = 0;
    let len = vector::length(&specs);
    while (i < len) {
        let action_spec = vector::borrow(&specs, i);
        // Extract fields and add to intent, preserving the original TypeName
        intents::add_action_spec_with_typename(
            &mut intent,
            intents::action_spec_type(action_spec),
            *intents::action_spec_data(action_spec),
            witness()
        );
        i = i + 1;
    };

    // Store the intent in the account
    let key_copy = intent_key;
    let expiration_time = clock.timestamp_ms() + 3_600_000; // Same as above
    account::insert_intent(account, registry, intent, version::current(), witness());

    // Register the intent with the janitor for tracking and cleanup
    intent_janitor::register_intent(account, registry, intent_key, expiration_time, ctx);

    key_copy
}
