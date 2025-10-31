# InitActionSpecs BCS Serialization Issue - Root Cause Analysis

## The Problem

When trying to call `factory::create_dao_with_init_specs` from TypeScript SDK, we encounter:
```
CommandArgumentError { arg_idx: 22, kind: InvalidUsageOfPureArg }
```

Where arg_idx 22 corresponds to the `init_specs: vector<InitActionSpecs>` parameter.

## Root Cause

**Sui does not allow complex structs containing stdlib types to be passed as pure BCS arguments in Programmable Transaction Blocks (PTBs).**

### Why This Fails

1. `InitActionSpecs` contains `ActionSpec`
2. `ActionSpec` contains `TypeName` (from `std::type_name`)
3. `TypeName` is a **Sui stdlib type** that cannot be constructed from pure BCS bytes in PTBs
4. Even though `InitActionSpecs` has `copy, drop, store` abilities, Sui's PTB system rejects it

### The Error Breakdown

```
InvalidUsageOfPureArg
```

This means: "You're trying to pass this as a `pure` argument (BCS-serialized bytes), but Sui doesn't allow this type to be constructed that way."

## The Architecture Design

Looking at the Move code comments:

```move
// Note: Init intents are now executed via PTB after DAO creation
// The frontend reads the staged specs and constructs a deterministic PTB
```

There are **TWO distinct patterns** for creating DAOs with init actions:

### Pattern A: `create_dao_with_init_specs` (Move-to-Move)

**Purpose**: Called FROM MOVE CODE (e.g., launchpad smart contracts)

**Flow**:
1. Move contract calls `factory::create_dao_with_init_specs`
2. Function stages the init specs inside the Account
3. Function shares the Account and SpotPool
4. Frontend/SDK reads the staged specs
5. Frontend constructs a separate PTB to execute the staged intents

**Why it works in Move**: When calling from Move code, `vector<InitActionSpecs>` is passed as a Move value (not BCS bytes), so no serialization issue.

**Why it fails from TypeScript**: Cannot pass `vector<InitActionSpecs>` as pure BCS from PTB.

### Pattern B: `create_dao_unshared` + execute + `finalize_and_share_dao` (PTB Pattern)

**Purpose**: For frontend/SDK to create DAOs with init actions atomically

**Flow** (all in ONE PTB):
```typescript
// Step 1: Create unshared DAO (returns owned objects)
let [account, spot_pool] = tx.moveCall({
    target: `${pkg}::factory::create_dao_unshared`,
    typeArguments: [assetType, stableType],
    arguments: [...],
});

// Step 2: Execute init actions directly on the unshared account
// Each action is a moveCall in the same PTB
tx.moveCall({
    target: `${pkg}::vault_actions::create_stream`,
    arguments: [account, ...],
});

// Step 3: Finalize and share
tx.moveCall({
    target: `${pkg}::factory::finalize_and_share_dao`,
    typeArguments: [assetType, stableType],
    arguments: [account, spot_pool],
});
```

**Why this works**:
- No need to pass `InitActionSpecs` as pure BCS
- Actions are executed as direct Move calls in the PTB
- Account object flows through the PTB as a transaction argument
- Everything is atomic (all or nothing)

## The Solution

### For SDK Implementation

The SDK should provide:

```typescript
class FactoryOperations {
    // Existing function (works without init actions)
    createDAO(config: DAOConfig): Transaction { ... }

    // New three-step PTB builder for init actions
    createDAOWithActions(
        config: DAOConfig,
        actions: (tx: Transaction, account: TransactionObjectArgument) => void
    ): Transaction {
        const tx = new Transaction();

        // Step 1: Create unshared
        const [account, spotPool] = tx.moveCall({
            target: `${this.factoryPackageId}::factory::create_dao_unshared`,
            // ...
        });

        // Step 2: Execute actions (callback)
        actions(tx, account);

        // Step 3: Finalize and share
        tx.moveCall({
            target: `${this.factoryPackageId}::factory::finalize_and_share_dao`,
            arguments: [account, spotPool],
        });

        return tx;
    }
}
```

### Usage Example

```typescript
const daoTx = sdk.factory.createDAOWithActions(
    daoConfig,
    (tx, account) => {
        // Create stream
        tx.moveCall({
            target: `${vaultActionsPackage}::vault_actions::create_stream`,
            arguments: [
                account,
                tx.pure.string("team_vesting"),
                tx.pure.address(beneficiary),
                tx.pure.u64(1000000),
                // ... other args
            ],
        });

        // Add more actions...
    }
);
```

## Key Insights

1. **`create_dao_with_init_specs` is NOT meant for SDK/frontend use** - it's for Move-to-Move calls (like launchpad contracts)

2. **The PTB pattern (`create_dao_unshared` + actions + `finalize_and_share_dao`) is the correct approach for TypeScript**

3. **This is not a bug** - it's a fundamental Sui limitation with PTBs that the architecture correctly works around

4. **The three-step pattern is atomic** - if any step fails, the entire transaction reverts

## References

- Move code: `futarchy_factory/sources/factory.move:809-930` (`create_dao_unshared`)
- Move code: `futarchy_factory/sources/factory.move:932-937` (`finalize_and_share_dao`)
- Move code comments: `futarchy_factory/sources/factory.move:786-788`
- SDK: `packages/sdk/src/lib/factory.ts:397-418` (`finalizeAndShareDao`)

## Next Steps

1. Implement `createDAOWithActions` in SDK using the PTB pattern
2. Add action builders for common init actions (streams, config updates, etc.)
3. Document the pattern for custom init actions
4. Update tests to use the new pattern
