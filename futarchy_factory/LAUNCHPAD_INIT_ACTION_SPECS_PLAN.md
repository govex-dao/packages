# Launchpad with InitActionSpecs - Reusing Proven Patterns

**Status:** Planning Complete
**Approach:** Reuse proposal's InitActionSpecs pattern
**Estimated Time:** 1-2 days
**Complexity:** LOW - Pattern already proven in proposals

---

## Executive Summary

### The Insight
Launchpad is like a proposal with ONE outcome. Proposals already use InitActionSpecs successfully. We should reuse that exact pattern.

### The Solution
```move
// Proposals (multiple alternatives)
intent_specs: vector<Option<InitActionSpecs>>  // One per outcome

// Launchpad (single set)
init_specs: InitActionSpecs  // Just one
```

### Key Benefits
✅ **Proven Pattern** - Already works in proposals
✅ **Zero New Concepts** - Reuse existing infrastructure
✅ **Simple** - No lock mechanism needed
✅ **Generic** - Works with ANY action type
✅ **JIT Conversion** - Atomic specs → Intent conversion

---

## Pattern Comparison

### Proposals Flow (REFERENCE)
```
1. Create Proposal
   └─ Store InitActionSpecs per outcome
      ├─ outcome_specs[0] = Some(YES actions)
      └─ outcome_specs[1] = Some(NO actions)

2. Market Resolves → YES wins

3. finalize_proposal_market()
   ├─ Delete losing outcome specs (NO)
   └─ Keep winning outcome spec (YES)

4. User creates Intent from winning spec
   └─ build_intent!(account, spec, outcome, ...)

5. Execute Intent
   └─ Keeper calls executors
```

### Launchpad Flow (NEW - SAME PATTERN!)
```
1. Create Raise
   └─ Store InitActionSpecs (ONE set)
      └─ init_specs = CreateStreamAction + CreatePoolAction + ...

2. Raise Completes → SUCCESS

3. complete_raise()
   ├─ Create Intent from specs (JIT conversion!)
   └─ Intent stored in Account

4. Execute Intent
   └─ Keeper calls executors
```

**Key Difference:** Proposals have multiple alternatives (delete losers), launchpad has one definite set (always execute).

---

## Architecture Overview

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Raise** | Store InitActionSpecs, track raise state |
| **complete_raise()** | JIT convert specs → Intent when successful |
| **Account** | Store created Intent (standard flow) |
| **LaunchpadOutcome** | Pre-approval outcome type |
| **Keepers** | Execute approved intents (UNCHANGED) |
| **Action Modules** | Implement executors (UNCHANGED) |

### State Machine

