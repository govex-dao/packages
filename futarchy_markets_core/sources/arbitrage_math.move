// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// ============================================================================
/// TRI-ARBITRAGE MATH - SPOT ↔ CONDITIONAL ↔ PROTECTIVE BID
/// ============================================================================
///
/// Single entry point: compute_optimal_tri_arbitrage()
///
/// Finds globally optimal arbitrage across three venues:
/// 1. Spot pool (variable price AMM)
/// 2. Conditional pools (variable price AMMs for each outcome)
/// 3. Protective bid (constant NAV price floor)
///
/// Routes:
/// - ROUTE_SPOT_TO_COND: Buy from spot, split, sell to conditional pools
/// - ROUTE_COND_TO_SPOT: Buy from ALL conditionals, recombine, sell to spot
/// - ROUTE_SPOT_TO_BID: Buy from spot, sell to protective bid at NAV
/// - ROUTE_COND_TO_BID: Buy from ALL conditionals, recombine, sell to bid
///
/// Uses B-parameterization with ternary search for optimal amounts.
/// Smart bounding reduces search space by 95%+ when hint provided.
///
/// **FEE HANDLING:**
/// - Routes 1-2 (spot↔cond): FEELESS - designed for internal rebalancing
/// - Routes 3-4 (→bid): WITH FEES - includes spot/cond fees AND bid_fee_bps
///
/// ============================================================================

module futarchy_markets_core::arbitrage_math;

use futarchy_markets_core::unified_spot_pool::{Self, UnifiedSpotPool};
use futarchy_markets_primitives::conditional_amm::{Self, LiquidityPool};
use futarchy_one_shot_utils::constants;

// === Errors ===
const ETooManyConditionals: u64 = 0;
const EInvalidFee: u64 = 1;

// === Constants ===
const BPS_SCALE: u64 = 10000;
const SMART_BOUND_MARGIN_NUM: u64 = 11; // 1.1x user swap
const SMART_BOUND_MARGIN_DENOM: u64 = 10;
const MIN_COARSE_THRESHOLD: u64 = 3; // Minimum safe ternary search threshold
const NAV_PRECISION: u64 = 1_000_000_000; // 1e9 (matches protective_bid)

// === Route Constants ===
const ROUTE_NONE: u8 = 0;
const ROUTE_SPOT_TO_COND: u8 = 1;
const ROUTE_COND_TO_SPOT: u8 = 2;
const ROUTE_SPOT_TO_BID: u8 = 3;
const ROUTE_COND_TO_BID: u8 = 4;

// === Public Route Accessors ===
public fun route_none(): u8 { ROUTE_NONE }
public fun route_spot_to_cond(): u8 { ROUTE_SPOT_TO_COND }
public fun route_cond_to_spot(): u8 { ROUTE_COND_TO_SPOT }
public fun route_spot_to_bid(): u8 { ROUTE_SPOT_TO_BID }
public fun route_cond_to_bid(): u8 { ROUTE_COND_TO_BID }
public fun nav_precision(): u64 { NAV_PRECISION }

// ============================================================================
// COMPATIBILITY WRAPPER (for existing tests/integrations)
// ============================================================================

/// Compatibility wrapper - use compute_optimal_tri_arbitrage for new code
/// Only searches spot↔conditional routes (no bid)
public fun compute_optimal_arbitrage_for_n_outcomes<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    user_swap_output: u64,
): (u64, u128, bool) {
    let (amount, route, profit) = compute_optimal_tri_arbitrage(
        spot,
        conditionals,
        0, // nav_price = 0 (no bid)
        0, // max_bid_tokens = 0 (no bid)
        0, // bid_fee_bps = 0 (no bid)
        user_swap_output,
    );
    let is_cond_to_spot = (route == ROUTE_COND_TO_SPOT);
    (amount, profit, is_cond_to_spot)
}

/// Compute optimal Spot → Conditional arbitrage
public fun compute_optimal_spot_to_conditional<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    user_swap_output: u64,
): (u64, u128) {
    compute_spot_to_conditional(spot, conditionals, user_swap_output)
}

/// Compute optimal Conditional → Spot arbitrage
public fun compute_optimal_conditional_to_spot<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    user_swap_output: u64,
): (u64, u128) {
    compute_conditional_to_spot(spot, conditionals, user_swap_output)
}

// ============================================================================
// PRIMARY ENTRY POINT
// ============================================================================

