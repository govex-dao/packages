# Govex DAO Intent System Documentation

Complete catalog of all intent types across the Move Framework and Futarchy governance system.

---

## Move Framework Intents (6 modules, 14 intent types)

### 1. **access_control_intents** (`account_actions::access_control_intents`)
- **BorrowCapIntent** - Borrow and return capability objects using hot potato pattern

  *Enables temporary borrowing of capability objects (like UpgradeCap, TreasuryCap, AdminCap) from the account's custody during intent execution. The capability must be borrowed AND returned within the same transaction, ensuring the account never loses custody. This allows governance proposals to use sensitive capabilities without permanently removing them. Think of it like checking out a library book - you can use it, but you must return it before the transaction ends or everything aborts.*

  **Example**: A DAO needs to use its UpgradeCap to upgrade a package. Instead of permanently transferring the cap, it creates a BorrowCapIntent that: (1) borrows the UpgradeCap, (2) uses it to authorize the upgrade, (3) returns it to the account - all atomically in one transaction.

### 2. **currency_intents** (`account_actions::currency_intents`)
- **DisableRulesIntent** - Permanently disable currency rules (mint/burn/metadata updates)

  *Permanently freezes the currency rules for a coin, disabling all future mints, burns, and metadata updates. This is a one-way operation that makes the coin's supply fixed forever and metadata immutable. Once executed, the TreasuryCap becomes effectively useless for anything except proving ownership. This is useful for DAOs that want to commit to "no more minting" credibly - similar to burning the mint keys in crypto parlance.*

  **Example**: A DAO votes to cap its token supply permanently. After passing a proposal with DisableRulesIntent, no future proposal can ever mint new tokens, even with 100% governance approval.

- **UpdateMetadataIntent** - Update coin metadata (symbol, name, description, icon)
- **MintAndTransferIntent** - Mint new coins and transfer to recipients
- **WithdrawAndBurnIntent** - Withdraw coins from account and burn them

### 3. **memo_intents** (`account_actions::memo_intents`)
- **MemoIntent** - Emit on-chain memo with optional object reference

### 4. **owned_intents** (`account_actions::owned_intents`)
- **WithdrawAndTransferToVaultIntent** - Withdraw coin and deposit to vault
- **WithdrawObjectsAndTransferIntent** - Withdraw and transfer arbitrary objects by ID
- **WithdrawCoinsAndTransferIntent** - Withdraw and transfer coins

### 5. **package_upgrade_intents** (`account_actions::package_upgrade_intents`)
- **UpgradePackageIntent** - Upgrade package with digest verification

- **RestrictPolicyIntent** - Restrict upgrade policy (additive, dep-only, or immutable)

  *Progressively restricts what kinds of package upgrades are allowed for a smart contract, moving from fully flexible to completely immutable. Sui has three upgrade policies: (1) Compatible (can change anything), (2) Additive (can only add new functions), (3) Dependency-only (can only update dependencies), and (4) Immutable (no changes ever). This intent moves the policy in one direction only - more restrictive. DAOs use this to gradually decentralize, starting flexible during early development, then locking down as the protocol matures.*

  **Example**: A DAO starts with "Compatible" policy. After 6 months, governance votes to restrict to "Additive" (can add features but not break existing). After 2 years, final vote to make "Immutable" - contract is now set in stone forever.

- **CreateCommitCapIntent** - Create and transfer commit authority capability

  *Creates a two-step upgrade system by delegating the "commit" step of package upgrades to a separate team (usually core developers) while keeping the "authorize" step with the DAO. After the DAO votes to upgrade, the core team receives an UpgradeCommitCap that lets them execute the upgrade within a timelock period. If they don't commit within the timelock, the DAO can reclaim authority. This balances speed (dev team can execute quickly) with safety (DAO always has final say and can override via governance).*

  **Example**: DAO votes "yes, upgrade to v2.0" and grants the core team a 7-day commit cap. Core team has 7 days to build and submit the upgrade. If they don't, or if DAO changes its mind, a new governance proposal can revoke/reclaim after the timelock expires.

### 6. **vault_intents** (`account_actions::vault_intents`)
- **SpendAndTransferIntent** - Spend from vault and transfer to recipients
- **SpendAndTransferIntent** (reused) - Also handles cancel_stream operations

---

## Futarchy Intents (10 modules, 40+ intent types)

### 1. **config_intents** (`futarchy_actions::config_intents`)

Single witness `ConfigIntent` for all configuration operations:

