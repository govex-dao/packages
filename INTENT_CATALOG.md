# Account Inents 

EXTERNAL
1) currency_intents
  - DisableRulesIntent - Permanently disable currency rules (mint/burn/metadata updates)
  - UpdateMetadataIntent - Update coin metadata (symbol, name, description, icon)
  - MintAndTransferIntent - Mint new coins and transfer to recipients
  - WithdrawAndBurnIntent - Withdraw coins from account and burn them
 2) memo_intents
  - MemoIntent - Emit on-chain memo with optional object reference
 3) owned_intents
  - WithdrawAndTransferToVaultIntent - Withdraw coin and deposit to vault
  - WithdrawObjectsAndTransferIntent - Withdraw and transfer arbitrary objects by ID
  - WithdrawCoinsAndTransferIntent - Withdraw and transfer coins
 4) package_upgrade_intents
  - UpgradePackageIntent - Upgrade package with digest verification
  - RestrictPolicyIntent - Restrict upgrade policy (additive, dep-only, or immutable)
  - CreateCommitCapIntent - Create and transfer commit authority capability
 5) vault_intents
  - SpendAndTransferIntent - Spend from vault and transfer to recipients


INTERNAL (won't be used by themselves)

1) access_control_intents
  - BorrowCapIntent - Borrow and return capability objects using hot potato pattern

# Futarchy Inents 

 config_intents (ConfigIntent - single witness)
  - Set proposals enabled/disabled
  - Update DAO name
  - Update metadata (name, icon_url, description)
  - Update trading parameters
  - Update TWAP configuration
  - Update governance settings (GovernanceUpdateAction - all fields optional):
    • max_outcomes - Maximum outcomes per proposal
    • max_actions_per_outcome - Maximum actions per outcome
    • required_bond_amount - Bond required for proposals
    • max_intents_per_outcome - Maximum intents per outcome
    • proposal_intent_expiry_ms - Intent expiration time
    • optimistic_challenge_fee - Fee for optimistic challenges
    • optimistic_challenge_period_ms - Challenge period duration
    • proposal_creation_fee - DAO-level base proposal creation fee (in StableType)
    • proposal_fee_per_outcome - DAO-level fee per additional outcome (in StableType)
    • accept_new_proposals - Enable/disable proposal creation
    • enable_premarket_reservation_lock - Enable/disable premarket reservation lock
  - Update conditional metadata configuration
  - Update sponsorship configuration
  - Update early resolve configuration

quota_intents
  - QuotaIntent - Set user quotas
  - QuotaIntent - Remove user quotas

 dissolution_intents
  - DissolutionIntent - Create dissolution capability for DAO termination

liquidity_intents (LiquidityIntent - single witness)
  - Add liquidity to pool
  - Remove liquidity from pool
  - Withdraw LP token from custody
  - Create new liquidity pool
  - Update pool parameters
  5) account_config_intents (allows DAO to add new intents without protocol permission)
  - UpdateDepsIntent - Update account dependencies (add new action packages)
  - ToggleUnverifiedIntent - Toggle unverified package allowance
  6) config_migration_intents (DAO upgrade from V1 to V2)
  - MigrateConfigIntent - Migrate account config type (e.g., FutarchyConfig → FutarchyConfigV2)
  governance_intents
  - GovernanceWitness - Execute proposal intent from approved proposals (just-in-time intent creation and execution)
  7) oracle_intents (founder unlocks)
  - Create oracle grant (price-based token unlock schedules)
  - Cancel oracle grant
PROTCOL CONTROLLING TENANNT DAO ONLY (for govex dao only)
  1) Factory admin:
  - Set factory paused
  - Add stable type to whitelist
  - Remove stable type from whitelist
  2) Coin fee configuration:
  - Add coin fee config
  - Update coin creation fee
  - Update coin proposal fee
  - Apply pending coin fees
  3) package_registry_intents (add intents for all DAOs)
  - Add package to registry
  - Remove package from registry
  - Update package version
  - Update package metadata
  protocol_admin_intents (Protocol DAO only)
  4) Fee management:
  - Update DAO creation fee
  - Update proposal fee
  - Update verification fee by level
  - Withdraw fees to treasury

MIX
 1) Verification:
  - Add verification level
  - Remove verification level
  - Request verification