/// Compute optimal tri-arbitrage across spot, conditional, and protective bid
///
/// @param spot: The spot pool
/// @param conditionals: Vector of conditional pools
/// @param nav_price: NAV price from protective bid (scaled by 1e9), 0 if no bid
/// @param max_bid_tokens: Max tokens the protective bid can absorb, 0 if no bid
/// @param bid_fee_bps: Fee charged by protective bid in basis points, 0 if no bid
/// @param user_swap_output: Hint for smart bounding (0 = use global bound)
///
/// @returns (optimal_amount, route, expected_profit)
public fun compute_optimal_tri_arbitrage<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    nav_price: u64,
    max_bid_tokens: u64,
    bid_fee_bps: u64,
    user_swap_output: u64,
): (u64, u8, u128) {
    let mut best_amount = 0u64;
    let mut best_route = ROUTE_NONE;
    let mut best_profit = 0u128;

    let outcome_count = vector::length(conditionals);
    if (outcome_count > 0) {
        assert!(outcome_count <= constants::protocol_max_outcomes(), ETooManyConditionals);
    };

    // === Route 1: Spot → Conditional (FEELESS - internal rebalancing) ===
    if (outcome_count > 0) {
        let (amount, profit) = compute_spot_to_conditional(spot, conditionals, user_swap_output);
        if (profit > best_profit) {
            best_profit = profit;
            best_amount = amount;
            best_route = ROUTE_SPOT_TO_COND;
        };
    };

    // === Route 2: Conditional → Spot (FEELESS - internal rebalancing) ===
    if (outcome_count > 0) {
        let (amount, profit) = compute_conditional_to_spot(spot, conditionals, user_swap_output);
        if (profit > best_profit) {
            best_profit = profit;
            best_amount = amount;
            best_route = ROUTE_COND_TO_SPOT;
        };
    };

    // === Route 3: Spot → Protective Bid (WITH FEES) ===
    if (nav_price > 0 && max_bid_tokens > 0) {
        let (amount, profit) = compute_spot_to_bid(spot, nav_price, max_bid_tokens, bid_fee_bps);
        if (profit > best_profit) {
            best_profit = profit;
            best_amount = amount;
            best_route = ROUTE_SPOT_TO_BID;
        };
    };

    // === Route 4: Conditional → Protective Bid (WITH FEES) ===
    if (nav_price > 0 && max_bid_tokens > 0 && outcome_count > 0) {
        let (amount, profit) = compute_conditional_to_bid(conditionals, nav_price, max_bid_tokens, bid_fee_bps);
        if (profit > best_profit) {
            best_profit = profit;
            best_amount = amount;
            best_route = ROUTE_COND_TO_BID;
        };
    };

    (best_amount, best_route, best_profit)
}

// ============================================================================
// ROUTE 1: SPOT → CONDITIONAL
// ============================================================================

/// Buy from spot, split into conditionals, sell to each conditional pool
fun compute_spot_to_conditional<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    user_swap_output: u64,
): (u64, u128) {
    let num_conditionals = vector::length(conditionals);
    if (num_conditionals == 0) return (0, 0);

    // Check for zero liquidity
    let mut i = 0;
    while (i < num_conditionals) {
        let (cond_asset, cond_stable) = conditional_amm::get_reserves(vector::borrow(conditionals, i));
        if (cond_asset == 0 || cond_stable == 0) return (0, 0);
        i = i + 1;
    };

    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(spot);
    if (spot_asset == 0 || spot_stable == 0) return (0, 0);

    // Build T, A, B constants
    let (ts, as_vals, bs) = build_tab_constants(spot_asset, spot_stable, conditionals);

    // Early exit check
    if (early_exit_spot_to_cond(&ts, &as_vals)) return (0, 0);

    // Calculate upper bound
    let global_ub = upper_bound_b(&ts, &bs);
    let smart_bound = apply_smart_bound(global_ub, user_swap_output);

    // Ternary search for optimal b
    optimal_b_search(&ts, &as_vals, &bs, smart_bound)
}

// ============================================================================
// ROUTE 2: CONDITIONAL → SPOT
// ============================================================================

/// Buy from ALL conditionals (quantum liquidity), recombine, sell to spot
fun compute_conditional_to_spot<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    user_swap_output: u64,
): (u64, u128) {
    let num_conditionals = vector::length(conditionals);
    if (num_conditionals == 0) return (0, 0);

    // Check for zero liquidity and find min asset reserve
    let mut min_cond_asset = std::u64::max_value!();
    let mut i = 0;
    while (i < num_conditionals) {
        let (cond_asset, cond_stable) = conditional_amm::get_reserves(vector::borrow(conditionals, i));
        if (cond_asset == 0 || cond_stable == 0) return (0, 0);
        if (cond_asset < min_cond_asset) { min_cond_asset = cond_asset; };
        i = i + 1;
    };

    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(spot);
    if (spot_asset == 0 || spot_stable == 0) return (0, 0);

    // Early exit check
    if (early_exit_cond_to_spot(spot_asset, spot_stable, conditionals)) return (0, 0);

    // Upper bound
    if (min_cond_asset < 2) return (0, 0);
    let global_ub = min_cond_asset - 1;
    let smart_bound = apply_smart_bound(global_ub, user_swap_output);

    // Ternary search
    ternary_search_cond_to_spot(spot_asset, spot_stable, conditionals, smart_bound)
}

// ============================================================================
// ROUTE 3: SPOT → PROTECTIVE BID
// ============================================================================

/// Buy from spot, sell to protective bid at NAV (WITH FEES)
fun compute_spot_to_bid<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    nav_price: u64,
    max_bid_tokens: u64,
    bid_fee_bps: u64,
): (u64, u128) {
    if (nav_price == 0 || max_bid_tokens == 0) return (0, 0);
    if (bid_fee_bps >= BPS_SCALE) return (0, 0); // 100% fee = no revenue

    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(spot);
    if (spot_asset == 0 || spot_stable == 0) return (0, 0);

    // Early exit: spot_price >= NAV (after fees) means no opportunity
    // Effective NAV after fees = nav_price * (1 - bid_fee_bps/10000)
    let effective_nav = (nav_price as u128) * ((BPS_SCALE - bid_fee_bps) as u128) / (BPS_SCALE as u128);
    let spot_scaled = (spot_stable as u128) * (NAV_PRECISION as u128);
    let nav_scaled = effective_nav * (spot_asset as u128);
    if (spot_scaled >= nav_scaled) return (0, 0);

    // Upper bound: where marginal spot price = effective NAV
    let price_limit = calculate_spot_bid_price_limit(spot_asset, spot_stable, (effective_nav as u64));
    let spot_limit = if (spot_asset > 1) { spot_asset - 1 } else { 0 };
    let upper_bound = min3_u64(price_limit, max_bid_tokens, spot_limit);

    if (upper_bound == 0) return (0, 0);

    // Ternary search
    ternary_search_spot_to_bid(spot, nav_price, bid_fee_bps, upper_bound)
}