```
┌─────────────────────────────────────────────────────────────┐
│ Raise Lifecycle                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CREATED                                                    │
│  ┌────────────────────────────────────┐                    │
│  │ - InitActionSpecs stored in Raise  │                    │
│  │ - No Intent exists yet             │                    │
│  │ - Raise state = FUNDING            │                    │
│  └────────────────────────────────────┘                    │
│                     │                                       │
│                     │ Investors contribute                  │
│                     ▼                                       │
│  FUNDING                                                    │
│  ┌────────────────────────────────────┐                    │
│  │ - Accumulating funds               │                    │
│  │ - Specs still in Raise             │                    │
│  │ - No Intent yet                    │                    │
│  └────────────────────────────────────┘                    │
│                     │                                       │
│                     │ Min raise met + deadline passed       │
│                     ▼                                       │
│  SUCCESSFUL                                                 │
│  ┌────────────────────────────────────┐                    │
│  │ - complete_raise() called          │                    │
│  │ - JIT: specs → Intent (atomic!)    │                    │
│  │ - Intent stored in Account         │                    │
│  │ - Specs can be cleared             │                    │
│  └────────────────────────────────────┘                    │
│                     │                                       │
│                     │ Keepers detect approved intent        │
│                     ▼                                       │
│  EXECUTED                                                   │
│  ┌────────────────────────────────────┐                    │
│  │ - All actions executed             │                    │
│  │ - DAO fully initialized            │                    │
│  │ - Normal governance active         │                    │
│  └────────────────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ PHASE 1: User Creates Raise (PTB)                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Create InitActionSpecs                                        │
│    let mut specs = init_action_specs::new_init_specs();         │
│                                                                  │
│    // Add stream action                                         │
│    stream_init_actions::add_create_stream_spec(                 │
│      &mut specs,                                                │
│      vault_name: "treasury",                                    │
│      beneficiary: founder,                                      │
│      total_amount: 100_000,                                     │
│      ...                                                        │
│    );                                                           │
│                                                                  │
│    // Add pool action                                           │
│    liquidity_init_actions::add_create_pool_spec(               │
│      &mut specs,                                                │
│      vault_name: "treasury",                                    │
│      asset_amount: 500_000,                                     │
│      stable_amount: 50_000,                                     │
│      fee_bps: 30,                                              │
│    );                                                           │
│                                                                  │
│    // specs now contains serialized actions (copy + drop!)      │
│                                                                  │
│ 2. Create Account                                                │
│    account_protocol::create_account(...)                         │
│    → Account created and SHARED                                 │
│                                                                  │
│ 3. Create Raise                                                  │
│    launchpad::create_raise(                                      │
│      account,                                                   │
│      treasury_cap,                                              │
│      coin_metadata,                                             │
│      specs,           // ← InitActionSpecs passed in!           │
│      ...                                                        │
│    )                                                            │
│    → Raise created                                               │
│    → raise.init_specs = specs (stored!)                         │
│    → TreasuryCap locked in Account                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE 2: Funding Period                                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ - Investors contribute stable coins                              │
│ - Raise accumulates funds                                        │
│ - InitActionSpecs stay in Raise (immutable!)                    │
│ - No Intent exists yet                                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE 3: Raise Completion (Permissionless)                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ complete_raise(raise, account, registry, clock, ctx)             │
│                                                                  │
│ 1. Validate raise succeeded                                      │
│    assert!(raise.state == STATE_FUNDING)                         │
│    assert!(total_raised >= min_raise_amount)                     │
│                                                                  │
│ 2. JIT Convert: InitActionSpecs → Intent (ATOMIC!)              │
│                                                                  │
│    // Create Intent params                                       │
│    let params = intents::new_params(                             │
│      b"launchpad_init".to_string(),                             │
│      b"DAO initialization actions".to_string(),                 │
│      vector[clock.timestamp_ms()],  // Execute immediately      │
│      clock.timestamp_ms() + 30_days_ms(),  // Expiry            │
│      clock,                                                     │
│      ctx,                                                       │
│    );                                                           │
│                                                                  │
│    // Create outcome (pre-approved!)                            │
│    let outcome = launchpad_outcome::new(object::id(raise));     │
│                                                                  │
│    // BUILD INTENT FROM SPECS                                   │
│    account.build_intent!(                                        │
│      registry,                                                  │
│      params,                                                    │
│      outcome,                                                   │
│      b"launchpad_init".to_string(),  // Intent key              │
│      version::current(),                                        │
│      LaunchpadIntent {},  // Intent witness                     │
│      ctx,                                                       │
│      |intent, iw| {                                             │
│        // Iterate through specs and add each action             │
│        let specs = &raise.init_specs;                           │
│        let actions = init_action_specs::actions(specs);         │
│        let mut i = 0;                                           │
│        while (i < vector::length(actions)) {                    │
│          let action_spec = vector::borrow(actions, i);          │
│          let action_type = init_action_specs::action_type(      │
│            action_spec                                          │
│          );                                                     │
│          let action_data = init_action_specs::action_data(      │
│            action_spec                                          │
│          );                                                     │
│                                                                  │
│          // Add to intent (type info preserved!)                │
│          intent.add_action_spec(                                │
│            action_type,                                         │
│            *action_data,                                        │
│            iw                                                   │
│          );                                                     │
│                                                                  │
│          i = i + 1;                                            │
│        };                                                       │
│      }                                                          │
│    );                                                           │
│                                                                  │
│    → Intent created in Account.intents!                         │
│    → Intent has LaunchpadOutcome (pre-approved!)                │
│                                                                  │
│ 3. Create DEPOSIT intent (raised funds)                         │
│    account.build_intent!(                                        │
│      params,                                                    │
│      outcome,                                                   │
│      |intent, iw| {                                             │
│        vault_actions::add_deposit<StableCoin>(                  │
│          intent,                                                │
│          "treasury",                                            │
│          total_raised,                                          │
│          iw                                                     │
│        );                                                       │
│      }                                                          │
│    );                                                           │
│                                                                  │
│ 4. Update raise state                                            │
│    raise.state = STATE_SUCCESSFUL                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE 4: Intent Execution (Keepers - Permissionless)            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Same as current Intent execution!                               │
│                                                                  │
│ 1. Keeper detects LaunchpadOutcome intent                       │
│ 2. Validates raise.state == STATE_SUCCESSFUL                    │
│ 3. Routes to correct executors based on action types            │
│ 4. Executes all actions atomically                              │
│ 5. Confirms execution                                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Raise Struct Changes

#### File: `futarchy_factory/sources/launchpad.move`

```move
public struct Raise<phantom RaiseToken, phantom StableCoin> has key {
    id: UID,
    account_id: ID,  // NEW: Reference to Account
    creator: address,
    state: u8,

