/**
 * Package Registry Module SDK Wrapper
 *
 * This module provides TypeScript wrappers for the account_protocol::package_registry Move module.
 * The package registry is a unified system for managing package whitelisting and action decoders.
 *
 * Core Concepts:
 * - PackageRegistry: Central registry for approved packages and their action types
 * - PackageMetadata: Version history, action types, category, and description for each package
 * - PackageVersion: Address and version number pairs for package upgrades
 * - HumanReadableField: Decoder output format for action visualization
 *
 * Key Features:
 * - Atomic package registration with action types
 * - Version monotonicity enforcement
 * - Action type to package mapping
 * - Account creation pause controls
 * - Decoder attachment support
 *
 * @module account-protocol/package-registry
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Package Registry Operations
 *
 * Static class providing type-safe wrappers for account_protocol::package_registry functions.
 * All functions use the accountProtocolPackageId and 'package_registry' module name.
 *
 * @example
 * ```typescript
 * import { PackageRegistry } from '@govex/sdk';
 *
 * const tx = new Transaction();
 *
 * // Check if package exists
 * const hasPackage = PackageRegistry.hasPackage(tx, accountProtocolPackageId, registry, 'my_package');
 *
 * // Get package metadata
 * const metadata = PackageRegistry.getPackageMetadata(tx, accountProtocolPackageId, registry, 'my_package');
 *
 * // Check account creation status
 * const isPaused = PackageRegistry.isAccountCreationPaused(tx, accountProtocolPackageId, registry);
 * ```
 */
export class PackageRegistry {
  // ============================================================================
  // PACKAGE MANAGEMENT (5)
  // ============================================================================

