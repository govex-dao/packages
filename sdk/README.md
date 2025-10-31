# Govex Futarchy SDK

TypeScript SDK for interacting with the Govex Futarchy Protocol on Sui blockchain.

## Overview

The Futarchy SDK provides a type-safe, developer-friendly interface for building applications on top of the Futarchy governance protocol. It handles network configuration, deployment management, and provides high-level abstractions for protocol interactions.

## Architecture

The SDK follows a three-layer architecture inspired by proven patterns:

```
src/
├── .gen/          # Auto-generated Move bindings (future)
├── lib/           # High-level abstractions (future)
├── sdk/           # Main SDK entry point
├── config/        # Network and deployment configuration
└── types/         # TypeScript type definitions
```

### Current Features

**Phase 1: Foundation**
- ✅ Network configuration (mainnet, testnet, devnet, localnet, custom RPC)
- ✅ Deployment data management
- ✅ Type-safe package and object ID access
- ✅ SuiClient integration
- ✅ Dual ESM/CJS build output

**Phase 2: Core Operations**
- ✅ Transaction builder utilities
- ✅ DAO creation (Factory operations)
- ✅ Query helpers for on-chain data
- ✅ Event querying
- ✅ Balance checking
- ✅ Object queries with type filtering

**Phase 3: Cross-Package Action Orchestration** 🆕
- ✅ InitActionSpec pattern for DAO initialization
- ✅ ConfigActions - DAO configuration (metadata, trading params, proposals)
- ✅ LiquidityActions - Pool operations (create, add/remove liquidity)
- ✅ GovernanceActions - Governance settings (voting power, quorum, delegation)
- ✅ VaultActions - Stream management (team vesting, advisor compensation)
- ✅ BCS serialization matching Move struct layouts
- ✅ Type-safe action builders with full parameter validation

### Roadmap

- [ ] Auto-generated Move bindings (.gen layer)
- [ ] Governance proposal operations
- [ ] Market operations (create, trade, resolve)
- [ ] Proposal voting and execution
- [ ] Event subscriptions and listeners
- [ ] Caching layer for on-chain data
- [ ] Batch transaction builders
- [ ] Init action execution helpers (PTB construction from staged specs)

## Installation

```bash
npm install @govex/futarchy-sdk
# or
yarn add @govex/futarchy-sdk
# or
pnpm add @govex/futarchy-sdk
```

## Quick Start

```typescript
import { FutarchySDK, TransactionUtils } from '@govex/futarchy-sdk';
import { ConfigActions, VaultActions } from '@govex/futarchy-sdk/actions';
import deployments from './deployments.json';

// Initialize SDK
const sdk = await FutarchySDK.init({
  network: 'devnet',
  deployments,
});

// === Query Operations ===

// Get all DAOs
const allDAOs = await sdk.query.getAllDAOs(
  sdk.getPackageId('futarchy_factory')!
);

// Get specific DAO
const dao = await sdk.query.getDAO(allDAOs[0].account_id);

// Check balances
const balance = await sdk.query.getBalance(address, '0x2::sui::SUI');

// === Create a DAO (Simple) ===

const tx = sdk.factory.createDAOWithDefaults({
  assetType: '0xPKG::coin::MYCOIN',
  stableType: '0x2::sui::SUI',
  treasuryCap: '0xCAP_ID',
  coinMetadata: '0xMETADATA_ID',
  daoName: 'My DAO',
  iconUrl: 'https://example.com/icon.png',
  description: 'A futarchy DAO',
});

// === Create a DAO with Init Actions (Advanced) ===

const now = Date.now();
const oneYear = 365 * 24 * 60 * 60 * 1000;

const txWithActions = sdk.factory.createDAOWithInitSpecs(
  {
    assetType: '0xPKG::coin::MYCOIN',
    stableType: '0x2::sui::SUI',
    treasuryCap: '0xCAP_ID',
    coinMetadata: '0xMETADATA_ID',
    daoName: 'My DAO',
    // ... other config
  },
  [
    // Configure DAO metadata
    ConfigActions.updateMetadata({
      daoName: "My DAO",
      description: "DAO with team vesting",
    }),

    // Create team vesting stream
    VaultActions.createStream({
      vaultName: "team_vesting",
      beneficiary: "0xBENEFICIARY",
      totalAmount: 1_000_000n,
      startTime: now,
      endTime: now + oneYear,
      cliffTime: now + (90 * 24 * 60 * 60 * 1000), // 3-month cliff
      maxPerWithdrawal: 50_000n,
      minIntervalMs: 86400000, // 1 day
      maxBeneficiaries: 1,
    }),
  ]
);

// Sign and execute
// const result = await sdk.client.signAndExecuteTransaction({
//   transaction: txWithActions,
//   signer: keypair,
// });
```

