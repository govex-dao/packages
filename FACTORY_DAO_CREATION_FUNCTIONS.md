# Factory DAO Creation Functions - Complete Overview

## All DAO Creation Functions

### 1. `create_dao` (PUBLIC, line 203)

**Visibility**: `public fun`
**Can call from PTB**: ✅ YES
**Shares DAO**: ✅ YES (immediately)
**Returns**: Nothing (shares objects)

**Signature**:
```move
public fun create_dao<AssetType: drop, StableType: drop>(
    factory: &mut Factory,
    registry: &PackageRegistry,
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    affiliate_id: UTF8String,
    min_asset_amount: u64,
    min_stable_amount: u64,
    dao_name: AsciiString,
    icon_url_string: AsciiString,
    review_period_ms: u64,
    trading_period_ms: u64,
    twap_start_delay: u64,
    twap_step_max: u64,
    twap_initial_observation: u128,
    twap_threshold: SignedU128,
    amm_total_fee_bps: u64,
    description: UTF8String,
    max_outcomes: u64,
    _agreement_lines: vector<UTF8String>,
    _agreement_difficulties: vector<u64>,
    treasury_cap: TreasuryCap<AssetType>,        // ❌ REQUIRED
    coin_metadata: CoinMetadata<AssetType>,       // ❌ REQUIRED
    clock: &Clock,
    ctx: &mut TxContext,
)
```

**Asset Coin Requirements**:
- ❌ Requires `TreasuryCap<AssetType>` (not optional)
- ❌ Requires `CoinMetadata<AssetType>` (not optional)
- ❌ Must call `coin_registry::validate_coin_set(&treasury_cap, &coin_metadata)`
- ❌ Cannot create DAO without asset coin

**Use Case**: Standard DAO creation with asset coin already minted

---

### 2. `create_dao_with_init_specs` (PUBLIC, line 262)

**Visibility**: `public fun`
**Can call from PTB**: ❌ NO (BCS limitation)
**Shares DAO**: ✅ YES (immediately)
**Returns**: Nothing (shares objects)

**Signature**:
```move
public fun create_dao_with_init_specs<AssetType: drop, StableType: drop>(
    // ... same params as create_dao ...
    treasury_cap: TreasuryCap<AssetType>,        // ❌ REQUIRED
    coin_metadata: CoinMetadata<AssetType>,       // ❌ REQUIRED
    init_specs: vector<InitActionSpecs>,          // ❌ Cannot pass from PTB (TypeName issue)
    clock: &Clock,
    ctx: &mut TxContext,
)
```

**Asset Coin Requirements**:
- ❌ Requires `TreasuryCap<AssetType>` (not optional)
- ❌ Requires `CoinMetadata<AssetType>` (not optional)
- ❌ Cannot create DAO without asset coin

**Blocker**: Cannot pass `vector<InitActionSpecs>` from PTB (contains `TypeName` stdlib type)

**Use Case**: Called from Move contracts (like launchpad) to create DAO with init actions

---

### 3. `create_dao_unshared` (PACKAGE ONLY, line 809)

**Visibility**: `public(package) fun`
**Can call from PTB**: ❌ NO (package visibility)
**Shares DAO**: ❌ NO (returns unshared objects)
**Returns**: `(Account, UnifiedSpotPool<AssetType, StableType>)`

**Signature**:
```move
public(package) fun create_dao_unshared<AssetType: drop, StableType: drop>(
    factory: &mut Factory,
    registry: &PackageRegistry,
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    treasury_cap: Option<TreasuryCap<AssetType>>,      // ✅ OPTIONAL!
    coin_metadata: Option<CoinMetadata<AssetType>>,    // ✅ OPTIONAL!
    clock: &Clock,
    ctx: &mut TxContext,
): (Account, UnifiedSpotPool<AssetType, StableType>)
```

