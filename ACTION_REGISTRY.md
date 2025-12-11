# Action Registry

Complete list of all action types across all packages. Each action follows the 3-layer pattern defined in `IMPORTANT_ACTION_EXECUTION_PATTERN.md`.

---

## account_protocol (3 actions)

### Per-Account Dependencies Management
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `ConfigToggleUnverified` | `toggle_unverified_allowed` | Toggle whether unverified packages can be added to per-account deps |
| `ConfigAddDep` | `add_dep` | Add a package to per-account deps table |
| `ConfigRemoveDep` | `remove_dep` | Remove a package from per-account deps table |

---

## account_actions (23 actions)

### Vault Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `VaultDeposit` | `deposit` | Deposit coins into a vault (takes from executable_resources) |
| `VaultSpend` | `spend` | Spend coins from a vault (provides to executable_resources) |
| `VaultApproveCoinType` | `approve_coin_type` | Approve a coin type for vault |
| `VaultRemoveApprovedCoinType` | `remove_approved_coin_type` | Remove approved coin type |
| `CreateStream` | `create_stream` | Create a vault vesting stream (accounting isolation, always cancellable) |
| `CancelStream` | `cancel_stream` | Cancel an active vault stream |

### Vesting Actions (Physical Isolation)
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `CreateVesting` | `create_vesting` | Create standalone vesting with TRUE fund isolation (funds in shared object) |
| `CancelVesting` | `cancel_vesting` | Cancel a cancellable vesting, return unvested funds to DAO |

### Currency Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `CurrencyDisable` | `disable_currency` | Disable currency operations |
| `CurrencyMint` | `mint` | Mint new tokens |
| `CurrencyBurn` | `burn` | Burn tokens |
| `CurrencyUpdate` | `update_currency` | Update currency metadata |
| `RemoveTreasuryCap` | `return_treasury_cap` | Return treasury cap to recipient |
| `RemoveMetadata` | `return_metadata` | Return coin metadata to recipient |

### Access Control Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `AccessControlBorrow` | `borrow_access` | Borrow a capability from account |
| `AccessControlReturn` | `return_access` | Return a borrowed capability |

### Transfer Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `TransferObject` | `transfer` | Transfer object to recipient (takes from executable_resources) |
| `TransferToSender` | `transfer_to_sender` | Transfer object to transaction sender (takes from executable_resources) |

### Package Upgrade Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `PackageUpgrade` | `upgrade_package` | Execute package upgrade |
| `PackageCommit` | `commit_upgrade` | Commit package upgrade |
| `PackageRestrict` | `restrict_upgrade` | Restrict upgrade policy |
| `PackageCreateCommitCap` | `create_commit_cap` | Create commit capability |

### Memo Action
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `Memo` | `memo` | Emit a memo event |

---

## futarchy_actions (16 actions)

### Liquidity Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `CreatePoolWithMint` | `create_pool_with_mint` | Create pool with minted tokens (deterministic, launchpad only) |
| `AddLiquidity` | `add_liquidity` | Add liquidity to pool (ResourceRequest pattern) |
| `RemoveLiquidity` | `remove_liquidity` | Remove liquidity from pool (ResourceRequest pattern) |
| `Swap` | `swap` | Execute swap (ResourceRequest pattern) |

### Config Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `SetProposalsEnabled` | `set_proposals_enabled` | Enable/disable proposals |
| `TerminateDao` | `terminate_dao` | Permanently terminate DAO |
| `UpdateName` | `update_dao_name` | Update DAO name |
| `TradingParamsUpdate` | `update_trading_params` | Update trading parameters |
| `MetadataUpdate` | `update_dao_metadata` | Update DAO metadata |
| `TwapConfigUpdate` | `update_twap_config` | Update TWAP configuration |
| `GovernanceUpdate` | `update_governance` | Update governance settings |
| `MetadataTableUpdate` | `update_metadata_table` | Update metadata table entries |
| `SponsorshipConfigUpdate` | `update_sponsorship_config` | Update sponsorship configuration |
| `UpdateConditionalMetadata` | `update_conditional_metadata` | Update conditional metadata |

### Quota Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `SetQuotas` | `set_quotas` | Set sponsorship quotas |

### Dissolution Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `CreateDissolutionCapability` | `create_dissolution_capability` | Create dissolution capability |

---

## futarchy_governance_actions (20 actions)