- **Set proposals enabled/disabled** - Enable or disable new proposal creation
- **Update DAO name** - Change the DAO's display name
- **Update metadata** - Update name, icon_url, description
- **Update trading parameters** - Configure review_period_ms, trading_period_ms, min_asset_amount, min_stable_amount
- **Update TWAP configuration** - Configure start_delay, step_max, initial_observation, threshold
- **Update governance settings** - Configure max_outcomes, max_actions_per_outcome, required_bond_amount, max_intents_per_outcome, proposal_intent_expiry_ms, optimistic_challenge_fee, optimistic_challenge_period_ms
- **Update conditional metadata configuration** - Configure how conditional token metadata is derived
- **Update sponsorship configuration** - Configure enabled, sponsored_threshold, waive_advancement_fees, default_sponsor_quota_amount
- **Update early resolve configuration** - Configure min/max_proposal_duration_ms, min_winner_spread, flip tracking parameters, twap_scaling, keeper_reward_bps

### 2. **quota_intents** (`futarchy_actions::quota_intents`)
- **QuotaIntent** - Set user quotas (quota_amount, quota_period_ms, reduced_fee, sponsor_quota_amount)
- **QuotaIntent** - Remove user quotas (convenience wrapper with quota_amount=0)

### 3. **dissolution_intents** (`futarchy_actions::dissolution_intents`)
- **DissolutionIntent** - Create dissolution capability for DAO termination

  *Creates a DissolutionCapability that enables controlled termination of the DAO. This is the nuclear option - it begins the process of shutting down the DAO permanently by allowing proportional redemption of DAO tokens for treasury assets. Once this capability exists, token holders can burn their tokens to claim their share of the treasury. The intent is typically added to a "Terminate DAO" proposal itself, so if the dissolution vote passes, the capability is created automatically.*

  **Example**: DAO with 1M tokens and $500K treasury votes to dissolve. DissolutionIntent creates a capability. Now anyone holding 1000 tokens (0.1%) can burn them to redeem $500 (0.1% of treasury). Eventually all tokens are burned and treasury is fully distributed.

### 4. **liquidity_intents** (`futarchy_actions::liquidity_intents`)

Single witness `LiquidityIntent` with helper functions:

- **Add liquidity** - Add liquidity to pool (pool_id, asset_amount, stable_amount, min_lp_amount)
- **Remove liquidity** - Remove liquidity from pool (pool_id, token_id, lp_amount, min_asset_amount, min_stable_amount)
- **Withdraw LP token** - Withdraw LP token from custody
- **Create pool** - Create new liquidity pool (initial_asset_amount, initial_stable_amount, fee_bps, minimum_liquidity)
- **Update pool parameters** - Update existing pool (fee_bps, minimum_liquidity)
- **Set pool status** - Pause or unpause pool

### 5. **account_config_intents** (`futarchy_governance_actions::account_config_intents`)
- **UpdateDepsIntent** - Update account dependencies (add new action packages)

  *Updates the account's dependency registry to enable new action modules. Every DAO account has a whitelist of which packages it trusts for actions. Before a DAO can use new functionality (like "dividend distribution" or "NFT minting"), governance must vote to add those packages to the deps list. This is a security measure - prevents malicious or untested packages from being used in proposals.*

  **Example**: DAO wants to add staking functionality. Developer publishes "StakingActions@0x123" package. DAO creates proposal with UpdateDepsIntent to add this package. After passing, any future proposals can include staking actions from that package.

- **ToggleUnverifiedIntent** - Toggle unverified package allowance

  *Toggles whether the DAO accepts packages that aren't in the protocol's official Extensions whitelist. By default, DAOs can only use verified/audited packages. Enabling unverified mode lets the DAO use ANY package (more flexibility, less safety). This is useful for experimental DAOs or when integrating with new protocols before they're officially whitelisted, but increases risk of malicious code execution.*

  **Example**: DAO wants to integrate with a brand new DeFi protocol that isn't yet in the Extensions whitelist. They vote to enable unverified mode, add the protocol's package, use it, then vote to disable unverified mode again for safety.

