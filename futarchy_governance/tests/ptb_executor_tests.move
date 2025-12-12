#[test_only]
module futarchy_governance::ptb_executor_tests;

use futarchy_governance::ptb_executor;
use futarchy_markets_core::proposal::{Self, Proposal};
use futarchy_markets_primitives::market_state::{Self, MarketState};
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use account_protocol::intents::{Self, ActionSpec};
use account_protocol::account::{Self, Account};
use account_protocol::package_registry::{Self, PackageRegistry};
use account_protocol::version_witness;
use account_actions::{action_spec_builder, stream_init_actions, memo_init_actions, transfer_init_actions, vault_init_actions};
use futarchy_core::futarchy_config::{Self, FutarchyConfig};
use sui::clock::{Self, Clock};
use sui::test_scenario::{Self as ts, Scenario};
use sui::test_utils;
use std::{string, vector};

// === Test Constants ===
const USER_ADDR: address = @0xABCD;
const DAO_ADDR: address = @0xDA0;
const RECIPIENT_ADDR: address = @0xBEEF;

// State constants
const STATE_FINALIZED: u8 = 3;

// Outcome constants
// NOTE: These must match the constants in proposal.move and proposal_lifecycle.move
const OUTCOME_REJECTED: u64 = 0;  // Reject is ALWAYS outcome 0 (baseline/status quo)
const OUTCOME_ACCEPTED: u64 = 1;  // Accept is ALWAYS outcome 1+ (proposed actions)

// Error codes
const EMarketNotFinalized: u64 = 0;
const EProposalNotApproved: u64 = 1;
const EIntentMissing: u64 = 2;

// === Test Helpers ===

fun create_test_clock(timestamp_ms: u64, ctx: &mut TxContext): Clock {
    let mut clock = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clock, timestamp_ms);
    clock
}

#[test]
fun test_module_compiles() {
    // Smoke test to verify module compiles
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();
    let clock = create_test_clock(1000, ctx);

    // ptb_executor requires full Account/Registry infrastructure for testing
    // Integration tests should be performed in a complete DAO environment
    assert!(true, 0);

    clock.destroy_for_testing();
    scenario.end();
}

/// Test building a proposal intent with stream, memo, and transfer actions
/// This demonstrates the full 3-layer action pattern:
/// - Layer 1: Action structs (CreateStreamAction, EmitMemoAction, WithdrawAndTransferAction)
/// - Layer 2: Spec builders (add_create_stream_spec, add_emit_memo_spec, add_withdraw_and_transfer_spec)
/// - Layer 3: Execution functions (do_create_stream, do_emit_memo, do_init_withdraw_and_transfer)
#[test]
fun test_build_proposal_intent_with_multiple_actions() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    // Create action spec builder
    let mut builder = action_spec_builder::new();

    // === Add Stream Action ===
    // Create a vesting stream for 100,000 tokens over 1 year
    let vault_name = string::utf8(b"treasury");
    let stream_recipient = RECIPIENT_ADDR;
    let stream_amount = 100_000_000_000; // 100k tokens with 6 decimals
    let start_time_ms = 1000; // Start immediately
    let iterations_total = 12; // 12 monthly iterations
    let iteration_period_ms = 2_628_000_000; // ~1 month in ms
    let amount_per_iteration = stream_amount / iterations_total; // ~8.33k per month

    stream_init_actions::add_create_stream_spec(
        &mut builder,
        vault_name,
        stream_recipient,
        amount_per_iteration,
        start_time_ms,
        iterations_total,
        iteration_period_ms,
        option::none(), // cliff_time
        option::none(), // claim_window_ms
        0, // max_per_withdrawal (0 = unlimited)
    );

    // === Add Memo Action ===
    // Record the reason for this proposal
    let memo = string::utf8(b"Approved by governance vote #42: Team vesting allocation and operational transfer");
    memo_init_actions::add_emit_memo_spec(
        &mut builder,
        memo,
    );

    // === Add Spend + Transfer Actions (composable pattern) ===
    // Spend coins from vault to executable_resources, then transfer to recipient
    let transfer_vault = string::utf8(b"treasury");
    let transfer_amount = 50_000_000_000; // 50k tokens with 6 decimals
    let transfer_recipient = RECIPIENT_ADDR;
    let resource_name = string::utf8(b"transfer_coin");

    // First: Spend from vault (puts coin in executable_resources)
    vault_init_actions::add_spend_spec(
        &mut builder,
        transfer_vault,
        transfer_amount,
        false, // spend_all
        resource_name,
    );

    // Second: Transfer to recipient (takes coin from executable_resources)
    // Use add_transfer_coin_spec because VaultSpend uses provide_coin (key: name::coin::Type)
    transfer_init_actions::add_transfer_coin_spec(
        &mut builder,
        transfer_recipient,
        resource_name,
    );

    // Build the action specs
    let action_specs = action_spec_builder::into_vector(builder);

    // Verify we have 4 actions (stream, memo, spend, transfer)
    assert!(vector::length(&action_specs) == 4, 0);

    // Verify each action spec has the correct version
    let stream_spec = vector::borrow(&action_specs, 0);
    let memo_spec = vector::borrow(&action_specs, 1);
    let spend_spec = vector::borrow(&action_specs, 2);
    let transfer_spec = vector::borrow(&action_specs, 3);

    assert!(intents::action_spec_version(stream_spec) == 1, 1);
    assert!(intents::action_spec_version(memo_spec) == 1, 2);
    assert!(intents::action_spec_version(spend_spec) == 1, 3);
    assert!(intents::action_spec_version(transfer_spec) == 1, 4);

    // Verify action types using type names
    // Note: We can't easily verify the exact type names in tests without exposing them,
    // but we can verify the data is serialized correctly by checking non-zero data
    assert!(vector::length(intents::action_spec_data(stream_spec)) > 0, 5);
    assert!(vector::length(intents::action_spec_data(memo_spec)) > 0, 6);
    assert!(vector::length(intents::action_spec_data(spend_spec)) > 0, 7);
    assert!(vector::length(intents::action_spec_data(transfer_spec)) > 0, 8);

    scenario.end();
}

