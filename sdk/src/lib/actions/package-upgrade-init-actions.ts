/**
 * Package Upgrade Init Actions
 *
 * Builders for package upgrade operations during initialization/intent staging.
 * Handles upgrades, commits, policy restrictions, and commit cap creation.
 *
 * @module package-upgrade-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Package upgrade initialization action builders
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Upgrade a package
 * PackageUpgradeInitActions.addUpgrade(tx, builder, actionsPackageId, {
 *   name: 'my-package',
 *   digest: new Uint8Array([...]),
 * });
 *
 * // Commit the upgrade
 * PackageUpgradeInitActions.addCommit(tx, builder, actionsPackageId, {
 *   name: 'my-package',
 * });
 * ```
 */
export class PackageUpgradeInitActions {
  /**
   * Add action to upgrade a package
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Upgrade configuration
   */
  static addUpgrade(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      name: string;
      digest: Uint8Array | number[];
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::package_upgrade_init_actions::add_upgrade_spec`,
      arguments: [
        builder,
        tx.pure.string(config.name),
        tx.pure.vector('u8', Array.from(config.digest)),
      ],
    });
  }

  /**
   * Add action to commit a package upgrade
   *
   * Finalizes a package upgrade after it has been executed.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Commit configuration
   */
  static addCommit(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      name: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::package_upgrade_init_actions::add_commit_spec`,
      arguments: [
        builder,
        tx.pure.string(config.name),
      ],
    });
  }

  /**
   * Add action to restrict package upgrade policy
   *
   * Changes the upgrade policy to be more restrictive.
   * Policy values: 0 = compatible, 1 = additive, 2 = dep_only, 255 = immutable
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Restriction configuration
   */
  static addRestrict(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      name: string;
      policy: number;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::package_upgrade_init_actions::add_restrict_spec`,
      arguments: [
        builder,
        tx.pure.string(config.name),
        tx.pure.u8(config.policy),
      ],
    });
  }

  /**
   * Add action to create a commit cap for a package
   *
   * Creates a capability that allows committing upgrades.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param actionsPackageId - Package ID for account_actions
   * @param config - Configuration
   */
  static addCreateCommitCap(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    actionsPackageId: string,
    config: {
      name: string;
    }
  ): void {
    tx.moveCall({
      target: `${actionsPackageId}::package_upgrade_init_actions::add_create_commit_cap_spec`,
      arguments: [
        builder,
        tx.pure.string(config.name),
      ],
    });
  }
}
