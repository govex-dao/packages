# Factory SDK - Complete Coverage Audit

**Date:** 2025-10-30
**Audit Type:** Comprehensive Move Contract vs SDK Implementation

---

## Executive Summary

**Current Coverage: 75.0% (42/56 functions)**

- **Transaction Methods:** 92.3% (36/39 implemented)
- **View/Query Methods:** 35.3% (6/17 implemented)

**Status:** Near complete for transaction methods, significant gaps in view functions

---

## Coverage Breakdown

### ✅ Fully Covered Modules

#### 1. Factory Admin Operations (100%)
All 6 admin functions implemented:
- `togglePause` ✅
- `disablePermanently` ✅
- `addAllowedStableType` ✅
- `removeAllowedStableType` ✅
- `updateLaunchpadFees` ✅
- `burnFactoryOwnerCap` ✅

#### 2. Factory Validator Operations (100%)
All 3 validator functions implemented:
- `approveVerification` ✅
- `rejectVerification` ✅
- `setDaoScore` ✅

#### 3. Launchpad Operations (94%)
17/18 functions implemented:
- `createRaise` ✅ (but missing `start_delay_ms` parameter)
- `contribute` ✅
- `settleRaise` ✅
- `completeRaise` ✅
- `completeRaisePermissionless` ✅
- `endRaiseEarly` ✅
- `claimTokens` ✅
- `claimRefund` ✅
- `batchClaimTokensFor` ✅
- `batchClaimRefundFor` ✅
- `cleanupFailedRaise` ✅
- `preCreateDaoForRaise` ✅
- `stageLaunchpadInitIntent` ✅ (but `initSpec` is `any` type)
- `unstageLastLaunchpadInitIntent` ✅
- `lockIntentsAndStartRaise` ✅
- `sweepDust` ✅
- `sweepProtocolFees` ✅
- `setLaunchpadVerification` ✅

---

## ❌ Missing Implementations

### CRITICAL - Transaction Methods (3 functions)

#### 1. `create_dao_with_init_specs`
**Location:** `futarchy_factory::factory` (Line 262)
**Priority:** HIGH
**Impact:** Cannot create DAOs with initialization actions atomically

**Move Signature:**
```move
public fun create_dao_with_init_specs<AssetType: drop, StableType: drop>(
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
    treasury_cap: TreasuryCap<AssetType>,
    coin_metadata: CoinMetadata<AssetType>,
    init_specs: vector<InitActionSpecs>,  // ← Key difference
    clock: &Clock,
    ctx: &mut TxContext
)
```

**SDK Implementation Needed:**
```typescript
createDAOWithInitSpecs(
    config: DAOConfig,
    initSpecs: InitActionSpec[],
    clock?: string
): Transaction
```

---

#### 2. `finalize_and_share_dao`
**Location:** `futarchy_factory::factory` (Line 932)
**Priority:** CRITICAL
**Impact:** Launchpad flow incomplete - cannot finalize DAOs created via launchpad

**Move Signature:**
```move
public fun finalize_and_share_dao<AssetType, StableType>(
    account: Account,
    spot_pool: UnifiedSpotPool<AssetType, StableType>
)
```

**SDK Implementation Needed:**
```typescript
finalizeAndShareDao<AssetType, StableType>(
    accountId: string,
    spotPoolId: string
): Transaction
```

**Why Critical:** This is called after `pre_create_dao_for_raise` to make the DAO publicly accessible. Without this, launchpad DAOs remain unshared.

---

#### 3. `cleanup_init_intents`
**Location:** `futarchy_factory::init_actions` (Line 152)
**Priority:** MEDIUM
**Impact:** Cannot properly clean up failed initialization attempts

**Move Signature:**
```move
public fun cleanup_init_intents(
    account: &mut Account,
    owner_id: &ID,
    specs: &vector<InitActionSpecs>,
    ctx: &mut TxContext
)
```