## Configuration

### Network Options

The SDK supports multiple network configurations:

```typescript
// Standard networks
await FutarchySDK.init({ network: 'mainnet', deployments });
await FutarchySDK.init({ network: 'testnet', deployments });
await FutarchySDK.init({ network: 'devnet', deployments });
await FutarchySDK.init({ network: 'localnet', deployments });

// Custom RPC
await FutarchySDK.init({
  network: 'https://custom-rpc.example.com',
  deployments
});
```

### Deployment Configuration

The deployment configuration contains package IDs, shared objects, and admin capabilities for each deployed package. This is auto-generated during deployment:

```typescript
{
  "futarchy_factory": {
    "packageId": "0x...",
    "upgradeCap": { ... },
    "adminCaps": [ ... ],
    "sharedObjects": [
      {
        "name": "Factory",
        "objectId": "0x...",
        "initialSharedVersion": 4
      }
    ]
  },
  ...
}
```

## API Reference

### FutarchySDK

Main SDK class for protocol interactions.

#### `FutarchySDK.init(config)`

Initialize the SDK with network and deployment configuration.

**Parameters:**
- `config.network` - Network type or custom RPC URL
- `config.deployments` - Deployment configuration object

**Returns:** `Promise<FutarchySDK>`

#### Instance Properties

- `client: SuiClient` - Underlying Sui client instance
- `network: NetworkConfig` - Network configuration
- `deployments: DeploymentManager` - Deployment data manager
- `factory: FactoryOperations` - DAO creation operations
- `query: QueryHelper` - Query helpers for on-chain data

#### Instance Methods

- `getPackageId(packageName: string)` - Get package ID by name
- `getAllPackageIds()` - Get all package IDs as a map
- `refresh()` - Refresh cached data (future use)

### DeploymentManager

Manages deployment data and provides convenient access methods.

#### Methods

- `getPackage(name)` - Get full deployment info for a package
- `getPackageId(name)` - Get package ID
- `getFactory()` - Get Factory shared object
- `getPackageRegistry()` - Get PackageRegistry shared object
- `getAllSharedObjects()` - Get all shared objects across packages
- `getAllAdminCaps()` - Get all admin capabilities

### FactoryOperations

Handles DAO creation operations.

#### Methods

##### `createDAO(config: DAOConfig): Transaction`

Create a new DAO with full configuration control.

**Parameters:**
- `config.assetType` - Full type path for DAO token
- `config.stableType` - Full type path for stable coin
- `config.treasuryCap` - Object ID of TreasuryCap
- `config.coinMetadata` - Object ID of CoinMetadata
- `config.daoName` - DAO name (ASCII string)
- `config.iconUrl` - Icon URL (ASCII string)
- `config.description` - Description (UTF-8 string)
- `config.minAssetAmount` - Minimum asset amount for markets
- `config.minStableAmount` - Minimum stable amount
- `config.reviewPeriodMs` - Review period in milliseconds
- `config.tradingPeriodMs` - Trading period in milliseconds
- `config.twapStartDelay` - TWAP start delay
- `config.twapStepMax` - TWAP window cap
- `config.twapInitialObservation` - Initial TWAP observation
- `config.twapThreshold` - TWAP threshold (signed)
- `config.ammTotalFeeBps` - AMM fee in basis points
- `config.maxOutcomes` - Maximum outcomes per proposal
- `config.paymentAmount` - Creation fee in MIST

