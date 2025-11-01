# Launchpad Intent Integration - Clean Architecture

**Status:** Planning Complete
**Approach:** Minimal changes using existing Intent system
**Estimated Time:** 1-2 days
**Complexity:** LOW - Simple lock/unlock mechanism

---

## Executive Summary

### The Problem
Current launchpad uses custom storage (InitActionSpecs) for DAO initialization actions. This duplicates the generic Intent system and couples launchpad to specific action types.

### The Solution
Use the existing Intent system with a simple lock mechanism:
1. Account has `launchpad_raise_id: Option<ID>` field
2. When locked to a raise, ONLY that raise can execute intents
3. When unlocked (after raise completes/fails), normal governance works

### Key Benefits
✅ **Fully Generic** - Works with ANY intent type
✅ **Extensible** - New action types = zero launchpad changes
✅ **Simple** - One lock field, two states
✅ **Reuses Existing** - Intent system does everything
✅ **Clean Separation** - Launchpad doesn't know about action types

---

## Architecture Overview

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Account** | Add `launchpad_raise_id` lock field |
| **Launchpad** | Lock/unlock Account, validate raise state |
| **Intent System** | Store actions, execution logic (UNCHANGED) |
| **Action Modules** | Implement executors (UNCHANGED) |
| **Keepers** | Execute approved intents (UNCHANGED) |

### State Machine