### Protocol Admin Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `SetFactoryPaused` | `set_factory_paused` | Pause/unpause factory |
| `DisableFactoryPermanently` | `disable_factory_permanently` | Permanently disable factory |
| `AddStableType` | `add_stable_type` | Add supported stable type |
| `RemoveStableType` | `remove_stable_type` | Remove supported stable type |
| `UpdateDaoCreationFee` | `update_dao_creation_fee` | Update DAO creation fee |
| `UpdateProposalFee` | `update_proposal_fee` | Update proposal fee |
| `UpdateVerificationFee` | `update_verification_fee` | Update verification fee |
| `AddVerificationLevel` | `add_verification_level` | Add verification level |
| `RemoveVerificationLevel` | `remove_verification_level` | Remove verification level |
| `WithdrawFeesToTreasury` | `withdraw_fees_to_treasury` | Withdraw fees to treasury |
| `AddCoinFeeConfig` | `add_coin_fee_config` | Add coin fee configuration |
| `UpdateCoinCreationFee` | `update_coin_creation_fee` | Update coin creation fee |
| `UpdateCoinProposalFee` | `update_coin_proposal_fee` | Update coin proposal fee |
| `ApplyPendingCoinFees` | `apply_pending_coin_fees` | Apply pending coin fees |

### Package Registry Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `AddPackage` | `add_package` | Add package to registry |
| `RemovePackage` | `remove_package` | Remove package from registry |
| `UpdatePackageVersion` | `update_package_version` | Update package version |
| `UpdatePackageMetadata` | `update_package_metadata` | Update package metadata |
| `PauseAccountCreation` | `pause_account_creation` | Pause account creation |
| `UnpauseAccountCreation` | `unpause_account_creation` | Unpause account creation |

---

## futarchy_oracle_actions (2 actions)

### Oracle Actions
| Marker | SDK ID | Description |
|--------|--------|-------------|
| `CreateOracleGrant` | `create_oracle_grant` | Create oracle grant |
| `CancelGrant` | `cancel_oracle_grant` | Cancel oracle grant |

---

## Summary

| Package | Action Count |
|---------|--------------|
| account_protocol | 3 |
| account_actions | 23 |
| futarchy_actions | 16 |
| futarchy_governance_actions | 20 |
| futarchy_oracle_actions | 2 |
| **Total** | **64** |

---

## Notes

### ResourceRequest Pattern Actions
The following actions use the ResourceRequest (hot potato) pattern and require `fulfill_*` calls. They are **NOT** suitable for launchpad/proposal execution:
- `AddLiquidity`
- `RemoveLiquidity`
- `Swap`

For launchpad flows, use `CreatePoolWithMint` which follows the deterministic 3-layer pattern.

### LP Token Changes
LP tokens are now standard `Coin<LPType>` instead of a custom `LPToken` struct. This means:
- LP tokens are stored in vaults like any other coin
- No special `WithdrawLpToken` action needed - use standard vault operations
- `UnifiedSpotPool` now has 3 type parameters: `<AssetType, StableType, LPType>`

### Composable Actions via executable_resources
Actions can pass objects to each other using `executable_resources`:
- `VaultSpend` puts coin in executable_resources with a `resource_name`
- `TransferObject` or `VaultDeposit` takes from executable_resources using the same `resource_name`

Example: To withdraw from vault and transfer to recipient:
```
ActionSpecs: [VaultSpend(resource_name="my_coin"), TransferObject(resource_name="my_coin")]
```

### Deterministic Actions
All other actions follow the deterministic 3-layer pattern:
1. **Layer 1**: Action struct (pure data)
2. **Layer 2**: ActionSpec in Intent (BCS-serialized, immutable)
3. **Layer 3**: `do_*` execution function (reads from ActionSpec only)

See `IMPORTANT_ACTION_EXECUTION_PATTERN.md` for full documentation.

### Vesting vs Vault Streams

| Feature | Vesting | Vault Stream |
|---------|---------|--------------|
| Fund Isolation | Physical (funds in shared Vesting object) | Accounting (funds remain in vault) |
| Cancellable | Configurable (`is_cancellable` flag) | Always (by DAO governance) |
| Transferable | With ClaimCap (if `is_transferable`) | No |
| Modification | Cannot modify, must recreate | Cancel & recreate |
| Claim Method | Beneficiary with ClaimCap | Any beneficiary address |

**When to use Vesting:** Permanent commitments where recipient needs guaranteed funds (employee vesting, investor lockups, grants). Uncancellable vestings are GUARANTEED to recipient.

**When to use Vault Streams:** DAO-controlled distributions that may need adjustment (contributor payments, operational expenses).