// ============================================================================
// ROUTE 4: CONDITIONAL → PROTECTIVE BID
// ============================================================================

/// Buy from ALL conditionals, recombine to base asset, sell to bid at NAV (WITH FEES)
fun compute_conditional_to_bid(
    conditionals: &vector<LiquidityPool>,
    nav_price: u64,
    max_bid_tokens: u64,
    bid_fee_bps: u64,
): (u64, u128) {
    let num_conditionals = vector::length(conditionals);
    if (num_conditionals == 0) return (0, 0);
    if (nav_price == 0 || max_bid_tokens == 0) return (0, 0);
    if (bid_fee_bps >= BPS_SCALE) return (0, 0); // 100% fee = no revenue

    // Find min conditional asset reserve and check for early exit
    let mut min_cond_asset = std::u64::max_value!();
    let mut i = 0;
    while (i < num_conditionals) {
        let pool = vector::borrow(conditionals, i);
        let (cond_asset, cond_stable) = conditional_amm::get_reserves(pool);
        if (cond_asset == 0 || cond_stable == 0) return (0, 0);
        if (cond_asset < min_cond_asset) { min_cond_asset = cond_asset; };

        // Early exit: if any conditional price > effective NAV, no opportunity
        // cond_price = cond_stable / cond_asset
        // effective_nav = nav_price * (1 - bid_fee_bps/10000) / NAV_PRECISION
        // Check: cond_stable * NAV_PRECISION * (BPS_SCALE - bid_fee_bps) >= nav_price * cond_asset * BPS_SCALE
        let cond_scaled = (cond_stable as u256) * (NAV_PRECISION as u256) * ((BPS_SCALE - bid_fee_bps) as u256);
        let nav_scaled = (nav_price as u256) * (cond_asset as u256) * (BPS_SCALE as u256);
        if (cond_scaled >= nav_scaled) return (0, 0);

        i = i + 1;
    };

    if (min_cond_asset < 2) return (0, 0);
    let upper_bound = min_u64(min_cond_asset - 1, max_bid_tokens);

    if (upper_bound == 0) return (0, 0);

    // Ternary search (WITH FEES)
    ternary_search_cond_to_bid(conditionals, nav_price, bid_fee_bps, upper_bound)
}

// ============================================================================
// B-PARAMETERIZATION CORE (for Spot↔Conditional)
// ============================================================================

/// Build T, A, B constants for Spot→Conditional (feeless)
/// T_i = cond_stable * spot_asset
/// A_i = cond_asset * spot_stable
/// B_i = cond_asset + spot_asset
fun build_tab_constants(
    spot_asset: u64,
    spot_stable: u64,
    conditionals: &vector<LiquidityPool>,
): (vector<u128>, vector<u128>, vector<u128>) {
    let n = vector::length(conditionals);
    let mut ts = vector::empty<u128>();
    let mut as_vals = vector::empty<u128>();
    let mut bs = vector::empty<u128>();

    let mut i = 0;
    while (i < n) {
        let (cond_asset, cond_stable) = conditional_amm::get_reserves(vector::borrow(conditionals, i));
        vector::push_back(&mut ts, (cond_stable as u128) * (spot_asset as u128));
        vector::push_back(&mut as_vals, (cond_asset as u128) * (spot_stable as u128));
        vector::push_back(&mut bs, (cond_asset as u128) + (spot_asset as u128));
        i = i + 1;
    };

    (ts, as_vals, bs)
}

/// Early exit: if ANY T_i <= A_i, no profit possible
fun early_exit_spot_to_cond(ts: &vector<u128>, as_vals: &vector<u128>): bool {
    let n = vector::length(ts);
    let mut i = 0;
    while (i < n) {
        if (*vector::borrow(ts, i) <= *vector::borrow(as_vals, i)) return true;
        i = i + 1;
    };
    false
}

/// Early exit for Cond→Spot: check if spot_price <= any cond_price
fun early_exit_cond_to_spot(spot_asset: u64, spot_stable: u64, conditionals: &vector<LiquidityPool>): bool {
    let n = vector::length(conditionals);
    let mut i = 0;
    while (i < n) {
        let (cond_asset, cond_stable) = conditional_amm::get_reserves(vector::borrow(conditionals, i));
        // spot_stable * cond_asset <= cond_stable * spot_asset → no profit
        if ((spot_stable as u256) * (cond_asset as u256) <= (cond_stable as u256) * (spot_asset as u256)) {
            return true
        };
        i = i + 1;
    };
    false
}