    // NEW: Store InitActionSpecs
    init_specs: InitActionSpecs,

    // ... rest of existing fields ...
    min_raise_amount: u64,
    max_raise_amount: Option<u64>,
    start_time_ms: u64,
    deadline_ms: u64,
    raise_token_vault: Balance<RaiseToken>,
    stable_coin_vault: Balance<StableCoin>,
    // ...
}
```

---

### 2. LaunchpadOutcome Type

#### File: `futarchy_factory/sources/launchpad_outcome.move` (NEW)

```move
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

// === Validation ===

/// Check if intent is approved (raise succeeded)
public fun is_approved<RaiseToken, StableCoin>(
    outcome: &LaunchpadOutcome,
    raise: &futarchy_factory::launchpad::Raise<RaiseToken, StableCoin>,
): bool {
    use futarchy_factory::launchpad;

    object::id(raise) == outcome.raise_id &&
    launchpad::state(raise) == launchpad::STATE_SUCCESSFUL
}
```

---

### 3. Update create_raise

```move
/// Create a raise with InitActionSpecs
public fun create_raise<RaiseToken: drop, StableCoin: drop>(
    account: &mut Account,
    treasury_cap: TreasuryCap<RaiseToken>,
    coin_metadata: CoinMetadata<RaiseToken>,
    init_specs: InitActionSpecs,  // NEW: Accept specs
    registry: &PackageRegistry,
    affiliate_id: String,
    tokens_for_sale: u64,
    min_raise_amount: u64,
    max_raise_amount: Option<u64>,
    allowed_caps: vector<u64>,
    start_delay_ms: Option<u64>,
    allow_early_completion: bool,
    description: String,
    metadata_keys: vector<String>,
    metadata_values: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Validate
    futarchy_one_shot_utils::coin_registry::validate_coin_set(&treasury_cap, &coin_metadata);

    // Lock TreasuryCap and Metadata in Account
    currency::lock_cap<RaiseToken>(
        account,
        registry,
        treasury_cap,
        coin_metadata,
        version::current(),
    );

    // Mint tokens for sale
    let minted_tokens = coin::mint(&mut treasury_cap, tokens_for_sale, ctx);

    // Calculate times
    let current_time = clock.timestamp_ms();
    let start_time = if (option::is_some(&start_delay_ms)) {
        current_time + *option::borrow(&start_delay_ms)
    } else {
        current_time
    };
    let deadline = start_time + constants::launchpad_duration_ms();

    // Create Raise
    let mut raise = Raise<RaiseToken, StableCoin> {
        id: object::new(ctx),
        account_id: object::id(account),  // NEW
        creator: ctx.sender(),
        state: STATE_FUNDING,
        init_specs,  // NEW: Store specs!
        min_raise_amount,
        max_raise_amount,
        start_time_ms: start_time,
        deadline_ms: deadline,
        allow_early_completion,
        raise_token_vault: minted_tokens.into_balance(),
        tokens_for_sale_amount: tokens_for_sale,
        stable_coin_vault: balance::zero(),
        description,
        allowed_caps,
        cap_sums: vector::empty(),
        // ... other fields ...
    };

    // Initialize cap_sums
    let cap_count = vector::length(&raise.allowed_caps);
    let mut i = 0;
    while (i < cap_count) {
        vector::push_back(&mut raise.cap_sums, 0);
        i = i + 1;
    };

    let raise_id = object::id(&raise);

    // Emit event
    event::emit(RaiseCreated {
        raise_id,
        account_id: object::id(account),
        creator: raise.creator,
        // ... event fields ...
    });

    // Share raise
    transfer::share_object(raise);
}
```

---

### 4. Update complete_raise (JIT Conversion!)

```move
/// Complete a successful raise
/// Creates Intent from InitActionSpecs (JIT conversion!)
public fun complete_raise<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    account: &mut Account,
    registry: &PackageRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Validate
    assert!(raise.state == STATE_FUNDING, EInvalidState);
    assert_raise_complete(raise, clock);
    assert!(object::id(account) == raise.account_id, EWrongAccount);

    let total_raised = raise.stable_coin_vault.value();
    let raise_id = object::id(raise);

    // 1. JIT CONVERT: InitActionSpecs → Intent
    if (init_action_specs::action_count(&raise.init_specs) > 0) {
        let params = intents::new_params(
            b"launchpad_init".to_string(),
            b"DAO initialization actions from raise".to_string(),
            vector[clock.timestamp_ms()],  // Execute immediately
            clock.timestamp_ms() + 30_days_ms(),  // 30 day expiry
            clock,
            ctx,
        );

        let outcome = launchpad_outcome::new(raise_id);

        // Build intent from specs
        account.build_intent!(
            registry,
            params,
            outcome,
            b"launchpad_init".to_string(),
            version::current(),
            LaunchpadIntent {},
            ctx,
            |intent, iw| {
                // Copy all action specs from raise to intent
                let actions = init_action_specs::actions(&raise.init_specs);
                let mut i = 0;
                while (i < vector::length(actions)) {
                    let action_spec = vector::borrow(actions, i);
                    let action_type = init_action_specs::action_type(action_spec);
                    let action_data = init_action_specs::action_data(action_spec);

                    // Add to intent (preserves type information!)
                    intents::add_action_spec(
                        intent,
                        action_type,
                        *action_data,  // Copy the bytes
                        iw
                    );

                    i = i + 1;
                };
            }
        );
    }

    // 2. Create DEPOSIT intent for raised funds
    if (total_raised > 0) {
        let params = intents::new_params(
            b"launchpad_deposit_funds".to_string(),
            b"Deposit raised funds to treasury vault".to_string(),
            vector[clock.timestamp_ms()],
            clock.timestamp_ms() + 30_days_ms(),
            clock,
            ctx,
        );

        let outcome = launchpad_outcome::new(raise_id);

        account.build_intent!(
            registry,
            params,
            outcome,
            b"launchpad_deposit".to_string(),
            version::current(),
            vault_actions::VaultIntent(),
            ctx,
            |intent, iw| {
                vault_actions::add_deposit_action<StableCoin>(
                    intent,
                    b"treasury".to_string(),
                    total_raised,
                    iw,
                );
            }
        );
    }

    // 3. Update raise state
    raise.state = STATE_SUCCESSFUL;
    raise.final_raise_amount = total_raised;

    // Emit event
    event::emit(RaiseCompleted {
        raise_id,
        account_id: object::id(account),
        total_raised,
        timestamp: clock.timestamp_ms(),
    });
}
```

---

### 5. Action Module Updates

#### Add spec builders to each action module

**Example: `liquidity_init_actions.move`**

```move
/// Add CreatePoolWithMintAction to InitActionSpecs
public fun add_create_pool_spec(
    specs: &mut InitActionSpecs,
    vault_name: String,
    asset_amount: u64,
    stable_amount: u64,
    fee_bps: u64,
) {
    // Create action struct
    let action = CreatePoolWithMintAction {
        vault_name,
        asset_amount,
        stable_amount,
        fee_bps,
    };

    // Serialize
    let action_data = bcs::to_bytes(&action);

    // Add to specs with type marker
    init_action_specs::add_action(
        specs,
        type_name::get<CreatePoolWithMintAction>(),
        action_data
    );
}
```

**Example: `stream_init_actions.move`**

```move
/// Add CreateStreamAction to InitActionSpecs
public fun add_create_stream_spec(
    specs: &mut InitActionSpecs,
    vault_name: String,
    beneficiary: address,
    total_amount: u64,
    start_time: u64,
    end_time: u64,
    cliff_time: Option<u64>,
    max_per_withdrawal: u64,
    min_interval_ms: u64,
    max_beneficiaries: u64,
) {
    let action = CreateStreamAction {
        vault_name,
        beneficiary,
        total_amount,
        start_time,
        end_time,
        cliff_time,
        max_per_withdrawal,
        min_interval_ms,
        max_beneficiaries,
    };

    let action_data = bcs::to_bytes(&action);

    init_action_specs::add_action(
        specs,
        type_name::get<CreateStreamAction>(),
        action_data
    );
}
```

---

### 6. Frontend Usage

```typescript
import { Transaction } from '@mysten/sui.js/transactions';

