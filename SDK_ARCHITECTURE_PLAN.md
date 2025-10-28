# GOVEX FUTARCHY SDK - PROFESSIONAL ANALYSIS & ARCHITECTURE PLAN

**Author:** Claude (Principal Sui Engineer Analysis)
**Date:** October 28, 2025
**Status:** Planning Phase
**Last Updated:** After reviewing ts-core SDK reference implementation

---

## 🔬 REFERENCE IMPLEMENTATION ANALYSIS

After analyzing `@account.tech/core` (ts-core SDK - cloned at `/packages/ts-core/`), we have valuable insights from a production SDK for a similar Move Framework implementation.

### Key Findings from ts-core SDK

1. **Auto-Generated Move Bindings** - 123 TypeScript files generated from Move modules in `.gen/` directory
2. **Three-Layer Architecture**:
   - `.gen/` - Low-level auto-generated Move function/struct bindings
   - `lib/` - Mid-level abstractions (intents, commands, account management)
   - `sdk/` - High-level SDK entry point with unified API
3. **Factory Pattern** - Intent and Asset types registered via factory arrays
4. **Modular Exports** - Separate entry points for each module (lib/account, lib/intents, lib/commands)
5. **State Management** - SDK can fetch and refresh on-chain state
6. **tsup Build System** - Dual ESM/CJS output with sourcemaps

### Patterns We Should Adopt

✅ **Auto-generate TypeScript from Move** (reduces maintenance burden)
✅ **Layered architecture** (low-level bindings → abstractions → high-level SDK)
✅ **Factory pattern for extensibility** (register new intent/action types)
✅ **Modular exports** (tree-shakeable, import only what you need)
✅ **State refresh pattern** (fetch account state, intents, proposals)

---

## 🔍 CURRENT STATE ANALYSIS

### What You Have

- **13 deployed packages** on devnet (Move Framework + Futarchy protocol)
- **Ad-hoc utility files** scattered across `/app/backend/` (create-dao-utils.ts, publish-utils.ts, etc.)
- **Frontend mutations** directly calling `txb.moveCall()` with hardcoded addresses
- **No centralized SDK** - each feature reimplements network/signer logic
- **Deployment data** in processed JSON format with all objects cataloged

### Key Protocol Components

1. **Account Protocol** - Account abstraction layer (PackageRegistry, Accounts, Intents)
2. **Futarchy Factory** - DAO creation & launchpad (Factory, FactoryOwnerCap, ValidatorAdminCap)
3. **Futarchy Governance** - Proposal lifecycle (proposals, escrows, execution)
4. **Futarchy Markets** - Conditional markets (AMM, liquidity, swaps, arbitrage, fees)
5. **Supporting Modules** - Types, utils, actions, oracles

---

## 🏗️ SDK ARCHITECTURE RECOMMENDATION

### Three-Layer Architecture (Inspired by ts-core)

```
@govex/sdk/
├── .gen/                           # LAYER 1: Auto-generated Move bindings
│   ├── futarchy-factory/
│   │   ├── factory/
│   │   │   ├── functions.ts        # Auto-generated: create_dao, add_stable_type, etc.
│   │   │   └── structs.ts          # Auto-generated: Factory, FactoryOwnerCap types
│   │   └── init-actions/
│   │       ├── functions.ts
│   │       └── structs.ts
│   ├── futarchy-governance/
│   │   ├── proposal/
│   │   ├── escrow/
│   │   └── execution/
│   ├── futarchy-markets/
│   ├── account-protocol/
│   └── ... (all 13 packages)
│
├── lib/                            # LAYER 2: High-level abstractions
│   ├── factory/
│   │   ├── Factory.ts              # Factory class with state management
│   │   ├── commands.ts             # High-level commands (createDao, etc.)
│   │   └── types.ts                # Factory-specific types
│   ├── governance/
│   │   ├── Proposal.ts             # Proposal class
│   │   ├── Escrow.ts               # Escrow management
│   │   ├── commands.ts             # createProposal, vote, execute
│   │   └── types.ts
│   ├── markets/
│   │   ├── Market.ts               # Market state
│   │   ├── commands.ts             # swap, addLiquidity, etc.
│   │   └── types.ts
│   ├── account/
│   │   ├── Account.ts              # Account abstraction
│   │   ├── Intents.ts              # Intent management (governance actions)
│   │   └── types.ts
│   └── oracle/
│       ├── Oracle.ts
│       └── types.ts
│
├── sdk/                            # LAYER 3: SDK entry point
│   ├── core.ts                     # GovexSDK class
│   ├── types.ts                    # SDK configuration types
│   └── index.ts                    # Public exports
│
├── types/                          # Shared types
│   ├── constants.ts                # Package addresses, known objects
│   ├── helpers.ts                  # Type utilities
│   └── index.ts
│
└── index.ts                        # Main export (re-exports from sdk/)
```

