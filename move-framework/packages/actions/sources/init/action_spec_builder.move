// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// PTB helper for building vector<ActionSpec> in programmable transactions
///
/// This module provides a wrapper object that can be created, mutated, and consumed
/// in PTBs (Programmable Transaction Blocks). The builder pattern is necessary because
/// raw vectors cannot be directly created in PTBs.
///
/// NOTE: This is ONLY for PTB construction. Storage everywhere uses vector<ActionSpec> directly.
module account_actions::action_spec_builder;

use account_protocol::intents::ActionSpec;
use std::vector;

/// Builder wrapper for constructing vector<ActionSpec> in PTBs
/// This has drop so it can be consumed by into_vector()
public struct Builder has copy, drop {
    specs: vector<ActionSpec>,
}

/// Create a new empty builder for PTB construction
public fun new(): Builder {
    Builder { specs: vector::empty() }
}

/// Add an ActionSpec to the builder (used by helper functions)
public fun add(builder: &mut Builder, spec: ActionSpec) {
    vector::push_back(&mut builder.specs, spec);
}

/// Consume the builder and extract the vector<ActionSpec>
/// This is used at the end of PTB construction to pass to stage functions
public fun into_vector(builder: Builder): vector<ActionSpec> {
    let Builder { specs } = builder;
    specs
}

/// Get the number of specs in the builder
public fun length(builder: &Builder): u64 {
    vector::length(&builder.specs)
}

/// Check if the builder is empty
public fun is_empty(builder: &Builder): bool {
    vector::is_empty(&builder.specs)
}