### 6. **config_migration_intents** (`futarchy_governance_actions::config_migration_intents`)
- **MigrateConfigIntent** - Migrate account config type (e.g., FutarchyConfig → FutarchyConfigV2)

  *Changes the fundamental configuration struct type of the DAO account (e.g., FutarchyConfig → FutarchyConfigV2) without creating a new DAO or migrating assets. This is for major protocol upgrades that add new config fields or restructure governance. The old config is removed, transformed to the new type, and the new config is installed. This is DANGEROUS because it changes the core identity/capabilities of the DAO, so it requires governance approval.*

  **Example**: Protocol adds "quadratic voting" feature in v2. Existing DAOs want to upgrade without migrating their $10M treasuries. They vote to migrate config from FutarchyConfig→FutarchyConfigV2. The migration function reads current params (fees, timeouts), transforms them to v2 format (adding quadratic_enabled: false), and installs the new config. DAO now has v2 capabilities.

### 7. **governance_intents** (`futarchy_governance_actions::governance_intents`)
- **GovernanceWitness** - Execute proposal intent from approved proposals (just-in-time intent creation and execution)

  *This is the "just-in-time intent execution" system for futarchy proposals. Unlike traditional intents that get created and stored in the account, GovernanceWitness creates intents on-the-fly at execution time from a blueprint (InitActionSpecs) stored in the proposal. When a proposal's market resolves to YES, this witness instantiates the intent, immediately converts it to an executable, runs all the actions, then cleans up the temporary intent. This avoids polluting the account with pending intents and enables more flexible proposal composition.*

  **Example**: A proposal to "increase trading fee to 0.5%" passes. Instead of having a pre-created intent sitting in the account, the proposal contains a specs blueprint. At execution, GovernanceWitness: (1) reads the blueprint, (2) creates a temporary intent, (3) executes all actions, (4) deletes the temporary intent - all in one transaction.

### 8. **package_registry_intents** (`futarchy_governance_actions::package_registry_intents`)

- **AcceptPackageAdminCapIntent** - Accept PackageAdminCap into protocol DAO custody

Helper functions for adding to intents:
- **Add package** - Add package to registry (name, addr, version, action_types, category, description)
- **Remove package** - Remove package from registry
- **Update package version** - Update package version
- **Update package metadata** - Update package metadata (action_types, category, description)

### 9. **protocol_admin_intents** (`futarchy_governance_actions::protocol_admin_intents`)

*These intents are special because they operate on the **protocol-level** (the factory, fee manager, validators) rather than individual DAOs. Only the Protocol DAO can execute these.*

**Cap acceptance:**
For accepting admin caps into Protocol DAO custody, use one of the following approaches:

1. **Entry functions (recommended for initial setup):**
   - `migrate_admin_caps_to_dao()` - Transfer all three caps at once
   - `migrate_factory_cap_to_dao()` - Transfer FactoryOwnerCap
   - `migrate_fee_cap_to_dao()` - Transfer FeeAdminCap
   - `migrate_validator_cap_to_dao()` - Transfer ValidatorAdminCap

2. **Generic intents (for governance-based transfer):**
   - Use `WithdrawObjectsAndTransferIntent` from `account_actions::owned_intents`
   - Then call `account::add_managed_asset()` to store with appropriate key:
     - `"protocol:factory_owner_cap"` for FactoryOwnerCap
     - `"protocol:fee_admin_cap"` for FeeAdminCap
     - `"protocol:validator_admin_cap"` for ValidatorAdminCap

  *The specialized cap acceptance intents were removed as they were redundant wrappers around generic object transfer functionality.*

**Factory admin helper functions:**
- **Set factory paused** - Pause or unpause DAO factory
- **Add stable type** - Add stable type to factory whitelist
- **Remove stable type** - Remove stable type from factory whitelist

**Fee management helper functions:**
- **Update DAO creation fee** - Update fee for creating new DAOs
- **Update proposal fee** - Update fee for creating proposals
- **Update verification fee** - Update verification fee by level
- **Update recovery fee** - Update fee for account recovery
- **Withdraw fees to treasury** - Withdraw protocol fees to treasury

**Verification helper functions:**
- **Add verification level** - Add new verification level (level, fee)
- **Remove verification level** - Remove verification level
- **Request verification** - DAO requests its own verification (level, attestation_url)

**Coin fee configuration helper functions:**
- **Add coin fee config** - Add fee configuration for new coin type (coin_type, decimals, dao_creation_fee, proposal_fee_per_outcome, recovery_fee)
- **Update coin creation fee** - Update DAO creation fee for specific coin type
- **Update coin proposal fee** - Update proposal fee for specific coin type
- **Update coin recovery fee** - Update recovery fee for specific coin type
- **Apply pending coin fees** - Apply pending fee changes for specific coin type

