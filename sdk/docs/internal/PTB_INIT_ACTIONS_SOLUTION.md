# Init Actions from TypeScript - Complete Analysis and Solution

## Problem Summary

We need to create DAOs with init actions (like streams) atomically from TypeScript/SDK. We discovered two blockers:

1. **BCS Serialization Issue**: `create_dao_with_init_specs` requires `vector<InitActionSpecs>` which contains `TypeName` (stdlib type) that cannot be passed as pure BCS from PTBs
2. **Package Visibility Issue**: `create_dao_unshared` is `public(package)` - only callable from within futarchy_factory package, not from external PTBs

## Architecture Analysis

### Current Move Architecture

```move
// PUBLIC - Can call from PTB, but requires InitActionSpecs as BCS (BLOCKED by Sui limitation)
public fun create_dao_with_init_specs<AssetType, StableType>(
    ...
    init_specs: vector<InitActionSpecs>,  // ❌ Cannot pass from PTB
) { ... }

// PACKAGE ONLY - Cannot call from PTB
public(package) fun create_dao_unshared<AssetType, StableType>(
    ...
): (Account, UnifiedSpotPool) { ... }  // ❌ Not accessible from PTB

// PUBLIC ENTRY - Can call from PTB, but shares immediately (no init actions)
public fun create_dao<AssetType, StableType>( ... ) { ... }  // ✅ Works but no init actions
```

### Why The Limitation Exists

**BCS TypeName Issue**:
- Sui PTBs cannot construct stdlib types like `TypeName` from pure BCS bytes
- This is a fundamental Sui limitation, not a bug in our code
- Move-to-Move calls work because `TypeName` is passed as a Move value, not BCS

**Package Visibility Design**:
- `create_dao_unshared` is intentionally package-only for the launchpad contract
- The launchpad lives in the same package, so it can call `create_dao_unshared`
- External callers (TypeScript/SDKs) cannot access `public(package)` functions

## Proposed Solutions

### Solution 1: Add Entry Function Wrapper (Recommended)

**Add to futarchy_factory/sources/factory.move**:

```move
/// Create an unshared DAO for init action execution (entry function wrapper)
/// This allows external PTBs to create unshared DAOs and execute init actions
public entry fun create_dao_unshared_entry<AssetType: drop, StableType: drop>(
    factory: &mut Factory,
    registry: &PackageRegistry,
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    treasury_cap: Option<TreasuryCap<AssetType>>,
    coin_metadata: Option<CoinMetadata<AssetType>>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Just call the internal version and transfer objects to sender
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

    // Transfer unshared objects to sender
    transfer::public_transfer(account, ctx.sender());
    transfer::public_transfer(spot_pool, ctx.sender());
}
```

**Then SDK can use it**:
```typescript
// Step 1: Create unshared DAO (returns owned objects to sender)
const daoTx = new Transaction();
daoTx.moveCall({
    target: `${pkg}::factory::create_dao_unshared_entry`,
    arguments: [...],
});

const result = await executeTransaction(sdk, daoTx);

// Step 2: Extract Account and SpotPool object IDs from result
const accountId = result.objectChanges.find(c => c.objectType.includes('Account')).objectId;
const spotPoolId = result.objectChanges.find(c => c.objectType.includes('SpotPool')).objectId;

// Step 3: Execute init actions in a new PTB
const actionTx = new Transaction();
actionTx.moveCall({
    target: `${pkg}::vault_actions::execute_create_stream_init`,
    arguments: [actionTx.object(accountId), ...],
});

// Step 4: Finalize and share
actionTx.moveCall({
    target: `${pkg}::factory::finalize_and_share_dao`,
    arguments: [actionTx.object(accountId), actionTx.object(spotPoolId)],
});

await executeTransaction(sdk, actionTx);
```

### Solution 2: Two-Transaction Pattern (Works Now)

```typescript
// Transaction 1: Create DAO (shares immediately)
const createTx = sdk.factory.createDAO(config);
const result = await executeTransaction(sdk, createTx);

// Extract Account ID
const accountId = result.objectChanges.find(c => c.objectType.includes('Account')).objectId;

// Transaction 2: Execute init actions on shared account
const actionTx = new Transaction();
actionTx.moveCall({
    target: `${pkg}::vault_actions::execute_create_stream_init`,
    typeArguments: [assetType],
    arguments: [
        actionTx.object(accountId), // shared account
        // ... other args
    ],
});

await executeTransaction(sdk, actionTx);
```

**Pros**:
- Works with current Move code
- No Move contract changes needed

**Cons**:
- Not atomic (DAO exists before init actions execute)
- Two separate transactions
- DAO is briefly in incomplete state

### Solution 3: Use Launchpad Flow (Complex but Atomic)

The launchpad provides an atomic multi-transaction flow:
1. Pre-create unshared DAO (launchpad holds it)
2. Stage init specs
3. Finalize and execute all at once

This is complex and primarily designed for fundraising scenarios.

## Recommendation

**Immediate**: Use Solution 2 (two-transaction pattern) - works now with deployed contracts

**Long-term**: Add Solution 1 entry function wrapper in next Move contract upgrade for better UX

## Implementation Status

✅ SDK `createDAOWithActions()` implemented (blocked by Move visibility)
✅ `VaultActions.createStreamPTB()` implemented
✅ Analysis complete
✅ Test script created

❌ Blocked by `create_dao_unshared` being `public(package)`
❌ Need Move contract change OR use two-transaction pattern

## Files Modified

- `/Users/admin/govex/packages/sdk/src/lib/factory.ts` - Added `createDAOWithActions()`
- `/Users/admin/govex/packages/sdk/src/lib/actions/vault-actions.ts` - Added `createStreamPTB()`
- `/Users/admin/govex/packages/sdk/src/sdk/FutarchySDK.ts` - Added convenience properties
- `/Users/admin/govex/packages/sdk/scripts/test-stream-init-action.ts` - Test script (blocked)