/// Upper bound: floor(min_i (T_i - 1) / B_i)
fun upper_bound_b(ts: &vector<u128>, bs: &vector<u128>): u64 {
    let n = vector::length(ts);
    if (n == 0) return 0;

    let mut ub: u128 = std::u64::max_value!() as u128;
    let mut i = 0;
    while (i < n) {
        let ti = *vector::borrow(ts, i);
        let bi = *vector::borrow(bs, i);
        let ub_i = if (bi == 0 || ti <= 1) { 0u128 } else { (ti - 1) / bi };
        if (ub_i < ub) { ub = ub_i; };
        i = i + 1;
    };

    if (ub > (std::u64::max_value!() as u128)) { std::u64::max_value!() } else { (ub as u64) }
}

/// Optimal b search via ternary search
fun optimal_b_search(ts: &vector<u128>, as_vals: &vector<u128>, bs: &vector<u128>, upper_bound: u64): (u64, u128) {
    if (upper_bound == 0) return (0, 0);

    let mut left = 0u64;
    let mut right = upper_bound;
    let mut best_b = 0u64;
    let mut best_profit = 0u128;

    while (right - left > MIN_COARSE_THRESHOLD) {
        let gap = right - left;
        let third = (gap + 2) / 3; // Ceiling division for safety
        let m1 = left + third;
        let m2 = right - third;

        let profit1 = profit_at_b(ts, as_vals, bs, m1);
        let profit2 = profit_at_b(ts, as_vals, bs, m2);

        if (profit1 > best_profit) { best_profit = profit1; best_b = m1; };
        if (profit2 > best_profit) { best_profit = profit2; best_b = m2; };

        if (profit1 >= profit2) { right = m2; } else { left = m1; };
    };

    // Check endpoints
    let pl = profit_at_b(ts, as_vals, bs, left);
    let pr = profit_at_b(ts, as_vals, bs, right);
    if (pl > best_profit) { best_profit = pl; best_b = left; };
    if (pr > best_profit) { best_profit = pr; best_b = right; };

    (best_b, best_profit)
}

/// Profit at b: F(b) = b - x(b)
fun profit_at_b(ts: &vector<u128>, as_vals: &vector<u128>, bs: &vector<u128>, b: u64): u128 {
    let x = x_required_for_b(ts, as_vals, bs, b);
    if (b > x) { ((b - x) as u128) } else { 0 }
}

/// x(b) = max_i [b × A_i / (T_i - b × B_i)]
fun x_required_for_b(ts: &vector<u128>, as_vals: &vector<u128>, bs: &vector<u128>, b: u64): u64 {
    let n = vector::length(ts);
    if (n == 0) return 0;

    let b_u256 = (b as u256);
    let mut x_max = 0u256;

    let mut i = 0;
    while (i < n) {
        let ti = (*vector::borrow(ts, i) as u256);
        let ai = (*vector::borrow(as_vals, i) as u256);
        let bi = (*vector::borrow(bs, i) as u256);

        let bbi = b_u256 * bi;
        if (bbi >= ti) return std::u64::max_value!();

        let denom = ti - bbi;
        let numer = b_u256 * ai;
        let xi = (numer + denom - 1) / denom; // Ceiling

        if (xi > x_max) { x_max = xi; };
        i = i + 1;
    };

    if (x_max > (std::u64::max_value!() as u256)) { std::u64::max_value!() } else { (x_max as u64) }
}

// ============================================================================
// CONDITIONAL → SPOT HELPERS
// ============================================================================

fun ternary_search_cond_to_spot(
    spot_asset: u64,
    spot_stable: u64,
    conditionals: &vector<LiquidityPool>,
    upper_bound: u64,
): (u64, u128) {
    if (upper_bound == 0) return (0, 0);

    let mut left = 0u64;
    let mut right = upper_bound;
    let mut best_b = 0u64;
    let mut best_profit = 0u128;

    while (right - left > MIN_COARSE_THRESHOLD) {
        let gap = right - left;
        let third = (gap + 2) / 3;
        let m1 = left + third;
        let m2 = right - third;

        let p1 = profit_cond_to_spot(spot_asset, spot_stable, conditionals, m1);
        let p2 = profit_cond_to_spot(spot_asset, spot_stable, conditionals, m2);

        if (p1 > best_profit) { best_profit = p1; best_b = m1; };
        if (p2 > best_profit) { best_profit = p2; best_b = m2; };

        if (p1 >= p2) { right = m2; } else { left = m1; };
    };

    let pl = profit_cond_to_spot(spot_asset, spot_stable, conditionals, left);
    let pr = profit_cond_to_spot(spot_asset, spot_stable, conditionals, right);
    if (pl > best_profit) { best_profit = pl; best_b = left; };
    if (pr > best_profit) { best_profit = pr; best_b = right; };

    (best_b, best_profit)
}

fun profit_cond_to_spot(spot_asset: u64, spot_stable: u64, conditionals: &vector<LiquidityPool>, b: u64): u128 {
    if (b == 0) return 0;

    // Revenue from selling b to spot
    let revenue = calculate_spot_revenue(spot_asset, spot_stable, b);

    // Cost to buy b from all conditionals (max due to quantum liquidity)
    let cost = calculate_conditional_cost(conditionals, b);
    if (cost == std::u128::max_value!()) return 0;

    if (revenue > cost) { revenue - cost } else { 0 }
}

