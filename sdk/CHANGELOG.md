# Changelog

All notable changes to the Futarchy SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-28

### Added

**Phase 1: Foundation & Configuration**

- Initial SDK project structure with three-layer architecture (.gen/, lib/, sdk/)
- Network configuration system supporting mainnet, testnet, devnet, localnet, and custom RPC
- Deployment configuration parser and manager
- Core `FutarchySDK` class with initialization and configuration
- TypeScript type definitions for deployment data structures
- Dual ESM/CJS build output using tsup
- Comprehensive README documentation
- Basic usage example
- Full TypeScript strict mode support
- Source maps for debugging

**Key Features:**
- `FutarchySDK.init()` - Initialize SDK with network and deployment config
- `DeploymentManager` - Access package IDs, shared objects, admin caps
- Helper methods for accessing Factory and PackageRegistry
- Type-safe package and object ID access
- Direct SuiClient integration

### Developer Experience

- Proper package.json with module exports
- TypeScript configuration with strict type checking
- Build scripts: `build`, `dev`, `type-check`, `clean`
- .gitignore for clean repository
- Examples directory for reference implementations

### Dependencies

- `@mysten/sui` ^1.14.0 - Sui SDK for blockchain interactions
- `tsup` ^8.3.5 - Build tool for dual ESM/CJS output
- `typescript` ^5.6.3 - TypeScript compiler

## [0.2.0] - 2025-10-28

### Added

**Phase 2: Core Operations & Queries**

- Transaction builder utilities with helper methods
- DAO creation operations via `FactoryOperations`
- Comprehensive query helpers via `QueryHelper`
- Event querying capabilities
- Balance checking utilities
- Object queries with type filtering

**Key Features:**
- `TransactionBuilder` - Base class for building transactions
- `TransactionUtils` - Utility functions (SUI/MIST conversion, target building)
- `FactoryOperations.createDAO()` - Full DAO creation with all parameters
- `FactoryOperations.createDAOWithDefaults()` - Simplified DAO creation
- `QueryHelper` - 15+ query methods for on-chain data
  - `getAllDAOs()` - Query all DAOs from events
  - `getDAOsCreatedByAddress()` - Filter DAOs by creator
  - `getBalance()` / `getAllBalances()` - Token balance queries
  - `getObject()` / `getObjects()` - Object data retrieval
  - `queryEvents()` - Event filtering
  - `getDynamicFields()` - Dynamic field access

**Examples:**
- `create-dao.ts` - DAO creation walkthrough
- `query-data.ts` - Comprehensive querying examples

**SDK Integration:**
- `sdk.factory` - Direct access to DAO creation
- `sdk.query` - Direct access to query utilities

## [Unreleased]

### Planned

**Phase 3: Governance Operations**
- Proposal creation and management
- Voting functionality
- Proposal execution helpers

**Phase 4: Market Operations**
- Conditional market creation
- Trading functionality
- Market resolution

**Phase 5: Advanced Features**
- Auto-generated Move type bindings (.gen layer)
- Event subscriptions and listeners
- Real-time market data
- Caching layer for on-chain queries
- Batch transaction builders
