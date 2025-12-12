# Action Execution Pattern - Implementation Plan

## Overview

This document defines the **unified 3-layer pattern** for all action execution in the Govex protocol. This pattern applies to:
- **Launchpad initialization** actions (executed during DAO creation)
- **Proposal execution** actions (executed after futarchy approval)
- **Any future intent-based actions**

The pattern provides **deterministic, atomic, ordered batch execution** with type-safe parameter validation and secure object passing between actions.

---

## Design Principles

1. **No God Dispatcher**: PTB routes directly to specific `do_*` functions (client-side routing)
2. **Type System Safety**: `assert_action_type<T>` ensures correct function called for each ActionSpec
3. **Parameter Integrity**: All parameters come from ActionSpec BCS bytes, never from PTB arguments
4. **Minimal Code**: Direct function calls - no intermediate dispatchers
5. **Deterministic Execution**: Every keeper executing the same Intent produces identical results

---

## The 3-Layer Architecture

### Layer 1: Action Structs (Typed Data)

Action structs are **pure data containers** with `store, copy, drop` abilities.

```move
// Example: packages/move-framework/packages/actions/sources/init/stream_init_actions.move
public struct CreateStreamAction has store, copy, drop {
    vault_name: String,
    beneficiary: address,
    total_amount: u64,
    start_time: u64,
    end_time: u64,
    cliff_time: Option<u64>,
    max_per_withdrawal: u64,
    min_interval_ms: u64,
    max_beneficiaries: u64,
}
```

**Requirements:**
- ✅ Must have `store, copy, drop` abilities
- ✅ All fields must be BCS-serializable
- ✅ Should be in dedicated module (e.g., `stream_init_actions`, `pool_init_actions`)

### Layer 2: Intent with ActionSpecs (Stored in Account)

ActionSpecs are **BCS-serialized action structs** stored in an Intent.

```move
// packages/move-framework/packages/protocol/sources/types/intents.move
public struct Intent<Outcome> has store {
    key: String,
    action_specs: vector<ActionSpec>,  // ← THE IMMUTABLE BATCH
    outcome: Outcome,
    ...
}

public struct ActionSpec has store, copy, drop {
    version: u8,
    action_type: TypeName,      // type_name::get<CreateStreamAction>()
    action_data: vector<u8>,    // bcs::to_bytes(&action)
}
```

**Key Properties:**
- ✅ Stored in Account (on-chain, immutable after creation)
- ✅ Contains ALL action parameters (fully deterministic)
- ✅ TypeName allows type validation at execution
- ✅ Versioned for forward compatibility

### Layer 3: `do_init_*` Execution Functions

Execution functions **read from Executable, validate type, deserialize, execute**.

**Naming Convention:**
- `do_init_*` functions are used for **both launchpad AND proposal execution**
- Regular `do_*` functions (like `do_spend`, `do_deposit`) are used for **post-initialization operations on shared accounts** (not part of the 3-layer pattern)

```move
// Example: packages/move-framework/packages/actions/sources/lib/vault.move:1439
public fun do_init_create_stream<Config: store, Outcome: store, CoinType: drop, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    clock: &Clock,
    _version_witness: VersionWitness,
    _intent_witness: IW,
    ctx: &mut TxContext,
): ID {
    // 1. Assert account ownership
    executable.intent().assert_is_account(account.addr());

    // 2. Get current ActionSpec from Executable
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // 3. CRITICAL: Validate action type
    action_validation::assert_action_type<CreateStream>(spec);

    // 4. Check version
    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // 5. Deserialize action from BCS bytes
    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);
    let vault_name = std::string::utf8(bcs::peel_vec_u8(&mut reader));
    let beneficiary = bcs::peel_address(&mut reader);
    let total_amount = bcs::peel_u64(&mut reader);
    // ... deserialize all fields

    // 6. Validate all bytes consumed (security)
    bcs_validation::validate_all_bytes_consumed(reader);

    // 7. Execute with deserialized params
    let stream_id = create_stream_unshared<Config, CoinType>(
        account,
        registry,
        vault_name,    // ← From ActionSpec, not PTB!
        beneficiary,   // ← From ActionSpec, not PTB!
        total_amount,  // ← From ActionSpec, not PTB!
        ...
    );

    // 8. Increment action index
    executable::increment_action_idx(executable);

    stream_id
}
```

**Requirements:**
- ✅ Must take `&mut Executable<Outcome>` as first parameter
- ✅ Must call `assert_action_type<T>` before deserialization
- ✅ Must read params from `ActionSpec.action_data` (never from PTB args)
- ✅ Must call `executable::increment_action_idx` at end
- ✅ Must validate all bytes consumed