fun calculate_spot_revenue(spot_asset: u64, spot_stable: u64, b: u64): u128 {
    let b_u256 = (b as u256);
    let numerator = (spot_stable as u256) * b_u256;
    let denominator = (spot_asset as u256) + b_u256;
    if (denominator == 0) return 0;
    let result = numerator / denominator;
    if (result > (std::u128::max_value!() as u256)) { std::u128::max_value!() } else { (result as u128) }
}

fun calculate_conditional_cost(conditionals: &vector<LiquidityPool>, b: u64): u128 {
    let n = vector::length(conditionals);
    let mut max_cost = 0u128;
    let b_u128 = (b as u128);

    let mut i = 0;
    while (i < n) {
        let (cond_asset, cond_stable) = conditional_amm::get_reserves(vector::borrow(conditionals, i));
        if (b >= cond_asset) return std::u128::max_value!();

        let numerator = (cond_stable as u128) * b_u128;
        let denominator = (cond_asset as u128) - b_u128;
        if (denominator == 0) return std::u128::max_value!();

        let cost_i = numerator / denominator;
        if (cost_i > max_cost) { max_cost = cost_i; };
        i = i + 1;
    };

    max_cost
}

// ============================================================================
// SPOT → BID HELPERS
// ============================================================================

fun calculate_spot_bid_price_limit(spot_asset: u64, spot_stable: u64, nav_price: u64): u64 {
    let stable_scaled = (spot_stable as u128) * (NAV_PRECISION as u128);
    let divisor = stable_scaled / (nav_price as u128);
    if (divisor >= (spot_asset as u128)) { 0 } else { ((spot_asset as u128) - divisor) as u64 }
}

fun ternary_search_spot_to_bid<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    nav_price: u64,
    bid_fee_bps: u64,
    upper_bound: u64,
): (u64, u128) {
    if (upper_bound == 0) return (0, 0);

    let mut left = 0u64;
    let mut right = upper_bound;
    let mut best_b = 0u64;
    let mut best_profit = 0u128;

    while (right - left > MIN_COARSE_THRESHOLD) {
        let gap = right - left;
        let third = (gap + 2) / 3;
        let m1 = left + third;
        let m2 = right - third;

        let p1 = profit_spot_to_bid(spot, nav_price, bid_fee_bps, m1);
        let p2 = profit_spot_to_bid(spot, nav_price, bid_fee_bps, m2);

        if (p1 > best_profit) { best_profit = p1; best_b = m1; };
        if (p2 > best_profit) { best_profit = p2; best_b = m2; };

        if (p1 >= p2) { right = m2; } else { left = m1; };
    };

    let pl = profit_spot_to_bid(spot, nav_price, bid_fee_bps, left);
    let pr = profit_spot_to_bid(spot, nav_price, bid_fee_bps, right);
    if (pl > best_profit) { best_profit = pl; best_b = left; };
    if (pr > best_profit) { best_profit = pr; best_b = right; };

    (best_b, best_profit)
}

fun profit_spot_to_bid<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    nav_price: u64,
    bid_fee_bps: u64,
    b: u64,
): u128 {
    if (b == 0) return 0;

    let cost = calculate_spot_cost_for_tokens(spot, b);
    if (cost == std::u128::max_value!()) return 0;

    // Revenue after bid fee: b * nav_price / PRECISION * (1 - fee_bps/10000)
    let gross_revenue = ((b as u128) * (nav_price as u128)) / (NAV_PRECISION as u128);
    let fee = (gross_revenue * (bid_fee_bps as u128)) / (BPS_SCALE as u128);
    let revenue = gross_revenue - fee;

    if (revenue > cost) { revenue - cost } else { 0 }
}

fun calculate_spot_cost_for_tokens<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    b: u64,
): u128 {
    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(spot);
    if (b >= spot_asset || spot_asset == 0) return std::u128::max_value!();

    let fee_bps = unified_spot_pool::get_fee_bps(spot);
    if (fee_bps >= BPS_SCALE) return std::u128::max_value!(); // Invalid fee protection
    let one_minus_fee = BPS_SCALE - fee_bps;

    let numerator = (spot_stable as u128) * (b as u128) * (BPS_SCALE as u128);
    let denominator = ((spot_asset - b) as u128) * (one_minus_fee as u128);
    if (denominator == 0) return std::u128::max_value!();

    (numerator + denominator - 1) / denominator // Ceiling
}

// ============================================================================
// CONDITIONAL → BID HELPERS
// ============================================================================

fun ternary_search_cond_to_bid(
    conditionals: &vector<LiquidityPool>,
    nav_price: u64,
    bid_fee_bps: u64,
    upper_bound: u64,
): (u64, u128) {
    if (upper_bound == 0) return (0, 0);

    let mut left = 0u64;
    let mut right = upper_bound;
    let mut best_b = 0u64;
    let mut best_profit = 0u128;

    while (right - left > MIN_COARSE_THRESHOLD) {
        let gap = right - left;
        let third = (gap + 2) / 3;
        let m1 = left + third;
        let m2 = right - third;

        let p1 = profit_cond_to_bid(conditionals, nav_price, bid_fee_bps, m1);
        let p2 = profit_cond_to_bid(conditionals, nav_price, bid_fee_bps, m2);

        if (p1 > best_profit) { best_profit = p1; best_b = m1; };
        if (p2 > best_profit) { best_profit = p2; best_b = m2; };

        if (p1 >= p2) { right = m2; } else { left = m1; };
    };

    let pl = profit_cond_to_bid(conditionals, nav_price, bid_fee_bps, left);
    let pr = profit_cond_to_bid(conditionals, nav_price, bid_fee_bps, right);
    if (pl > best_profit) { best_profit = pl; best_b = left; };
    if (pr > best_profit) { best_profit = pr; best_b = right; };

    (best_b, best_profit)
}

