# Init Action Staging Guide (Disclosure-Only Pattern)

## Overview

This guide explains how to stage init actions for investor transparency in the launchpad system.

**CRITICAL**: InitActionSpecs are **DISCLOSURE ONLY**. They do NOT auto-execute. Execution happens via manual PTB calls.

## The Disclosure-Only Pattern

### What It Is

InitActionSpecs serve two purposes:
1. **Transparency**: Investors see what will happen during DAO creation
2. **Disclosure**: Actions are stored on-chain BEFORE the raise completes

### What It Is NOT

- ❌ NOT auto-executed (no dispatcher/router)
- ❌ NOT Intent-based (different from governance actions)
- ❌ NOT validated against PackageRegistry at storage time

### How It Works

```
STEP 1 (Staging - Disclosure):
  Creator → build_stream_init_spec(...) → InitActionSpecs → stored in Raise
  Purpose: Investors see what will happen

STEP 2 (Funding):
  Investors → contribute knowing what init actions are staged

STEP 3 (Execution - Manual PTB):
  Frontend → init_actions::init_create_stream(...) → Stream created
  Purpose: Actual execution via direct function call
```

## Why This Pattern?

### SDK Limitation

TypeScript/Sui SDK cannot construct complex Move structs like `InitActionSpecs` with nested `TypeName`. We build them in Move instead.

### No Dispatcher

Unlike governance actions (Intents), init actions don't have a dispatcher that routes `action_type` to handlers. The `action_type` is just a label for identification.

### Solution

Build `InitActionSpecs` in Move (for transparency) → Execute manually in PTBs (for actual work)

## Architecture

```
futarchy_actions/sources/
├── vault/
│   └── vault_init_staging.move       # Vault init action builders
├── config/
│   └── config_init_staging.move      # Config init action builders (TODO)
├── liquidity/
│   └── liquidity_init_staging.move   # Liquidity init action builders (TODO)
└── ... (other domains)
```

## How to Add Init Action Staging

### Step 1: Identify Init Actions in Your Domain

Look in `account_actions::init_actions` for functions starting with `init_*`:

```move
// Example from init_actions.move
public fun init_lock_treasury_cap<Config: store, CoinType>(
    account: &mut Account,
    registry: &PackageRegistry,
    cap: TreasuryCap<CoinType>,
) { ... }
```

### Step 2: Create Domain Module

Create `{domain}_init_staging.move` in the appropriate directory:

```move
module futarchy_actions::{domain}_init_staging;

use futarchy_types::init_action_specs::{Self, InitActionSpecs};
use std::type_name;
use sui::bcs;
```

### Step 3: Define Data Struct

Create a struct matching the init action parameters (excluding `account`, `registry`, `ctx` which are provided during execution):

```move
/// Data struct matching init_lock_treasury_cap parameters
public struct LockTreasuryCapInitData has drop, copy, store {
    // NOTE: TreasuryCap<CoinType> cannot be serialized
    // This is for staging/disclosure only - cap passed during execution
}
```

**Important Notes:**
- Exclude execution-only parameters: `account`, `registry`, `ctx`, `clock`
- Objects (`Coin<T>`, `TreasuryCap<T>`, etc.) cannot be serialized - note this in comments
- Only include disclosure-worthy parameters (amounts, addresses, timestamps, etc.)

### Step 4: Define Marker Struct

Create a marker struct for TypeName identity:

```move
/// Marker struct for init_lock_treasury_cap action type
public struct LockTreasuryCapInitMarker has drop {}
```

### Step 5: Create Builder Function

Write a public function that constructs `InitActionSpecs`:

```move
/// Build InitActionSpecs for treasury cap locking init action
///
/// This allows investors to see that a treasury cap will be locked during DAO initialization.
/// The actual locking happens in PTB execution by calling init_lock_treasury_cap.
public fun build_lock_treasury_cap_init_spec(
    // Include only serializable, disclosure-worthy parameters
): InitActionSpecs {
    // 1. Create data struct
    let data = LockTreasuryCapInitData {
        // ... fields
    };

    // 2. Serialize to BCS bytes
    let action_data = bcs::to_bytes(&data);

    // 3. Get TypeName for marker
    let action_type = type_name::get<LockTreasuryCapInitMarker>();

    // 4. Build InitActionSpecs
    let mut specs = init_action_specs::new_init_specs();
    init_action_specs::add_action(&mut specs, action_type, action_data);
    specs
}
```

## Usage Pattern

### From Launchpad (Move)

```move
use futarchy_actions::vault_init_staging;

// Before raise starts, stage init actions for transparency
let specs = vault_init_staging::build_stream_init_spec(
    string::utf8(b"treasury"),
    @0xBENEFICIARY,
    1_000_000,
    start_time,
    end_time,
    option::none(),
    100_000,
    86400000,
    1,
);

launchpad::stage_launchpad_init_intent(
    raise,
    registry,
    creator_cap,
    specs,
    clock,
    ctx
);
```

### From TypeScript SDK