**Note**: The following operations were moved from intents to direct cap-gated functions in `futarchy_factory::factory`:
- **Approve verification** - Now a direct function using ValidatorAdminCap
- **Reject verification** - Now a direct function using ValidatorAdminCap
- **Set DAO score** - Now a direct function using ValidatorAdminCap

### 10. **oracle_intents** (`futarchy_oracle_actions::oracle_intents`)
- **Create oracle grant** - Create price-based grant with tiers (tier_specs, launchpad_multiplier, earliest_execution_offset_ms, expiry_years, cancelable, description)

  *Creates price-based token unlock schedules with multiple tiers and recipients. Instead of time-vesting, tokens vest based on price milestones. A DAO can create a grant like: "Tier 1 (10M tokens): unlocks when price hits 2x launch price, distributed to core team. Tier 2 (5M tokens): unlocks when price hits 5x, distributed to early contributors." Each tier has price conditions (above/below threshold), recipients, and amounts. The grant can be cancelable or permanent, and includes a launchpad price enforcement (minimum global threshold below which nothing unlocks).*

  **Use case**: DAO wants to reward core team based on performance, not just time passage. Create oracle grant with 3 tiers: 10% at 2x price, 20% at 5x price, 30% at 10x price. Team only gets tokens if they actually deliver value and price increases. If price dumps, they get nothing even if years pass.

- **Cancel oracle grant** - Cancel an existing grant (grant_id) if cancelable flag was set

  *Cancels an existing oracle grant (only if it was created with cancelable=true). All unclaimed tokens become unclaimable and effectively burned. Used when a recipient leaves the DAO, violates terms, or the DAO votes to cancel the grant program.*

---

## Architectural Patterns

### Move Framework Pattern
Traditional account-based intents with Auth verification. These intents require:
- Auth capability (proves account ownership)
- Direct account mutation
- Used for account administration and treasury management

### Futarchy Pattern
Governance-based intents that bypass Auth and go through market-based proposal system. These intents:
- Do NOT require Auth
- Go through futarchy market resolution
- Execute only if market resolves to YES
- Used for DAO governance decisions

### Helper Functions vs Full Intents
Some modules provide **helper functions** that add actions to existing intents rather than creating full intent witnesses:
- `liquidity_intents` - Helpers add actions to any intent
- `protocol_admin_intents` - Helpers compose complex governance proposals
- `package_registry_intents` - Helpers manage package registry

### Single Witness Pattern
Some modules use a **single witness** for multiple related operations:
- `ConfigIntent` - All DAO configuration changes
- `LiquidityIntent` - All liquidity operations
- `GovernanceWitness` - All proposal executions
- `QuotaIntent` - All quota management operations

This reduces witness proliferation and simplifies the type system.

---

## Summary Statistics

- **Total modules**: 16 (6 move-framework + 10 futarchy)
- **Total named intent witnesses**: 17 distinct types
- **Total operations**: 54+ different operations available
- **Move Framework**: 14 intent types across 6 modules
- **Futarchy**: 40+ operations across 10 modules (including helper functions)

**Note**: Many futarchy operations use helper functions rather than distinct witnesses, allowing flexible composition of complex governance proposals.

---

## Non-Trivial Intent Explanations

This section provides detailed explanations for intents whose purpose and behavior may not be immediately obvious from their names.

---

### Move Framework Intents

#### **BorrowCapIntent** (`access_control_intents`)
**What it does**: Enables temporary borrowing of capability objects (like UpgradeCap, TreasuryCap, AdminCap) from the account's custody during intent execution using a hot potato pattern. The capability must be borrowed AND returned within the same transaction, ensuring the account never loses custody. This allows governance proposals to use sensitive capabilities without permanently removing them from the account. Think of it like checking out a library book - you can use it, but you must return it before the transaction ends or everything aborts.

**Example**: A DAO needs to use its UpgradeCap to upgrade a package. Instead of permanently transferring the cap, it creates a BorrowCapIntent that: (1) borrows the UpgradeCap, (2) uses it to authorize the upgrade, (3) returns it to the account - all atomically in one transaction.

---

#### **DisableRulesIntent** (`currency_intents`)
**What it does**: Permanently freezes the currency rules for a coin, disabling all future mints, burns, and metadata updates. This is a one-way operation that makes the coin's supply fixed forever and metadata immutable. Once executed, the TreasuryCap becomes effectively useless for anything except proving ownership. This is useful for DAOs that want to commit to "no more minting" credibly - similar to burning the mint keys in crypto parlance.

