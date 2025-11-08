#[test_only]
module futarchy_markets_core::proposal_tests;

use futarchy_markets_core::proposal;
use futarchy_markets_primitives::coin_escrow::{Self, TokenEscrow};
use futarchy_markets_primitives::conditional_amm::LiquidityPool;
use futarchy_markets_primitives::market_state;
use futarchy_one_shot_utils::test_coin_a::TEST_COIN_A;
use futarchy_one_shot_utils::test_coin_b::TEST_COIN_B;
use account_protocol::intents::ActionSpec;
use futarchy_types::signed::{Self as signed, SignedU128};
use std::option;
use std::string::{Self, String};
use sui::balance;
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin, TreasuryCap};
use sui::test_scenario::{Self as ts, Scenario};
use sui::test_utils;

// === Test Constants ===

const DAO_ADDR: address = @0xDA0;
const PROPOSER_ADDR: address = @0xABCD;
const TREASURY_ADDR: address = @0xFEE;

const REVIEW_PERIOD_MS: u64 = 24 * 60 * 60 * 1000; // 24 hours
const TRADING_PERIOD_MS: u64 = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_ASSET_LIQUIDITY: u64 = 1_000_000_000; // 1 token (9 decimals)
const MIN_STABLE_LIQUIDITY: u64 = 10_000_000; // 10 USDC (6 decimals)
const TWAP_START_DELAY: u64 = 60 * 1000; // 1 minute
const TWAP_INITIAL_OBSERVATION: u128 = 1_000_000_000_000_000_000u128; // 1.0 in Q64.64
const TWAP_STEP_MAX: u64 = 100;
const TWAP_THRESHOLD_VALUE: u128 = 500_000_000_000_000_000u128; // 0.5 in Q64.64
const AMM_TOTAL_FEE_BPS: u64 = 30; // 0.3%
const CONDITIONAL_LIQUIDITY_RATIO_PERCENT: u64 = 50; // 50% (base 100, not BPS!)
const MAX_OUTCOMES: u64 = 10;

// Error codes from proposal.move
const EInvalidAmount: u64 = 1;
const EInvalidState: u64 = 2;
const EAssetLiquidityTooLow: u64 = 4;
const EStableLiquidityTooLow: u64 = 5;
const EPoolNotFound: u64 = 6;
const EOutcomeOutOfBounds: u64 = 7;
const EInvalidOutcomeVectors: u64 = 8;
const ETooManyOutcomes: u64 = 10;
const EInvalidOutcome: u64 = 11;
const ENotFinalized: u64 = 12;
const ETwapNotSet: u64 = 13;

// State constants
const STATE_PREMARKET: u8 = 0;
const STATE_REVIEW: u8 = 1;
const STATE_TRADING: u8 = 2;
const STATE_FINALIZED: u8 = 3;

// Outcome constants
const OUTCOME_ACCEPTED: u64 = 0;
const OUTCOME_REJECTED: u64 = 1;

// === Test Helpers ===

/// Create a test clock at specific time
fun create_test_clock(timestamp_ms: u64, ctx: &mut TxContext): Clock {
    let mut clock = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clock, timestamp_ms);
    clock
}

/// Helper to create outcome messages
fun create_outcome_messages(count: u64): vector<String> {
    let mut messages = vector::empty<String>();
    let mut i = 0;
    while (i < count) {
        let mut msg = string::utf8(b"Outcome ");
        string::append(&mut msg, string::utf8(b""));
        messages.push_back(msg);
        i = i + 1;
    };
    messages
}

/// Helper to create outcome details
fun create_outcome_details(count: u64): vector<String> {
    let mut details = vector::empty<String>();
    let mut i = 0;
    while (i < count) {
        let mut detail = string::utf8(b"Detail ");
        string::append(&mut detail, string::utf8(b""));
        details.push_back(detail);
        i = i + 1;
    };
    details
}

/// Helper to create test proposal ID
fun create_test_proposal_id(ctx: &mut TxContext): ID {
    object::id_from_address(@0x1234)
}

// === Proposal Creation Tests ===