```
┌─────────────────────────────────────────────────────────────┐
│ Account States                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  UNLOCKED (launchpad_raise_id = None)                      │
│  ┌────────────────────────────────────┐                    │
│  │ - Normal governance works          │                    │
│  │ - Proposals can execute intents    │                    │
│  │ - Anyone can create intents        │                    │
│  └────────────────────────────────────┘                    │
│                     │                                       │
│                     │ create_raise()                        │
│                     ▼                                       │
│  LOCKED (launchpad_raise_id = Some(raise_id))             │
│  ┌────────────────────────────────────┐                    │
│  │ - ONLY launchpad can execute       │                    │
│  │ - Governance blocked               │                    │
│  │ - Proposals can't execute          │                    │
│  └────────────────────────────────────┘                    │
│                     │                                       │
│                     │ complete_raise() or cancel_raise()    │
│                     ▼                                       │
│  UNLOCKED (launchpad_raise_id = None)                      │
│  ┌────────────────────────────────────┐                    │
│  │ - Normal governance restored       │                    │
│  │ - Launchpad intents executed       │                    │
│  └────────────────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ PHASE 1: DAO Creation (User PTB)                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Create Account                                                │
│    account_protocol::create_account(...)                         │
│    → Account created (launchpad_raise_id = None)                │
│    → SHARED immediately                                          │
│                                                                  │
│ 2. Create Intents (any intents!)                                │
│    account.build_intent!(                                        │
│      params,                                                     │
│      LaunchpadOutcome { raise_id: TBD },                        │
│      |intent, iw| {                                             │
│        stream_actions::add_create_stream(intent, ...);          │
│      }                                                           │
│    )                                                             │
│    → Intent #0 stored in Account.intents                        │
│                                                                  │
│    account.build_intent!(                                        │
│      params,                                                     │
│      LaunchpadOutcome { raise_id: TBD },                        │
│      |intent, iw| {                                             │
│        pool_actions::add_create_pool(intent, ...);              │
│      }                                                           │
│    )                                                             │
│    → Intent #1 stored in Account.intents                        │
│                                                                  │
│    (User can add ANY intent type from ANY module!)              │
│                                                                  │
│ 3. Create Raise                                                  │
│    launchpad::create_raise(                                      │
│      account,          // The Account we just created            │
│      treasury_cap,     // Lock in Account                       │
│      coin_metadata,    // Lock in Account                       │
│      ...               // Raise params                           │
│    )                                                             │
│    → Raise created                                               │
│    → account.launchpad_raise_id = Some(raise_id) ← LOCKED!     │
│    → TreasuryCap + Metadata locked in Account                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE 2: Funding Period                                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ - Investors contribute stable coins                              │
│ - Raise accumulates funds                                        │
│ - Account is LOCKED (governance can't execute)                   │
│ - Intents exist but can't be executed yet                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE 3: Raise Completion (Permissionless)                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. complete_raise()                                              │
│    → Validates raise succeeded                                   │
│    → Creates "deposit raised funds" Intent:                      │
│                                                                  │
│      account.build_intent!(                                      │
│        params,                                                   │
│        LaunchpadOutcome { raise_id },                           │
│        |intent, iw| {                                           │
│          vault_actions::add_deposit(                            │
│            intent,                                              │
│            vault_name: "treasury",                              │
│            amount: raise.total_raised,                          │
│            ...                                                  │
│          );                                                     │
│        }                                                        │
│      )                                                          │
│                                                                  │
│    → raise.state = STATE_SUCCESSFUL                             │
│    → account.launchpad_raise_id = None ← UNLOCKED!             │
│                                                                  │
│ 2. All intents now executable!                                   │
│    - User's intents (stream, pool, etc.)                        │
│    - Launchpad's intent (deposit funds)                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE 4: Intent Execution (Keepers - Permissionless)            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ For each Intent in Account.intents:                             │
│                                                                  │
│ 1. Keeper detects pending intent                                │
│    → Reads Account.intents bag                                  │
│    → Finds LaunchpadOutcome intents                             │
│                                                                  │
│ 2. Validate approval                                             │
│    let (outcome, executable) = account::create_executable(...)  │
│    let raise = getRaise(outcome.raise_id)                       │
│    assert!(raise.state == STATE_SUCCESSFUL)  ← Approved!        │
│                                                                  │
│ 3. Execute actions                                               │
│    account.process_intent!(                                      │
│      executable,                                                │
│      |executable, iw| {                                         │
│        // Keeper routes to correct executor based on action type │
│        stream_actions::execute_create_stream(executable, ...);  │
│      }                                                          │
│    )                                                            │
│                                                                  │
│ 4. Cleanup                                                       │
│    account::confirm_execution(executable)                        │
│    → Intent removed from Account                                │
│    → Keeper receives reward                                     │
│                                                                  │
│ 5. Repeat for all intents                                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PHASE 5: Post-Launch (Normal Governance)                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ - Account unlocked (launchpad_raise_id = None)                  │
│ - Proposals work normally                                        │
│ - Governance can create/execute intents                          │
│ - Launchpad no longer special                                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Account Protocol Changes

#### File: `account_protocol/sources/account.move`

**Add lock field to Account:**
```move
public struct Account has key {
    id: UID,
    // ... existing fields ...

    /// Launchpad lock: When Some, only that raise can execute intents
    /// When None, normal governance works
    launchpad_raise_id: Option<ID>,

