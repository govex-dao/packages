/**
 * Action Registry - Single Source of Truth
 *
 * This module provides:
 * - Complete action definitions for all 57+ actions
 * - Lookup functions by ID, category, package
 * - Type generation helpers
 *
 * @module core/action-registry
 */

export {
  // Type definitions
  type ParamType,
  type ParamDef,
  type PackageId,
  type ActionCategory,
  type ActionDefinition,

  // Action arrays by category
  TRANSFER_ACTIONS,
  VAULT_ACTIONS,
  CURRENCY_ACTIONS,
  STREAM_ACTIONS,
  MEMO_ACTIONS,
  PACKAGE_UPGRADE_ACTIONS,
  ACCESS_CONTROL_ACTIONS,
  CONFIG_ACTIONS,
  QUOTA_ACTIONS,
  LIQUIDITY_ACTIONS,
  DISSOLUTION_ACTIONS,
  PACKAGE_REGISTRY_ACTIONS,
  PROTOCOL_ADMIN_ACTIONS,
  ORACLE_ACTIONS,

  // Combined registry
  ALL_ACTIONS,
  ACTION_BY_ID,
  ACTIONS_BY_CATEGORY,
  ACTIONS_BY_PACKAGE,
  LAUNCHPAD_ACTIONS,
  PROPOSAL_ACTIONS,
} from './action-definitions';

import {
  ALL_ACTIONS,
  ACTION_BY_ID,
  ACTIONS_BY_CATEGORY,
  ACTIONS_BY_PACKAGE,
  type ActionDefinition,
  type ActionCategory,
  type PackageId,
} from './action-definitions';

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Get an action definition by ID
 * @throws Error if action not found
 */
export function getAction(id: string): ActionDefinition {
  const action = ACTION_BY_ID[id];
  if (!action) {
    throw new Error(
      `Unknown action: "${id}". Available actions: ${ALL_ACTIONS.map((a) => a.id).join(', ')}`
    );
  }
  return action;
}

/**
 * Get an action definition by ID (returns undefined if not found)
 */
export function findAction(id: string): ActionDefinition | undefined {
  return ACTION_BY_ID[id];
}

/**
 * Get all actions for a category
 */
export function getActionsByCategory(category: ActionCategory): ActionDefinition[] {
  return ACTIONS_BY_CATEGORY[category] || [];
}

/**
 * Get all actions for a package
 */
export function getActionsByPackage(packageId: PackageId): ActionDefinition[] {
  return ACTIONS_BY_PACKAGE[packageId] || [];
}

/**
 * Check if an action ID is valid
 */
export function isValidAction(id: string): boolean {
  return id in ACTION_BY_ID;
}

/**
 * Get all action IDs
 */
export function getAllActionIds(): string[] {
  return ALL_ACTIONS.map((a) => a.id);
}

/**
 * Get all categories
 */
export function getAllCategories(): ActionCategory[] {
  return Object.keys(ACTIONS_BY_CATEGORY) as ActionCategory[];
}

/**
 * Get action count
 */
export function getActionCount(): number {
  return ALL_ACTIONS.length;
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Get the TypeScript type for a parameter type
 */
export function paramTypeToTsType(paramType: string): string {
  const mapping: Record<string, string> = {
    u8: 'number',
    u64: 'bigint',
    u128: 'bigint',
    bool: 'boolean',
    string: 'string',
    address: 'string',
    id: 'string',
    'vector<u8>': 'Uint8Array | number[]',
    'vector<string>': 'string[]',
    'vector<address>': 'string[]',
    'option<u64>': 'bigint | undefined',
    'option<u128>': 'bigint | undefined',
    'option<bool>': 'boolean | undefined',
    'option<string>': 'string | undefined',
    'option<vector<u8>>': 'Uint8Array | number[] | undefined',
    'option<signed_u128>': 'bigint | undefined',
    signed_u128: 'bigint',
    tier_specs: 'TierSpec[]',
    conditional_metadata: 'ConditionalMetadata | undefined',
  };

  return mapping[paramType] || 'unknown';
}

/**
 * Generate a TypeScript interface for an action config
 */
export function generateActionConfigInterface(action: ActionDefinition): string {
  const lines = [`export interface ${toPascalCase(action.id)}ActionConfig {`, `  type: '${action.id}';`];

  for (const param of action.params) {
    const tsType = paramTypeToTsType(param.type);
    const optional = param.optional ? '?' : '';
    lines.push(`  /** ${param.description} */`);
    lines.push(`  ${param.name}${optional}: ${tsType};`);
  }

  lines.push('}');
  return lines.join('\n');
}

// ============================================================================
// PACKAGE ID RESOLUTION
// ============================================================================

/**
 * Package ID configuration
 */
export interface PackageIdConfig {
  accountActionsPackageId: string;
  futarchyActionsPackageId: string;
  futarchyGovernanceActionsPackageId: string;
  futarchyOracleActionsPackageId: string;
  futarchyTypesPackageId: string;
}

/**
 * Resolve a package ID from config
 */
export function resolvePackageId(packageId: PackageId, config: PackageIdConfig): string {
  const mapping: Record<PackageId, keyof PackageIdConfig> = {
    accountActions: 'accountActionsPackageId',
    futarchyActions: 'futarchyActionsPackageId',
    futarchyGovernanceActions: 'futarchyGovernanceActionsPackageId',
    futarchyOracleActions: 'futarchyOracleActionsPackageId',
  };

  const configKey = mapping[packageId];
  return config[configKey];
}

/**
 * Get the full Move target for staging an action
 */
export function getStagingTarget(action: ActionDefinition, config: PackageIdConfig): string {
  const packageAddr = resolvePackageId(action.package, config);
  return `${packageAddr}::${action.stagingModule}::${action.stagingFunction}`;
}

/**
 * Get the full Move target for executing an action
 */
export function getExecutionTarget(action: ActionDefinition, config: PackageIdConfig): string | undefined {
  if (!action.executionModule || !action.executionFunction) {
    return undefined;
  }
  const packageAddr = resolvePackageId(action.package, config);
  return `${packageAddr}::${action.executionModule}::${action.executionFunction}`;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert snake_case to camelCase
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
