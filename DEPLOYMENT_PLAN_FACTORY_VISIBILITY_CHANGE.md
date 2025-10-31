# Deployment Plan: Factory Visibility Change

## Change Summary

**File**: `/Users/admin/govex/packages/futarchy_factory/sources/factory.move`
**Function**: `create_dao_unshared` (line ~812)
**Change**: `public(package) fun` → `public fun`

**Reason**: Enable external PTBs (TypeScript SDK) to create unshared DAOs for atomic init action execution

---

## Impact Analysis

### ✅ Non-Breaking Change

Changing `public(package)` → `public` is **purely additive**:
- ✅ External packages couldn't call it before (package-only)
- ✅ External packages gain new capability (now callable)
- ✅ Internal package callers (launchpad.move) unaffected
- ✅ No API contract changes
- ✅ No signature changes

### Who Uses `create_dao_unshared`?

**Internal Callers** (within futarchy_factory package):
- `launchpad.move:275` - Creates unshared DAO for fundraising flow
  - ✅ No changes needed (same package)

**External Dependencies**:
- `futarchy_governance_actions` - Depends on futarchy_factory
  - Uses: `factory::is_paused()` only (NOT `create_dao_unshared`)
  - ✅ No code changes needed

**New Capability Enabled**:
- TypeScript SDK can now call `create_dao_unshared` from PTBs
- Enables atomic DAO creation + init actions pattern

---

## Deployment Steps

### 1. Redeploy futarchy_factory ⚙️

```bash
cd /Users/admin/govex/packages
./deploy_verified.sh futarchy_factory
```

**Why**: Source code changed (visibility modifier)

**Expected Outcome**:
- New package ID for futarchy_factory
- All functions available at new address
- `create_dao_unshared` now publicly callable

---

### 2. Update Package Registry 📝

```bash
cd /Users/admin/govex/packages/sdk
npx tsx scripts/update-package-registry.ts
```

**What it updates**:
- Package registry on-chain with new futarchy_factory package ID
- Enables validation and versioning

**Files to update** (deployment records):
- `deployments/devnet/futarchy_factory.json` (auto-updated by deploy script)

---

### 3. Update futarchy_governance_actions (If Needed) 🔄

**Decision Tree**:

**IF** deploying to devnet for testing:
- ✅ No action needed - uses `{ local = "../futarchy_factory" }` dependency

**IF** deploying to testnet/mainnet:
- Update `futarchy_governance_actions/Move.toml`:
  ```toml
  [addresses]
  futarchy_factory = "<NEW_PACKAGE_ID>"
  ```
- Redeploy `futarchy_governance_actions`
- Update registry

**Current Recommendation**:
- Test on devnet first (no redeployment needed)
- Update and redeploy governance actions only if deploying to persistent networks

---

## Dependency Graph

```
futarchy_factory (CHANGED ✏️)
    ↑
    │ (depends on)
    │
futarchy_governance_actions
    │ Uses: factory::is_paused()
    │ Does NOT use: create_dao_unshared
    └─ ✅ No changes needed for functionality
```

---

## Testing Plan

### Before Deployment
- [x] Changed `create_dao_unshared` visibility to `public`
- [x] Implemented SDK `createDAOWithActions()` method
- [x] Created `test-stream-init-action.ts` test script

### After Deployment
1. **Deploy futarchy_factory**
   ```bash
   ./deploy_verified.sh futarchy_factory
   ```

2. **Update registry**
   ```bash
   cd sdk && npx tsx scripts/update-package-registry.ts
   ```

3. **Update SDK deployments**
   - Ensure `sdk/deployments/devnet/futarchy_factory.json` has new package ID

4. **Run test script**
   ```bash
   cd sdk && npx tsx scripts/test-stream-init-action.ts
   ```

**Expected Result**: ✅ DAO created atomically with stream init action in single transaction

---

## Rollback Plan

If issues arise:

1. **Revert code change**:
   ```move
   public(package) fun create_dao_unshared<AssetType, StableType>(...)
   ```

2. **Redeploy futarchy_factory**

3. **Update registry** with reverted package ID

**Risk**: Low - change is additive, no breaking changes

---

## Summary

**Packages to Redeploy**: 1
- ✅ futarchy_factory (required)

**Registry Updates**: 1
- ✅ futarchy_factory package ID

**Dependent Package Changes**: 0
- ❌ futarchy_governance_actions (no code changes needed)

**New Functionality Enabled**:
- ✅ PTB-based DAO creation with init actions from TypeScript
- ✅ Atomic DAO + stream creation
- ✅ Full launchpad flow support from SDK

---

## Verification Checklist

After deployment, verify:

- [ ] `futarchy_factory` deployed successfully
- [ ] New package ID recorded in `deployments/devnet/futarchy_factory.json`
- [ ] Package registry updated on-chain
- [ ] `create_dao_unshared` callable from PTBs (test with SDK)
- [ ] `test-stream-init-action.ts` passes successfully
- [ ] Launchpad still works (internal caller unaffected)
- [ ] `futarchy_governance_actions` still works (external dependent unaffected)

---

## Next Steps

1. Run deployment: `./deploy_verified.sh futarchy_factory`
2. Update registry: `npx tsx scripts/update-package-registry.ts`
3. Test SDK: `npx tsx scripts/test-stream-init-action.ts`
4. Verify launchpad flow still works