---

## Execution Guarantees

### 1. Atomicity (All or Nothing)
```typescript
// ONE PTB transaction
tx.moveCall({ target: 'do_init_create_stream', [exec, ...] });
tx.moveCall({ target: 'do_init_create_pool', [exec, ...] });
tx.moveCall({ target: 'finalize_launchpad_init', [exec] });
// If ANY fails → entire transaction aborts → rollback
```

### 2. Sequential Ordering (Cannot Skip)
```move
// Executable maintains action_idx counter
public fun do_create_stream(executable: &mut Executable, ...) {
    let spec = executable.intent().action_specs().borrow(
        executable.action_idx()  // MUST be 0 for first action
    );
    // ...
    executable::increment_action_idx(executable);  // Now 1
}

// If PTB tries to skip to action 2:
public fun do_create_pool(executable: &mut Executable, ...) {
    let spec = executable.intent().action_specs().borrow(
        executable.action_idx()  // Still 0! Can't skip!
    );
    assert_action_type<CreatePool>(spec);  // ABORT - ActionSpec[0] is CreateStream
}
```

### 3. Type Safety (Cannot Call Wrong Function)
```move
// Intent: [CreateStreamAction, CreatePoolAction]

// PTB calls wrong function:
tx.moveCall({ target: 'do_create_stream', [exec] });  // ActionSpec[0] ✅
tx.moveCall({ target: 'do_create_stream', [exec] });  // ActionSpec[1]

// Inside second call:
let spec = executable.intent().action_specs().borrow(1);
assert_action_type<CreateStream>(spec);  // ABORT!
// ActionSpec[1] is CreatePoolAction, not CreateStreamAction
```

### 4. Completeness (Must Execute All)
```move
public fun finalize_execution(executable: Executable) {
    // Checks action_idx == action_specs.length()
    assert!(
        executable.action_idx() == executable.intent().action_specs().length(),
        ENotAllActionsExecuted
    );
    account::confirm_execution(executable);
}
```

### 5. Parameter Integrity (Cannot Fake)
```move
// PTB CANNOT pass fake parameters because do_* functions don't accept them!
public fun do_create_stream(
    executable: &mut Executable,  // ← Only takes Executable reference
    account: &mut Account,
    registry: &PackageRegistry,
    clock: &Clock,
    // NO amount parameter!
    // NO beneficiary parameter!
    // NO vault_name parameter!
) {
    // MUST read from ActionSpec
    let action_data = intents::action_spec_data(spec);
    let amount = bcs::peel_u64(...);  // ← From Intent, not PTB!
}
```

---

## Object Passing Between Actions

Actions can pass objects to each other using **two patterns**.

### Pattern 1: Executable Resources (Primary - Use This!)

**When to use:** Passing objects created by one action to the next action in the same Intent.

**Location:** `packages/futarchy_core/sources/executable_resources.move`

**Example: Launchpad Init Flow**
```move
// Action 1: Mint asset tokens
public fun do_init_mint_tokens<Config, Outcome, CoinType>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    ...
): Coin<CoinType> {
    let spec = ...;
    let action: MintAction = bcs::from_bytes(...);

    // Mint tokens
    let minted_coin = currency::do_mint_to_coin_unshared(account, action.amount, ctx);

    // Provide to next action via Executable's Bag
    executable_resources::provide_coin(
        executable::uid_mut(executable),
        string::utf8(b"minted_asset"),
        minted_coin,
        ctx
    );

    executable::increment_action_idx(executable);
}

// Action 2: Create AMM pool (needs minted tokens)
public fun do_init_create_pool<Config, Outcome, AssetType, StableType>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    ...
): ID {
    let spec = ...;
    let action: CreatePoolAction = bcs::from_bytes(...);

    // Take minted tokens from previous action (deterministic!)
    let asset_coin = executable_resources::take_coin<Outcome, AssetType>(
        executable::uid_mut(executable),
        string::utf8(b"minted_asset")
    );

    // Get stable from vault
    let stable_coin = vault::do_spend_unshared(account, action.stable_amount, ctx);

    // Create pool
    let (pool_id, lp_token) = amm::create_pool(asset_coin, stable_coin, ...);

    // Provide LP token for next action
    executable_resources::provide_coin(
        executable::uid_mut(executable),
        string::utf8(b"lp_token"),
        lp_token,
        ctx
    );

    executable::increment_action_idx(executable);
    pool_id
}

// Action 3: Lock LP tokens
public fun do_init_lock_lp<Config, Outcome, LPType>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    ...
) {
    // Take LP token from previous action
    let lp_token = executable_resources::take_coin<Outcome, LPType>(
        executable::uid_mut(executable),
        string::utf8(b"lp_token")
    );

    // Lock in vault
    vault::do_deposit_unshared(account, lp_token, ctx);

    executable::increment_action_idx(executable);
}

// Finalize: Bag MUST be empty
public fun finalize_launchpad_init(executable: Executable) {
    // Destroy resources - aborts if bag not empty!
    executable_resources::destroy_resources(
        executable::uid_mut(&mut executable)
    );

    account::confirm_execution(executable);
}
```