### Modular Package Exports

```typescript
// package.json exports (tree-shakeable)
{
  "exports": {
    ".": "./dist/esm/index.js",
    "./lib/factory": "./dist/esm/lib/factory/index.js",
    "./lib/governance": "./dist/esm/lib/governance/index.js",
    "./lib/markets": "./dist/esm/lib/markets/index.js",
    "./lib/account": "./dist/esm/lib/account/index.js",
    "./sdk": "./dist/esm/sdk/index.js",
    "./types": "./dist/esm/types/index.js"
  }
}
```

---

## 📦 KEY SDK FEATURES TO IMPLEMENT

### 1. Core Client Pattern

```typescript
// Usage pattern
const sdk = new GovexSDK({
  network: 'devnet',
  packageIds: PACKAGE_IDS['devnet']
});

// Or with custom provider
const sdk = new GovexSDK({
  provider: customSuiClient,
  packageIds: {...}
});
```

### 2. Module-Based API

```typescript
// Factory module
sdk.factory.createDao({...})
sdk.factory.addStableCoin({...})
sdk.factory.approveVerification({...})

// Governance module
sdk.governance.createProposal({...})
sdk.governance.advanceState({...})
sdk.governance.signResult({...})

// Markets module
sdk.markets.swap({...})
sdk.markets.addLiquidity({...})
sdk.markets.arbitrage({...})
```

### 3. Transaction Builder Pattern

```typescript
// Chainable PTB builder
const tx = sdk.transaction()
  .setGasBudget(50_000_000)
  .factory.createDao({...})
  .markets.addInitialLiquidity({...})
  .build();

await sdk.execute(tx, signer);
```

### 4. Type-Safe Response Parsing

```typescript
const result = await sdk.factory.createDao({...});
// result.daoId - strongly typed
// result.escrowId
// result.proposalMarkets[]
// result.transaction - full tx details
```

---

## 🎯 CRITICAL DESIGN DECISIONS

### 1. Package ID Management

**Problem:** You have 13 packages with different IDs per network

**Solution:**

```typescript
// Auto-load from deployments-processed/
const DEVNET_IDS = loadDeploymentConfig('devnet');
const MAINNET_IDS = loadDeploymentConfig('mainnet');

// Or use deployment files directly
import devnetDeployment from '../deployments-processed/_all-packages.json';
```

### 2. Multi-Network Support

```typescript
export type Network = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

const NETWORKS: Record<Network, NetworkConfig> = {
  devnet: {
    rpcUrl: getFullnodeUrl('devnet'),
    packages: DEVNET_IDS,
    feeManager: '0x...',
    factory: '0x...'
  },
  // ... other networks
};
```

### 3. Signer Abstraction

**Options:**
- **Option A:** Pass signer to each execute call (flexible for dApps)
- **Option B:** Initialize SDK with signer (easier for scripts)
- **Option C:** Both (recommended)

```typescript
// Script usage
const sdk = new GovexSDK({ network: 'devnet', signer });
await sdk.factory.createDao({...}); // auto-signs

// dApp usage
const sdk = new GovexSDK({ network: 'devnet' });
await sdk.factory.createDao({...}, { signer: walletSigner });
```

### 4. Error Handling Strategy

```typescript
// Wrap Sui errors with context
try {
  await sdk.markets.swap({...});
} catch (e) {
  if (e.code === 'INSUFFICIENT_LIQUIDITY') {
    throw new GovexSDKError('Insufficient liquidity in market', e);
  }
  throw e;
}
```

---

## 📊 DATA LAYER ARCHITECTURE