**Returns:** Transaction object ready to sign

##### `createDAOWithDefaults(config): Transaction`

Create a DAO with sensible defaults. Only requires essential parameters.

### QueryHelper

Query utilities for reading on-chain data.

#### Methods

- `getObject(objectId)` - Get object with full content
- `getObjects(objectIds[])` - Get multiple objects
- `getOwnedObjects(address, filter?)` - Get objects owned by address
- `getDynamicFields(parentObjectId)` - Get dynamic fields
- `queryEvents(filter)` - Query events by filter
- `extractField(object, fieldPath)` - Extract field from object
- `getAllDAOs(factoryPackageId)` - Get all DAOs from events
- `getDAOsCreatedByAddress(factoryPackageId, creator)` - Get DAOs by creator
- `getDAO(accountId)` - Get DAO object
- `getProposal(proposalId)` - Get proposal object
- `getMarket(marketId)` - Get market object
- `getBalance(address, coinType)` - Get token balance
- `getAllBalances(address)` - Get all balances

### TransactionUtils

Utility functions for transaction building.

#### Methods

- `suiToMist(sui: number)` - Convert SUI to MIST
- `mistToSui(mist: bigint)` - Convert MIST to SUI
- `buildTarget(packageId, module, function)` - Build function target
- `buildType(packageId, module, type)` - Build type parameter

### Action Builders 🆕

Type-safe builders for creating initialization actions. All action builders return `InitActionSpec` objects that can be passed to `factory.createDAOWithInitSpecs()`.

#### ConfigActions

Configure DAO settings during initialization.

**Methods:**

- `updateMetadata({ daoName?, iconUrl?, description? })` - Update DAO metadata
- `updateMetadataTable([{ key, value }, ...])` - Add custom metadata key-value pairs
- `setProposalsEnabled(enabled: boolean)` - Enable/disable proposals
- `updateTradingParams({ minAssetAmount?, minStableAmount?, ammTotalFeeBps? })` - Update trading parameters
- `updateProposalParams({ reviewPeriodMs?, tradingPeriodMs?, maxOutcomes? })` - Update proposal parameters
- `updateTwapParams({ twapStartDelay?, twapStepMax?, twapInitialObservation?, twapThreshold? })` - Update TWAP settings
- `setAssetAvailability(vaultName: string, available: boolean)` - Control asset withdrawals
- `setStableAvailability(vaultName: string, available: boolean)` - Control stable withdrawals
- `setAssetLimitPerWithdrawal(vaultName: string, limit: bigint)` - Set withdrawal limits

#### VaultActions

Manage payment streams and vesting schedules.

**Methods:**

- `createStream({ vaultName, beneficiary, totalAmount, startTime, endTime, cliffTime?, maxPerWithdrawal?, minIntervalMs?, maxBeneficiaries? })` - Create a payment stream with linear vesting
- `createMultipleStreams([streamConfig, ...])` - Create multiple streams at once

**Stream Features:**
- Linear vesting between start and end time
- Optional cliff period (funds locked until cliff time)
- Rate limiting (max per withdrawal, min interval)
- Multiple beneficiaries support (1-100)

**Example:**
```typescript
VaultActions.createStream({
  vaultName: "team_vesting",
  beneficiary: "0x...",
  totalAmount: 1_000_000n,
  startTime: Date.now(),
  endTime: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
  cliffTime: Date.now() + (90 * 24 * 60 * 60 * 1000), // 3-month cliff
  maxPerWithdrawal: 50_000n, // Max 50k per withdrawal
  minIntervalMs: 86400000, // Min 1 day between withdrawals
  maxBeneficiaries: 1,
})
```

#### LiquidityActions

Create and manage liquidity pools.

**Methods:**