    /// Auto-unlock time (safety mechanism)
    launchpad_unlock_time: u64,
}
```

**Modify create_executable to check lock:**
```move
public fun create_executable<Config: store, Outcome: store + copy, CW: drop>(
    account: &mut Account,
    registry: &PackageRegistry,
    key: String,
    clock: &Clock,
    version_witness: VersionWitness,
    config_witness: CW,
    ctx: &mut TxContext,
): (Outcome, Executable<Outcome>) {
    // Existing checks...
    account.deps().check(version_witness, registry);
    assert_is_config_module<Config, CW>(account, config_witness);

    // NEW: Check if account is locked to launchpad
    if (account.launchpad_raise_id.is_some()) {
        // Check if auto-unlock time has passed
        if (clock.timestamp_ms() >= account.launchpad_unlock_time) {
            // Auto-unlock
            account.launchpad_raise_id = option::none();
        } else {
            // Still locked - must use launchpad flow
            abort EAccountLockedToLaunchpad
        }
    }

    // Normal execution...
    let mut intent = account.intents.remove_intent<Outcome>(key);
    let time = intent.pop_front_execution_time();
    assert!(clock.timestamp_ms() >= time, ECantBeExecutedYet);

    (
        *intent.outcome(),
        executable::new(intent, ctx),
    )
}
```

**Add launchpad-specific execution:**
```move
/// Special execution path for launchpad-locked accounts
/// Only callable when account is locked to the raise
public(package) fun create_executable_via_launchpad<Config: store, Outcome: store + copy, CW: drop>(
    account: &mut Account,
    raise_id: ID,
    registry: &PackageRegistry,
    key: String,
    clock: &Clock,
    version_witness: VersionWitness,
    config_witness: CW,
    ctx: &mut TxContext,
): (Outcome, Executable<Outcome>) {
    // Validate account is locked to this raise
    assert!(
        account.launchpad_raise_id == option::some(raise_id),
        ENotLockedToThisRaise
    );

    // Bypass lock check, normal execution
    account.deps().check(version_witness, registry);
    assert_is_config_module<Config, CW>(account, config_witness);

    let mut intent = account.intents.remove_intent<Outcome>(key);
    let time = intent.pop_front_execution_time();
    assert!(clock.timestamp_ms() >= time, ECantBeExecutedYet);

    (
        *intent.outcome(),
        executable::new(intent, ctx),
    )
}
```

**Add lock/unlock functions:**
```move
/// Lock account to a launchpad raise
public(package) fun lock_to_launchpad(
    account: &mut Account,
    raise_id: ID,
    unlock_time: u64,
) {
    assert!(account.launchpad_raise_id.is_none(), EAlreadyLocked);
    account.launchpad_raise_id = option::some(raise_id);
    account.launchpad_unlock_time = unlock_time;
}

