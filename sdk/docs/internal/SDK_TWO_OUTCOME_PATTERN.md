# SDK Updates for Two-Outcome Pattern

## Overview

The SDK has been updated to document the new two-outcome pattern for launchpad init actions. This pattern allows creators to stage different actions for success vs failure scenarios, exactly like proposals.

## Changes Made

### 1. Documentation Added to `LaunchpadOperations` class

Added comprehensive inline documentation explaining the two-outcome pattern with complete examples:

- **Success intents**: Actions that execute when raise succeeds (e.g., create pools, streams, etc.)
- **Failure intents**: Actions that execute if raise fails (e.g., return TreasuryCap to creator)

### 2. Pattern: Manual PTB Construction

**Why manual construction?**
The two-outcome pattern requires building `InitActionSpecs` in the SAME transaction as staging them, because the `specs` object is a `TransactionArgument` that can't cross transaction boundaries.

**Pattern:**
```typescript
const tx = new Transaction();

// Step 1: Create empty specs
const specs = tx.moveCall({
  target: `${actionsPkg}::init_action_specs::new_init_specs`,
  arguments: [],
});

// Step 2: Add actions using action-specific builders
tx.moveCall({
  target: `${actionsPkg}::stream_init_actions::add_create_stream_spec`,
  arguments: [specs, ...params],
});

// Step 3: Stage as success or failure intent
tx.moveCall({
  target: `${launchpadPkg}::launchpad::stage_success_intent`,
  typeArguments: [raiseTokenType, stableCoinType],
  arguments: [raiseId, registryId, creatorCapId, specs, clock],
});
```

### 3. Deprecated Old Pattern

Marked `stageLaunchpadInitIntent()` as deprecated with clear migration guidance to the new two-outcome pattern.

### 4. Removed Non-Existent Exports

Fixed build error by removing export of non-existent `vault-actions` module.

## Usage Examples

### Success Intents (Stream Creation)

See the inline documentation in `/Users/admin/govex/packages/sdk/src/lib/launchpad.ts` (lines 634-722) for the complete example.

**Key aspects:**
- Create InitActionSpecs using `init_action_specs::new_init_specs()`
- Add actions using action-specific builders (e.g., `stream_init_actions::add_create_stream_spec()`)
- Stage using `launchpad::stage_success_intent()`
- Lock intents using `LaunchpadOperations.lockIntentsAndStartRaise()`

### Failure Intents (Return TreasuryCap)

Example showing how to return TreasuryCap to creator if raise fails:

```typescript
const tx = new Transaction();

const specs = tx.moveCall({
  target: `${actionsPkg}::init_action_specs::new_init_specs`,
  arguments: [],
});

tx.moveCall({
  target: `${actionsPkg}::currency_init_actions::add_return_treasury_cap_spec`,
  arguments: [specs, tx.pure(bcs.Address.serialize(creator).toBytes())],
});

tx.moveCall({
  target: `${launchpadPkg}::launchpad::stage_failure_intent`,
  typeArguments: [raiseTokenType, stableCoinType],
  arguments: [raiseId, registryId, creatorCapId, specs, clock],
});
```

## Complete E2E Example

See: `/Users/admin/govex/packages/sdk/scripts/launchpad-e2e-with-init-actions-TWO-OUTCOME.ts`

This demonstrates:
1. Creating a raise
2. Staging success intents (stream creation)
3. Locking intents
4. Contributing to the raise
5. Completing the raise (triggers JIT conversion)
6. Verifying the Intent was created

## Action Builders Available

### Core Account Actions (in move-framework)

1. **Stream Actions** (`account_actions::stream_init_actions`)
   - `add_create_stream_spec()` - Create vesting streams

2. **Currency Actions** (`account_actions::currency_init_actions`)
   - `add_return_treasury_cap_spec()` - Return TreasuryCap to address

### Futarchy Actions (in futarchy_actions)

3. **Liquidity Actions** (already implemented)
   - Pool creation and management

## Migration Guide

### Old Pattern (Deprecated)

```typescript
const tx = sdk.launchpad.stageLaunchpadInitIntent(
  raiseId,
  creatorCapId,
  initSpec, // Pre-built InitActionSpec
  clock
);
```

### New Pattern (Recommended)

```typescript
const tx = new Transaction();

// Build specs in PTB
const specs = tx.moveCall({
  target: `${actionsPkg}::init_action_specs::new_init_specs`,
  arguments: [],
});

// Add actions
tx.moveCall({
  target: `${actionsPkg}::stream_init_actions::add_create_stream_spec`,
  arguments: [specs, ...streamParams],
});

// Stage as success intent
tx.moveCall({
  target: `${launchpadPkg}::launchpad::stage_success_intent`,
  typeArguments: [raiseTokenType, stableCoinType],
  arguments: [raiseId, registryId, creatorCapId, specs, clock],
});
```

## Architecture Benefits

1. **No Code Coupling**: Launchpad doesn't depend on specific action modules
2. **Client-Side Dispatch**: Frontends/keepers compose PTBs to call action functions directly
3. **Type Safety**: Move functions provide type checking for action parameters
4. **Flexibility**: Easy to add new action types without modifying launchpad
5. **Investor Protection**: Specs are locked before contributions start

## Flow Summary

1. **Creator**: Creates raise
2. **Creator**: Stages success intents (what happens if raise succeeds)
3. **Creator**: Optionally stages failure intents (what happens if raise fails)
4. **Creator**: Locks intents (no more changes allowed)
5. **Investors**: Contribute (can see exactly what will execute)
6. **System**: Raise completes successfully
7. **System**: JIT conversion - success_specs → Intent (atomic with DAO creation)
8. **Keeper**: Executes Intent actions via PTB

## Notes

- The `lockIntentsAndStartRaise()` SDK method is still available and should be used after staging intents
- All other launchpad SDK methods (contribute, claimTokens, etc.) remain unchanged
- The two-outcome system works exactly like proposals - only one outcome executes based on raise result