### Option 1: SDK Only (Lightweight)

- SDK only builds transactions
- No querying, no caching
- Users handle data fetching via `suiClient.getObject()`

### Option 2: SDK + Query Layer (Recommended)

```typescript
// Query helpers
sdk.query.getDao(daoId)
sdk.query.getProposal(proposalId)
sdk.query.getMarketState(marketId)
sdk.query.getUserPositions(address)

// Still allows direct SuiClient access
sdk.provider.getObject(...)
```

### Option 3: SDK + Full Indexer Integration

- SDK connects to your backend indexer
- Cached data, fast queries
- Falls back to RPC for fresh data

**Recommendation:** Start with **Option 2**, allow **Option 3** later

---

## 🔧 TECHNICAL IMPLEMENTATION NOTES

### Dependencies

```json
{
  "@mysten/sui": "^1.30.x",
  "@mysten/kiosk": "^0.12.x",    // For NFT handling (if needed)
  "superstruct": "^1.0",         // Runtime validation (optional)
  "zod": "^3.x"                  // Schema validation (optional)
}
```

### Code Generation Strategy

**Option 1: Use Existing Tools** (Recommended)
- Use Sui's built-in `sui move build` to generate JSON ABIs
- Write a codegen script to convert Move ABIs → TypeScript
- Generate `functions.ts` and `structs.ts` for each module

**Option 2: Manual Wrappers** (Faster to start)
- Write manual wrappers for most-used functions
- Generate types only
- Add more as needed

**Recommendation:** Start with **Option 2** for MVP, migrate to **Option 1** for production

### Build System (Matching ts-core)

```javascript
// tsup.config.js
export default defineConfig([
  {
    entry: ['src/**/*.ts'],
    format: 'esm',
    outDir: 'dist/esm',
    sourcemap: true,
    clean: true,
    dts: false,  // Use tsc for types
    outExtension: () => ({ js: '.js' }),
  },
  {
    entry: ['src/**/*.ts'],
    format: 'cjs',
    outDir: 'dist/cjs',
    sourcemap: true,
  }
]);
```

- **tsup** for fast bundling (esbuild-based)
- **ESM + CJS** dual output
- **Tree-shakeable** modules
- **TypeScript** for declaration files
- Source maps for debugging

### Testing Strategy

1. **Unit tests** - Pure functions, builders, parsers
2. **Integration tests** - Against devnet (use real deployed packages)
3. **E2E tests** - Full workflows (create DAO → proposal → vote → execute)
4. **Type tests** - Ensure generated types are correct

---

## 📈 MIGRATION PATH FOR EXISTING CODE

### Before (Current Utils)

```typescript
import { createDao } from './create-dao-utils';
const result = await createDao({
  packageId: '0x...',
  feeManager: '0x...',
  // ... 15 parameters
  network: 'devnet'
});
```

### After (SDK)

```typescript
import { GovexSDK } from '@govex/sdk';
const sdk = new GovexSDK({ network: 'devnet' });
const result = await sdk.factory.createDao({
  assetType: '0x2::sui::SUI',
  stableType: '0x...',
  daoName: 'My DAO',
  // ... clean params, auto-inferred addresses
});
```

---

## 🚀 PHASED ROLLOUT PLAN

### Phase 1: MVP (Week 1-2)

- Core Client with network config
- Factory module (createDao only)
- Basic transaction builder
- Load deployment configs automatically

### Phase 2: Expand Modules (Week 3-4)

- Complete Factory module
- Governance module (proposals)
- Markets module (swaps)
- Response parsers

### Phase 3: Developer Experience (Week 5-6)

- Query helpers
- Error handling
- TypeScript docs (JSDoc)
- Example scripts

### Phase 4: Production Ready (Week 7-8)

- Full test coverage
- Mainnet deployment configs
- npm publish
- Documentation site

---

## ⚠️ CRITICAL QUESTIONS FOR YOU

1. **Multi-sig support?** Do DAOs need multi-sig execution patterns?

2. **Indexer dependency?** Should SDK talk to your backend API or go direct to RPC?

3. **Browser vs Node?** Is this SDK for dApps, scripts, or both?

4. **Versioning strategy?** With 13 packages, how do you handle upgrades? Pin versions or auto-detect?

