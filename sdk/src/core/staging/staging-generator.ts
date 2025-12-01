/**
 * Staging Function Generator
 *
 * Generates staging functions from action definitions.
 * Each function adds an action spec to an intent builder.
 *
 * @module core/staging/staging-generator
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import {
  ALL_ACTIONS,
  ActionDefinition,
  PackageId,
  LAUNCHPAD_ACTIONS,
  PROPOSAL_ACTIONS,
} from '../action-registry/action-definitions';

/**
 * Package configuration for staging functions
 */
export interface StagingPackageConfig {
  accountActionsPackageId: string;
  futarchyActionsPackageId: string;
  futarchyGovernanceActionsPackageId: string;
  futarchyOracleActionsPackageId: string;
}

/**
 * Result type for staged action
 */
export interface StagedActionResult {
  target: string;
  typeArguments: string[];
}

/**
 * Resolve package ID from config
 */
function resolvePackage(packageId: PackageId, config: StagingPackageConfig): string {
  const mapping: Record<PackageId, keyof StagingPackageConfig> = {
    accountActions: 'accountActionsPackageId',
    futarchyActions: 'futarchyActionsPackageId',
    futarchyGovernanceActions: 'futarchyGovernanceActionsPackageId',
    futarchyOracleActions: 'futarchyOracleActionsPackageId',
  };
  return config[mapping[packageId]];
}

/**
 * Get the staging target for an action
 */
export function getStagingTarget(action: ActionDefinition, config: StagingPackageConfig): string {
  const packageAddr = resolvePackage(action.package, config);
  return `${packageAddr}::${action.stagingModule}::${action.stagingFunction}`;
}

/**
 * Parameters for a staging call
 */
export interface StagingCallParams {
  /** Transaction to add the call to */
  tx: Transaction;
  /** Intent builder result from previous call */
  builder: ReturnType<Transaction['moveCall']>;
  /** Action definition */
  action: ActionDefinition;
  /** Package configuration */
  packages: StagingPackageConfig;
  /** Parameter values keyed by param name */
  params: Record<string, unknown>;
  /** Type arguments if the action has type params */
  typeArgs?: string[];
}

/**
 * Serialize a parameter value to BCS for staging
 */
function serializeParam(
  tx: Transaction,
  value: unknown,
  paramType: string
): ReturnType<Transaction['pure']> {
  switch (paramType) {
    case 'u8':
      return tx.pure.u8(value as number);
    case 'u64':
      return tx.pure.u64(value as bigint);
    case 'u128':
      return tx.pure.u128(value as bigint);
    case 'bool':
      return tx.pure.bool(value as boolean);
    case 'string':
      return tx.pure.string(value as string);
    case 'address':
    case 'id':
      return tx.pure.address(value as string);
    case 'vector<u8>':
      return tx.pure(bcs.vector(bcs.u8()).serialize(value as number[] | Uint8Array).toBytes());
    case 'vector<string>':
      return tx.pure(bcs.vector(bcs.string()).serialize(value as string[]).toBytes());
    case 'vector<address>':
      return tx.pure(bcs.vector(bcs.Address).serialize(value as string[]).toBytes());
    case 'option<u64>':
      return tx.pure(bcs.option(bcs.u64()).serialize(value as bigint | null).toBytes());
    case 'option<u128>':
      return tx.pure(bcs.option(bcs.u128()).serialize(value as bigint | null).toBytes());
    case 'option<bool>':
      return tx.pure(bcs.option(bcs.bool()).serialize(value as boolean | null).toBytes());
    case 'option<string>':
      return tx.pure(bcs.option(bcs.string()).serialize(value as string | null).toBytes());
    case 'option<vector<u8>>':
      return tx.pure(
        bcs.option(bcs.vector(bcs.u8())).serialize(value as number[] | Uint8Array | null).toBytes()
      );
    default:
      // For complex types, assume value is already serialized
      if (value instanceof Uint8Array) {
        return tx.pure(value);
      }
      throw new Error(`Unsupported parameter type: ${paramType}`);
  }
}

/**
 * Add a staging call to a transaction
 *
 * @returns Updated builder result
 */
export function addStagingCall(params: StagingCallParams): ReturnType<Transaction['moveCall']> {
  const { tx, builder, action, packages, params: values, typeArgs } = params;

  const target = getStagingTarget(action, packages);

  // Build arguments: [builder, ...serialized params]
  const args: ReturnType<Transaction['pure']>[] = [builder];

  for (const paramDef of action.params) {
    const value = values[paramDef.name];
    if (value === undefined && !paramDef.optional) {
      throw new Error(`Missing required parameter: ${paramDef.name} for action ${action.id}`);
    }
    if (value !== undefined || !paramDef.optional) {
      args.push(serializeParam(tx, value, paramDef.type));
    }
  }

  return tx.moveCall({
    target,
    typeArguments: typeArgs || [],
    arguments: args,
  });
}

/**
 * Get all launchpad-supported action IDs
 */
export function getLaunchpadActionIds(): string[] {
  return LAUNCHPAD_ACTIONS.map((a) => a.id);
}

/**
 * Get all proposal-supported action IDs
 */
export function getProposalActionIds(): string[] {
  return PROPOSAL_ACTIONS.map((a) => a.id);
}

/**
 * Get all action IDs
 */
export function getAllActionIds(): string[] {
  return ALL_ACTIONS.map((a) => a.id);
}

/**
 * Check if an action is supported for launchpad
 */
export function isLaunchpadSupported(actionId: string): boolean {
  return LAUNCHPAD_ACTIONS.some((a) => a.id === actionId);
}

/**
 * Check if an action is supported for proposals
 */
export function isProposalSupported(actionId: string): boolean {
  return PROPOSAL_ACTIONS.some((a) => a.id === actionId);
}

/**
 * Validate that all actions in a list are supported for a given context
 */
export function validateActionsForContext(
  actionIds: string[],
  context: 'launchpad' | 'proposal'
): { valid: boolean; unsupported: string[] } {
  const checker = context === 'launchpad' ? isLaunchpadSupported : isProposalSupported;
  const unsupported = actionIds.filter((id) => !checker(id));
  return {
    valid: unsupported.length === 0,
    unsupported,
  };
}
