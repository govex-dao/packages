# Vault Actions Coverage Status

**Date:** 2025-10-30

## Current Coverage

### ✅ Implemented in SDK

**VaultActions.createStream()** - Full implementation
- Creates payment streams during DAO initialization
- Supports all 9 parameters (vault name, beneficiary, amount, times, limits)
- BCS serialization: 102 bytes
- Verified working through demonstration

### ❌ Not Yet Implemented

Based on move-framework's `vault.move` action markers:

1. **VaultDeposit** - Deposit coins into vault
2. **VaultSpend** - Spend coins from vault
3. **VaultApproveCoinType** - Approve coin type for permissionless deposits
4. **VaultRemoveApprovedCoinType** - Remove coin type approval
5. **CancelStream** - Cancel an existing stream

## Coverage Percentage

**Current:** 1/6 actions = 16.7%
**Target:** 6/6 actions = 100%

## Recommended Actions for 100% Coverage

### 1. VaultDeposit
```typescript
static depositToVault(params: {
    vaultName: string;
    coinType: string;
    amount: bigint;
}): InitActionSpec
```

**Use Case:** Initial vault funding during DAO creation

### 2. VaultApproveCoinType
```typescript
static approveCoinType(params: {
    vaultName: string;
    coinType: string;
}): InitActionSpec
```

**Use Case:** Enable donations/revenue in specific coin types

### 3. Cancel Stream Actions

For completeness, though less common for init actions:

```typescript
static cancelStream(params: {
    vaultName: string;
    streamId: string;
}): InitActionSpec
```

## Implementation Plan

### Priority 1: Essential for DAO Creation
- ✅ VaultActions.createStream() - DONE
- ⏭️  VaultActions.approveCoinType() - Enable donations

### Priority 2: Nice to Have
- ⏭️  VaultActions.depositToVault() - Initial funding
- ⏭️  VaultActions.removeApprovedCoinType() - Disable donations

### Priority 3: Rare Use Cases
- ⏭️  VaultActions.cancelStream() - Cancel during init (unusual)
- ⏭️  VaultActions.spend() - Spend during init (unusual)

## Move Contract Status

**futarchy_actions/vault_actions.move:**
- ✅ CreateStream marker exists
- ✅ execute_create_stream_init() exists
- ❌ Other action markers not yet added

**To add for 100% coverage:**
- Add action markers for VaultDeposit, VaultApproveCoinType, etc.
- Add execute_*_init() functions for each action
- Follow same pattern as CreateStream

## Why This Matters

### Current State
- **Stream creation works!** ✅
- Can create DAOs with team vesting
- Demonstrated end-to-end with fresh test coins
- BCS serialization verified correct

### With 100% Coverage
- Can deposit initial vault funds during creation
- Can approve coin types for donations
- Can configure complete vault setup atomically
- More flexible DAO initialization

## Next Steps

1. ✅ Stream init actions verified working
2. ⏭️  Add vault_actions markers to futarchy_actions
3. ⏭️  Add SDK builders for deposit/approve actions
4. ⏭️  Test with fresh deployment
5. ⏭️  Update documentation

## Deployment Status

**Issue:** Address conflicts in deploy_verified.sh
- AccountProtocol deploys successfully ✅
- AccountActions fails due to circular address reference ❌
- Need to fix deployment script's address resolution

**Workaround:** Use existing Oct 28 deployments for now

**Permanent Fix:** Update deploy_verified.sh to handle circular deps

---

## Summary

**Current Status:** Stream init actions are **fully functional** and **verified working**.

**Coverage:** 16.7% (1/6 vault actions)

**To Reach 100%:**
1. Add 5 more action builders to SDK
2. Add corresponding markers to futarchy_actions
3. Test each action type

**Estimated Effort:** ~2-3 hours for 100% coverage
