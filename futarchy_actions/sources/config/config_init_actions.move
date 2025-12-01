// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Layer 1 & 2: Action structs and spec builders for configuration operations.
/// These can be staged in intents for proposals.
module futarchy_actions::config_init_actions;

use account_protocol::intents;
use futarchy_core::dao_config;
use futarchy_types::signed::SignedU128;
use std::ascii::String as AsciiString;
use std::option::Option;
use std::string::String;
use std::type_name;
use std::vector;
use sui::bcs;
use sui::url::Url;

// === Layer 1: Action Structs ===

/// Action to enable or disable proposals
public struct SetProposalsEnabledAction has copy, drop, store {
    enabled: bool,
}

/// Action to permanently terminate the DAO
public struct TerminateDaoAction has copy, drop, store {
    reason: String,
    dissolution_unlock_delay_ms: u64,
}

/// Action to update the DAO name
public struct UpdateNameAction has copy, drop, store {
    new_name: String,
}

/// Trading parameters update action
public struct TradingParamsUpdateAction has copy, drop, store {
    min_asset_amount: Option<u64>,
    min_stable_amount: Option<u64>,
    review_period_ms: Option<u64>,
    trading_period_ms: Option<u64>,
    amm_total_fee_bps: Option<u64>,
}

/// DAO metadata update action
public struct MetadataUpdateAction has copy, drop, store {
    dao_name: Option<AsciiString>,
    icon_url: Option<Url>,
    description: Option<String>,
}

/// TWAP configuration update action
public struct TwapConfigUpdateAction has copy, drop, store {
    start_delay: Option<u64>,
    step_max: Option<u64>,
    initial_observation: Option<u128>,
    threshold: Option<SignedU128>,
}

/// Governance settings update action
public struct GovernanceUpdateAction has copy, drop, store {
    max_outcomes: Option<u64>,
    max_actions_per_outcome: Option<u64>,
    required_bond_amount: Option<u64>,
    max_intents_per_outcome: Option<u64>,
    proposal_intent_expiry_ms: Option<u64>,
    optimistic_challenge_fee: Option<u64>,
    optimistic_challenge_period_ms: Option<u64>,
    proposal_creation_fee: Option<u64>,
    proposal_fee_per_outcome: Option<u64>,
    accept_new_proposals: Option<bool>,
    enable_premarket_reservation_lock: Option<bool>,
    show_proposal_details: Option<bool>,
}

/// Metadata table update action
public struct MetadataTableUpdateAction has copy, drop, store {
    keys: vector<String>,
    values: vector<String>,
    keys_to_remove: vector<String>,
}

/// Conditional metadata configuration update action
public struct ConditionalMetadataUpdateAction has copy, drop, store {
    use_outcome_index: Option<bool>,
    conditional_metadata: Option<Option<dao_config::ConditionalMetadata>>,
}

/// Sponsorship configuration update action
public struct SponsorshipConfigUpdateAction has copy, drop, store {
    enabled: Option<bool>,
    sponsored_threshold: Option<SignedU128>,
    waive_advancement_fees: Option<bool>,
    default_sponsor_quota_amount: Option<u64>,
}

// === Layer 2: Spec Builder Functions ===

/// Add set proposals enabled action to the spec builder
public fun add_set_proposals_enabled_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    enabled: bool,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = SetProposalsEnabledAction { enabled };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::SetProposalsEnabled>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add terminate DAO action to the spec builder
public fun add_terminate_dao_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    reason: String,
    dissolution_unlock_delay_ms: u64,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = TerminateDaoAction {
        reason,
        dissolution_unlock_delay_ms,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::TerminateDao>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add update name action to the spec builder
public fun add_update_name_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    new_name: String,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = UpdateNameAction { new_name };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::UpdateName>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add trading params update action to the spec builder
public fun add_update_trading_params_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    min_asset_amount: Option<u64>,
    min_stable_amount: Option<u64>,
    review_period_ms: Option<u64>,
    trading_period_ms: Option<u64>,
    amm_total_fee_bps: Option<u64>,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = TradingParamsUpdateAction {
        min_asset_amount,
        min_stable_amount,
        review_period_ms,
        trading_period_ms,
        amm_total_fee_bps,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::TradingParamsUpdate>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add metadata update action to the spec builder
public fun add_update_metadata_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    dao_name: Option<AsciiString>,
    icon_url: Option<Url>,
    description: Option<String>,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = MetadataUpdateAction {
        dao_name,
        icon_url,
        description,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::MetadataUpdate>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add TWAP config update action to the spec builder
public fun add_update_twap_config_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    start_delay: Option<u64>,
    step_max: Option<u64>,
    initial_observation: Option<u128>,
    threshold: Option<SignedU128>,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = TwapConfigUpdateAction {
        start_delay,
        step_max,
        initial_observation,
        threshold,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::TwapConfigUpdate>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add governance update action to the spec builder
public fun add_update_governance_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    max_outcomes: Option<u64>,
    max_actions_per_outcome: Option<u64>,
    required_bond_amount: Option<u64>,
    max_intents_per_outcome: Option<u64>,
    proposal_intent_expiry_ms: Option<u64>,
    optimistic_challenge_fee: Option<u64>,
    optimistic_challenge_period_ms: Option<u64>,
    proposal_creation_fee: Option<u64>,
    proposal_fee_per_outcome: Option<u64>,
    accept_new_proposals: Option<bool>,
    enable_premarket_reservation_lock: Option<bool>,
    show_proposal_details: Option<bool>,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = GovernanceUpdateAction {
        max_outcomes,
        max_actions_per_outcome,
        required_bond_amount,
        max_intents_per_outcome,
        proposal_intent_expiry_ms,
        optimistic_challenge_fee,
        optimistic_challenge_period_ms,
        proposal_creation_fee,
        proposal_fee_per_outcome,
        accept_new_proposals,
        enable_premarket_reservation_lock,
        show_proposal_details,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::GovernanceUpdate>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add metadata table update action to the spec builder
public fun add_update_metadata_table_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    keys: vector<String>,
    values: vector<String>,
    keys_to_remove: vector<String>,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = MetadataTableUpdateAction {
        keys,
        values,
        keys_to_remove,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::MetadataTableUpdate>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add conditional metadata update action to the spec builder
public fun add_update_conditional_metadata_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    use_outcome_index: Option<bool>,
    conditional_metadata: Option<Option<dao_config::ConditionalMetadata>>,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = ConditionalMetadataUpdateAction {
        use_outcome_index,
        conditional_metadata,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::UpdateConditionalMetadata>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}

/// Add sponsorship config update action to the spec builder
public fun add_update_sponsorship_config_spec(
    builder: &mut account_actions::action_spec_builder::Builder,
    enabled: Option<bool>,
    sponsored_threshold: Option<SignedU128>,
    waive_advancement_fees: Option<bool>,
    default_sponsor_quota_amount: Option<u64>,
) {
    use account_actions::action_spec_builder as builder_mod;

    let action = SponsorshipConfigUpdateAction {
        enabled,
        sponsored_threshold,
        waive_advancement_fees,
        default_sponsor_quota_amount,
    };
    let action_data = bcs::to_bytes(&action);
    let action_spec = intents::new_action_spec_with_typename(
        type_name::with_defining_ids<futarchy_actions::config_actions::SponsorshipConfigUpdate>(),
        action_data,
        1,
    );
    builder_mod::add(builder, action_spec);
}
