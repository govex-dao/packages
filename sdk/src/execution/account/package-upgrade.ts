/**
 * Package Upgrade Account Actions
 *
 * Package managers can lock UpgradeCaps in the account. Caps can't be unlocked, this is to enforce the policies.
 * Any rule can be defined for the upgrade lock. The module provides a timelock rule by default, based on execution time.
 * Upon locking, the user can define an optional timelock corresponding to the minimum delay between an upgrade proposal and its execution.
 * The account can decide to make the policy more restrictive or destroy the Cap, to make the package immutable.
 *
 * Portions of this module are derived from the account.tech Move Framework project
 * and remain licensed under the Apache License, Version 2.0.
 *
 * @module package-upgrade
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Package Upgrade Account Action Builders
 *
 * Static utilities for building package upgrade actions following the marker → execution pattern.
 * Supports upgrade cap management, commit cap control, and upgrade proposals with governance voting.
 *
 * @example Lock upgrade cap and propose upgrade
 * ```typescript
 * const tx = new Transaction();
 *
 * // Get markers
 * const upgradeMarker = PackageUpgrade.packageUpgrade(tx, accountActionsPackageId);
 * const commitMarker = PackageUpgrade.packageCommit(tx, accountActionsPackageId);
 *
 * // Lock upgrade cap
 * PackageUpgrade.lockCap(tx, accountActionsPackageId, auth, account, registry, cap, name, delayMs, reclaimDelayMs);
 *
 * // Propose upgrade digest
 * PackageUpgrade.proposeUpgradeDigest(tx, accountActionsPackageId, auth, account, registry, packageName, digest, executionTimeMs, clock);
 *
 * // Approve upgrade
 * PackageUpgrade.approveUpgradeProposal(tx, { accountActionsPackageId, configType }, auth, account, registry, packageName, digest, clock);
 * ```
 */
export class PackageUpgrade {
  // ============================================================================
  // MARKERS (4)
  // ============================================================================

