/**
 * Package Registry Actions
 *
 * Governance actions for managing the package registry. These actions allow
 * DAOs to whitelist packages, update versions, manage metadata, and control
 * account creation.
 *
 * Pattern:
 * 1. Get marker witness
 * 2. Create action struct with new_*
 * 3. Execute action with do_* in PTB
 *
 * @module package-registry-actions
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Package Registry Action Builders
 *
 * Static utilities for building package registry governance actions.
 * These follow the marker → constructor → execution pattern.
 *
 * @example Add package to registry
 * ```typescript
 * const tx = new Transaction();
 *
 * // Step 1: Get marker
 * const marker = PackageRegistryActions.addPackageMarker(tx, governanceActionsPackageId);
 *
 * // Step 2: Create action
 * const action = PackageRegistryActions.newAddPackage(tx, {
 *   governanceActionsPackageId,
 *   name: "my_package",
 *   packageAddress: "0xabc...",
 *   version: 1,
 *   actionTypes: ["do_init_create_stream", "do_init_create_pool"],
 *   category: "DeFi",
 *   description: "AMM and vesting package",
 * });
 *
 * // Step 3: Execute in PTB
 * PackageRegistryActions.doAddPackage(tx, {
 *   governanceActionsPackageId,
 *   registryId,
 *   outcomeType,
 *   intentWitnessType,
 * }, executable, versionWitness, intentWitness);
 * ```
 */
export class PackageRegistryActions {
  // ============================================================================
  // Marker Functions (6)
  // ============================================================================

  /**
   * Get AddPackage marker witness
   */
  static addPackageMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'package_registry_actions', 'add_package_marker'),
      arguments: [],
    });
  }

  /**
   * Get RemovePackage marker witness
   */
  static removePackageMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'package_registry_actions', 'remove_package_marker'),
      arguments: [],
    });
  }

  /**
   * Get UpdatePackageVersion marker witness
   */
  static updatePackageVersionMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'package_registry_actions', 'update_package_version_marker'),
      arguments: [],
    });
  }

  /**
   * Get UpdatePackageMetadata marker witness
   */
  static updatePackageMetadataMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'package_registry_actions', 'update_package_metadata_marker'),
      arguments: [],
    });
  }

  /**
   * Get PauseAccountCreation marker witness
   */
  static pauseAccountCreationMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'package_registry_actions', 'pause_account_creation_marker'),
      arguments: [],
    });
  }

  /**
   * Get UnpauseAccountCreation marker witness
   */
  static unpauseAccountCreationMarker(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'package_registry_actions', 'unpause_account_creation_marker'),
      arguments: [],
    });
  }

  // ============================================================================
  // Constructor Functions (6)
  // ============================================================================

  /**
   * Create AddPackage action
   *
   * @param tx - Transaction
   * @param config - Package configuration
   * @returns TransactionArgument for AddPackageAction
   *
   * @example
   * ```typescript
   * const action = PackageRegistryActions.newAddPackage(tx, {
   *   governanceActionsPackageId,
   *   name: "futarchy_markets",
   *   packageAddress: "0x123...",
   *   version: 1,
   *   actionTypes: ["do_init_create_pool"],
   *   category: "DeFi",
   *   description: "AMM package",
   * });
   * ```
   */
  static newAddPackage(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      name: string;
      packageAddress: string;
      version: number;
      actionTypes: string[];
      category: string;
      description: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'new_add_package'),
      arguments: [
        tx.pure.string(config.name),
        tx.pure.address(config.packageAddress),
        tx.pure.u64(config.version),
        tx.pure.vector('string', config.actionTypes),
        tx.pure.string(config.category),
        tx.pure.string(config.description),
      ],
    });
  }

  /**
   * Create RemovePackage action
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TransactionArgument for RemovePackageAction
   */
  static newRemovePackage(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      name: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'new_remove_package'),
      arguments: [tx.pure.string(config.name)],
    });
  }

  /**
   * Create UpdatePackageVersion action
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TransactionArgument for UpdatePackageVersionAction
   */
  static newUpdatePackageVersion(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      name: string;
      packageAddress: string;
      version: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'new_update_package_version'),
      arguments: [tx.pure.string(config.name), tx.pure.address(config.packageAddress), tx.pure.u64(config.version)],
    });
  }

  /**
   * Create UpdatePackageMetadata action
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TransactionArgument for UpdatePackageMetadataAction
   */
  static newUpdatePackageMetadata(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      name: string;
      actionTypes: string[];
      category: string;
      description: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'new_update_package_metadata'),
      arguments: [
        tx.pure.string(config.name),
        tx.pure.vector('string', config.actionTypes),
        tx.pure.string(config.category),
        tx.pure.string(config.description),
      ],
    });
  }

  /**
   * Create PauseAccountCreation action
   */
  static newPauseAccountCreation(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'package_registry_actions', 'new_pause_account_creation'),
      arguments: [],
    });
  }

  /**
   * Create UnpauseAccountCreation action
   */
  static newUnpauseAccountCreation(tx: Transaction, governanceActionsPackageId: string): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(governanceActionsPackageId, 'package_registry_actions', 'new_unpause_account_creation'),
      arguments: [],
    });
  }

  // ============================================================================
  // Execution Functions (6)
  // ============================================================================

  /**
   * Execute AddPackage action in PTB
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @param executable - Executable hot potato
   * @param versionWitness - Version witness
   * @param intentWitness - Intent witness
   */
  static doAddPackage(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'do_add_package'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        executable,
        tx.object(config.daoId),
        versionWitness,
        intentWitness,
        tx.object(config.registryId),
      ],
    });
  }

  /**
   * Execute RemovePackage action in PTB
   */
  static doRemovePackage(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'do_remove_package'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, tx.object(config.daoId), versionWitness, intentWitness, tx.object(config.registryId)],
    });
  }

  /**
   * Execute UpdatePackageVersion action in PTB
   */
  static doUpdatePackageVersion(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'do_update_package_version'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, tx.object(config.daoId), versionWitness, intentWitness, tx.object(config.registryId)],
    });
  }

  /**
   * Execute UpdatePackageMetadata action in PTB
   */
  static doUpdatePackageMetadata(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'do_update_package_metadata'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, tx.object(config.daoId), versionWitness, intentWitness, tx.object(config.registryId)],
    });
  }

  /**
   * Execute PauseAccountCreation action in PTB
   */
  static doPauseAccountCreation(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'do_pause_account_creation'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, tx.object(config.daoId), versionWitness, intentWitness, tx.object(config.registryId)],
    });
  }

  /**
   * Execute UnpauseAccountCreation action in PTB
   */
  static doUnpauseAccountCreation(
    tx: Transaction,
    config: {
      governanceActionsPackageId: string;
      daoId: string;
      registryId: string;
      outcomeType: string;
      intentWitnessType: string;
    },
    executable: ReturnType<Transaction['moveCall']>,
    versionWitness: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.governanceActionsPackageId, 'package_registry_actions', 'do_unpause_account_creation'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [executable, tx.object(config.daoId), versionWitness, intentWitness, tx.object(config.registryId)],
    });
  }
}