```typescript
// SDK wrapper calls the Move helper
const stageTx = new Transaction();
stageTx.moveCall({
    target: `${futarchyActionsPkg}::vault_init_staging::build_stream_init_spec`,
    arguments: [
        stageTx.pure.string('treasury'),
        stageTx.pure.address(beneficiary),
        stageTx.pure.u64(totalAmount),
        // ... other params
    ],
});

// Returns InitActionSpecs, then pass to stage_launchpad_init_intent
stageTx.moveCall({
    target: `${launchpadPkg}::launchpad::stage_launchpad_init_intent`,
    typeArguments: [assetType, stableType],
    arguments: [
        stageTx.object(raiseId),
        stageTx.object(registryId),
        stageTx.object(creatorCapId),
        /* result from build_stream_init_spec */,
        stageTx.object('0x6'), // clock
    ],
});
```

## Complete Example: Currency Init Actions

```move
// futarchy_actions/sources/currency/currency_init_staging.move
module futarchy_actions::currency_init_staging;

use futarchy_types::init_action_specs::{Self, InitActionSpecs};
use std::type_name;
use sui::bcs;

// === Data Structs ===

public struct MintInitData has drop, copy, store {
    amount: u64,
    recipient: address,
}

public struct LockTreasuryCapInitData has drop, copy, store {
    // TreasuryCap passed during execution, not serializable
}

// === Markers ===

public struct MintInitMarker has drop {}
public struct LockTreasuryCapInitMarker has drop {}

// === Builders ===

public fun build_mint_init_spec(
    amount: u64,
    recipient: address,
): InitActionSpecs {
    let data = MintInitData { amount, recipient };
    let action_data = bcs::to_bytes(&data);
    let action_type = type_name::get<MintInitMarker>();

    let mut specs = init_action_specs::new_init_specs();
    init_action_specs::add_action(&mut specs, action_type, action_data);
    specs
}

public fun build_lock_treasury_cap_init_spec(): InitActionSpecs {
    let data = LockTreasuryCapInitData {};
    let action_data = bcs::to_bytes(&data);
    let action_type = type_name::get<LockTreasuryCapInitMarker>();

    let mut specs = init_action_specs::new_init_specs();
    init_action_specs::add_action(&mut specs, action_type, action_data);
    specs
}
```

## Domains to Implement

Based on `account_actions::init_actions`:

- ✅ **Vault** (`vault_init_staging.move`) - DONE
  - `init_vault_deposit`
  - `init_create_stream`

- ⏳ **Currency** (`currency_init_staging.move`) - TODO
  - `init_lock_treasury_cap`
  - `init_mint`
  - `init_mint_to_coin`

- ⏳ **Access Control** (`access_control_init_staging.move`) - TODO
  - `init_lock_cap`

- ⏳ **Owned** (`owned_init_staging.move`) - TODO
  - `init_store_object`

For futarchy-specific init actions in `futarchy_actions`:

- ⏳ **Liquidity** (`liquidity_init_staging.move`) - TODO
  - Check `liquidity_init_actions.move` for init functions

## Testing

Each staging module should have corresponding tests in `tests/`:

```move
#[test_only]
module futarchy_actions::vault_init_staging_tests;

use futarchy_actions::vault_init_staging;
use futarchy_types::init_action_specs;

#[test]
fun test_build_stream_init_spec() {
    let specs = vault_init_staging::build_stream_init_spec(
        string::utf8(b"treasury"),
        @0xBENEFICIARY,
        1_000_000,
        0,
        3600000,
        option::none(),
        100_000,
        86400000,
        1,
    );

    assert!(init_action_specs::action_count(&specs) == 1, 0);
}
```

## Relationship to Execution (CRITICAL UNDERSTANDING)

### Two Separate Steps

**STEP 1: Staging** (Disclosure for Transparency)
```move
// BEFORE raise starts - so investors can review
vault_init_staging::build_stream_init_spec(
    vault_name: "treasury",
    beneficiary: 0xABC...,
    total_amount: 1_000_000,
    ...
) → InitActionSpecs → stored in Raise.staged_init_specs
```
- Purpose: **Transparency only**
- When: Before funding starts
- Who sees it: Potential investors
- What it does: **NOTHING** (just stores data)

**STEP 2: Execution** (Manual PTB Call)
```move
// AFTER raise completes - during DAO creation PTB
account_actions::init_actions::init_create_stream(
    account: &mut Account,      // Unshared Account from begin_dao_creation
    registry: &PackageRegistry,
    vault_name: "treasury",     // Same params as staged
    beneficiary: 0xABC...,
    total_amount: 1_000_000,
    ...
    clock: &Clock,
) → creates Stream object (ACTUAL WORK HAPPENS HERE)
```
- Purpose: **Actually creates the stream**
- When: During DAO creation (Step 8 in E2E)
- Who does it: Frontend PTB
- What it does: **EVERYTHING** (real execution)

### Key Points

1. **Staging does NOT execute** - it only discloses
2. **Execution is manual** - you must call the init function in your PTB
3. **Parameters should match** - but there's no automatic enforcement
4. **No dispatcher exists** - InitActionSpecs are informational only

### Why Keep Them Separate?

- **Security**: Explicit execution is clearer than auto-dispatch
- **Flexibility**: Can adjust parameters at execution time if needed
- **Simplicity**: No complex dispatcher/router needed
- **Transparency**: Investors see intent, execution is still manual/auditable

## Benefits

1. **Transparency**: Investors see all init actions before funding
2. **Type Safety**: Move constructs complex structs (avoids SDK limitation)
3. **Reusability**: Any package can use these builders
4. **Scalability**: Each domain manages its own staging helpers
5. **Maintainability**: Co-located with execution functions by domain