// User creates a raise
async function createRaise() {
  const tx = new Transaction();

  // 1. Create InitActionSpecs
  const specs = tx.moveCall({
    target: `${FUTARCHY_TYPES}::init_action_specs::new_init_specs`,
  });

  // 2. Add stream action
  tx.moveCall({
    target: `${FUTARCHY_ACTIONS}::stream_init_actions::add_create_stream_spec`,
    arguments: [
      specs,
      tx.pure('treasury'),  // vault_name
      tx.pure(founderAddress),  // beneficiary
      tx.pure(100_000),  // total_amount
      tx.pure(startTime),
      tx.pure(endTime),
      tx.pure([cliffTime], 'vector<u64>'),  // Option
      tx.pure(10_000),  // max_per_withdrawal
      tx.pure(86_400_000),  // min_interval_ms (1 day)
      tx.pure(1),  // max_beneficiaries
    ],
  });

  // 3. Add pool creation action
  tx.moveCall({
    target: `${FUTARCHY_ACTIONS}::liquidity_init_actions::add_create_pool_spec`,
    arguments: [
      specs,
      tx.pure('treasury'),
      tx.pure(500_000),  // asset_amount
      tx.pure(50_000),   // stable_amount
      tx.pure(30),       // fee_bps
    ],
  });

  // 4. Create Account
  const account = tx.moveCall({
    target: `${ACCOUNT_PROTOCOL}::account::create_account`,
    arguments: [
      tx.object(REGISTRY_ID),
      tx.pure('My DAO'),
      // ... other params
    ],
  });

  // 5. Create Raise with specs
  tx.moveCall({
    target: `${LAUNCHPAD}::launchpad::create_raise`,
    arguments: [
      account,
      treasuryCap,
      coinMetadata,
      specs,  // ← InitActionSpecs passed in!
      tx.object(REGISTRY_ID),
      tx.pure('affiliate123'),
      tx.pure(1_000_000),  // tokens_for_sale
      tx.pure(100_000),    // min_raise_amount
      // ... other params
    ],
    typeArguments: [RAISE_TOKEN, STABLE_COIN],
  });

  return tx;
}
```

---

## Comparison with Intent-Based Plan

### What We REMOVED (simpler!)

| Feature | Intent Plan | InitActionSpecs Plan |
|---------|-------------|---------------------|
| **Account locking** | Required lock/unlock | ❌ Not needed |
| **Lock mechanism** | `launchpad_raise_id` field | ❌ Not needed |
| **Lock functions** | `lock_to_launchpad()` | ❌ Not needed |
| **Custom executable** | `create_executable_via_launchpad()` | ❌ Not needed |
| **Pre-creation** | Create Intents before raise | ❌ Not needed |

### What STAYS (reused!)

| Feature | Both Plans |
|---------|-----------|
| **LaunchpadOutcome** | ✅ Same |
| **Keeper routing** | ✅ Same |
| **Executor pattern** | ✅ Same |
| **Generic actions** | ✅ Same |

### What's NEW (from proposals!)

| Feature | InitActionSpecs Plan |
|---------|---------------------|
| **Store in Raise** | ✅ Specs stored in Raise struct |
| **JIT conversion** | ✅ Specs → Intent in complete_raise |
| **Spec builders** | ✅ add_*_spec() functions |

---

## Why This Is Better

### 1. Proven Pattern
```move
// Proposals already do this!
intent_specs: vector<Option<InitActionSpecs>>