/// Test building a proposal with only memo and transfer (no stream)
/// This validates that the pattern works for different action combinations
#[test]
fun test_build_proposal_intent_memo_and_transfer_only() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    // Create action spec builder
    let mut builder = action_spec_builder::new();

    // Add memo
    memo_init_actions::add_emit_memo_spec(
        &mut builder,
        string::utf8(b"Treasury diversification: Converting to stablecoins"),
    );

    // Add spend + transfer (composable pattern)
    let resource_name = string::utf8(b"transfer_coin");
    vault_init_actions::add_spend_spec(
        &mut builder,
        string::utf8(b"treasury"),
        1_000_000_000_000, // 1M tokens
        false,
        resource_name,
    );
    // Use add_transfer_coin_spec because VaultSpend uses provide_coin (key: name::coin::Type)
    transfer_init_actions::add_transfer_coin_spec(
        &mut builder,
        RECIPIENT_ADDR,
        resource_name,
    );

    let action_specs = action_spec_builder::into_vector(builder);

    // Verify we have exactly 3 actions (memo, spend, transfer)
    assert!(vector::length(&action_specs) == 3, 0);

    scenario.end();
}

/// Test building a proposal with multiple streams (batch vesting)
/// Demonstrates that we can have multiple actions of the same type
#[test]
fun test_build_proposal_with_multiple_streams() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    let mut builder = action_spec_builder::new();
    let vault_name = string::utf8(b"treasury");

    // Add 3 vesting streams for different team members
    let recipients = vector[
        @0x1111,
        @0x2222,
        @0x3333,
    ];

    let stream_total = 100_000_000_000; // 100k each
    let iterations = 12; // 12 monthly payments
    let period_ms = 2_628_000_000; // ~1 month
    let per_iteration = stream_total / iterations;

    let mut i = 0;
    while (i < 3) {
        stream_init_actions::add_create_stream_spec(
            &mut builder,
            vault_name,
            *vector::borrow(&recipients, i),
            per_iteration,
            1000, // start_time
            iterations,
            period_ms,
            option::none(), // cliff_time
            option::none(), // claim_window_ms
            0, // max_per_withdrawal
        );
        i = i + 1;
    };

    // Add a memo documenting all streams
    memo_init_actions::add_emit_memo_spec(
        &mut builder,
        string::utf8(b"Batch vesting: 3 team members, 100k each, 1 year"),
    );

    let action_specs = action_spec_builder::into_vector(builder);

    // Verify we have 4 actions total (3 streams + 1 memo)
    assert!(vector::length(&action_specs) == 4, 0);

    scenario.end();
}

