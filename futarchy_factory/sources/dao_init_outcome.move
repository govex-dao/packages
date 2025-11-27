// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Generic outcome type for DAO initialization intents.
///
/// Used by both launchpad and factory for bootstrapping DAOs with init actions.
/// The outcome ties to an account_id and optionally a source_id (e.g., raise_id for launchpad).
module futarchy_factory::dao_init_outcome;

/// Outcome type for DAO initialization intents
/// Works for both launchpad (with raise_id) and factory (without)
public struct DaoInitOutcome has copy, drop, store {
    /// The DAO account this outcome is for
    account_id: ID,
    /// Optional source ID (e.g., raise_id for launchpad, none for factory)
    source_id: Option<ID>,
}

// === Constructors ===

/// Create outcome for launchpad (with raise_id)
public fun new_for_launchpad(account_id: ID, raise_id: ID): DaoInitOutcome {
    DaoInitOutcome {
        account_id,
        source_id: option::some(raise_id),
    }
}

/// Create outcome for factory (no source)
public fun new_for_factory(account_id: ID): DaoInitOutcome {
    DaoInitOutcome {
        account_id,
        source_id: option::none(),
    }
}

// === Getters ===

public fun account_id(outcome: &DaoInitOutcome): ID {
    outcome.account_id
}

public fun source_id(outcome: &DaoInitOutcome): &Option<ID> {
    &outcome.source_id
}

/// Check if this outcome is for a specific raise (for launchpad validation)
public fun is_for_raise(outcome: &DaoInitOutcome, raise_id: ID): bool {
    if (outcome.source_id.is_some()) {
        *outcome.source_id.borrow() == raise_id
    } else {
        false
    }
}
