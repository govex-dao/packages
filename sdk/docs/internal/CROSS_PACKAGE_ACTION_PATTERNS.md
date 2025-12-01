# Cross-Package Action/Intent Orchestration Patterns in Futarchy

## Executive Summary

The Futarchy protocol implements a sophisticated **type-safe intent orchestration pattern** using Move's static typing combined with generic action specifications. The system uses a **two-phase execution model**: staging actions during DAO creation, then executing them via PTB (Programmable Transaction Blocks) after setup is complete.

---

## 1. How `create_dao_with_init_specs` Handles Init Actions

### Location
`/Users/admin/govex/packages/futarchy_factory/sources/factory.move` (lines 262-319)

### High-Level Flow

```
create_dao_with_init_specs()
  ↓
[Phase 1: DAO Creation - In Memory]
  - Create account (shared object)
  - Create unified spot pool (shared object)  
  - Initialize treasury vault
  - Pre-approve common coin types (SUI, AssetType, StableType)
  - Lock TreasuryCap + Store CoinMetadata
  ↓
[Phase 2: Stage Init Actions - On-Chain Intent Storage]
  - Loop through vector<InitActionSpecs>
  - For each spec at index i:
    - Call init_actions::stage_init_intent()
    - Creates Intent object with InitIntentOutcome
    - Stores action specs as part of Intent on Account
  ↓
[Phase 3: Share Objects Atomically]
  - transfer::public_share_object(account)
  - unified_spot_pool::share(spot_pool)
  ↓
[Phase 4: Emit Event]
  - DAOCreated event with creator info
```

### Key Design Decisions

1. **Two-Step Process**: 
   - Staging happens during DAO creation (atomic with factory logic)
   - Execution happens separately via PTB after raise completes
   - Frontend reads staged specs and constructs deterministic PTB

2. **Intent as Storage Mechanism**:
   - Uses `account_protocol::intents::Intent` as tamper-proof storage
   - Each init action becomes an ActionSpec within the Intent
   - Intent key: `"init_intent_" + owner_id + "_" + index`

3. **Atomicity Guarantee**:
   - If any step fails before sharing, entire transaction aborts
   - No partial DAO creation possible
   - All init specs are stored before DAO becomes shared

---

## 2. Types of Init Actions Possible

### Pattern: Generic Type-Safe Action Specifications

The system uses `InitActionSpecs` (defined in `futarchy_types::init_action_specs`) as a generic container:

```move
public struct ActionSpec has store, drop, copy {
    action_type: TypeName,    // Compile-time type identity
    action_data: vector<u8>,  // BCS-serialized action payload
}

public struct InitActionSpecs has store, drop, copy {
    actions: vector<ActionSpec>,
}
```

### Action Categories by Package

#### **futarchy_actions::config_actions** (DAO Configuration)

Marker types (used for type dispatch):
- `SetProposalsEnabled` - Enable/disable proposal creation
- `UpdateName` - Update DAO name
- `TerminateDao` - Permanently terminate DAO
- `TradingParamsUpdate` - Update trading parameters
- `MetadataUpdate` - Update DAO metadata (name, icon, description)
- `TwapConfigUpdate` - Update TWAP configuration
- `GovernanceUpdate` - Update governance settings
- `MetadataTableUpdate` - Update custom metadata table
- `UpdateConditionalMetadata` - Update conditional token metadata
- `SponsorshipConfigUpdate` - Update sponsorship configuration

#### **futarchy_actions::liquidity_actions** (Market Setup)

- `CreatePoolAction` - Create liquidity pool
- `AddLiquidityAction` - Add liquidity to pool
- `RemoveLiquidityAction` - Remove liquidity from pool
- `WithdrawLpTokenAction` - Withdraw LP tokens from custody
- `UpdatePoolParamsAction` - Update pool parameters

#### **futarchy_actions::dissolution_actions** (DAO Termination)

- `CreateDissolutionCapabilityAction` - Create capability for redemption

#### **futarchy_governance_actions** (Governance)

- Custom proposal execution intents (outcome-specific)

### Action Serialization Pattern

```move
// Creation
let action = SomeAction { field1, field2, ... };
let action_bytes = bcs::to_bytes(&action);
let action_spec = init_action_specs::new_action_spec(
    type_name::get<SomeActionMarker>(),
    action_bytes
);
```

---

## 3. How Init Actions Call Into Other Packages

### Cross-Package Execution Architecture

```
factory.move (DAO Creation)
  ├─→ init_actions.move (Staging)
  │   ├─→ account_protocol::intents (Storage)
  │   └─→ config_intents::witness() (Type dispatch)
  │
  └─→ [Later: PTB Execution]
      ├─→ config_actions.move (Execute)
      │   ├─→ futarchy_config.move (Update config)
      │   └─→ dao_config.move (Nested config updates)
      │
      ├─→ liquidity_actions.move (Create pools)
      │   ├─→ unified_spot_pool.move (Pool operations)
      │   └─→ markets_core.move (Market integration)
      │
      └─→ governance_actions.move (Set up governance)
          └─→ proposal.move (Proposal system)
```

