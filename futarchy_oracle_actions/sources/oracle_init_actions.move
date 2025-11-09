// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for oracle grant operations.
/// These can be staged in intents for proposals or launchpad initialization.
module futarchy_oracle::oracle_init_actions;

use std::string::String;
use sui::bcs;
use std::type_name;
use account_protocol::intents;

// === Layer 1: Action Structs ===

/// Recipient allocation for a grant tier
public struct RecipientMint has store, copy, drop {
    recipient: address,
    amount: u64,
}

/// Tier specification for oracle grant creation
public struct TierSpec has store, drop, copy {
    price_threshold: u128,
    is_above: bool,
    recipients: vector<RecipientMint>,
    tier_description: String,
}

/// Action to create an oracle grant with price-based unlocks
public struct CreateOracleGrantAction<phantom AssetType, phantom StableType> has store, drop, copy {
    tier_specs: vector<TierSpec>,
    use_relative_pricing: bool,
    launchpad_multiplier: u64,
    earliest_execution_offset_ms: u64,
    expiry_years: u64,
    cancelable: bool,
    description: String,
}

/// Action to cancel an existing oracle grant
/// The grant object is passed as a shared object parameter in the PTB
public struct CancelGrantAction has store, drop, copy {
    grant_id: ID,
}

// === Layer 2: Spec Builder Functions ===

/// Helper: Create a recipient mint allocation
public fun new_recipient_mint(recipient: address, amount: u64): RecipientMint {
    RecipientMint { recipient, amount }
}

/// Helper: Create a tier specification
public fun new_tier_spec(
    price_threshold: u128,
    is_above: bool,
    recipients: vector<RecipientMint>,
    tier_description: String,
): TierSpec {
    TierSpec {
        price_threshold,
        is_above,
        recipients,
        tier_description,
    }
}

/// Add create oracle grant action to the spec builder
/// Creates a grant with N tiers, each with price conditions and recipient allocations
public fun add_create_oracle_grant_spec<AssetType, StableType>(
    builder: &mut account_actions::action_spec_builder::Builder,
    tier_specs: vector<TierSpec>,
    use_relative_pricing: bool,
    launchpad_multiplier: u64,
    earliest_execution_offset_ms: u64,
    expiry_years: u64,
    cancelable: bool,
    description: String,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = CreateOracleGrantAction<AssetType, StableType> {
        tier_specs,
        use_relative_pricing,
        launchpad_multiplier,
        earliest_execution_offset_ms,
        expiry_years,
        cancelable,
        description,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_oracle::oracle_actions::CreateOracleGrant>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}

/// Add cancel grant action to the spec builder
/// Cancels an existing oracle grant (must be cancelable)
public fun add_cancel_grant_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    grant_id: ID,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = CancelGrantAction {
        grant_id,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_oracle::oracle_actions::CancelGrant>(),
        action_data,
        1
    );
    builder_mod::add(builder, action_spec);
}