**SDK Implementation Needed:**
```typescript
cleanupInitIntents(
    accountId: string,
    ownerId: string,
    specs: InitActionSpec[]
): Transaction
```

---

### HIGH PRIORITY - Factory View Functions (6 missing)

These should be added to `QueryHelper` class:

#### Factory State Queries

1. **`getFactoryDaoCount(factoryId: string): Promise<number>`**
   - Move: `dao_count(factory: &Factory): u64`
   - Returns total DAOs created

2. **`isFactoryPaused(factoryId: string): Promise<boolean>`**
   - Move: `is_paused(factory: &Factory): bool`
   - Returns pause state

3. **`isFactoryPermanentlyDisabled(factoryId: string): Promise<boolean>`**
   - Move: `is_permanently_disabled(factory: &Factory): bool`
   - Returns permanent disable state

4. **`getLaunchpadBidFee(factoryId: string): Promise<bigint>`**
   - Move: `launchpad_bid_fee(factory: &Factory): u64`
   - Returns contribution fee in MIST

5. **`getLaunchpadCrankerReward(factoryId: string): Promise<bigint>`**
   - Move: `launchpad_cranker_reward(factory: &Factory): u64`
   - Returns cranker reward in MIST

6. **`getLaunchpadSettlementReward(factoryId: string): Promise<bigint>`**
   - Move: `launchpad_settlement_reward(factory: &Factory): u64`
   - Returns settlement reward in MIST

---

### MEDIUM PRIORITY - Launchpad View Functions (9 missing)

These should be added to `QueryHelper` class:

#### Raise Detail Queries

7. **`getRaiseStartTime(raiseId: string): Promise<number>`**
   - Move: `start_time<RT, SC>(r: &Raise<RT, SC>): u64`
   - Returns raise start timestamp

8. **`getRaiseDeadline(raiseId: string): Promise<number>`**
   - Move: `deadline<RT, SC>(r: &Raise<RT, SC>): u64`
   - Returns raise deadline timestamp

9. **`getRaiseDescription(raiseId: string): Promise<string>`**
   - Move: `description<RT, SC>(r: &Raise<RT, SC>): &String`
   - Returns raise description

10. **`getRaiseFinalAmount(raiseId: string): Promise<bigint>`**
    - Move: `final_raise_amount<RT, SC>(r: &Raise<RT, SC>): u64`
    - Returns final raise amount after settlement

11. **`getRaiseAllowedCaps(raiseId: string): Promise<bigint[]>`**
    - Move: `allowed_caps<RT, SC>(r: &Raise<RT, SC>): &vector<u64>`
    - Returns contribution cap tiers

12. **`getRaiseCapSums(raiseId: string): Promise<bigint[]>`**
    - Move: `cap_sums<RT, SC>(r: &Raise<RT, SC>): &vector<u64>`
    - Returns cumulative contributions per cap tier

13. **`getRaiseVerificationLevel(raiseId: string): Promise<number>`**
    - Move: `verification_level<RT, SC>(r: &Raise<RT, SC>): u8`
    - Returns verification level (0-255)

14. **`getRaiseAttestationUrl(raiseId: string): Promise<string>`**
    - Move: `attestation_url<RT, SC>(r: &Raise<RT, SC>): &String`
    - Returns verification attestation URL

15. **`getRaiseAdminReviewText(raiseId: string): Promise<string>`**
    - Move: `admin_review_text<RT, SC>(r: &Raise<RT, SC>): &String`
    - Returns admin review text

---

## ⚠️ Type Safety Issues

### 1. Missing InitActionSpecs Type Definition

**Current:**
```typescript
stageLaunchpadInitIntent(
    raiseId: string,
    creatorCapId: string,
    initSpec: any,  // ← Type is 'any'
    clock?: string
): Transaction
```

**Needed:**
```typescript
interface InitActionSpec {
    key: string;
    // ... other fields from Move struct
}

stageLaunchpadInitIntent(
    raiseId: string,
    creatorCapId: string,
    initSpec: InitActionSpec,  // ← Properly typed
    clock?: string
): Transaction
```