### Execution Model: Type-Driven Dispatch

The system uses **TypeName-based dispatch** instead of a generic executor:

```move
// In config_actions.move - Execute an action from an Executable
pub fun do_update_metadata<Outcome: store, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version: VersionWitness,
    intent_witness: IW,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Step 1: Get action spec from executable
    let specs = executable::intent(executable).action_specs();
    let spec = specs.borrow(executable::action_idx(executable));
    
    // Step 2: CRITICAL - Type check BEFORE deserialization
    action_validation::assert_action_type<MetadataUpdate>(spec);
    
    // Step 3: Get action data
    let action_data = intents::action_spec_data(spec);
    
    // Step 4: Safe deserialization with BCS reader
    let mut reader = bcs::new(*action_data);
    let dao_name = if (reader.peel_bool()) {
        option::some(ascii::string(reader.peel_vec_u8()))
    } else {
        option::none()
    };
    // ... more field parsing
    
    // Step 5: Validate all bytes consumed
    bcs_validation::validate_all_bytes_consumed(reader);
    
    // Step 6: Apply mutations to account
    let config = account::config_mut<FutarchyConfig, ConfigActionsWitness>(
        account, registry, version, ConfigActionsWitness {}
    );
    
    if (action.dao_name.is_some()) {
        futarchy_config::set_dao_name(config, ...);
    };
    
    // Step 7: Emit event
    event::emit(MetadataChanged { ... });
    
    // Step 8: Increment action index
    executable::increment_action_idx(executable);
}
```

### Two Execution Paths

#### Path 1: Init Actions (During DAO Creation)

```move
// In init_actions.move - Used during stage_init_intent()
pub fun do_update_name_internal(
    account: &mut Account,
    registry: &PackageRegistry,
    action: UpdateNameAction,  // Direct struct, not from Executable
    version: VersionWitness,
    clock: &Clock,
    ctx: &mut TxContext,
)
```

**Advantages:**
- Direct struct passing (no BCS deserialization needed)
- Compile-time type checking
- Can be executed atomically during DAO creation
- Frontend can batch these into a single PTB

#### Path 2: Governance Intents (Post-Creation Execution)

```move
// In governance_intents.move - Used for proposal outcomes
pub fun execute_proposal_intent<AssetType, StableType, Outcome>(
    account: &mut Account,
    registry: &PackageRegistry,
    proposal: &mut Proposal<AssetType, StableType>,
    outcome_index: u64,
    outcome: Outcome,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // 1. Get intent spec from proposal
    let intent_spec = proposal::take_intent_spec_for_outcome(proposal, outcome_index);
    
    // 2. Create and store Intent temporarily
    let intent_key = create_and_store_intent_from_spec(
        account, registry, intent_spec, outcome, clock, ctx
    );
    
    // 3. Create Executable from stored Intent
    let (_outcome, executable) = account::create_executable<FutarchyConfig, Outcome, GovernanceWitness>(
        account, registry, intent_key, clock, version::current(), GovernanceWitness{}, ctx
    );
    
    // 4. Execute actions in order
    // (caller will invoke do_update_metadata(), do_update_name(), etc.)
}
```

---

## 4. Action/Intent Registry & Dispatch Pattern

### NOT a Traditional Registry Pattern

Unlike Sui Move frameworks that use dynamic registries, Futarchy uses **static, compile-time dispatch**:

#### Key Comment from `factory.move` (line 167)
```move
// === Internal Helper Functions ===
// Note: Action registry removed - using statically-typed pattern like move-framework
```

#### Key Comment from `config_intents.move` (lines 407-410)
```move
// === Intent Processing ===
// Note: Processing of config intents is handled by PTB calls
// which execute actions directly. The process_intent! macro is not
// used here because it doesn't support passing additional parameters (account, clock, ctx)
// that are needed by the action execution functions.
```

### How Dispatch Works: TypeName-Based Matching

1. **Storage Phase** (factory/init_actions):
   ```move
   intents::add_action_spec_with_typename(
       intent,
       init_action_specs::action_type(action),  // TypeName of action marker
       *init_action_specs::action_data(action), // BCS bytes
       witness,
   );
   ```

2. **Validation Phase** (Before Deserialization):
   ```move
   action_validation::assert_action_type<MetadataUpdate>(spec);
   // Uses: type_name::with_defining_ids<T>() to compare TypeNames
   ```

3. **Execution Phase** (PTB or Governance):
   ```move
   // Frontend/PTB calls the right do_* function based on TypeName
   // This is a manual dispatch - the caller knows which function to call
   // by examining the action type stored on-chain
   ```

### Type Safety Guarantees

The pattern provides **compile-time type safety** with **runtime verification**:

```move
// In action_validation.move
pub fun assert_action_type<T>(spec: &ActionSpec) {
    let expected_type = type_name::with_defining_ids<T>();
    let actual_type = intents::action_spec_type(spec);
    assert!(actual_type == expected_type, EActionTypeMismatch);
}
```