5. **Type generation?** Auto-generate TypeScript types from Move ABIs or manual?

6. **Existing utils migration?** Keep old utils for backward compat or force migration?

---

## 🎯 INTENT PATTERN IMPLEMENTATION

### Understanding Intents (From ts-core Analysis)

Intents are **governance proposals** that go through approval → execution lifecycle:

```typescript
// Intent lifecycle
1. Request: Create intent with actions
2. Approve: Multi-sig or governance approves
3. Execute: After approval + time delay, execute actions
4. Cleanup: Delete expired/completed intents
```

### Intent Architecture

```typescript
// Base Intent class (from ts-core pattern)
export abstract class Intent {
  constructor(
    public client: SuiClient,
    public account: string,
    public outcome: Outcome,  // Approval outcome
    public fields: IntentFields
  ) {}

  // Each intent implements these
  abstract request(tx: Transaction, ...args): void;
  abstract execute(tx: Transaction, executable: TransactionObjectInput): void;
  abstract init(): Promise<void>;  // Fetch on-chain state
}

// Factory pattern for registering intent types
export class Intents {
  constructor(
    private intentFactory: Array<typeof Intent>,
    private outcomeFactory: Array<typeof Outcome>
  ) {}

  async fetchIntents(): Promise<Intent[]> {
    // Fetch from dynamic fields on-chain
    // Deserialize and instantiate correct Intent subclass
  }
}
```

### Governance Intent Examples

```typescript
// Create proposal intent
const intent = await sdk.governance.requestProposal({
  key: 'proposal-1',
  description: 'Update DAO config',
  actions: [
    { type: 'UpdateConfig', params: {...} },
    { type: 'TransferFunds', params: {...} }
  ],
  executionTimes: [Date.now() + 7 * 24 * 60 * 60 * 1000] // 7 days
});

// Later: Execute after approval
await sdk.governance.executeIntent(intent.key);
```

### Integration with Your Protocol

Your protocol has **two types of intents**:

1. **Account Protocol Intents** - Config changes, package upgrades, etc.
2. **Futarchy Governance** - Proposals with conditional markets

**Recommendation:**
- Use Intent pattern for **both**
- Factory registers all intent types
- SDK auto-discovers intents from on-chain state

---

## 💡 RECOMMENDATIONS AS PRINCIPAL ENGINEER

### Critical Recommendations (Updated After ts-core Review)

1. **Three-Layer Architecture:** Follow `.gen/` → `lib/` → `sdk/` pattern
2. **Code Generation:** Auto-generate Move bindings (Phase 2+)
3. **Intent Pattern:** Implement factory-based intent system
4. **Modular Exports:** Allow tree-shaking, import only what you need
5. **State Management:** SDK should fetch and cache on-chain state
6. **Type Safety:** Strong types everywhere, especially for intents/outcomes
7. **Developer First:** High-level SDK for common tasks, low-level access for advanced users
8. **Future-Proof:** Design for multi-network, multi-version, extensibility

### Phase Priority (Updated)

**Phase 1: Core Infrastructure** (Week 1-2)
- Network configuration
- Load deployment configs
- Transaction builder wrapper
- Basic Factory commands (createDao)

**Phase 2: Code Generation** (Week 2-3)
- Set up codegen pipeline
- Generate bindings for Factory + Governance + Markets
- Test generated code

**Phase 3: High-Level Abstractions** (Week 3-5)
- Factory, Governance, Markets classes
- Intent management system
- State refresh patterns
- Response parsers

**Phase 4: Developer Experience** (Week 5-6)
- Query helpers
- Error handling
- Examples & docs
- Type safety validation

**Phase 5: Production Ready** (Week 7-8)
- Full test coverage
- Mainnet configs
- Performance optimization
- npm publish

---

## 📋 DEPLOYMENT DATA INTEGRATION

### Available Deployment Information

From `/packages/deployments-processed/_all-packages.json`:

- **Package IDs** for all 13 packages
- **UpgradeCap IDs** (for package upgrades)
- **Admin Capability IDs** (FactoryOwnerCap, ValidatorAdminCap, FeeAdminCap, PackageAdminCap)
- **Shared Object IDs** (Factory, FeeManager, PackageRegistry, PositionImageConfig)
- **Transaction Digests** (deployment history)

