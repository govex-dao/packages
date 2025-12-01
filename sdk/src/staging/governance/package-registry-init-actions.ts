/**
 * Package Registry Init Actions
 *
 * Builders for package registry management during initialization/intent staging.
 * Handles adding, removing, and updating packages in the registry.
 *
 * @module package-registry-init-actions
 */

import { Transaction } from '@mysten/sui/transactions';

/**
 * Package registry initialization action builders
 *
 * These actions are for protocol-level package management, typically used
 * to manage which packages can be used with the protocol.
 *
 * @example
 * ```typescript
 * const tx = new Transaction();
 * const builder = ActionSpecBuilder.new(tx, actionsPackageId);
 *
 * // Add a new package to the registry
 * PackageRegistryInitActions.addAddPackage(tx, builder, govActionsPackageId, {
 *   name: 'my-package',
 *   addr: '0xPACKAGE_ID',
 *   version: 1,
 *   actionTypes: ['Transfer', 'Mint'],
 *   category: 'defi',
 * });
 * ```
 */
export class PackageRegistryInitActions {
  /**
   * Add action to add a package to the registry
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Package configuration
   */
  static addAddPackage(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      name: string;
      addr: string;
      version: number;
      actionTypes: string[];
      category: string;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::package_registry_init_actions::add_add_package_spec`,
      arguments: [
        builder,
        tx.pure.string(config.name),
        tx.pure.address(config.addr),
        tx.pure.u64(config.version),
        tx.makeMoveVec({
          type: '0x1::string::String',
          elements: config.actionTypes.map(t => tx.pure.string(t)),
        }),
        tx.pure.string(config.category),
      ],
    });
  }

  /**
   * Add action to remove a package from the registry
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addRemovePackage(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      name: string;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::package_registry_init_actions::add_remove_package_spec`,
      arguments: [
        builder,
        tx.pure.string(config.name),
      ],
    });
  }

  /**
   * Add action to update a package version
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addUpdatePackageVersion(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      name: string;
      addr: string;
      version: number;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::package_registry_init_actions::add_update_package_version_spec`,
      arguments: [
        builder,
        tx.pure.string(config.name),
        tx.pure.address(config.addr),
        tx.pure.u64(config.version),
      ],
    });
  }

  /**
   * Add action to update package metadata
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   * @param config - Configuration
   */
  static addUpdatePackageMetadata(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string,
    config: {
      name: string;
      newActionTypes: string[];
      newCategory: string;
      newDescription: string;
    }
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::package_registry_init_actions::add_update_package_metadata_spec`,
      arguments: [
        builder,
        tx.pure.string(config.name),
        tx.makeMoveVec({
          type: '0x1::string::String',
          elements: config.newActionTypes.map(t => tx.pure.string(t)),
        }),
        tx.pure.string(config.newCategory),
        tx.pure.string(config.newDescription),
      ],
    });
  }

  /**
   * Add action to pause account creation
   *
   * Pauses the ability to create new accounts in the registry.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   */
  static addPauseAccountCreation(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::package_registry_init_actions::add_pause_account_creation_spec`,
      arguments: [builder],
    });
  }

  /**
   * Add action to unpause account creation
   *
   * Resumes the ability to create new accounts in the registry.
   *
   * @param tx - Transaction
   * @param builder - ActionSpec builder
   * @param governanceActionsPackageId - Package ID for futarchy_governance_actions
   */
  static addUnpauseAccountCreation(
    tx: Transaction,
    builder: ReturnType<Transaction['moveCall']>,
    governanceActionsPackageId: string
  ): void {
    tx.moveCall({
      target: `${governanceActionsPackageId}::package_registry_init_actions::add_unpause_account_creation_spec`,
      arguments: [builder],
    });
  }
}