**Key Functions:**
```move
// Provide a coin to next actions
executable_resources::provide_coin<T, CoinType>(
    executable_uid: &mut UID,
    name: String,              // e.g., "minted_asset"
    coin: Coin<CoinType>,
    ctx: &mut TxContext,
)

// Take a coin from previous actions
executable_resources::take_coin<T, CoinType>(
    executable_uid: &mut UID,
    name: String,              // Same name used in provide
): Coin<CoinType>

// Check if coin exists
executable_resources::has_coin<T, CoinType>(
    executable_uid: &UID,
    name: String,
): bool

// Destroy bag (must be empty) - called in finalize
executable_resources::destroy_resources(executable_uid: &mut UID)
```

**Why This Works:**
1. ✅ **Bag attached to Executable UID** - PTB can't fake it
2. ✅ **Typed keys** - `name + TypeName` ensures type safety
3. ✅ **Mandatory cleanup** - `destroy_resources()` aborts if not empty
4. ✅ **Deterministic** - Same ActionSpecs → same bag operations → same results

### Pattern 2: Resource Requests (Secondary - For External Resources)

**When to use:** When PTB caller must provide resources NOT from previous actions.

**Location:** `packages/futarchy_core/sources/resource_requests.move`

**Use cases:**
- ❌ Launchpad init (all resources from Account/previous actions - use Pattern 1)
- ❌ Proposal execution (all resources from Account/previous actions - use Pattern 1)
- ✅ Bidding on auction (PTB provides bid coin)
- ✅ Contributing to pool (PTB provides liquidity)
- ✅ Paying fees (PTB provides payment)

**Example: External Contribution**
```move
// Action creates request (hot potato)
let request = resource_requests::new_request<ContributeAction>(ctx);
request.add_context("amount", 1000u64);

// PTB MUST provide coin (hot potato forces this)
let coin = tx.splitCoins(...)  // PTB provides this
let receipt = fulfill_contribution_request(request, coin, ...);
```

**For Launchpad/Proposals:** ❌ **Don't use this pattern** - use Pattern 1 (Executable Resources) instead.

---

## Implementation Checklist

For each action type (stream, pool, mint, transfer, etc.), implement:

### 1. Action Struct (Layer 1)
- [ ] Create action struct in dedicated module (e.g., `pool_init_actions.move`)
- [ ] Add `has store, copy, drop` abilities
- [ ] Include ALL execution parameters as fields
- [ ] Use BCS-serializable types only

### 2. Type Marker
- [ ] Add type marker struct to execution module (e.g., `vault.move`)
```move
public struct CreatePool has drop {}
```

### 3. `do_init_*` Execution Function (Layer 3)
**Important:** Function MUST be named `do_init_*` for both launchpad AND proposals!
- [ ] Signature: `public fun do_init_<action_name><Config, Outcome, ...>(executable: &mut Executable<Outcome>, ...)`
- [ ] Assert account ownership: `executable.intent().assert_is_account(account.addr())`
- [ ] Get ActionSpec: `let spec = executable.intent().action_specs().borrow(executable.action_idx())`
- [ ] Validate type: `assert_action_type<TypeMarker>(spec)`
- [ ] Check version: `assert!(intents::action_spec_version(spec) == 1, ...)`
- [ ] Deserialize: `let mut reader = bcs::new(*action_data); let field1 = bcs::peel_...()`
- [ ] Validate bytes consumed: `bcs_validation::validate_all_bytes_consumed(reader)`
- [ ] Execute action with deserialized params
- [ ] Increment index: `executable::increment_action_idx(executable)`

### 4. Object Passing (if needed)
- [ ] Identify resources needed from previous actions
- [ ] In producer action: Call `executable_resources::provide_coin(executable::uid_mut(exec), "key", coin, ctx)`
- [ ] In consumer action: Call `executable_resources::take_coin(executable::uid_mut(exec), "key")`
- [ ] In finalize: Call `executable_resources::destroy_resources(executable::uid_mut(&mut exec))`