**Asset Coin Requirements**:
- ✅ `treasury_cap: Option<TreasuryCap<AssetType>>` - **OPTIONAL**
- ✅ `coin_metadata: Option<CoinMetadata<AssetType>>` - **OPTIONAL**
- ✅ **CAN create DAO without asset coin** (pass `option::none()` for both)
- ✅ If both provided, validates with `coin_registry::validate_coin_set`
- ✅ Uses default metadata if not provided

**Blocker**: `public(package)` - only callable from within futarchy_factory package

**Use Case**:
- Called by launchpad (same package) to create unshared DAO
- Allows init actions to execute before sharing
- Allows DAO creation without asset coin (launchpad will add later)

---

### 4. `create_dao_test` (PUBLIC ENTRY, line 1243)

**Visibility**: `public entry fun`
**Can call from PTB**: ✅ YES
**Shares DAO**: ✅ YES (immediately)
**Returns**: Nothing (shares objects)

**Signature**:
```move
public entry fun create_dao_test<AssetType: drop, StableType: drop>(
    // ... simplified params ...
    treasury_cap: TreasuryCap<AssetType>,        // ❌ REQUIRED
    coin_metadata: CoinMetadata<AssetType>,       // ❌ REQUIRED
    // ...
)
```

**Asset Coin Requirements**:
- ❌ Requires `TreasuryCap<AssetType>` (not optional)
- ❌ Requires `CoinMetadata<AssetType>` (not optional)
- ❌ Cannot create DAO without asset coin

**Use Case**: Simplified entry function for testing (bypasses some validation)

---

### 5. `create_dao_internal_with_extensions` (PACKAGE ONLY, line 323)

**Visibility**: `public(package) fun`
**Can call from PTB**: ❌ NO

This is the internal implementation used by `create_dao` and `create_dao_with_init_specs`.

---

## Summary Table

| Function | Visibility | PTB Call | Shares | Asset Coin Optional | Init Actions |
|----------|-----------|----------|--------|-------------------|--------------|
| `create_dao` | public | ✅ | ✅ | ❌ Required | ❌ |
| `create_dao_with_init_specs` | public | ❌ BCS | ✅ | ❌ Required | ✅ (Move only) |
| `create_dao_unshared` | package | ❌ | ❌ | ✅ **OPTIONAL** | ✅ (via PTB) |
| `create_dao_test` | entry | ✅ | ✅ | ❌ Required | ❌ |

## Key Finding

**`create_dao_unshared` IS THE ONLY FUNCTION THAT ACCEPTS OPTIONAL ASSET COIN**

```move
treasury_cap: Option<TreasuryCap<AssetType>>,
coin_metadata: Option<CoinMetadata<AssetType>>,
```

But it's `public(package)` so we cannot call it from PTBs!

## Solution: Make Entry Wrapper

We need to add a `public entry` wrapper for `create_dao_unshared`:

```move
/// Create unshared DAO that can be used for init actions (entry wrapper)
/// Allows creating DAO without asset coin (Option::none() for caps)
public entry fun create_dao_for_init_actions<AssetType: drop, StableType: drop>(
    factory: &mut Factory,
    registry: &PackageRegistry,
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    treasury_cap: Option<TreasuryCap<AssetType>>,
    coin_metadata: Option<CoinMetadata<AssetType>>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let (account, spot_pool) = create_dao_unshared(
        factory,
        registry,
        fee_manager,
        payment,
        treasury_cap,
        coin_metadata,
        clock,
        ctx,
    );

    // Transfer unshared objects to sender for init action execution
    transfer::public_transfer(account, ctx.sender());
    transfer::public_transfer(spot_pool, ctx.sender());
}
```

This would allow:
1. ✅ Creating DAO without asset coin (pass `option::none()`)
2. ✅ Calling from PTB (public entry)
3. ✅ Receiving unshared objects to execute init actions
4. ✅ Manually calling `finalize_and_share_dao` when ready