fun profit_cond_to_bid(conditionals: &vector<LiquidityPool>, nav_price: u64, bid_fee_bps: u64, b: u64): u128 {
    if (b == 0) return 0;

    // Cost WITH conditional pool fees
    let cost = calculate_conditional_cost_with_fees(conditionals, b);
    if (cost == std::u128::max_value!()) return 0;

    // Revenue after bid fee: b * nav_price / PRECISION * (1 - fee_bps/10000)
    let gross_revenue = ((b as u128) * (nav_price as u128)) / (NAV_PRECISION as u128);
    let fee = (gross_revenue * (bid_fee_bps as u128)) / (BPS_SCALE as u128);
    let revenue = gross_revenue - fee;

    if (revenue > cost) { revenue - cost } else { 0 }
}

// ============================================================================
// UTILITIES
// ============================================================================

fun apply_smart_bound(global_ub: u64, user_swap_output: u64): u64 {
    if (user_swap_output == 0) return global_ub;
    let hint_bound = (user_swap_output * SMART_BOUND_MARGIN_NUM) / SMART_BOUND_MARGIN_DENOM;
    if (hint_bound < global_ub) { hint_bound } else { global_ub }
}

fun min_u64(a: u64, b: u64): u64 { if (a < b) { a } else { b } }
fun min3_u64(a: u64, b: u64, c: u64): u64 { min_u64(min_u64(a, b), c) }

// ============================================================================
// SIMULATION (for validation and testing)
// ============================================================================

/// Calculate arbitrage profit for a specific amount and direction
/// Used for validation before execution
public fun calculate_spot_arbitrage_profit<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    arbitrage_amount: u64,
    is_spot_to_conditional: bool,
): u128 {
    if (is_spot_to_conditional) {
        // Spot → Conditional: Buy from spot, sell to conditionals
        simulate_spot_to_conditional_profit(spot, conditionals, arbitrage_amount)
    } else {
        // Conditional → Spot: Buy from conditionals, sell to spot
        simulate_conditional_to_spot_profit(spot, conditionals, arbitrage_amount)
    }
}

/// Simulate Spot → Conditional arbitrage profit
fun simulate_spot_to_conditional_profit<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    stable_input: u64,
): u128 {
    let n = vector::length(conditionals);
    if (n == 0) return 0;

    // Buy asset from spot
    let asset_from_spot = unified_spot_pool::simulate_swap_stable_to_asset(spot, stable_input);
    if (asset_from_spot == 0) return 0;

    // Sell to each conditional, find min stable out
    let mut min_stable_out = std::u64::max_value!();
    let mut i = 0;
    while (i < n) {
        let stable_out = conditional_amm::simulate_swap_asset_to_stable(
            vector::borrow(conditionals, i),
            asset_from_spot,
        );
        if (stable_out < min_stable_out) { min_stable_out = stable_out; };
        i = i + 1;
    };

    if (min_stable_out > stable_input) {
        ((min_stable_out - stable_input) as u128)
    } else {
        0
    }
}

/// Simulate Conditional → Spot arbitrage profit
public fun simulate_conditional_to_spot_profit<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    arbitrage_amount: u64,
): u128 {
    let n = vector::length(conditionals);
    if (n == 0) return 0;

    let total_cost = calculate_conditional_cost_with_fees(conditionals, arbitrage_amount);
    if (total_cost == std::u128::max_value!()) return 0;

    let (spot_asset, spot_stable) = unified_spot_pool::get_reserves(spot);
    let spot_fee_bps = unified_spot_pool::get_fee_bps(spot);
    let beta = BPS_SCALE - spot_fee_bps;

    let spot_revenue = calculate_spot_revenue_with_fees(spot_asset, spot_stable, beta, arbitrage_amount);
    if (spot_revenue > total_cost) { spot_revenue - total_cost } else { 0 }
}

fun calculate_conditional_cost_with_fees(conditionals: &vector<LiquidityPool>, b: u64): u128 {
    let n = vector::length(conditionals);
    let mut max_cost = 0u128;

    let mut i = 0;
    while (i < n) {
        let cond = vector::borrow(conditionals, i);
        let (cond_asset, cond_stable) = conditional_amm::get_reserves(cond);
        let cond_fee_bps = conditional_amm::get_fee_bps(cond);

        if (b >= cond_asset) return std::u128::max_value!();
        assert!(cond_fee_bps <= BPS_SCALE, EInvalidFee);
        let alpha = BPS_SCALE - cond_fee_bps;

        let numer = (cond_stable as u256) * (b as u256) * (BPS_SCALE as u256);
        let denom = ((cond_asset - b) as u256) * (alpha as u256);
        if (denom == 0) return std::u128::max_value!();

        let cost_i = numer / denom;
        let cost_i_u128 = if (cost_i > (std::u128::max_value!() as u256)) {
            std::u128::max_value!()
        } else {
            (cost_i as u128)
        };

        if (cost_i_u128 > max_cost) { max_cost = cost_i_u128; };
        i = i + 1;
    };

    max_cost
}