### 5. Builder Function (for SDK)
- [ ] Create `add_<action>_spec()` function in action module
```move
public fun add_create_pool_spec(
    specs: &mut InitActionSpecs,
    // ... all action parameters
) {
    let action = CreatePoolAction { /* fields */ };
    let action_data = bcs::to_bytes(&action);
    init_action_specs::add_action(
        specs,
        type_name::get<CreatePoolAction>(),
        action_data
    );
}
```

### 6. Package Registry
- [ ] Register action type in PackageRegistry
```typescript
registry.add_package(
    "account_actions",
    packageAddr,
    version,
    [
        "CreateStreamAction",
        "CreatePoolAction",
        // ... all action types
    ],
    category,
    description
);
```

### 7. Testing
- [ ] Test: Create Intent with action
- [ ] Test: Execute via PTB
- [ ] Test: Wrong function call → abort
- [ ] Test: Skip action → abort
- [ ] Test: Incomplete execution → finalize abort
- [ ] Test: Object passing (if applicable)

---

## Example: Complete Launchpad Init Flow

```move
// === CREATION (SDK) ===

// 1. Create InitActionSpecs
let mut specs = init_action_specs::new_init_specs();

// 2. Add actions in order
stream_init_actions::add_create_stream_spec(
    &mut specs,
    vault_name,
    beneficiary,
    amount,
    start_time,
    end_time,
    cliff_time,
    max_per_withdrawal,
    min_interval_ms,
    max_beneficiaries,
);

pool_init_actions::add_create_pool_spec(
    &mut specs,
    asset_amount,
    stable_amount,
    fee_rate,
);

// 3. Store specs on Raise object (before DAO creation)
raise.set_init_actions(specs);

// === EXECUTION (PTB after raise completes) ===

// 1. Create Intent from InitActionSpecs
let executable = launchpad::begin_init_execution(raise, account, ...);

// 2. Execute actions in order (PTB routes directly)
let stream_id = vault::do_init_create_stream<Config, Outcome, AssetType>(
    executable,
    account,
    registry,
    clock,
    version_witness,
    witness,
    ctx
);

let pool_id = amm::do_init_create_pool<Config, Outcome, AssetType, StableType>(
    executable,
    account,
    registry,
    clock,
    version_witness,
    witness,
    ctx
);

// 3. Finalize (checks all actions executed, bag empty)
launchpad::finalize_init_execution(executable, account, registry, clock, ctx);
```

---

## Migration Plan

### Current State
- ✅ `CreateStreamAction` exists (`stream_init_actions.move:23`)
- ✅ `ActionSpec` exists (`intents.move:67`)
- ✅ `Intent` exists (`intents.move:90`)
- ✅ `do_init_create_stream` exists (`vault.move:1439`) ← **Reference implementation**
- ✅ `executable_resources` exists (`futarchy_core/sources/executable_resources.move`)
- ✅ `resource_requests` exists (but not needed for launchpad/proposals)

### What to Build

#### Phase 1: Core Init Actions (Launchpad)
- [ ] `do_init_mint_tokens` (currency module)
- [ ] `do_init_lock_treasury_cap` (currency module)
- [ ] `do_init_create_pool` (AMM module)
- [ ] `do_init_add_liquidity` (AMM module)
- [ ] `do_init_deposit_vault` (vault module)
- [ ] `do_init_withdraw_vault` (vault module)
- [ ] `begin_launchpad_init` (creates Executable from InitActionSpecs)
- [ ] `finalize_launchpad_init` (confirms execution, cleans up resources)

#### Phase 2: Proposal Actions (Governance)
**Note:** Proposals use `do_init_*` functions (same pattern as launchpad), NOT regular `do_*` functions!