- `createPool({ poolName, assetAmount, stableAmount, ammTotalFeeBps? })` - Create a new liquidity pool
- `addLiquidity({ poolName, assetAmount, stableAmount })` - Add liquidity to existing pool
- `removeLiquidity({ poolName, lpTokenAmount })` - Remove liquidity
- `withdrawLpToken({ poolName, amount, recipient })` - Withdraw LP tokens
- `updatePoolParams({ poolName, ammTotalFeeBps })` - Update pool fee parameters

#### GovernanceActions

Configure governance and voting parameters.

**Methods:**

- `setMinVotingPower(amount: bigint)` - Set minimum voting power required
- `setQuorum(amount: bigint)` - Set quorum threshold
- `updateVotingPeriod(periodMs: number)` - Set voting period duration
- `setDelegationEnabled(enabled: boolean)` - Enable/disable vote delegation
- `updateProposalDeposit(amount: bigint)` - Set proposal deposit requirement

## Examples

See the `scripts/` directory for complete usage examples:

**Basic Usage:**
- `execute-tx.ts` - Helper utilities for transaction execution
- `query-data.ts` - Querying DAOs, events, and balances

**DAO Creation:**
- `create-dao-with-init-actions.ts` - Create DAO with config actions
- `create-dao-with-stream.ts` - Create DAO with team vesting stream
- `create-dao-with-stream-sui.ts` - Demonstration of stream init actions

**Documentation:**
- `STREAM_IMPLEMENTATION.md` - Full implementation guide for stream init actions
- `STREAM_INIT_ACTIONS_VERIFIED.md` - Verification report with examples
- `CROSS_PACKAGE_ACTIONS_IMPLEMENTATION.md` - Cross-package orchestration guide

## Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Type check
npm run type-check

# Development mode (watch)
npm run dev

# Clean build artifacts
npm run clean
```

## Build Output

The SDK is built to support both ESM and CommonJS:

```
dist/
├── esm/           # ES modules (.js + .d.ts)
└── cjs/           # CommonJS (.js)
```

## Recent Updates 🆕

### Cross-Package Action Orchestration (Phase 3)

The SDK now supports **InitActionSpec pattern** for composing actions from multiple packages during DAO initialization:

**What Changed:**
- ✅ Added `InitActionSpec` interface (TypeName + BCS data)
- ✅ Added 4 action builder classes: ConfigActions, LiquidityActions, GovernanceActions, VaultActions
- ✅ Added BCS serialization helpers matching Move struct layouts
- ✅ Updated Factory with `createDAOWithInitSpecs()` method
- ✅ Created Move contracts: `vault_actions.move` and `vault_intents.move` in futarchy_actions package

**Move Framework Changes:**
- ❌ NO changes needed to move-framework (account_actions package)
- ✅ `vault::create_stream()` already exists and works perfectly
- ✅ Only added **integration layer** in futarchy_actions to connect streams with InitActionSpecs

**Architecture:**
```
SDK Action Builders → InitActionSpec (TypeName + BCS)
         ↓
Factory stages as Intents on Account
         ↓
Frontend reads staged specs → Constructs PTB
         ↓
PTB calls vault_actions::execute_create_stream_init()
         ↓
Internally calls account_actions::vault::create_stream()
         ↓
Stream created atomically with DAO setup
```

### Stream Init Actions

Create payment streams during DAO initialization:

```typescript
VaultActions.createStream({
  vaultName: "team_vesting",
  beneficiary: "0x...",
  totalAmount: 1_000_000n,
  startTime: Date.now(),
  endTime: Date.now() + (365 * 24 * 60 * 60 * 1000),
  cliffTime: Date.now() + (90 * 24 * 60 * 60 * 1000),
  maxPerWithdrawal: 50_000n,
  minIntervalMs: 86400000,
  maxBeneficiaries: 1,
})
```

**Use Cases:**
- Team vesting schedules
- Advisor compensation
- Grant distributions
- Time-based token unlocking

**Status:** ✅ Verified working - see `STREAM_INIT_ACTIONS_VERIFIED.md`

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or PR.

## Support

For issues and questions:
- GitHub Issues: [govex repository]
- Documentation: [link to docs]
- Discord: [discord invite]