**Example**: A DAO votes to cap its token supply permanently. After passing a proposal with DisableRulesIntent, no future proposal can ever mint new tokens, even with 100% governance approval.

---

#### **RestrictPolicyIntent** (`package_upgrade_intents`)
**What it does**: Progressively restricts what kinds of package upgrades are allowed for a smart contract, moving from fully flexible to completely immutable. Sui has three upgrade policies: (1) Compatible (can change anything), (2) Additive (can only add new functions), (3) Dependency-only (can only update dependencies), and (4) Immutable (no changes ever). This intent moves the policy in one direction only - more restrictive. DAOs use this to gradually decentralize, starting flexible during early development, then locking down as the protocol matures.

**Example**: A DAO starts with "Compatible" policy. After 6 months, governance votes to restrict to "Additive" (can add features but not break existing). After 2 years, final vote to make "Immutable" - contract is now set in stone forever.

---

#### **CreateCommitCapIntent** (`package_upgrade_intents`)
**What it does**: Creates a two-step upgrade system by delegating the "commit" step of package upgrades to a separate team (usually core developers) while keeping the "authorize" step with the DAO. After the DAO votes to upgrade, the core team receives an UpgradeCommitCap that lets them execute the upgrade within a timelock period. If they don't commit within the timelock, the DAO can reclaim authority. This balances speed (dev team can execute quickly) with safety (DAO always has final say and can override via governance).

**Example**: DAO votes "yes, upgrade to v2.0" and grants the core team a 7-day commit cap. Core team has 7 days to build and submit the upgrade. If they don't, or if DAO changes its mind, a new governance proposal can revoke/reclaim after the timelock expires.

---

### Futarchy Governance Intents

#### **GovernanceWitness** (`governance_intents`)
**What it does**: This is the "just-in-time intent execution" system for futarchy proposals. Unlike traditional intents that get created and stored in the account, GovernanceWitness creates intents on-the-fly at execution time from a blueprint (InitActionSpecs) stored in the proposal. When a proposal's market resolves to YES, this witness instantiates the intent, immediately converts it to an executable, runs all the actions, then cleans up the temporary intent. This avoids polluting the account with pending intents and enables more flexible proposal composition.

**Example**: A proposal to "increase trading fee to 0.5%" passes. Instead of having a pre-created intent sitting in the account, the proposal contains a specs blueprint. At execution, GovernanceWitness: (1) reads the blueprint, (2) creates a temporary intent, (3) executes all actions, (4) deletes the temporary intent - all in one transaction.

---

#### **DissolutionIntent** (`dissolution_intents`)
**What it does**: Creates a DissolutionCapability that enables controlled termination of the DAO. This is the nuclear option - it begins the process of shutting down the DAO permanently by allowing proportional redemption of DAO tokens for treasury assets. Once this capability exists, token holders can burn their tokens to claim their share of the treasury. The intent is typically added to a "Terminate DAO" proposal itself, so if the dissolution vote passes, the capability is created automatically.

**Example**: DAO with 1M tokens and $500K treasury votes to dissolve. DissolutionIntent creates a capability. Now anyone holding 1000 tokens (0.1%) can burn them to redeem $500 (0.1% of treasury). Eventually all tokens are burned and treasury is fully distributed.

---

#### **UpdateDepsIntent** (`account_config_intents`)
**What it does**: Updates the account's dependency registry to enable new action modules. Every DAO account has a whitelist of which packages it trusts for actions. Before a DAO can use new functionality (like "dividend distribution" or "NFT minting"), governance must vote to add those packages to the deps list. This is a security measure - prevents malicious or untested packages from being used in proposals.

**Example**: DAO wants to add staking functionality. Developer publishes "StakingActions@0x123" package. DAO creates proposal with UpdateDepsIntent to add this package. After passing, any future proposals can include staking actions from that package.

---

#### **ToggleUnverifiedIntent** (`account_config_intents`)
**What it does**: Toggles whether the DAO accepts packages that aren't in the protocol's official Extensions whitelist. By default, DAOs can only use verified/audited packages. Enabling unverified mode lets the DAO use ANY package (more flexibility, less safety). This is useful for experimental DAOs or when integrating with new protocols before they're officially whitelisted, but increases risk of malicious code execution.

**Example**: DAO wants to integrate with a brand new DeFi protocol that isn't yet in the Extensions whitelist. They vote to enable unverified mode, add the protocol's package, use it, then vote to disable unverified mode again for safety.