  /**
   * Create a PackageUpgrade action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The package upgrade marker
   */
  static packageUpgrade(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'package_upgrade'),
      arguments: [],
    });
  }

  /**
   * Create a PackageCommit action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The package commit marker
   */
  static packageCommit(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'package_commit'),
      arguments: [],
    });
  }

  /**
   * Create a PackageRestrict action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The package restrict marker
   */
  static packageRestrict(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'package_restrict'),
      arguments: [],
    });
  }

  /**
   * Create a PackageCreateCommitCap action type marker
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @returns The package create commit cap marker
   */
  static packageCreateCommitCap(tx: Transaction, accountActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'package_create_commit_cap'),
      arguments: [],
    });
  }

  // ============================================================================
  // CAP MANAGEMENT (11)
  // ============================================================================

  /**
   * Lock an UpgradeCap in the account
   * Attaches the UpgradeCap as a Dynamic Object Field to the account.
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param cap - The UpgradeCap to lock
   * @param name - The name of the package
   * @param delayMs - Minimum delay between proposal and execution (in milliseconds)
   * @param reclaimDelayMs - Delay before DAO can reclaim commit cap (in milliseconds)
   */
  static lockCap(
    tx: Transaction,
    accountActionsPackageId: string,
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    cap: ReturnType<Transaction['moveCall']>,
    name: ReturnType<Transaction['moveCall']>,
    delayMs: ReturnType<Transaction['moveCall']>,
    reclaimDelayMs: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'lock_cap'),
      arguments: [auth, account, registry, cap, name, delayMs, reclaimDelayMs],
    });
  }

  /**
   * Lock an UpgradeCommitCap in an account
   * Creates an UpgradeCommitCap and locks it in an Account.
   * This cap grants authority to commit package upgrades (finalize with UpgradeReceipt).
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The name of the package
   */
  static lockCommitCap(
    tx: Transaction,
    accountActionsPackageId: string,
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'lock_commit_cap'),
      arguments: [auth, account, registry, packageName],
    });
  }

  /**
   * Create and transfer an UpgradeCommitCap to a recipient
   * Use this to give commit authority to an external multisig.
   * Cap is created with current nonce - will be invalidated if DAO requests reclaim.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The name of the package
   * @param recipient - The recipient address
   */
  static createAndTransferCommitCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    recipient: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'create_and_transfer_commit_cap'),
      typeArguments: [config.configType],
      arguments: [auth, account, registry, packageName, recipient],
    });
  }

  /**
   * Borrow the commit cap from the account
   * Removes it temporarily - must be returned in the same transaction.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The name of the package
   * @param versionWitness - The version witness
   * @returns The borrowed commit cap
   */
  static borrowCommitCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'borrow_commit_cap'),
      typeArguments: [config.configType],
      arguments: [account, registry, packageName, versionWitness],
    });
  }

  /**
   * Return the commit cap to the account after use
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param commitCap - The commit cap to return
   * @param versionWitness - The version witness
   */
  static returnCommitCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    commitCap: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'return_commit_cap'),
      typeArguments: [config.configType],
      arguments: [account, registry, commitCap, versionWitness],
    });
  }

  /**
   * Transfer commit cap to an address
   * Needed for Sui private transfer rules.
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param cap - The commit cap to transfer
   * @param recipient - The recipient address
   */
  static transferCommitCap(
    tx: Transaction,
    accountActionsPackageId: string,
    cap: ReturnType<Transaction['moveCall']>,
    recipient: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'transfer_commit_cap'),
      arguments: [cap, recipient],
    });
  }

  /**
   * Destroy a commit cap and give DAO immediate control
   * Anyone holding the cap can call this to destroy it.
   * This resets nonce to 0, clears any pending reclaim, giving DAO immediate control.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param cap - The commit cap to destroy
   * @param account - The account object
   * @param registry - The package registry object
   */
  static destroyCommitCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    cap: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'destroy_commit_cap'),
      typeArguments: [config.configType],
      arguments: [cap, account, registry],
    });
  }

  /**
   * Check if account has an upgrade cap for a package
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param name - The package name
   * @returns Boolean indicating if the cap exists
   */
  static hasCap(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    name: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'has_cap'),
      arguments: [account, name],
    });
  }

  /**
   * Check if account has a commit cap for a package
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param packageName - The package name
   * @returns Boolean indicating if the commit cap exists
   */
  static hasCommitCap(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'has_commit_cap'),
      arguments: [account, packageName],
    });
  }

  /**
   * Get the package name from an UpgradeCommitCap
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param cap - The commit cap
   * @returns The package name
   */
  static commitCapPackageName(
    tx: Transaction,
    accountActionsPackageId: string,
    cap: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'commit_cap_package_name'),
      arguments: [cap],
    });
  }

  /**
   * Get the valid nonce from an UpgradeCommitCap
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param cap - The commit cap
   * @returns The valid nonce
   */
  static commitCapValidNonce(
    tx: Transaction,
    accountActionsPackageId: string,
    cap: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'commit_cap_valid_nonce'),
      arguments: [cap],
    });
  }

  // ============================================================================
  // QUERIES (11)
  // ============================================================================

  /**
   * Get the address of the package for a given package name
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The package name
   * @returns The package address
   */
  static getCapPackage(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    name: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_cap_package'),
      arguments: [account, registry, name],
    });
  }

  /**
   * Get the version of the UpgradeCap for a given package name
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The package name
   * @returns The cap version
   */
  static getCapVersion(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    name: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_cap_version'),
      arguments: [account, registry, name],
    });
  }

  /**
   * Get the policy of the UpgradeCap for a given package name
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The package name
   * @returns The cap policy
   */
  static getCapPolicy(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    name: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_cap_policy'),
      arguments: [account, registry, name],
    });
  }

  /**
   * Get the timelock delay for a package
   * Returns the minimum delay between proposal and execution.
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param name - The package name
   * @returns The time delay in milliseconds
   */
  static getTimeDelay(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    name: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_time_delay'),
      arguments: [account, registry, name],
    });
  }

  /**
   * Get the map of package names to package addresses
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @returns The packages info map
   */
  static getPackagesInfo(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_packages_info'),
      arguments: [account, registry],
    });
  }

  /**
   * Check if a package is managed by the account
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageAddr - The package address
   * @returns Boolean indicating if the package is managed
   */
  static isPackageManaged(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageAddr: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'is_package_managed'),
      arguments: [account, registry, packageAddr],
    });
  }

  /**
   * Get the address of the package for a given package name
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @returns The package address
   */
  static getPackageAddr(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_package_addr'),
      arguments: [account, registry, packageName],
    });
  }

  /**
   * Get the package name for a given package address
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageAddr - The package address
   * @returns The package name
   */
  static getPackageName(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageAddr: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_package_name'),
      arguments: [account, registry, packageAddr],
    });
  }

  /**
   * Get the current commit nonce from UpgradeRules
   * This is the nonce that new caps will be created with.
   * Existing caps are only valid if their nonce matches this value.
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @returns The current commit nonce
   */
  static getCurrentCommitNonce(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_current_commit_nonce'),
      arguments: [account, registry, packageName],
    });
  }

  // ============================================================================
  // RECLAIM (4)
  // ============================================================================

  /**
   * DAO initiates reclaim of commit cap from external holder
   * Starts the timelock countdown and immediately increments nonce, invalidating all existing commit caps.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param clock - The clock object
   */
  static requestReclaimCommitCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    clock: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'request_reclaim_commit_cap'),
      typeArguments: [config.configType],
      arguments: [auth, account, registry, packageName, clock],
    });
  }

  /**
   * Clear the reclaim request after timelock expires
   * This just clears the reclaim_request_time for cleaner state.
   * Can only be called after request_reclaim_commit_cap + reclaim_delay_ms.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param clock - The clock object
   */
  static clearReclaimRequest(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    clock: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'clear_reclaim_request'),
      typeArguments: [config.configType],
      arguments: [auth, account, registry, packageName, clock],
    });
  }

  /**
   * Check if a reclaim request is pending
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @returns Boolean indicating if reclaim is pending
   */
  static hasReclaimRequest(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'has_reclaim_request'),
      arguments: [account, registry, packageName],
    });
  }

  /**
   * Get the timestamp when reclaim will be available (if request exists)
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @returns Option containing the available time in milliseconds
   */
  static getReclaimAvailableTime(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_reclaim_available_time'),
      arguments: [account, registry, packageName],
    });
  }

  // ============================================================================
  // PROPOSALS (6)
  // ============================================================================

  /**
   * Propose an upgrade digest for governance voting
   * Creates a proposal that can be voted on over time (multi-day).
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param digest - The upgrade digest
   * @param executionTimeMs - The execution time in milliseconds
   * @param clock - The clock object
   */
  static proposeUpgradeDigest(
    tx: Transaction,
    accountActionsPackageId: string,
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    digest: ReturnType<Transaction['moveCall']>,
    executionTimeMs: ReturnType<Transaction['moveCall']>,
    clock: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'propose_upgrade_digest'),
      arguments: [auth, account, registry, packageName, digest, executionTimeMs, clock],
    });
  }

  /**
   * Approve an upgrade proposal
   * Called by governance system when vote passes.
   * Marks the digest as approved for execution.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param digest - The upgrade digest
   * @param clock - The clock object
   */
  static approveUpgradeProposal(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    digest: ReturnType<Transaction['moveCall']>,
    clock: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'approve_upgrade_proposal'),
      typeArguments: [config.configType],
      arguments: [auth, account, registry, packageName, digest, clock],
    });
  }

  /**
   * Check if a specific upgrade digest proposal exists
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param packageName - The package name
   * @param digest - The upgrade digest
   * @returns Boolean indicating if the proposal exists
   */
  static hasUpgradeProposal(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    digest: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'has_upgrade_proposal'),
      arguments: [account, packageName, digest],
    });
  }

  /**
   * Check if a specific upgrade digest is approved
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param digest - The upgrade digest
   * @returns Boolean indicating if the upgrade is approved
   */
  static isUpgradeApproved(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    digest: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'is_upgrade_approved'),
      arguments: [account, registry, packageName, digest],
    });
  }

  /**
   * Get upgrade proposal details
   * Returns (digest, proposed_time_ms, execution_time_ms, approved).
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param digest - The upgrade digest
   * @returns Tuple of proposal details
   */
  static getUpgradeProposal(
    tx: Transaction,
    accountActionsPackageId: string,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    digest: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'get_upgrade_proposal'),
      arguments: [account, registry, packageName, digest],
    });
  }

  // ============================================================================
  // EXECUTION (4)
  // ============================================================================

  /**
   * Execute approved upgrade atomically (DAO-only mode)
   * Creates the UpgradeTicket which must be consumed in same PTB.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param digest - The upgrade digest
   * @param clock - The clock object
   * @param versionWitness - The version witness
   * @returns The UpgradeTicket
   */
  static executeApprovedUpgradeDaoOnly(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    digest: ReturnType<Transaction['moveCall']>,
    clock: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'execute_approved_upgrade_dao_only'),
      typeArguments: [config.configType],
      arguments: [account, registry, packageName, digest, clock, versionWitness],
    });
  }

  /**
   * Complete the upgrade by consuming the receipt (DAO-only mode)
   * Must be called in same PTB after sui upgrade command.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param digest - The upgrade digest
   * @param receipt - The upgrade receipt
   * @param versionWitness - The version witness
   */
  static completeApprovedUpgradeDaoOnly(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    digest: ReturnType<Transaction['moveCall']>,
    receipt: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'complete_approved_upgrade_dao_only'),
      typeArguments: [config.configType],
      arguments: [account, registry, packageName, digest, receipt, versionWitness],
    });
  }

  /**
   * Execute approved upgrade atomically (with commit cap)
   * Requires the commit cap to be provided, validating nonce.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param digest - The upgrade digest
   * @param commitCap - The commit cap
   * @param clock - The clock object
   * @param versionWitness - The version witness
   * @returns The UpgradeTicket
   */
  static executeApprovedUpgradeWithCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    digest: ReturnType<Transaction['moveCall']>,
    commitCap: ReturnType<Transaction['moveCall']>,
    clock: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'execute_approved_upgrade_with_cap'),
      typeArguments: [config.configType],
      arguments: [account, registry, packageName, digest, commitCap, clock, versionWitness],
    });
  }

  /**
   * Complete the upgrade by consuming the receipt (with commit cap)
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.configType - The config type parameter
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The package name
   * @param digest - The upgrade digest
   * @param receipt - The upgrade receipt
   * @param commitCap - The commit cap
   * @param versionWitness - The version witness
   */
  static completeApprovedUpgradeWithCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      configType: string;
    },
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: ReturnType<Transaction['moveCall']>,
    digest: ReturnType<Transaction['moveCall']>,
    receipt: ReturnType<Transaction['moveCall']>,
    commitCap: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'complete_approved_upgrade_with_cap'),
      typeArguments: [config.configType],
      arguments: [account, registry, packageName, digest, receipt, commitCap, versionWitness],
    });
  }

  // ============================================================================
  // DO FUNCTIONS (4)
  // ============================================================================

  /**
   * Process an UpgradeAction and return an UpgradeTicket
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param clock - The clock object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   * @returns The upgrade ticket
   */
  static doUpgrade(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    clock: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'do_upgrade'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, account, registry, clock, versionWitness, intentWitness],
    });
  }

  /**
   * Commit an upgrade without requiring commit cap validation (DAO-only)
   * Use this when DAO has full control over upgrades.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param receipt - The upgrade receipt
   * @param clock - The clock object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doCommitDaoOnly(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    receipt: ReturnType<Transaction['moveCall']>,
    clock: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'do_commit_dao_only'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, account, registry, receipt, clock, versionWitness, intentWitness],
    });
  }

  /**
   * Commit an upgrade with commit cap validation
   * Use this when core team holds commit authority.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param receipt - The upgrade receipt
   * @param commitCap - The commit cap
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doCommitWithCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    receipt: ReturnType<Transaction['moveCall']>,
    commitCap: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'do_commit_with_cap'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, account, registry, receipt, commitCap, versionWitness, intentWitness],
    });
  }

  /**
   * Process a RestrictAction and update the UpgradeCap policy
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doRestrict(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'do_restrict'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, account, registry, versionWitness, intentWitness],
    });
  }

  /**
   * Process a CreateCommitCapAction and create/transfer the commit cap
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param config.outcomeType - The outcome type parameter
   * @param config.intentWitnessType - The intent witness type parameter
   * @param executable - The executable object containing the action
   * @param account - The account object
   * @param registry - The package registry object
   * @param versionWitness - The version witness
   * @param intentWitness - The intent witness
   */
  static doCreateCommitCap(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade', 'do_create_commit_cap'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, account, registry, versionWitness, intentWitness],
    });
  }

  // ============================================================================
  // DELETE FUNCTIONS (4)
  // ============================================================================

  /**
   * Delete an UpgradeAction from an expired intent
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteUpgrade(
    tx: Transaction,
    accountActionsPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'delete_upgrade'),
      arguments: [expired],
    });
  }

  /**
   * Delete a CommitAction from an expired intent
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteCommit(
    tx: Transaction,
    accountActionsPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'delete_commit'),
      arguments: [expired],
    });
  }

  /**
   * Delete a RestrictAction from an expired intent
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteRestrict(
    tx: Transaction,
    accountActionsPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'delete_restrict'),
      arguments: [expired],
    });
  }

  /**
   * Delete a CreateCommitCapAction from an expired intent
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param expired - The expired intent object
   */
  static deleteCreateCommitCap(
    tx: Transaction,
    accountActionsPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'delete_create_commit_cap'),
      arguments: [expired],
    });
  }

  // ============================================================================
  // DESTROY FUNCTIONS (4)
  // ============================================================================

  /**
   * Destroy an UpgradeAction after serialization
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param action - The UpgradeAction to destroy
   */
  static destroyUpgradeAction(
    tx: Transaction,
    accountActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'destroy_upgrade_action'),
      arguments: [action],
    });
  }

  /**
   * Destroy a CommitAction after serialization
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param action - The CommitAction to destroy
   */
  static destroyCommitAction(
    tx: Transaction,
    accountActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'destroy_commit_action'),
      arguments: [action],
    });
  }

  /**
   * Destroy a RestrictAction after serialization
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param action - The RestrictAction to destroy
   */
  static destroyRestrictAction(
    tx: Transaction,
    accountActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'destroy_restrict_action'),
      arguments: [action],
    });
  }

  /**
   * Destroy a CreateCommitCapAction after serialization
   * @param tx - Transaction instance
   * @param accountActionsPackageId - The account actions package ID
   * @param action - The CreateCommitCapAction to destroy
   */
  static destroyCreateCommitCapAction(
    tx: Transaction,
    accountActionsPackageId: string,
    action: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountActionsPackageId, 'package_upgrade', 'destroy_create_commit_cap_action'),
      arguments: [action],
    });
  }
}
