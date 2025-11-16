// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for quota management operations.
/// These can be staged in intents for proposals.
module futarchy_actions::quota_init_actions;

use account_protocol::intents;
use std::type_name;
use std::vector;
use sui::bcs;

// === Layer 1: Action Structs ===

/// Action to set quotas for multiple addresses (batch operation)
/// Set quota_amount to 0 to remove quotas
public struct SetQuotasAction has drop, store {
    /// Addresses to set quota for
    users: vector<address>,
    /// N proposals per period (0 to remove)
    quota_amount: u64,
    /// Period in milliseconds (e.g., 30 days = 2_592_000_000)
    quota_period_ms: u64,
    /// Reduced fee (0 for free, ignored if removing)
    reduced_fee: u64,
    /// N sponsorships per period (0 to disable sponsorship for these users)
    sponsor_quota_amount: u64,
}

// === Layer 2: Spec Builder Functions ===

/// Add set quotas action to the spec builder
/// Allows batch setting of proposal quotas for multiple addresses
public fun add_set_quotas_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    users: vector<address>,
    quota_amount: u64,
    quota_period_ms: u64,
    reduced_fee: u64,
    sponsor_quota_amount: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = SetQuotasAction {
        users,
        quota_amount,
        quota_period_ms,
        reduced_fee,
        sponsor_quota_amount,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::quota_actions::SetQuotas>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}