// Launchpad is just simpler (no alternatives)
init_specs: InitActionSpecs
```

### 2. No Lock Complexity
```
Intent Plan:
- Lock account to raise
- Unlock after completion
- Handle auto-unlock safety
- Prevent double-lock

InitActionSpecs Plan:
- Store specs in Raise
- Convert when ready
- Done!
```

### 3. Immutable Specs
```move
// InitActionSpecs has copy + drop
public struct InitActionSpecs has store, drop, copy {
    actions: vector<ActionSpec>,
}

// Can freely copy, no ownership issues
let specs_copy = raise.init_specs;  // Just works!
```

### 4. Same Extensibility
```move
// New action type?
module my_protocol::airdrop_init_actions;

pub fun add_airdrop_spec(specs: &mut InitActionSpecs, ...) {
    // Add to specs
}

pub fun dispatch_airdrop<Outcome>(...) {
    // Execute from intent
}

// Launchpad never changes!
```

---

## Migration Path

### From Current System

**Current (if you have one):**
```move
raise.staged_actions: vector<StagedAction>
```

**New:**
```move
raise.init_specs: InitActionSpecs
```

**Migration:**
1. Keep old raises working
2. New raises use InitActionSpecs
3. Deprecate old system over 3 months

---

## Testing Strategy

### Unit Tests

1. **Spec Creation**
   - Create InitActionSpecs
   - Add multiple action types
   - Verify serialization

2. **Raise Creation**
   - Create raise with specs
   - Verify specs stored correctly
   - Validate all raise params

3. **JIT Conversion**
   - Complete successful raise
   - Verify Intent created
   - Check Intent has correct actions
   - Validate LaunchpadOutcome

4. **Execution**
   - Execute Intent
   - Verify all actions run
   - Check DAO state correct

### Integration Tests

1. **Full Flow**
   - Create specs (stream + pool)
   - Create raise
   - Complete raise
   - Execute intent
   - Verify DAO initialized

2. **Failed Raise**
   - Create raise
   - Fail to meet minimum
   - Verify no Intent created
   - Verify specs not converted

3. **Multiple Actions**
   - Create specs with 5+ actions
   - Verify all execute in order
   - Check atomic execution

---

## Timeline

| Phase | Tasks | Time |
|-------|-------|------|
| **Phase 1** | LaunchpadOutcome module | 2 hours |
| **Phase 2** | Update Raise struct | 2 hours |
| **Phase 3** | Update create_raise | 2 hours |
| **Phase 4** | Implement complete_raise (JIT) | 4 hours |
| **Phase 5** | Add spec builders to action modules | 4 hours |
| **Phase 6** | Keeper routing (if needed) | 2 hours |
| **Phase 7** | Testing | 6 hours |
| **Total** | | **~22 hours (3 days)** |

---

## Code Metrics

### Lines of Code

**Added:**
- LaunchpadOutcome module: +30 lines
- Raise struct field: +1 line
- create_raise update: +10 lines
- complete_raise (JIT): +50 lines
- Spec builders (per action): +15 lines × 4 actions = +60 lines

**Removed:**
- No lock mechanism: 0 lines (never existed)
- Old staged actions (if any): ~200 lines

**Net: +150 lines**

---

## Security Considerations

### 1. Spec Immutability
✅ **InitActionSpecs has copy + drop**
```move
// Can't be modified after Raise creation
raise.init_specs  // Immutable!
```

### 2. JIT Conversion Atomicity
✅ **Conversion happens in complete_raise**
```move
// Either:
// - Raise fails → No Intent created
// - Raise succeeds → Intent created
// No partial state!
```

### 3. Approval Validation
✅ **LaunchpadOutcome checks raise state**
```move
pub fun is_approved(outcome, raise): bool {
    raise.state == STATE_SUCCESSFUL
}
```

### 4. Type Safety
✅ **TypeName preserves action types**
```move
// Keeper knows which executor to call
action_type: TypeName  // e.g., "CreateStreamAction"
```

---

## Open Questions

### 1. Clear Specs After Conversion?

**Option A: Keep specs in Raise**
- Pro: Can verify what was executed
- Pro: Replay/audit capability
- Con: Extra storage cost

**Option B: Clear specs after conversion**
- Pro: Save storage
- Con: Lose audit trail

**Recommendation:** Keep specs (they're small, copy + drop)

### 2. Multiple Raises Per Account?

**Current:** One account can have multiple raises?
**Question:** Should we prevent this?

**Recommendation:** Allow it (no harm, specs are separate)

---

## Conclusion

This approach:

✅ **Reuses Proven Patterns** - Proposals already work this way
✅ **Simpler** - No lock mechanism needed
✅ **Generic** - Works with ANY action type
✅ **Type Safe** - TypeName preserves action types
✅ **Atomic** - JIT conversion is all-or-nothing
✅ **Immutable** - Specs can't be modified after creation

**The key insight:** Launchpad is just a proposal with ONE outcome. Reuse that exact pattern.

---

## Next Steps

1. ✅ Review this plan
2. ⏳ Implement LaunchpadOutcome module
3. ⏳ Update Raise struct
4. ⏳ Implement JIT conversion in complete_raise
5. ⏳ Add spec builders to action modules
6. ⏳ Write tests
7. ⏳ Deploy to testnet

---

**END OF PLAN**
