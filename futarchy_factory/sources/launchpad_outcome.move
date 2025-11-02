// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Outcome type for launchpad initialization intents
///
/// When a raise completes successfully, intents with LaunchpadOutcome
/// become approved and can be executed by keepers.
module futarchy_factory::launchpad_outcome;

use sui::object::ID;

/// Outcome type for launchpad initialization intents
/// Approval is determined by raise.state == STATE_SUCCESSFUL
public struct LaunchpadOutcome has copy, drop, store {
    raise_id: ID,
}

// === Constructors ===

public fun new(raise_id: ID): LaunchpadOutcome {
    LaunchpadOutcome { raise_id }
}

// === Getters ===

public fun raise_id(outcome: &LaunchpadOutcome): ID {
    outcome.raise_id
}

// Note: Validation function is_approved() is in launchpad.move to avoid circular dependency
