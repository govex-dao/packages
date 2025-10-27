# Govex DAO Intent System Documentation

Complete catalog of all intent types across the Move Framework and Futarchy governance system.

---

## Move Framework Intents (6 modules, 14 intent types)

### 1. **access_control_intents** (`account_actions::access_control_intents`)
- **BorrowCapIntent** - Borrow and return capability objects using hot potato pattern

### 2. **currency_intents** (`account_actions::currency_intents`)
- **DisableRulesIntent** - Permanently disable currency rules (mint/burn/metadata updates)
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
- **CreateCommitCapIntent** - Create and transfer commit authority capability

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
- **ToggleUnverifiedIntent** - Toggle unverified package allowance

### 6. **config_migration_intents** (`futarchy_governance_actions::config_migration_intents`)
- **MigrateConfigIntent** - Migrate account config type (e.g., FutarchyConfig → FutarchyConfigV2)

### 7. **governance_intents** (`futarchy_governance_actions::governance_intents`)
- **GovernanceWitness** - Execute proposal intent from approved proposals (just-in-time intent creation and execution)

### 8. **package_registry_intents** (`futarchy_governance_actions::package_registry_intents`)

- **AcceptPackageAdminCapIntent** - Accept PackageAdminCap into protocol DAO custody

Helper functions for adding to intents:
- **Add package** - Add package to registry (name, addr, version, action_types, category, description)
- **Remove package** - Remove package from registry
- **Update package version** - Update package version
- **Update package metadata** - Update package metadata (action_types, category, description)

### 9. **protocol_admin_intents** (`futarchy_governance_actions::protocol_admin_intents`)

**Cap acceptance intents:**
- **AcceptFactoryOwnerCapIntent** - Accept FactoryOwnerCap into protocol DAO custody
- **AcceptFeeAdminCapIntent** - Accept FeeAdminCap into protocol DAO custody
- **AcceptValidatorAdminCapIntent** - Accept ValidatorAdminCap into protocol DAO custody

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
- **Cancel oracle grant** - Cancel an existing grant (grant_id) if cancelable flag was set

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
- **Total named intent witnesses**: 20+ distinct types
- **Total operations**: 54+ different operations available
- **Move Framework**: 14 intent types across 6 modules
- **Futarchy**: 40+ operations across 10 modules

**Note**: Many futarchy operations use helper functions rather than distinct witnesses, allowing flexible composition of complex governance proposals.