### SDK Configuration Loading

```typescript
// Automatic loading from deployment files
const config = loadNetworkConfig('devnet');

config.packages.futarchy_factory.packageId
config.packages.futarchy_factory.adminCaps[0].objectId // FactoryOwnerCap
config.packages.futarchy_factory.sharedObjects[0].objectId // Factory
```

---

## 🔗 REFERENCES

- **Deployment Data:** `/packages/deployments-processed/`
- **Current Utils:** `/app/backend/*-utils.ts`
- **Frontend Mutations:** `/app/frontend/src/mutations/`
- **Move Packages:** `/packages/futarchy_*/`

---

## 📚 KEY LEARNINGS FROM TS-CORE ANALYSIS

### What Worked Well in ts-core

1. **Auto-generated bindings** - Zero manual maintenance for Move function wrappers
2. **Layered access** - Advanced users can import `.gen/`, normal users use `lib/`
3. **Factory pattern** - Easy to extend with new intent types
4. **State management** - SDK fetches and caches on-chain state efficiently
5. **Modular exports** - Tree-shaking works, bundle size stays small
6. **Dual ESM/CJS** - Works in Node scripts and browser apps

### What to Improve

1. **Better error messages** - ts-core errors can be cryptic
2. **More examples** - Need comprehensive usage docs
3. **Type inference** - Could be better for generic functions
4. **Query optimization** - Batch fetches where possible
5. **Caching strategy** - Add TTL cache for frequently accessed data

### Direct Inspirations for Govex SDK

```typescript
// 1. SDK initialization (like ts-core)
const sdk = await GovexSDK.init({
  network: 'devnet',
  userAddress: '0x...',
  daoId: '0x...',  // optional, can switch later
});

// 2. State refresh pattern
await sdk.refresh();  // Re-fetch all state
await sdk.dao.refresh();  // Just DAO state
await sdk.proposals.refresh();  // Just proposals

// 3. Switch context (like ts-core's switch())
await sdk.switchDao('0x...newDaoId');

// 4. Low-level access when needed
import { createDao } from '@govex/sdk/.gen/futarchy-factory/factory/functions';
// For advanced users who need full control
```

---

## NEXT STEPS

### Immediate Actions

1. ✅ **Answer critical questions** (see section above)
2. ✅ **Review and approve** this architecture document
3. 🔲 **Set up SDK repo structure** in `/packages/sdk/` or separate repo
4. 🔲 **Bootstrap Phase 1** - Core infrastructure
5. 🔲 **Create example** - Simple createDao script using SDK

### Development Sequence

**Week 1:**
- [ ] Set up repo structure (`.gen/`, `lib/`, `sdk/`)
- [ ] Configure tsup build
- [ ] Create network configuration loader
- [ ] Implement deployment config parser (from `deployments-processed/`)
- [ ] Write first manual wrapper: `Factory.createDao()`

**Week 2:**
- [ ] Set up codegen tooling
- [ ] Generate bindings for futarchy_factory
- [ ] Test generated code vs manual wrappers
- [ ] Document codegen workflow
- [ ] Start Factory module abstractions

**Week 3-4:**
- [ ] Governance module (proposals, voting, execution)
- [ ] Markets module (swaps, liquidity)
- [ ] Intent system implementation
- [ ] State refresh patterns

**Week 5-6:**
- [ ] Query helpers
- [ ] Error handling system
- [ ] Usage examples
- [ ] Documentation site

**Week 7-8:**
- [ ] Full test suite
- [ ] Mainnet deployment configs
- [ ] Performance profiling
- [ ] npm publish prep

---

## 🔗 ADDITIONAL RESOURCES

- **ts-core SDK:** `/packages/ts-core/` (reference implementation)
- **Current utils:** `/app/backend/*-utils.ts` (code to migrate)
- **Frontend mutations:** `/app/frontend/src/mutations/` (SDK users)
- **Deployment data:** `/packages/deployments-processed/` (auto-load configs)
- **Move packages:** `/packages/futarchy_*/` (source of truth)

---

**Ready to build? Review this document, answer the critical questions, and let's start implementing Phase 1!**

**Last Updated:** October 28, 2025 - After comprehensive ts-core SDK analysis