---

#### **MigrateConfigIntent** (`config_migration_intents`)
**What it does**: Changes the fundamental configuration struct type of the DAO account (e.g., FutarchyConfig → FutarchyConfigV2) without creating a new DAO or migrating assets. This is for major protocol upgrades that add new config fields or restructure governance. The old config is removed, transformed to the new type, and the new config is installed. This is DANGEROUS because it changes the core identity/capabilities of the DAO, so it requires governance approval.

**Example**: Protocol adds "quadratic voting" feature in v2. Existing DAOs want to upgrade without migrating their $10M treasuries. They vote to migrate config from FutarchyConfig→FutarchyConfigV2. The migration function reads current params (fees, timeouts), transforms them to v2 format (adding quadratic_enabled: false), and installs the new config. DAO now has v2 capabilities.

---

#### **Oracle Grant Intents** (`oracle_intents`)

**CreateOracleGrant**: Creates price-based token unlock schedules with multiple tiers and recipients. Instead of time-vesting, tokens vest based on price milestones. A DAO can create a grant like: "Tier 1 (10M tokens): unlocks when price hits 2x launch price, distributed to core team. Tier 2 (5M tokens): unlocks when price hits 5x, distributed to early contributors." Each tier has price conditions (above/below threshold), recipients, and amounts. The grant can be cancelable or permanent, and includes a launchpad price enforcement (minimum global threshold below which nothing unlocks).

**Use case**: DAO wants to reward core team based on performance, not just time passage. Create oracle grant with 3 tiers: 10% at 2x price, 20% at 5x price, 30% at 10x price. Team only gets tokens if they actually deliver value and price increases. If price dumps, they get nothing even if years pass.

**CancelOracleGrant**: Cancels an existing oracle grant (only if it was created with cancelable=true). All unclaimed tokens become unclaimable and effectively burned. Used when a recipient leaves the DAO, violates terms, or the DAO votes to cancel the grant program.

---

#### **Protocol Admin Intents** (`protocol_admin_intents`)

These intents are special because they operate on the **protocol-level** (the factory, fee manager, validators) rather than individual DAOs. Only the Protocol DAO can execute these.

**AcceptFactoryOwnerCapIntent**: Protocol DAO votes to take custody of the factory's admin capability. This is the initial bootstrapping step - when the protocol launches, someone deploys the factory and gets the OwnerCap. That person then creates a proposal to transfer it to the Protocol DAO via governance. Once accepted, only Protocol DAO governance can pause factory, update fees, whitelist stablecoins, etc.

**AcceptFeeAdminCapIntent**: Same pattern for the fee management system. Accepts custody of the cap that controls all protocol fees (DAO creation fees, proposal fees, verification fees). After acceptance, only Protocol DAO can adjust these fees via governance.

**Factory admin operations** (pause, whitelist stablecoins): Protocol DAO can vote to pause DAO creation (emergency response) or add new stablecoins to the allowed list (e.g., adding PYUSD when it launches on Sui).

**Fee management operations**: Protocol DAO sets how much it costs to create a DAO (0.5 SUI? 1 SUI?), create proposals (0.1 SUI? Free?), get verified (1 SUI for Bronze, 10 SUI for Gold). Also manages multi-currency fees (fee in SUI vs USDC vs other tokens).

**Verification operations**: DAOs can request verification (proves they're not scams). Originally validators could approve/reject via intents, but this was moved to direct cap-gated functions for efficiency. The Protocol DAO still controls who has validator authority via AcceptValidatorAdminCapIntent.

---

## Key Architectural Patterns Explained

### Hot Potato Pattern (BorrowCapIntent)
A value that MUST be consumed/returned in the same transaction or everything aborts. Forces atomic borrow-use-return, ensuring capabilities never leave custody.

### Progressive Restriction (RestrictPolicyIntent, DisableRulesIntent)
Operations that can only move in one direction (more restrictive), never reversed. Enables credible commitment to decentralization and immutability.

### Two-Step Governance (CreateCommitCapIntent)
DAO authorizes, core team executes, with timelock and reclaim. Balances speed (devs can move fast) and safety (DAO has veto power).

### Just-In-Time Creation (GovernanceWitness)
Don't store intents permanently, create them on-demand at execution from blueprints. Cleaner architecture, avoids intent accumulation.

### Price-Based Vesting (Oracle Grants)
Unlock based on achievement (price milestones) rather than time passage. Aligns incentives with performance - team only gets paid if they deliver results.