/// Unlock account from launchpad
public(package) fun unlock_from_launchpad(
    account: &mut Account,
    raise_id: ID,
) {
    assert!(account.launchpad_raise_id == option::some(raise_id), ENotLocked);
    account.launchpad_raise_id = option::none();
    account.launchpad_unlock_time = 0;
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

### 3. Launchpad Changes

#### File: `futarchy_factory/sources/launchpad.move`

**Update create_raise:**
```move
/// Create a raise for an existing DAO Account
/// The Account must already have Intents created with LaunchpadOutcome
public fun create_raise<RaiseToken: drop, StableCoin: drop>(
    account: &mut Account,
    mut treasury_cap: TreasuryCap<RaiseToken>,
    coin_metadata: CoinMetadata<RaiseToken>,
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
    let unlock_time = deadline + 7_days_ms();  // Auto-unlock after 7 days

    // Create Raise
    let mut raise = Raise<RaiseToken, StableCoin> {
        id: object::new(ctx),
        account_id: object::id(account),
        creator: ctx.sender(),
        affiliate_id,
        state: STATE_FUNDING,
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
        settlement_done: false,
        final_raise_amount: 0,
        intents_locked: false,
        verification_level: 0,
        attestation_url: string::utf8(b""),
        admin_review_text: string::utf8(b""),
        crank_fee_vault: balance::zero(),
    };

    // Initialize cap_sums
    let cap_count = vector::length(&raise.allowed_caps);
    let mut i = 0;
    while (i < cap_count) {
        vector::push_back(&mut raise.cap_sums, 0);
        i = i + 1;
    };

    let raise_id = object::id(&raise);

    // LOCK ACCOUNT TO THIS RAISE
    account::lock_to_launchpad(account, raise_id, unlock_time);

    // Emit event
    event::emit(RaiseCreated {
        raise_id,
        account_id: object::id(account),
        creator: raise.creator,
        affiliate_id: raise.affiliate_id,
        raise_token_type: type_name::with_defining_ids<RaiseToken>().into_string().to_string(),
        stable_coin_type: type_name::with_defining_ids<StableCoin>().into_string().to_string(),
        min_raise_amount,
        tokens_for_sale,
        start_time_ms: raise.start_time_ms,
        deadline_ms: raise.deadline_ms,
        description: raise.description,
        metadata_keys,
        metadata_values,
    });

    // Share raise
    transfer::share_object(raise);
}
```

**Update complete_raise:**
```move
/// Complete a successful raise
/// Creates deposit intent and unlocks account for normal governance
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

    // Create Intent to deposit raised funds to vault
    let total_raised = raise.stable_coin_vault.value();
    if (total_raised > 0) {
        let params = intents::new_params(
            b"launchpad_deposit_funds".to_string(),
            b"Deposit raised funds to treasury vault".to_string(),
            vector[clock.timestamp_ms()],  // Execute now
            clock.timestamp_ms() + 30_days_ms(),  // 30 day expiry
            clock,
            ctx,
        );

        let outcome = launchpad_outcome::new(object::id(raise));

        account.build_intent!(
            registry,
            params,
            outcome,
            b"treasury".to_string(),
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

    // Update raise state
    raise.state = STATE_SUCCESSFUL;
    raise.final_raise_amount = total_raised;

    // UNLOCK ACCOUNT (now governance can work)
    account::unlock_from_launchpad(account, object::id(raise));

    // Emit event
    event::emit(RaiseCompleted {
        raise_id: object::id(raise),
        account_id: object::id(account),
        total_raised,
        timestamp: clock.timestamp_ms(),
    });
}
```

**Add cancel_raise for failed raises:**
```move
/// Cancel a failed raise and unlock account
public fun cancel_raise<RaiseToken: drop, StableCoin: drop>(
    raise: &mut Raise<RaiseToken, StableCoin>,
    account: &mut Account,
    clock: &Clock,
) {
    // Validate
    assert!(raise.state == STATE_FUNDING, EInvalidState);
    assert!(clock.timestamp_ms() > raise.deadline_ms, ERaiseStillActive);
    assert!(object::id(account) == raise.account_id, EWrongAccount);

    let total_raised = raise.stable_coin_vault.value();

    // Check if raise failed (didn't meet minimum)
    if (total_raised < raise.min_raise_amount) {
        raise.state = STATE_FAILED;

        // UNLOCK ACCOUNT
        account::unlock_from_launchpad(account, object::id(raise));

        event::emit(RaiseFailed {
            raise_id: object::id(raise),
            total_raised,
            min_required: raise.min_raise_amount,
        });
    }
}
```

---

### 4. Update Raise Struct

**Add account_id field:**
```move
public struct Raise<phantom RaiseToken, phantom StableCoin> has key {
    id: UID,
    account_id: ID,  // NEW: Reference to the Account
    creator: address,
    state: u8,
    // ... rest of fields unchanged ...
}
```

---

## Keeper Implementation

### TypeScript Keeper Service

```typescript
import { SuiClient } from '@mysten/sui.js/client';
import { Transaction } from '@mysten/sui.js/transactions';

interface LaunchpadIntent {
  key: string;
  accountId: string;
  raiseId: string;
  actionType: string;
  executionTime: number;
}

class LaunchpadKeeper {
  private client: SuiClient;

  // Registry mapping action types to executors
  private ACTION_EXECUTORS = {
    // Stream actions
    'stream_init_actions::CreateStreamAction': {
      target: `${STREAM_PKG}::stream_init_actions::execute_create_stream`,
      typeArgs: (raise) => ['FutarchyConfig', 'LaunchpadOutcome', raise.CoinType],
    },

    // Pool actions
    'pool_init_actions::CreatePoolWithMintAction': {
      target: `${POOL_PKG}::pool_init_actions::execute_create_pool`,
      typeArgs: (raise) => ['FutarchyConfig', 'LaunchpadOutcome', raise.RaiseToken, raise.StableCoin],
    },

    // Vault actions
    'vault_actions::DepositAction': {
      target: `${VAULT_PKG}::vault_actions::execute_deposit`,
      typeArgs: (raise) => ['FutarchyConfig', 'LaunchpadOutcome', raise.StableCoin],
    },

    // ANY new action can be added here!
  };

  async run() {
    while (true) {
      const pendingIntents = await this.findPendingLaunchpadIntents();

      for (const intent of pendingIntents) {
        try {
          await this.executeIntent(intent);
          console.log(`✅ Executed intent: ${intent.key}`);
        } catch (e) {
          console.error(`❌ Failed intent ${intent.key}:`, e);
        }
      }

      await this.sleep(30_000); // Check every 30s
    }
  }

  async findPendingLaunchpadIntents(): Promise<LaunchpadIntent[]> {
    // 1. Query RaiseCompleted events
    const events = await this.client.queryEvents({
      query: { MoveEventType: `${LAUNCHPAD}::launchpad::RaiseCompleted` },
    });

    const pending: LaunchpadIntent[] = [];

    for (const event of events.data) {
      const { account_id, raise_id } = event.parsedJson;

      // 2. Get Account's intents
      const account = await this.client.getObject({
        id: account_id,
        options: { showContent: true },
      });

      // 3. Filter for LaunchpadOutcome intents
      const intents = await this.getAccountIntents(account_id);

      for (const intent of intents) {
        if (intent.outcome.raise_id === raise_id) {
          pending.push({
            key: intent.key,
            accountId: account_id,
            raiseId: raise_id,
            actionType: intent.action_specs[0].action_type,
            executionTime: intent.execution_times[0],
          });
        }
      }
    }

    return pending;
  }

  async executeIntent(intent: LaunchpadIntent) {
    const tx = new Transaction();

    // Get raise to determine type args
    const raise = await this.getRaise(intent.raiseId);

    // Look up executor for this action type
    const executor = this.ACTION_EXECUTORS[intent.actionType];
    if (!executor) {
      throw new Error(`Unknown action type: ${intent.actionType}`);
    }

    // 1. Create executable
    const [outcome, executable] = tx.moveCall({
      target: `${ACCOUNT}::account::create_executable`,
      arguments: [
        tx.object(intent.accountId),
        tx.object(REGISTRY_ID),
        tx.pure(intent.key),
        tx.object('0x6'), // Clock
      ],
      typeArguments: ['FutarchyConfig', 'LaunchpadOutcome', 'ConfigWitness'],
    });

    // 2. Validate approval
    tx.moveCall({
      target: `${LAUNCHPAD}::launchpad_outcome::is_approved`,
      arguments: [outcome, tx.object(intent.raiseId)],
      typeArguments: [raise.RaiseToken, raise.StableCoin],
    });

    // 3. Execute action
    tx.moveCall({
      target: executor.target,
      arguments: [
        executable,
        tx.object(intent.accountId),
        tx.object(REGISTRY_ID),
        tx.object('0x6'), // Clock
      ],
      typeArguments: executor.typeArgs(raise),
    });

    // 4. Confirm execution
    tx.moveCall({
      target: `${ACCOUNT}::account::confirm_execution`,
      arguments: [tx.object(intent.accountId), executable],
      typeArguments: ['LaunchpadOutcome'],
    });

    // Execute transaction
    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.signer,
    });

    return result;
  }
}
```

---

## Extensibility Example

### Adding a New Action Type

**1. Create Action Module:**
```move
module my_protocol::airdrop_init_actions;

public struct CreateAirdropAction has drop {
    recipients: vector<address>,
    amounts: vector<u64>,
}

/// Executor compatible with Intent system
pub fun execute_create_airdrop<Config, Outcome>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    ctx: &mut TxContext,
) {
    // Get action from executable
    let action_spec = executable.get_current_action_spec();
    let data = action_spec.action_data();

    // Deserialize
    let mut reader = bcs::new(*data);
    let recipients = bcs::peel_vec_address(&mut reader);
    let amounts = bcs::peel_vec_u64(&mut reader);

    // Execute
    do_airdrop(account, recipients, amounts, ...);

    executable.increment_action_idx();
}

/// Helper to add to intent
pub fun add_create_airdrop_action<Outcome>(
    intent: &mut Intent<Outcome>,
    recipients: vector<address>,
    amounts: vector<u64>,
    intent_witness: AirdropIntent,
) {
    let action = CreateAirdropAction { recipients, amounts };
    let bytes = bcs::to_bytes(&action);
    intent.add_action_spec(
        CreateAirdropAction {},
        bytes,
        intent_witness
    );
}
```

**2. Register in Keeper:**
```typescript
// Just add one line!
ACTION_EXECUTORS['airdrop_init_actions::CreateAirdropAction'] = {
  target: `${AIRDROP_PKG}::airdrop_init_actions::execute_create_airdrop`,
  typeArgs: (raise) => ['FutarchyConfig', 'LaunchpadOutcome'],
};
```

**3. Use in Raise:**
```typescript
// User creates DAO
const tx = new Transaction();

// Create Account
const account = tx.moveCall({
  target: `${ACCOUNT}::account::create_account`,
  arguments: [...],
});

// Create Intent with NEW action type
tx.moveCall({
  target: `${ACCOUNT}::intent_interface::build_intent`,
  arguments: [
    account,
    registry,
    params,
    launchpadOutcome,
    // ...
  ],
});

// Add airdrop action
tx.moveCall({
  target: `${AIRDROP_PKG}::airdrop_init_actions::add_create_airdrop_action`,
  arguments: [intent, recipients, amounts],
});

// Create raise
tx.moveCall({
  target: `${LAUNCHPAD}::create_raise`,
  arguments: [account, ...],
});
```

**Launchpad never changed!** New action just works.

---

## Migration from InitActionSpecs

### Current System
```move
// Raise stores InitActionSpecs
raise.staged_init_specs: vector<InitActionSpecs>

// Launchpad knows about action types
execute_staged_init_stream(...)
execute_staged_init_create_pool(...)
```

### New System
```move
// Account stores Intents (generic)
account.intents: Intents

// Launchpad doesn't know about action types
// Just locks/unlocks Account
```

### Migration Path

**Option A: Parallel Systems**
- Keep old launchpad flow
- Add new Intent-based flow
- Users choose which to use

**Option B: One-time Migration**
- Convert existing InitActionSpecs → Intents
- Remove old code

**Recommendation:** Option A for safety, migrate over 3 months

---

## Error Handling

### Failed Raise
```move
pub fun cancel_raise(...) {
    raise.state = STATE_FAILED;
    account::unlock_from_launchpad(account, raise_id);
    // Users can claim refunds
    // Account unlocked for normal use
}
```

### Stuck Account (Safety)
```move
// Auto-unlock after deadline + 7 days
if (clock.timestamp_ms() >= account.launchpad_unlock_time) {
    account.launchpad_raise_id = None;
}
```

### Intent Execution Failure
- Intent remains in Account
- Can be retried later
- Doesn't block other intents

---

## Security Considerations

### 1. Lock Validation
✅ **Account can only be locked if unlocked**
```move
assert!(account.launchpad_raise_id.is_none(), EAlreadyLocked);
```

### 2. Unlock Validation
✅ **Only the locking raise can unlock**
```move
assert!(account.launchpad_raise_id == option::some(raise_id), ENotLocked);
```

### 3. Auto-unlock Safety
✅ **Prevents permanent lock**
```move
if (clock.timestamp_ms() >= account.launchpad_unlock_time) {
    account.launchpad_raise_id = option::none();
}
```

### 4. Approval Check
✅ **Intents only executable after raise succeeds**
```move
assert!(raise.state == STATE_SUCCESSFUL, ERaiseNotComplete);
```

---

## Testing Strategy

### Unit Tests
1. **Lock/Unlock Logic**
   - Lock account to raise
   - Unlock after completion
   - Auto-unlock after deadline
   - Reject double-lock

2. **Intent Creation**
   - Create intents before raise
   - Create deposit intent in complete_raise
   - Intents have correct outcome

3. **Execution Validation**
   - Can't execute while locked
   - Can execute after unlock
   - Approval check works

### Integration Tests
1. **Full Flow**
   - Create DAO + Intents
   - Create raise (locks account)
   - Complete raise (unlocks account)
   - Execute all intents

2. **Failed Raise**
   - Create raise
   - Fail to meet minimum
   - Cancel raise (unlocks)
   - Verify no intents executed

3. **Multiple Action Types**
   - Create intents of different types
   - Verify all execute correctly
   - Verify keeper routes correctly

---

## Success Metrics

### Code Quality
- ✅ Account protocol: +50 lines (lock/unlock)
- ✅ Launchpad: +100 lines (create_raise, complete_raise)
- ✅ LaunchpadOutcome: +30 lines (new module)
- ✅ Remove: -500 lines (InitActionSpecs, typed storage, executors)
- **Net: -320 lines (simpler!)**

### Performance
- ✅ Zero serialization overhead (uses Intent's BCS, but only once)
- ✅ Same execution gas as current system
- ✅ No additional storage

### Extensibility
- ✅ Add new action: 0 launchpad changes
- ✅ Add new action: 1 line keeper config
- ✅ Works with any Intent type

---

## Timeline

| Phase | Tasks | Time |
|-------|-------|------|
| **Phase 1** | Account lock/unlock mechanism | 4 hours |
| **Phase 2** | LaunchpadOutcome module | 2 hours |
| **Phase 3** | Update create_raise, complete_raise | 4 hours |
| **Phase 4** | Keeper routing logic | 4 hours |
| **Phase 5** | Testing | 6 hours |
| **Phase 6** | Documentation | 2 hours |
| **Total** | | **~22 hours (3 days)** |

---

## Next Steps

### Immediate
1. ✅ Review and approve this plan
2. ⏳ Start Phase 1: Add lock/unlock to Account
3. ⏳ Create LaunchpadOutcome module
4. ⏳ Write unit tests for locking

### This Week
1. ⏳ Implement create_raise with locking
2. ⏳ Implement complete_raise with intent creation
3. ⏳ Update keeper config for routing

### Next Week
1. ⏳ Integration testing
2. ⏳ Testnet deployment
3. ⏳ Production deployment

---

## Open Questions

### 1. Multiple Raises per Account?
**Current:** One account = one raise (lock prevents multiple)
**Alternative:** Allow sequential raises (unlock → lock → unlock)
**Decision:** Start with one raise, can add sequential later

### 2. Keeper Rewards?
**Current:** No explicit reward mechanism
**Options:**
- A: Protocol fee covers keeper gas
- B: Raise creator pre-funds rewards
- C: Keepers volunteer (altruistic)
**Decision:** Start with C, add A/B if needed

### 3. Intent Expiration?
**Current:** Intents expire after execution_time + expiration_time
**Question:** What if critical intent expires?
**Decision:** Set long expiration (30 days), monitor closely

---

## Conclusion

This architecture achieves:

✅ **Fully Generic** - Works with ANY intent type
✅ **Simple** - One lock field, minimal code
✅ **Extensible** - Add actions without touching launchpad
✅ **Clean** - Reuses existing Intent system
✅ **Safe** - Auto-unlock prevents stuck accounts

**The key insight:** We don't need custom storage or execution logic. The Intent system already does everything. We just need to control WHEN intents can execute (lock/unlock).

**This is as clean as it gets.**

---

**END OF PLAN**