**Why this works:**
- TypeName is computed from the module path and function type parameters
- Compile-time: SDK knows all possible action types (MetadataUpdate, UpdateName, etc.)
- Runtime: BCS deserialization only happens after type match
- No arbitrary code execution: Each action type has specific, known do_* functions

---

## 5. Cross-Package Orchestration Summary

### Package Dependencies & Execution Order

```
Phase 1: DAO Creation (Atomic)
├─ futarchy_factory::factory::create_dao_with_init_specs()
│  ├─ Creates Account (with FutarchyConfig)
│  ├─ Creates UnifiedSpotPool
│  ├─ Pre-approves coin types
│  └─ Calls: futarchy_factory::init_actions::stage_init_intent()
│
└─ futarchy_factory::init_actions::stage_init_intent()
   ├─ Calls: account_protocol::intents::add_action_spec_with_typename()
   ├─ Stores action specs as Intent on Account
   └─ Intent key: "init_intent_{owner}_{index}"

Phase 2: PTB Execution (After Raise)
├─ Frontend reads staged InitActionSpecs
├─ Constructs deterministic PTB
│
├─ Call: futarchy_actions::config_actions::do_update_metadata()
│  ├─ Validates action type
│  ├─ Deserializes action data (BCS)
│  ├─ Calls: futarchy_config::set_dao_name/set_icon_url/set_description()
│  └─ Calls: futarchy_core::dao_config setters
│
├─ Call: futarchy_actions::liquidity_actions::do_create_pool()
│  ├─ Deserializes pool parameters
│  ├─ Calls: unified_spot_pool::create_and_initialize()
│  └─ Returns ResourceRequest for chaining
│
└─ Call: futarchy_actions::dissolution_intents (if terminating)
   ├─ Sets operational_state to TERMINATED
   └─ Stores dissolution parameters on DaoState

Phase 3: Governance Execution (Post-Proposal Resolution)
├─ Proposal outcome resolves (e.g., "YES" wins)
├─ Call: futarchy_governance_actions::governance_intents::execute_proposal_intent()
│  ├─ Gets intent spec from proposal
│  ├─ Creates Intent and Executable
│  └─ Caller executes do_* functions in sequence
│
└─ Updates to DAO configuration, markets, etc.
```

### Key Architectural Patterns

1. **Witness-Based Access Control**
   ```move
   ConfigIntent {} - witness type for config actions
   LiquidityIntent {} - witness type for liquidity actions
   DissolutionIntent {} - witness type for dissolution actions
   GovernanceWitness {} - witness type for governance actions
   ```

2. **Intent as Transaction Log**
   - Each action becomes an ActionSpec in an Intent
   - Intent is stored on Account as a dynamic field
   - Provides audit trail and tamper-proofing
   - Can be cleaned up after execution via cleanup_init_intents()

3. **Resource Request for Chaining**
   ```move
   // Liquidity pool creation returns ResourceRequest for dependent actions
   do_create_pool() → ResourceRequest<CreatePoolAction>
   fulfill_create_pool() → (ResourceReceipt, pool_id)
   // pool_id can be used immediately in same PTB
   ```

4. **Type-Driven Dispatch (NOT Registry)**
   - No global action registry
   - Actions identified by TypeName
   - Dispatch is manual (Frontend/PTB knows the type)
   - Matches Move framework patterns

---

## 6. SDK Design Recommendations

Based on this analysis:

### For SDK Type Generation
1. Generate marker types for each action (SetProposalsEnabled, UpdateName, etc.)
2. Generate action struct types with field accessors
3. Generate BCS serializers for each action type
4. Map action types to execution function names

### For PTB Construction
1. Read staged InitActionSpecs from Account intents
2. For each ActionSpec:
   - Get action_type (TypeName)
   - Match against known action types
   - Call corresponding do_* function with deserialized action struct
3. Chain dependent actions using pool_id/object results

### For Action Creation
1. Provide builders for each action type
2. Serialize to BCS
3. Wrap in InitActionSpecs with TypeName

### For Execution
1. Two paths: Init (direct structs) vs Governance (from Intent)
2. Type validation before deserialization
3. Clear error messages for type mismatches
4. Event emissions for audit trail

---

## Key Files Reference

- **DAO Creation**: `/Users/admin/govex/packages/futarchy_factory/sources/factory.move`
- **Init Staging**: `/Users/admin/govex/packages/futarchy_factory/sources/init_actions.move`
- **Config Actions**: `/Users/admin/govex/packages/futarchy_actions/sources/config/config_actions.move`
- **Config Intents**: `/Users/admin/govex/packages/futarchy_actions/sources/config/config_intents.move`
- **Liquidity Intents**: `/Users/admin/govex/packages/futarchy_actions/sources/liquidity/liquidity_intents.move`
- **Governance Intents**: `/Users/admin/govex/packages/futarchy_governance_actions/sources/governance/governance_intents.move`
- **Type Specs**: `/Users/admin/govex/packages/futarchy_types/sources/init_action_specs.move`
- **Action Validation**: `/Users/admin/govex/packages/futarchy_core/sources/action_validation.move`