fun calculate_spot_revenue_with_fees(spot_asset: u64, spot_stable: u64, beta: u64, b: u64): u128 {
    let b_beta = (b as u256) * (beta as u256);
    let numer = (spot_stable as u256) * b_beta;
    let denom = (spot_asset as u256) * (BPS_SCALE as u256) + b_beta;
    if (denom == 0) return 0;
    let result = numer / denom;
    if (result > (std::u128::max_value!() as u256)) { std::u128::max_value!() } else { (result as u128) }
}

// ============================================================================
// ROUTING OPTIMIZATION - MAXIMIZE USER OUTPUT
// ============================================================================

/// Find optimal routing for stable→asset swap to maximize asset output
public fun compute_optimal_route_stable_to_asset<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    stable_input: u64,
): (u64, u64) {
    let outcome_count = vector::length(conditionals);
    if (outcome_count == 0) {
        let asset_out = unified_spot_pool::simulate_swap_stable_to_asset(spot, stable_input);
        return (0, asset_out)
    };

    let direct_output = unified_spot_pool::simulate_swap_stable_to_asset(spot, stable_input);
    let routed_output = simulate_full_route_stable_to_asset(spot, conditionals, stable_input);

    if (routed_output <= direct_output) return (0, direct_output);

    ternary_search_routing_stable_to_asset(spot, conditionals, stable_input)
}

/// Find optimal routing for asset→stable swap to maximize stable output
public fun compute_optimal_route_asset_to_stable<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    asset_input: u64,
): (u64, u64) {
    let outcome_count = vector::length(conditionals);
    if (outcome_count == 0) {
        let stable_out = unified_spot_pool::simulate_swap_asset_to_stable(spot, asset_input);
        return (0, stable_out)
    };

    let direct_output = unified_spot_pool::simulate_swap_asset_to_stable(spot, asset_input);
    let routed_output = simulate_full_route_asset_to_stable(spot, conditionals, asset_input);

    if (routed_output <= direct_output) return (0, direct_output);

    ternary_search_routing_asset_to_stable(spot, conditionals, asset_input)
}

fun simulate_full_route_stable_to_asset<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    stable_input: u64,
): u64 {
    let asset_from_spot = unified_spot_pool::simulate_swap_stable_to_asset(spot, stable_input);
    if (asset_from_spot == 0) return 0;

    let mut min_stable = std::u64::max_value!();
    let n = vector::length(conditionals);
    let mut i = 0;
    while (i < n) {
        let stable_out = conditional_amm::quote_swap_asset_to_stable(vector::borrow(conditionals, i), asset_from_spot);
        if (stable_out < min_stable) { min_stable = stable_out; };
        i = i + 1;
    };

    if (min_stable == 0) return 0;
    unified_spot_pool::simulate_swap_stable_to_asset(spot, min_stable)
}

fun simulate_full_route_asset_to_stable<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    asset_input: u64,
): u64 {
    let stable_from_spot = unified_spot_pool::simulate_swap_asset_to_stable(spot, asset_input);
    if (stable_from_spot == 0) return 0;

    let mut min_asset = std::u64::max_value!();
    let n = vector::length(conditionals);
    let mut i = 0;
    while (i < n) {
        let asset_out = conditional_amm::quote_swap_stable_to_asset(vector::borrow(conditionals, i), stable_from_spot);
        if (asset_out < min_asset) { min_asset = asset_out; };
        i = i + 1;
    };

    if (min_asset == 0) return 0;
    unified_spot_pool::simulate_swap_asset_to_stable(spot, min_asset)
}

fun ternary_search_routing_stable_to_asset<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    stable_input: u64,
): (u64, u64) {
    let mut left = 0u64;
    let mut right = stable_input;
    let threshold = if (stable_input / 100 > 3) { stable_input / 100 } else { 3 };

    let mut best_routed = 0u64;
    let mut best_output = 0u64;

    while (right - left > threshold) {
        let third = (right - left) / 3;
        if (third == 0) break;

        let m1 = left + third;
        let m2 = right - third;

        let o1 = eval_split_stable_to_asset(spot, conditionals, stable_input, m1);
        let o2 = eval_split_stable_to_asset(spot, conditionals, stable_input, m2);

        if (o1 > best_output) { best_output = o1; best_routed = m1; };
        if (o2 > best_output) { best_output = o2; best_routed = m2; };

        if (o1 >= o2) { right = m2; } else { left = m1; };
    };

    let ol = eval_split_stable_to_asset(spot, conditionals, stable_input, left);
    let or = eval_split_stable_to_asset(spot, conditionals, stable_input, right);
    if (ol > best_output) { best_output = ol; best_routed = left; };
    if (or > best_output) { best_output = or; best_routed = right; };

    (best_routed, best_output)
}