  /**
   * Add a new package to the registry with its action types
   * This is an atomic operation - package and action type metadata are added together
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param config - Configuration object
   * @param config.name - Package name
   * @param config.addr - Package address
   * @param config.version - Package version number
   * @param config.actionTypes - Array of action type strings this package provides
   * @param config.category - Package category (e.g., "core", "governance", "defi")
   * @param config.description - Package description
   */
  static addPackage(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    config: {
      name: string;
      addr: string;
      version: number;
      actionTypes: string[];
      category: string;
      description: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'add_package'),
      arguments: [
        registry,
        tx.pure.string(config.name),
        tx.pure.address(config.addr),
        tx.pure.u64(config.version),
        tx.pure.vector('string', config.actionTypes),
        tx.pure.string(config.category),
        tx.pure.string(config.description),
      ],
    });
  }

  /**
   * Remove a package from the registry
   * Also removes all its action type mappings
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param name - Package name to remove
   */
  static removePackage(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    name: string
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'remove_package'),
      arguments: [registry, tx.pure.string(name)],
    });
  }

  /**
   * Update package version (add a new version)
   * Version must be greater than all existing versions (monotonic)
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param config - Configuration object
   * @param config.name - Package name
   * @param config.addr - New package address
   * @param config.version - New version number (must be > latest version)
   */
  static updatePackageVersion(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    config: {
      name: string;
      addr: string;
      version: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'update_package_version'),
      arguments: [
        registry,
        tx.pure.string(config.name),
        tx.pure.address(config.addr),
        tx.pure.u64(config.version),
      ],
    });
  }

  /**
   * Remove a specific version from a package's history
   * Requires PackageAdminCap for authorization
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param cap - The PackageAdminCap
   * @param config - Configuration object
   * @param config.name - Package name
   * @param config.addr - Package address to remove
   * @param config.version - Version number to remove
   */
  static removePackageVersion(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    cap: ReturnType<Transaction['moveCall']>,
    config: {
      name: string;
      addr: string;
      version: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'remove_package_version'),
      arguments: [
        registry,
        cap,
        tx.pure.string(config.name),
        tx.pure.address(config.addr),
        tx.pure.u64(config.version),
      ],
    });
  }

  /**
   * Update package metadata (category, description, action types)
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param config - Configuration object
   * @param config.name - Package name
   * @param config.newActionTypes - New array of action type strings
   * @param config.newCategory - New category
   * @param config.newDescription - New description
   */
  static updatePackageMetadata(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    config: {
      name: string;
      newActionTypes: string[];
      newCategory: string;
      newDescription: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'update_package_metadata'),
      arguments: [
        registry,
        tx.pure.string(config.name),
        tx.pure.vector('string', config.newActionTypes),
        tx.pure.string(config.newCategory),
        tx.pure.string(config.newDescription),
      ],
    });
  }

  // ============================================================================
  // ACCOUNT CREATION PAUSE (5)
  // ============================================================================

  /**
   * Pause account creation system-wide
   * Requires PackageAdminCap to authorize
   * When paused, all calls to account::new() will abort
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param cap - The PackageAdminCap
   */
  static pauseAccountCreation(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    cap: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'pause_account_creation'),
      arguments: [registry, cap],
    });
  }

  /**
   * Pause account creation system-wide (without cap check)
   * IMPORTANT: Authorization must be verified by caller before calling this function
   * This is an internal API for governance actions where the cap check is done separately
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   */
  static pauseAccountCreationAuthorized(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'pause_account_creation_authorized'),
      arguments: [registry],
    });
  }

  /**
   * Unpause account creation system-wide
   * Requires PackageAdminCap to authorize
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param cap - The PackageAdminCap
   */
  static unpauseAccountCreation(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    cap: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'unpause_account_creation'),
      arguments: [registry, cap],
    });
  }

  /**
   * Unpause account creation system-wide (without cap check)
   * IMPORTANT: Authorization must be verified by caller before calling this function
   * This is an internal API for governance actions where the cap check is done separately
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   */
  static unpauseAccountCreationAuthorized(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'unpause_account_creation_authorized'),
      arguments: [registry],
    });
  }

  /**
   * Check if account creation is currently paused
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @returns Boolean indicating if account creation is paused
   */
  static isAccountCreationPaused(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'is_account_creation_paused'),
      arguments: [registry],
    });
  }

  // ============================================================================
  // QUERY FUNCTIONS (9)
  // ============================================================================

  /**
   * Check if a package exists
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param name - Package name to check
   * @returns Boolean indicating if package exists
   */
  static hasPackage(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'has_package'),
      arguments: [registry, tx.pure.string(name)],
    });
  }

  /**
   * Check if an action type has a registered package
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param actionType - Action type string to check
   * @returns Boolean indicating if action type is registered
   */
  static hasActionType(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    actionType: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'has_action_type'),
      arguments: [registry, tx.pure.string(actionType)],
    });
  }

  /**
   * Get which package provides an action type
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param actionType - Action type string
   * @returns The package name that provides this action type
   */
  static getPackageForAction(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    actionType: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'get_package_for_action'),
      arguments: [registry, tx.pure.string(actionType)],
    });
  }

  /**
   * Get package metadata
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param name - Package name
   * @returns Reference to the PackageMetadata
   */
  static getPackageMetadata(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'get_package_metadata'),
      arguments: [registry, tx.pure.string(name)],
    });
  }

  /**
   * Get latest version for a package
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param name - Package name
   * @returns Tuple of (address, version)
   */
  static getLatestVersion(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'get_latest_version'),
      arguments: [registry, tx.pure.string(name)],
    });
  }

  /**
   * Check if a specific (name, addr, version) triple is valid
   * This is the compatibility function for Extensions::is_extension
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param config - Configuration object
   * @param config.name - Package name
   * @param config.addr - Package address
   * @param config.version - Version number
   * @returns Boolean indicating if the package version is valid
   */
  static isValidPackage(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    config: {
      name: string;
      addr: string;
      version: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'is_valid_package'),
      arguments: [
        registry,
        tx.pure.string(config.name),
        tx.pure.address(config.addr),
        tx.pure.u64(config.version),
      ],
    });
  }

  /**
   * Check if a package address exists in the registry
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param addr - Package address to check
   * @returns Boolean indicating if address exists
   */
  static containsPackageAddr(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    addr: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'contains_package_addr'),
      arguments: [registry, tx.pure.address(addr)],
    });
  }

  /**
   * Get package name from address
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param addr - Package address
   * @returns The package name
   */
  static getPackageName(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    addr: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'get_package_name'),
      arguments: [registry, tx.pure.address(addr)],
    });
  }

  /**
   * Get all action types for a package
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param name - Package name
   * @returns Reference to vector of action type strings
   */
  static getActionTypes(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'get_action_types'),
      arguments: [registry, tx.pure.string(name)],
    });
  }

  /**
   * Get package category
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param name - Package name
   * @returns Reference to the category string
   */
  static getCategory(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'get_category'),
      arguments: [registry, tx.pure.string(name)],
    });
  }

  /**
   * Get package description
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param name - Package name
   * @returns Reference to the description string
   */
  static getDescription(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'get_description'),
      arguments: [registry, tx.pure.string(name)],
    });
  }

  /**
   * Get version history for a package
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param name - Package name
   * @returns Reference to vector of PackageVersion structs
   */
  static getVersions(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    name: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'get_versions'),
      arguments: [registry, tx.pure.string(name)],
    });
  }

  // ============================================================================
  // REGISTRY ACCESS (2)
  // ============================================================================

  /**
   * Get registry ID for dynamic field access (decoders)
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @returns Reference to the UID
   */
  static registryId(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'registry_id'),
      arguments: [registry],
    });
  }

  /**
   * Get mutable registry ID for adding decoders
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @returns Mutable reference to the UID
   */
  static registryIdMut(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'registry_id_mut'),
      arguments: [registry],
    });
  }

  // ============================================================================
  // PACKAGE METADATA ACCESSORS (4)
  // ============================================================================

  /**
   * Get action types from metadata
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param metadata - The PackageMetadata object
   * @returns Reference to vector of action type strings
   */
  static metadataActionTypes(
    tx: Transaction,
    accountProtocolPackageId: string,
    metadata: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'metadata_action_types'),
      arguments: [metadata],
    });
  }

  /**
   * Get category from metadata
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param metadata - The PackageMetadata object
   * @returns Reference to the category string
   */
  static metadataCategory(
    tx: Transaction,
    accountProtocolPackageId: string,
    metadata: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'metadata_category'),
      arguments: [metadata],
    });
  }

  /**
   * Get description from metadata
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param metadata - The PackageMetadata object
   * @returns Reference to the description string
   */
  static metadataDescription(
    tx: Transaction,
    accountProtocolPackageId: string,
    metadata: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'metadata_description'),
      arguments: [metadata],
    });
  }

  /**
   * Get versions from metadata
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param metadata - The PackageMetadata object
   * @returns Reference to vector of PackageVersion structs
   */
  static metadataVersions(
    tx: Transaction,
    accountProtocolPackageId: string,
    metadata: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'metadata_versions'),
      arguments: [metadata],
    });
  }

  // ============================================================================
  // HUMAN READABLE FIELD HELPERS (4)
  // ============================================================================

  /**
   * Create a human-readable field for decoder output
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.name - Field name
   * @param config.value - Field value as string
   * @param config.typeName - Type name of the field
   * @returns The HumanReadableField
   */
  static newField(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      name: string;
      value: string;
      typeName: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'new_field'),
      arguments: [
        tx.pure.string(config.name),
        tx.pure.string(config.value),
        tx.pure.string(config.typeName),
      ],
    });
  }

  /**
   * Get field name
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param field - The HumanReadableField
   * @returns Reference to the name string
   */
  static fieldName(
    tx: Transaction,
    accountProtocolPackageId: string,
    field: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'field_name'),
      arguments: [field],
    });
  }

  /**
   * Get field value
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param field - The HumanReadableField
   * @returns Reference to the value string
   */
  static fieldValue(
    tx: Transaction,
    accountProtocolPackageId: string,
    field: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'field_value'),
      arguments: [field],
    });
  }

  /**
   * Get field type
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param field - The HumanReadableField
   * @returns Reference to the type name string
   */
  static fieldType(
    tx: Transaction,
    accountProtocolPackageId: string,
    field: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'field_type'),
      arguments: [field],
    });
  }

  // ============================================================================
  // DECODER FUNCTIONS (1)
  // ============================================================================

  /**
   * Check if decoder exists for action type (via dynamic object field)
   * Action type should be the full type name as a string
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param registry - The PackageRegistry object
   * @param actionType - Action type string
   * @returns Boolean indicating if decoder exists
   */
  static hasPackageDecoder(
    tx: Transaction,
    accountProtocolPackageId: string,
    registry: ReturnType<Transaction['moveCall']>,
    actionType: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'has_package_decoder'),
      arguments: [registry, tx.pure.string(actionType)],
    });
  }

  // ============================================================================
  // PACKAGE VERSION HELPERS (3)
  // ============================================================================

  /**
   * Get address from PackageVersion
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param version - The PackageVersion object
   * @returns The package address
   */
  static versionAddr(
    tx: Transaction,
    accountProtocolPackageId: string,
    version: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'version_addr'),
      arguments: [version],
    });
  }

  /**
   * Get version number from PackageVersion
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param version - The PackageVersion object
   * @returns The version number
   */
  static versionNumber(
    tx: Transaction,
    accountProtocolPackageId: string,
    version: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'version_number'),
      arguments: [version],
    });
  }

  /**
   * Create a new PackageVersion
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.addr - Package address
   * @param config.version - Version number
   * @returns The PackageVersion
   */
  static newPackageVersion(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      addr: string;
      version: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'package_registry', 'new_package_version'),
      arguments: [
        tx.pure.address(config.addr),
        tx.pure.u64(config.version),
      ],
    });
  }
}