/// Test that demonstrates the complete flow pattern:
/// 1. Build action specs using Layer 2 (init_actions)
/// 2. Store them in an Intent
/// 3. Pass to proposal
/// 4. Execute via PTB calling Layer 3 (do_* functions)
///
/// Note: This test can't actually execute the full flow without complete
/// DAO infrastructure, but it demonstrates the builder pattern
#[test]
fun test_action_spec_builder_pattern_documentation() {
    let mut scenario = ts::begin(USER_ADDR);
    let ctx = scenario.ctx();

    // ============================================
    // PHASE 1: BUILD ACTION SPECS (Layer 2)
    // ============================================
    let mut builder = action_spec_builder::new();

    // Add actions using the init_actions modules (Layer 2)
    stream_init_actions::add_create_stream_spec(
        &mut builder,
        string::utf8(b"treasury"),
        RECIPIENT_ADDR,
        100_000, // amount_per_iteration
        0, // start_time
        10, // iterations_total
        100_000, // iteration_period_ms
        option::none(), // cliff_time
        option::none(), // claim_window_ms
        0, // max_per_withdrawal
    );

    memo_init_actions::add_emit_memo_spec(
        &mut builder,
        string::utf8(b"Governance action approved"),
    );

    // Use composable spend + transfer pattern
    let resource_name = string::utf8(b"transfer_coin");
    vault_init_actions::add_spend_spec(
        &mut builder,
        string::utf8(b"treasury"),
        500_000,
        false,
        resource_name,
    );
    // Use add_transfer_coin_spec because VaultSpend uses provide_coin (key: name::coin::Type)
    transfer_init_actions::add_transfer_coin_spec(
        &mut builder,
        RECIPIENT_ADDR,
        resource_name,
    );

    let action_specs = action_spec_builder::into_vector(builder);

    // ============================================
    // PHASE 2: CREATE INTENT (would happen in proposal creation)
    // ============================================
    // In real usage:
    // let intent = intents::new(..., action_specs, ...);
    // proposal::add_intent(proposal, outcome, intent);

    // ============================================
    // PHASE 3: EXECUTE (would happen via PTB after proposal passes)
    // ============================================
    // In real PTB execution:
    // let executable = ptb_executor::begin_execution(...);
    // let stream_id = stream::do_create_stream<Config, Outcome, CoinType, IW>(&mut executable, ...);
    // memo::do_emit_memo<Config, Outcome, IW>(&mut executable, ...);
    // vault::do_spend<Config, Outcome, CoinType, IW>(&mut executable, ...);  // puts coin in executable_resources
    // transfer::do_init_transfer<Config, Outcome, T, IW>(&mut executable, ...);  // takes coin and transfers
    // ptb_executor::finalize_execution(executable, ...);

    // Verify specs were built correctly (stream, memo, spend, transfer = 4 actions)
    assert!(vector::length(&action_specs) == 4, 0);

    scenario.end();
}

// === Integration Note ===
// Full integration tests for ptb_executor require:
// 1. Properly initialized Account with FutarchyConfig
// 2. PackageRegistry with registered packages
// 3. Finalized Proposal with InitActionSpecs
// 4. Finalized MarketState
//
// These dependencies make unit testing difficult without extensive setup.
// The module is designed for integration testing with real DAO infrastructure.
//
// Key behaviors to verify in integration tests:
// - begin_execution creates Executable hot potato
// - finalize_execution confirms execution and emits events
// - Error handling for non-finalized markets
// - Error handling for rejected proposals
// - Error handling for missing intents
//
// The tests above demonstrate:
// ✅ Building action specs with the 3-layer pattern
// ✅ Combining multiple action types in one proposal
// ✅ Batch operations (multiple streams)
// ✅ Action spec versioning
// ✅ The complete builder pattern flow