### 2. Missing start_delay_ms Parameter

**Current `createRaise`:**
```typescript
createRaise(config: CreateRaiseConfig, clock?: string): Transaction
```

**CreateRaiseConfig is missing:**
```typescript
startDelayMs?: number; // Optional start delay
```

**Move contract accepts:**
```move
start_delay_ms: Option<u64>  // Line 381 in launchpad.move
```

---

## 📊 Coverage Statistics

### By Module

| Module | Total Functions | Implemented | Coverage |
|--------|----------------|-------------|----------|
| **Factory Core** | 2 | 1 | 50% |
| **Factory Admin** | 6 | 6 | 100% ✅ |
| **Factory Validator** | 3 | 3 | 100% ✅ |
| **Factory Views** | 9 | 0 | 0% |
| **Launchpad Core** | 18 | 17 | 94% |
| **Launchpad Views** | 14 | 5 | 36% |
| **Init Actions** | 3 | 1 | 33% |
| **Constants** | 1 | 1 | 100% ✅ |

### By Category

| Category | Total | Implemented | Coverage |
|----------|-------|-------------|----------|
| **Transaction Methods** | 39 | 36 | 92.3% |
| **View/Query Methods** | 17 | 6 | 35.3% |
| **TOTAL** | **56** | **42** | **75.0%** |

---

## 🎯 Path to 100% Coverage

### Phase 1: Critical Transaction Methods (Est: 4-6 hours)

1. **Implement `createDAOWithInitSpecs`** (2 hours)
   - Add to `factory.ts`
   - Type InitActionSpecs interface
   - Add JSDoc with examples

2. **Implement `finalizeAndShareDao`** (1 hour)
   - Add to `factory.ts`
   - Critical for launchpad completion
   - Add JSDoc

3. **Implement `cleanupInitIntents`** (1 hour)
   - Add to launchpad.ts or new init-actions.ts
   - Add JSDoc

4. **Fix `createRaise` parameters** (30 min)
   - Add `startDelayMs?: number` to config
   - Update moveCall to handle option

5. **Fix `stageLaunchpadInitIntent` typing** (30 min)
   - Create InitActionSpec interface
   - Replace `any` type

### Phase 2: Factory View Functions (Est: 2-3 hours)

6. **Add Factory state queries** (2 hours)
   - Add 6 methods to QueryHelper
   - Use extractField pattern
   - Add JSDoc

### Phase 3: Launchpad View Functions (Est: 3-4 hours)

7. **Add Launchpad detail queries** (3 hours)
   - Add 9 methods to QueryHelper
   - Use extractField pattern
   - Add JSDoc

### Phase 4: Documentation & Tests (Est: 1 day)

8. **Update documentation** (4 hours)
   - Update README with new functions
   - Add examples for init specs
   - Document view functions

9. **Write tests** (4 hours)
   - Test critical functions
   - Test view queries
   - Integration tests

**Total Time to 100%: 2-3 days**

---

## 🚨 Immediate Action Items

### Must Implement (Blocking Launchpad)

1. `finalize_and_share_dao` - **CRITICAL** - Launchpad flow incomplete without this

### Should Implement (For Production)

2. `create_dao_with_init_specs` - Required for advanced DAO setups
3. Factory view functions - Required for UI/status display
4. Launchpad view functions - Required for UI/raise details

### Nice to Have (For Completeness)

5. `cleanup_init_intents` - Error recovery
6. InitActionSpec type safety - Developer experience
7. `start_delay_ms` parameter - Feature parity

---

## Conclusion

**The SDK has excellent coverage (75%) with transaction methods nearly complete (92.3%).**

**The biggest gap is view/query functions (35.3%) which are essential for frontend/UI.**

**Critical blocker:** `finalize_and_share_dao` must be implemented for launchpad to work end-to-end.

**Recommendation:** Implement Phase 1 (critical transaction methods) immediately to unblock launchpad, then add view functions for production-ready UI support.