**COMPLETED - Full 3-Layer Pattern:**
- [X] `do_init_create_stream` (vault.move:1439 - verified working)
- [X] `do_init_withdraw_and_transfer` (vault.move - NEW - withdraws from vault + transfers)
- [X] `do_create_vesting` (vesting.move - creates standalone vesting with TRUE fund isolation)
- [X] `do_cancel_vesting` (vesting.move - cancels vesting, returns unvested funds)
- [X] `do_init_remove_treasury_cap` (currency.move - verified working)
- [X] `do_init_remove_metadata` (currency.move - verified working)
- [X] `do_emit_memo` (memo.move - reuses existing, has Layer 1 & 2 added)
- [X] `do_deposit` (vault.move:617 - has Layer 3, added Layers 1 & 2 in vault_init_actions.move)
- [X] `do_spend` (vault.move:775 - has Layer 3, added Layers 1 & 2 in vault_init_actions.move)
- [X] `do_cancel_stream` (vault.move:676 - has Layer 3, added Layers 1 & 2 in vault_init_actions.move)
- [X] `do_approve_coin_type` (vault.move:838 - has Layer 3, added Layers 1 & 2 in vault_init_actions.move)
- [X] `do_remove_approved_coin_type` (vault.move:879 - has Layer 3, added Layers 1 & 2 in vault_init_actions.move)
- [X] `do_mint` (currency.move:542 - has Layer 3, added Layers 1 & 2 in currency_init_actions.move)
- [X] `do_burn` (currency.move:605 - has Layer 3, added Layers 1 & 2 in currency_init_actions.move)
- [X] `do_disable` (currency.move:398 - has Layer 3, added Layers 1 & 2 in currency_init_actions.move)
- [X] `do_update` (currency.move:456 - has Layer 3, added Layers 1 & 2 in currency_init_actions.move)
- [X] `ptb_executor.move` reviewed and updated - uses same pattern as launchpad

**ALSO COMPLETED - Full 3-Layer Pattern:**
- [X] `do_borrow` (access_control.move:118 - has Layer 3, added Layers 1 & 2 in access_control_init_actions.move)
- [X] `do_return` (access_control.move:177 - has Layer 3, added Layers 1 & 2 in access_control_init_actions.move)
- [X] `do_transfer` (transfer.move:74 - has Layer 3, added Layers 1 & 2 in transfer_init_actions.move)
- [X] `do_transfer_to_sender` (transfer.move:123 - has Layer 3, added Layers 1 & 2 in transfer_init_actions.move)
- [X] `do_upgrade` (package_upgrade.move:608 - has Layer 3, added Layers 1 & 2 in package_upgrade_init_actions.move)
- [X] `do_commit_dao_only` (package_upgrade.move:664 - has Layer 3, added Layers 1 & 2 in package_upgrade_init_actions.move)
- [X] `do_commit_with_cap` (package_upgrade.move:733 - has Layer 3, added Layers 1 & 2 in package_upgrade_init_actions.move)
- [X] `do_restrict` (package_upgrade.move:800 - has Layer 3, added Layers 1 & 2 in package_upgrade_init_actions.move)
- [X] `do_create_commit_cap` (package_upgrade.move:856 - has Layer 3, added Layers 1 & 2 in package_upgrade_init_actions.move)

**Oracle Actions (futarchy_oracle_actions package):**
- [X] `do_create_oracle_grant` (oracle_actions.move:871 - has Layer 3, added Layers 1 & 2 in oracle_init_actions.move)
- [X] `do_cancel_grant` (oracle_actions.move:935 - has Layer 3, added Layers 1 & 2 in oracle_init_actions.move)

**Futarchy Actions (futarchy_actions package):**
- [X] `do_create_dissolution_capability` (dissolution_actions.move:317 - has Layer 3, added Layers 1 & 2 in dissolution_init_actions.move)
- [X] `do_set_quotas` (quota_actions.move:54 - has Layer 3, added Layers 1 & 2 in quota_init_actions.move)
- [X] `do_set_proposals_enabled` (config_actions.move:267 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)
- [X] `do_terminate_dao` (config_actions.move:345 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)
- [X] `do_update_name` (config_actions.move:411 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)
- [X] `do_update_trading_params` (config_actions.move:493 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)
- [X] `do_update_metadata` (config_actions.move:572 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)
- [X] `do_update_twap_config` (config_actions.move:655 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)
- [X] `do_update_governance` (config_actions.move:731 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)
- [X] `do_update_metadata_table` (config_actions.move:846 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)
- [X] `do_update_conditional_metadata` (config_actions.move:936 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)
- [X] `do_update_sponsorship_config` (config_actions.move:1009 - has Layer 3, added Layers 1 & 2 in config_init_actions.move)