fun ternary_search_routing_asset_to_stable<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    asset_input: u64,
): (u64, u64) {
    let mut left = 0u64;
    let mut right = asset_input;
    let threshold = if (asset_input / 100 > 3) { asset_input / 100 } else { 3 };

    let mut best_routed = 0u64;
    let mut best_output = 0u64;

    while (right - left > threshold) {
        let third = (right - left) / 3;
        if (third == 0) break;

        let m1 = left + third;
        let m2 = right - third;

        let o1 = eval_split_asset_to_stable(spot, conditionals, asset_input, m1);
        let o2 = eval_split_asset_to_stable(spot, conditionals, asset_input, m2);

        if (o1 > best_output) { best_output = o1; best_routed = m1; };
        if (o2 > best_output) { best_output = o2; best_routed = m2; };

        if (o1 >= o2) { right = m2; } else { left = m1; };
    };

    let ol = eval_split_asset_to_stable(spot, conditionals, asset_input, left);
    let or = eval_split_asset_to_stable(spot, conditionals, asset_input, right);
    if (ol > best_output) { best_output = ol; best_routed = left; };
    if (or > best_output) { best_output = or; best_routed = right; };

    (best_routed, best_output)
}

fun eval_split_stable_to_asset<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    total: u64,
    routed: u64,
): u64 {
    if (routed > total) return 0;
    let direct = total - routed;
    let direct_out = if (direct > 0) { unified_spot_pool::simulate_swap_stable_to_asset(spot, direct) } else { 0 };
    let routed_out = if (routed > 0) { simulate_full_route_stable_to_asset(spot, conditionals, routed) } else { 0 };
    direct_out + routed_out
}

fun eval_split_asset_to_stable<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    conditionals: &vector<LiquidityPool>,
    total: u64,
    routed: u64,
): u64 {
    if (routed > total) return 0;
    let direct = total - routed;
    let direct_out = if (direct > 0) { unified_spot_pool::simulate_swap_asset_to_stable(spot, direct) } else { 0 };
    let routed_out = if (routed > 0) { simulate_full_route_asset_to_stable(spot, conditionals, routed) } else { 0 };
    direct_out + routed_out
}

// ============================================================================
// TEST HELPERS
// ============================================================================

#[test_only]
public fun test_compute_spot_to_bid<AssetType, StableType, LPType>(
    spot: &UnifiedSpotPool<AssetType, StableType, LPType>,
    nav_price: u64,
    max_bid_tokens: u64,
    bid_fee_bps: u64,
): (u64, u128) {
    compute_spot_to_bid(spot, nav_price, max_bid_tokens, bid_fee_bps)
}

#[test_only]
public fun test_compute_conditional_to_bid(
    conditionals: &vector<LiquidityPool>,
    nav_price: u64,
    max_bid_tokens: u64,
    bid_fee_bps: u64,
): (u64, u128) {
    compute_conditional_to_bid(conditionals, nav_price, max_bid_tokens, bid_fee_bps)
}

#[test_only]
public fun test_build_tab_constants(
    spot_asset: u64,
    spot_stable: u64,
    conditionals: &vector<LiquidityPool>,
): (vector<u128>, vector<u128>, vector<u128>) {
    build_tab_constants(spot_asset, spot_stable, conditionals)
}

// Alias for test compatibility
#[test_only]
public fun test_only_build_tab_constants(
    spot_asset: u64,
    spot_stable: u64,
    _fee_bps: u64, // Legacy parameter, ignored
    conditionals: &vector<LiquidityPool>,
): (vector<u128>, vector<u128>, vector<u128>) {
    build_tab_constants(spot_asset, spot_stable, conditionals)
}

#[test_only]
public fun test_profit_at_b(ts: &vector<u128>, as_vals: &vector<u128>, bs: &vector<u128>, b: u64): u128 {
    profit_at_b(ts, as_vals, bs, b)
}

#[test_only]
public fun test_optimal_b_search(ts: &vector<u128>, as_vals: &vector<u128>, bs: &vector<u128>): (u64, u128) {
    let ub = upper_bound_b(ts, bs);
    optimal_b_search(ts, as_vals, bs, ub)
}

#[test_only]
public fun test_upper_bound_b(ts: &vector<u128>, bs: &vector<u128>): u64 {
    upper_bound_b(ts, bs)
}

// Aliases for test compatibility (same as above)
#[test_only]
public fun test_only_upper_bound_b(ts: &vector<u128>, bs: &vector<u128>): u64 {
    upper_bound_b(ts, bs)
}

#[test_only]
public fun test_x_required_for_b(ts: &vector<u128>, as_vals: &vector<u128>, bs: &vector<u128>, b: u64): u64 {
    x_required_for_b(ts, as_vals, bs, b)
}

#[test_only]
public fun test_only_x_required_for_b(ts: &vector<u128>, as_vals: &vector<u128>, bs: &vector<u128>, b: u64): u64 {
    x_required_for_b(ts, as_vals, bs, b)
}

#[test_only]
public fun test_only_optimal_b_search(ts: &vector<u128>, as_vals: &vector<u128>, bs: &vector<u128>): (u64, u128) {
    let ub = upper_bound_b(ts, bs);
    optimal_b_search(ts, as_vals, bs, ub)
}

#[test_only]
public fun test_only_profit_at_b(ts: &vector<u128>, as_vals: &vector<u128>, bs: &vector<u128>, b: u64): u128 {
    profit_at_b(ts, as_vals, bs, b)
}

#[test_only]
public fun test_calculate_spot_revenue(spot_asset: u64, spot_stable: u64, b: u64): u128 {
    calculate_spot_revenue(spot_asset, spot_stable, b)
}
