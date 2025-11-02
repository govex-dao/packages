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

### Layer 3: `do_*` Execution Functions

Execution functions **read from Executable, validate type, deserialize, execute**.

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

### 3. `do_*` Execution Function (Layer 3)
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
- [ ] `do_spend` (already exists at vault.move:878 - verify pattern)
- [ ] `do_deposit` (already exists at vault.move:637 - verify pattern)
- [ ] `do_mint` (needs to be built)
- [ ] `do_transfer` (needs to be built)
- [ ] `do_upgrade_package` (needs to be built)
- [ ] Review `ptb_executor.move` - ensure it uses same pattern

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
A: Yes! Same 3-layer pattern, same guarantees. Only difference is Outcome type (LaunchpadOutcome vs FutarchyOutcome).

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
