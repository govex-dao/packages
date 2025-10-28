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

### Roadmap

- [ ] Auto-generated Move bindings (.gen layer)
- [ ] Governance proposal operations
- [ ] Market operations (create, trade, resolve)
- [ ] Proposal voting and execution
- [ ] Event subscriptions and listeners
- [ ] Caching layer for on-chain data
- [ ] Batch transaction builders

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

// === Create a DAO ===

const tx = sdk.factory.createDAOWithDefaults({
  assetType: '0xPKG::coin::MYCOIN',
  stableType: '0x2::sui::SUI',
  treasuryCap: '0xCAP_ID',
  coinMetadata: '0xMETADATA_ID',
  daoName: 'My DAO',
  iconUrl: 'https://example.com/icon.png',
  description: 'A futarchy DAO',
});

// Sign and execute
// const result = await sdk.client.signAndExecuteTransaction({
//   transaction: tx,
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

## Examples

See the `examples/` directory for complete usage examples:

- `basic-usage.ts` - SDK initialization and basic queries
- `create-dao.ts` - Creating a new Futarchy DAO
- `query-data.ts` - Querying DAOs, events, and balances

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

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or PR.

## Support

For issues and questions:
- GitHub Issues: [govex repository]
- Documentation: [link to docs]