**Governance Actions (futarchy_governance_actions package):**
- [X] `do_add_package` (package_registry_actions.move:136 - has Layer 3, added Layers 1 & 2 in package_registry_init_actions.move)
- [X] `do_remove_package` (package_registry_actions.move:191 - has Layer 3, added Layers 1 & 2 in package_registry_init_actions.move)
- [X] `do_update_package_version` (package_registry_actions.move:220 - has Layer 3, added Layers 1 & 2 in package_registry_init_actions.move)
- [X] `do_update_package_metadata` (package_registry_actions.move:252 - has Layer 3, added Layers 1 & 2 in package_registry_init_actions.move)
- [X] `do_pause_account_creation` (package_registry_actions.move:301 - has Layer 3, added Layers 1 & 2 in package_registry_init_actions.move)
- [X] `do_unpause_account_creation` (package_registry_actions.move:338 - has Layer 3, added Layers 1 & 2 in package_registry_init_actions.move)
- [X] `do_set_factory_paused` (protocol_admin_actions.move:264 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_disable_factory_permanently` (protocol_admin_actions.move:304 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_add_stable_type` (protocol_admin_actions.move:347 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_remove_stable_type` (protocol_admin_actions.move:388 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_update_dao_creation_fee` (protocol_admin_actions.move:429 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_update_proposal_fee` (protocol_admin_actions.move:468 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_update_verification_fee` (protocol_admin_actions.move:513 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_add_verification_level` (protocol_admin_actions.move:560 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_remove_verification_level` (protocol_admin_actions.move:600 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_withdraw_fees_to_treasury` (protocol_admin_actions.move:639 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_add_coin_fee_config` (protocol_admin_actions.move:684 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_update_coin_creation_fee` (protocol_admin_actions.move:739 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_update_coin_proposal_fee` (protocol_admin_actions.move:785 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)
- [X] `do_apply_pending_coin_fees` (protocol_admin_actions.move:836 - has Layer 3, added Layers 1 & 2 in protocol_admin_init_actions.move)

**✅ ALL ACTIONS COMPLETE! All 59 actions now have full 3-layer pattern implementation.**
- 25 actions in account_actions package (including CreateVesting, CancelVesting)
- 2 actions in futarchy_oracle_actions package
- 12 actions in futarchy_actions package
- 20 actions in futarchy_governance_actions package

#### Phase 3: SDK Integration
- [ ] Update SDK to build PTBs with direct `do_*` calls
- [ ] Add TypeScript types for all action structs
- [ ] Add BCS serialization helpers
- [ ] Add PTB builders for launchpad init
- [ ] Add PTB builders for proposal execution

#### Phase 4: Documentation & Testing
- [ ] Document each action type
- [ ] Integration tests for full launchpad flow
- [ ] Integration tests for full proposal flow
- [ ] Test object passing patterns
- [ ] Security audit of execution guarantees

---

## TODO: Action Types Needed

### Launchpad Init Actions
- [X] `CreateStreamAction` - Create vesting stream
- [ ] `MintTokensAction` - Mint asset tokens
- [ ] `CreatePoolAction` - Create AMM pool
- [ ] `AddLiquidityAction` - Add initial liquidity
- [ ] `LockTreasuryCapAction` - Lock treasury cap in account
- [ ] `DepositVaultAction` - Deposit to vault
- [ ] `WithdrawVaultAction` - Withdraw from vault (for pool creation)

### Proposal Execution Actions
- [ ] `SpendAction` - Withdraw from treasury (verify existing)
- [ ] `TransferAction` - Send coins to address
- [ ] `MintAction` - Mint new tokens
- [ ] `BurnAction` - Burn tokens
- [ ] `UpgradePackageAction` - Execute package upgrade
- [ ] `UpdateConfigAction` - Update DAO config
- [ ] `UpdatePolicyAction` - Update policy settings

### Future Actions
- [ ] `CreateSubDAOAction` - Spawn child DAO
- [ ] `DelegateAction` - Delegate voting power
- [ ] `StakeAction` - Stake in external protocol
- [ ] `SwapAction` - Execute DEX swap
- [ ] Custom actions via plugin system

---

## CRITICAL: Never Return Objects to PTB Caller

### The Vulnerability

**Action functions that return objects to the PTB caller are EXPLOITABLE.** The executor can steal returned objects instead of passing them to subsequent actions.

```move
// ❌ VULNERABLE - Returns coin to PTB caller
public fun do_spend<...>(...): Coin<CoinType> {
    let coin = vault.withdraw(amount);
    coin  // PTB caller receives this - CAN STEAL IT
}

// ❌ VULNERABLE - Returns object to PTB caller
public fun do_withdraw_object<...>(...): T {
    let obj = account.receive(receiving);
    obj  // PTB caller receives this - CAN STEAL IT
}
```

**Attack scenario:**
```
Intent: [SpendAction(100 SUI), TransferAction(recipient)]

Expected flow:
  do_spend() → returns 100 SUI → PTB passes to → do_transfer() → recipient gets 100 SUI

Attack flow:
  do_spend() → returns 100 SUI → PTB KEEPS IT → do_transfer() never called
  Executor steals 100 SUI!
```

### The Fix: Use `executable_resources`

**All objects produced by actions MUST be stored in `executable_resources`, not returned.**

```move
// ✅ SECURE - Stores coin in executable_resources
public fun do_spend<...>(
    executable: &mut Executable<Outcome>,
    ...
    ctx: &mut TxContext,
) {
    // Deserialize resource_name from ActionSpec (deterministic!)
    let resource_name = std::string::utf8(bcs::peel_vec_u8(&mut reader));

    let coin = vault.withdraw(amount);

    // Store in executable_resources - PTB cannot intercept
    executable_resources::provide_coin(
        executable::uid_mut(executable),
        resource_name,
        coin,
        ctx,
    );

    executable::increment_action_idx(executable);
}

// ✅ SECURE - Takes coin from executable_resources
public fun do_transfer<...>(
    executable: &mut Executable<Outcome>,
    ...
) {
    // Deserialize resource_name and recipient from ActionSpec
    let resource_name = std::string::utf8(bcs::peel_vec_u8(&mut reader));
    let recipient = bcs::peel_address(&mut reader);

    // Take from executable_resources (deterministic!)
    let coin = executable_resources::take_coin(
        executable::uid_mut(executable),
        resource_name,
    );

    transfer::public_transfer(coin, recipient);
    executable::increment_action_idx(executable);
}
```

### Why This Works

1. **`resource_name` is in ActionSpec** - Set at Intent creation, approved by governance, immutable at execution
2. **PTB caller never touches the object** - Goes directly from producer action → executable_resources → consumer action
3. **Deterministic** - Same Intent always produces same resource flow
4. **Enforced cleanup** - `destroy_resources()` aborts if bag not empty

### Checklist for New Actions

When writing a new action that produces an object:

- [ ] **NEVER return the object** from the function
- [ ] **Add `resource_name: String` field** to the Action struct
- [ ] **Deserialize `resource_name`** from ActionSpec BCS data
- [ ] **Call `executable_resources::provide_coin/provide_object`** to store output
- [ ] **Document** which resource_name the action outputs to

When writing a new action that consumes an object:

- [ ] **NEVER accept the object as a function parameter** from PTB
- [ ] **Add `resource_name: String` field** to the Action struct
- [ ] **Deserialize `resource_name`** from ActionSpec BCS data
- [ ] **Call `executable_resources::take_coin/take_object`** to retrieve input

### Exceptions (Intentional Returns)

Some patterns legitimately return objects to PTB:

1. **Hot Potatoes** (no `store` ability) - Must be used in same tx, e.g., `UpgradeTicket`
2. **ResourceRequest pattern** - For external contributions (PTB provides resources TO the protocol)
3. **Borrow/Return pattern** - Returns Cap but REQUIRES matching ReturnAction in same Intent

These are safe because the returned object either:
- Cannot be stored (hot potato forces immediate use)
- Is being PROVIDED by PTB, not taken from protocol

---

## Anti-Patterns (DO NOT DO)

### ❌ Don't Add Dispatcher Layer
```move
// BAD - adds unnecessary code
public fun dispatch_vault_action(executable: &mut Executable, ...) {
    if (type == CreateStream) do_create_stream(...)
    else if (type == Deposit) do_deposit(...)
    // ... 50 lines of if/else
}
```

### ❌ Don't Accept Params from PTB
```move
// BAD - allows PTB to fake params
public fun do_create_stream(
    executable: &mut Executable,
    amount: u64,  // ❌ NO! PTB could pass fake amount
    beneficiary: address,  // ❌ NO! PTB could pass fake beneficiary
) { ... }
```

### ❌ Don't Skip Type Validation
```move
// BAD - no type check
public fun do_create_stream(executable: &mut Executable, ...) {
    let spec = ...;
    // Missing: assert_action_type<CreateStream>(spec);
    let action = bcs::from_bytes(...);  // ❌ Could deserialize wrong type!
}
```

### ❌ Don't Skip Bytes Validation
```move
// BAD - allows trailing data attacks
public fun do_create_stream(executable: &mut Executable, ...) {
    let mut reader = bcs::new(*action_data);
    let amount = bcs::peel_u64(&mut reader);
    // Missing: bcs_validation::validate_all_bytes_consumed(reader);
    // ❌ Attacker could append malicious data!
}
```

### ❌ Don't Forget to Increment Index
```move
// BAD - breaks sequential ordering
public fun do_create_stream(executable: &mut Executable, ...) {
    let spec = ...;
    let action = bcs::from_bytes(...);
    execute_action(...);
    // Missing: executable::increment_action_idx(executable);
    // ❌ Next action will read same ActionSpec again!
}
```

### ❌ Don't Return Objects to PTB Caller
```move
// BAD - executor can steal the coin!
public fun do_spend(...): Coin<CoinType> {
    let coin = vault.withdraw(amount);
    coin  // ❌ NEVER return objects - use executable_resources instead!
}

// GOOD - store in executable_resources
public fun do_spend(...) {
    let coin = vault.withdraw(amount);
    executable_resources::provide_coin(uid, resource_name, coin, ctx);  // ✅
}
```

---

## Security Considerations

### 1. BCS Deserialization Safety
- ✅ Always validate action type before deserializing
- ✅ Always validate all bytes consumed after deserializing
- ✅ Use typed deserialization helpers (bcs::peel_u64, not manual byte parsing)

### 2. Executable Hot Potato
- ✅ Executable cannot be stored (forces single-transaction execution)
- ✅ Executable cannot be copied or cloned
- ✅ Executable must be consumed by `confirm_execution`

### 3. Account Ownership
- ✅ Always call `executable.intent().assert_is_account(account.addr())`
- ✅ Prevents executing actions on wrong account

### 4. Resource Cleanup
- ✅ Always call `destroy_resources()` in finalize
- ✅ Aborts if bag not empty (prevents resource leaks)

### 5. Action Index Invariants
- ✅ Cannot skip actions (index mismatch)
- ✅ Cannot reorder actions (index enforces sequence)
- ✅ Cannot execute partial batch (finalize checks completeness)

---

## Questions & Answers

**Q: Why not use a dispatcher for simpler SDK?**
A: Dispatcher adds ~50 lines per module with zero safety benefit. Type validation already ensures correct function called. Less code = fewer bugs.

**Q: How does PTB routing work if SDK has bug?**
A: If SDK calls wrong function, `assert_action_type<T>` will abort. Same safety as dispatcher, but enforced by type system not runtime routing.

**Q: Can actions pass objects between each other?**
A: Yes! Use `executable_resources::provide_coin` and `take_coin`. Bag is attached to Executable UID, so it's deterministic and non-fakeable.

**Q: What if action needs external resource from PTB?**
A: Use Pattern 2 (resource_requests) with hot potato. But for launchpad/proposals, all resources come from Account - use Pattern 1 instead.

**Q: How to add new action type?**
A: Follow 7-step checklist above. Use `do_init_create_stream` as reference implementation.

**Q: Can keeper execute with different parameters?**
A: No. Parameters are BCS-serialized in ActionSpec. `do_*` functions don't accept param arguments, they MUST deserialize from ActionSpec.

**Q: Is this the same pattern for proposals and launchpad?**
A: Yes! Same 3-layer pattern, same guarantees, same `do_init_*` function naming. Only difference is Outcome type (LaunchpadOutcome vs FutarchyOutcome).

**Q: What's the difference between `do_init_*` and `do_*` functions?**
A: `do_init_*` functions are used for the 3-layer pattern (launchpad init + proposal execution). They read parameters from ActionSpecs in an Executable. Regular `do_*` functions (like `do_spend`, `do_deposit`) are for direct operations on shared accounts and accept parameters as function arguments. Only actions with all 3 layers can be staged in launchpad/proposals.

---

## Reference Implementation

See: `packages/move-framework/packages/actions/sources/lib/vault.move:1439`

```move
public fun do_init_create_stream<Config: store, Outcome: store, CoinType: drop, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    clock: &Clock,
    _version_witness: VersionWitness,
    _intent_witness: IW,
    ctx: &mut TxContext,
): ID
```

This is the **gold standard** - all other `do_*` functions should follow this pattern.

---

## Summary

**3 Layers:**
1. Action Struct (pure data)
2. Intent with ActionSpecs (immutable batch in Account)
3. `do_*` execution functions (read from Executable, validate, execute)

**Key Points:**
- ✅ No dispatcher - PTB routes directly
- ✅ Type system enforces safety
- ✅ Parameters from ActionSpec only
- ✅ Executable Resources for object passing
- ✅ Same pattern for launchpad + proposals
- ✅ Minimal code, maximum safety

**Next Steps:**
1. Use `do_init_create_stream` as template
2. Build remaining init actions (mint, pool, liquidity)
3. Build `begin_launchpad_init` and `finalize_launchpad_init`
4. Update SDK to build PTBs with direct `do_*` calls
5. Test full launchpad flow
6. Apply same pattern to proposal execution actions
