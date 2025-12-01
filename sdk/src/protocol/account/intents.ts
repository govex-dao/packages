/**
 * Intents Module SDK Wrapper
 *
 * This module provides TypeScript wrappers for the account_protocol::intents Move module.
 * Intents are blueprints for actions that can be proposed, approved, and executed on accounts.
 *
 * Core Concepts:
 * - ActionSpec: Blueprint for a single action with versioning and type safety
 * - Intent: Container for action specs with execution timing and outcome tracking
 * - Params: Reusable parameter bundles for intent creation
 * - Expired: Hot potato wrapper for post-execution action cleanup
 *
 * @module account-protocol/intents
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Intents Module Operations
 *
 * Static class providing type-safe wrappers for account_protocol::intents functions.
 * All functions use the accountProtocolPackageId and 'intents' module name.
 *
 * @example
 * ```typescript
 * import { Intents } from '@govex/sdk';
 *
 * const tx = new Transaction();
 *
 * // Create intent params
 * const params = Intents.newParams(tx, accountProtocolPackageId, {
 *   key: 'my-intent',
 *   description: 'Transfer funds',
 *   executionTimes: [Date.now() + 86400000],
 *   expirationTime: Date.now() + 172800000,
 *   clock: '0x6'
 * });
 *
 * // Check max placeholders
 * const maxPlaceholders = Intents.maxPlaceholders(tx, accountProtocolPackageId);
 * ```
 */
export class Intents {
  // ============================================================================
  // CONSTANTS (2)
  // ============================================================================

  /**
   * Get the maximum number of placeholders allowed in a single intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @returns The maximum placeholder count (currently 50)
   */
  static maxPlaceholders(
    tx: Transaction,
    accountProtocolPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'max_placeholders'),
      arguments: [],
    });
  }

  /**
   * Get the maximum size for action data in bytes
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @returns The maximum action data size (currently 4096 bytes)
   */
  static maxActionDataSize(
    tx: Transaction,
    accountProtocolPackageId: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'max_action_data_size'),
      arguments: [],
    });
  }

  // ============================================================================
  // PARAMS CREATION (2)
  // ============================================================================

  /**
   * Create new intent parameters with a specified key
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.key - Unique key for the intent
   * @param config.description - Description of the intent
   * @param config.executionTimes - Array of execution timestamps (milliseconds)
   * @param config.expirationTime - Expiration timestamp (milliseconds)
   * @param config.clock - Clock object ID
   * @returns The Params object
   */
  static newParams(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      key: string;
      description: string;
      executionTimes: number[];
      expirationTime: number;
      clock: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'new_params'),
      arguments: [
        tx.pure.string(config.key),
        tx.pure.string(config.description),
        tx.pure.vector('u64', config.executionTimes),
        tx.pure.u64(config.expirationTime),
        tx.object(config.clock),
      ],
    });
  }

  /**
   * Create new intent parameters with a randomly generated key
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.description - Description of the intent
   * @param config.executionTimes - Array of execution timestamps (milliseconds)
   * @param config.expirationTime - Expiration timestamp (milliseconds)
   * @param config.clock - Clock object ID
   * @returns Tuple of (Params, String key)
   */
  static newParamsWithRandKey(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      description: string;
      executionTimes: number[];
      expirationTime: number;
      clock: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'new_params_with_rand_key'),
      arguments: [
        tx.pure.string(config.description),
        tx.pure.vector('u64', config.executionTimes),
        tx.pure.u64(config.expirationTime),
        tx.object(config.clock),
      ],
    });
  }

  // ============================================================================
  // PARAMS ACCESSORS (5)
  // ============================================================================

  /**
   * Get the key from Params
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param params - The Params object
   * @returns The key string
   */
  static paramsKey(
    tx: Transaction,
    accountProtocolPackageId: string,
    params: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'params_key'),
      arguments: [params],
    });
  }

  /**
   * Get the description from Params
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param params - The Params object
   * @returns The description string
   */
  static paramsDescription(
    tx: Transaction,
    accountProtocolPackageId: string,
    params: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'params_description'),
      arguments: [params],
    });
  }

  /**
   * Get the creation time from Params
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param params - The Params object
   * @returns The creation timestamp
   */
  static paramsCreationTime(
    tx: Transaction,
    accountProtocolPackageId: string,
    params: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'params_creation_time'),
      arguments: [params],
    });
  }

  /**
   * Get the execution times from Params
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param params - The Params object
   * @returns Vector of execution timestamps
   */
  static paramsExecutionTimes(
    tx: Transaction,
    accountProtocolPackageId: string,
    params: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'params_execution_times'),
      arguments: [params],
    });
  }

  /**
   * Get the expiration time from Params
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param params - The Params object
   * @returns The expiration timestamp
   */
  static paramsExpirationTime(
    tx: Transaction,
    accountProtocolPackageId: string,
    params: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'params_expiration_time'),
      arguments: [params],
    });
  }

  // ============================================================================
  // ACTION SPEC CREATION (2)
  // ============================================================================

  /**
   * Create a new ActionSpec with generic type parameter
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.actionType - Type parameter for the action
   * @param config.actionData - BCS-serialized action data
   * @param config.version - Action version (default: 1)
   * @returns The ActionSpec
   */
  static newActionSpec(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      actionType: string;
      actionData: number[];
      version: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'new_action_spec'),
      typeArguments: [config.actionType],
      arguments: [
        tx.pure(new Uint8Array(config.actionData)),
        tx.pure.u8(config.version),
      ],
    });
  }

  /**
   * Create a new ActionSpec with TypeName directly
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.actionType - TypeName of the action
   * @param config.actionData - BCS-serialized action data
   * @param config.version - Action version (default: 1)
   * @returns The ActionSpec
   */
  static newActionSpecWithTypename(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      actionType: ReturnType<Transaction['moveCall']>;
      actionData: number[];
      version: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'new_action_spec_with_typename'),
      arguments: [
        config.actionType,
        tx.pure(new Uint8Array(config.actionData)),
        tx.pure.u8(config.version),
      ],
    });
  }

  // ============================================================================
  // ACTION SPEC MANAGEMENT (4)
  // ============================================================================

  /**
   * Add an action specification to an intent with pre-serialized bytes
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param config.actionType - Type parameter for the action (drop)
   * @param config.intentWitnessType - Type parameter for the intent witness (drop)
   * @param intent - The Intent object
   * @param actionTypeWitness - The action type witness
   * @param actionDataBytes - BCS-serialized action data
   * @param intentWitness - The intent witness
   */
  static addActionSpec(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
      actionType: string;
      intentWitnessType: string;
    },
    intent: ReturnType<Transaction['moveCall']>,
    actionTypeWitness: ReturnType<Transaction['moveCall']>,
    actionDataBytes: number[],
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'add_action_spec'),
      typeArguments: [config.outcomeType, config.actionType, config.intentWitnessType],
      arguments: [
        intent,
        actionTypeWitness,
        tx.pure(new Uint8Array(actionDataBytes)),
        intentWitness,
      ],
    });
  }

  /**
   * Add action spec with TypeName directly (for replaying stored init intents)
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param config.intentWitnessType - Type parameter for the intent witness (drop)
   * @param intent - The Intent object
   * @param actionType - The TypeName of the action
   * @param actionDataBytes - BCS-serialized action data
   * @param intentWitness - The intent witness
   */
  static addActionSpecWithTypename(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
      intentWitnessType: string;
    },
    intent: ReturnType<Transaction['moveCall']>,
    actionType: ReturnType<Transaction['moveCall']>,
    actionDataBytes: number[],
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'add_action_spec_with_typename'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [
        intent,
        actionType,
        tx.pure(new Uint8Array(actionDataBytes)),
        intentWitness,
      ],
    });
  }

  /**
   * Add an already-constructed ActionSpec to intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param config.intentWitnessType - Type parameter for the intent witness (drop)
   * @param intent - The Intent object
   * @param spec - The ActionSpec to add
   * @param intentWitness - The intent witness
   */
  static addExistingActionSpec(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
      intentWitnessType: string;
    },
    intent: ReturnType<Transaction['moveCall']>,
    spec: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'add_existing_action_spec'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [intent, spec, intentWitness],
    });
  }

  /**
   * Add a typed action with pre-serialized bytes (serialize-then-destroy pattern)
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param config.actionType - Type parameter for the action (drop)
   * @param config.intentWitnessType - Type parameter for the intent witness (drop)
   * @param intent - The Intent object
   * @param actionType - The action type witness
   * @param actionData - BCS-serialized action data
   * @param intentWitness - The intent witness
   */
  static addTypedAction(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
      actionType: string;
      intentWitnessType: string;
    },
    intent: ReturnType<Transaction['moveCall']>,
    actionType: ReturnType<Transaction['moveCall']>,
    actionData: number[],
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'add_typed_action'),
      typeArguments: [config.outcomeType, config.actionType, config.intentWitnessType],
      arguments: [
        intent,
        actionType,
        tx.pure(new Uint8Array(actionData)),
        intentWitness,
      ],
    });
  }

  // ============================================================================
  // ACTION SPEC ACCESSORS (4)
  // ============================================================================

  /**
   * Get the version from an ActionSpec
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param spec - The ActionSpec
   * @returns The version byte
   */
  static actionSpecVersion(
    tx: Transaction,
    accountProtocolPackageId: string,
    spec: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'action_spec_version'),
      arguments: [spec],
    });
  }

  /**
   * Get the action type (TypeName) from an ActionSpec
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param spec - The ActionSpec
   * @returns The TypeName
   */
  static actionSpecType(
    tx: Transaction,
    accountProtocolPackageId: string,
    spec: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'action_spec_type'),
      arguments: [spec],
    });
  }

  /**
   * Get a reference to the action data from an ActionSpec
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param spec - The ActionSpec
   * @returns Reference to the action data bytes
   */
  static actionSpecData(
    tx: Transaction,
    accountProtocolPackageId: string,
    spec: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'action_spec_data'),
      arguments: [spec],
    });
  }

  /**
   * Extract and consume the action data from an ActionSpec
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param spec - The ActionSpec (consumed)
   * @returns The action data bytes
   */
  static actionSpecActionData(
    tx: Transaction,
    accountProtocolPackageId: string,
    spec: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'action_spec_action_data'),
      arguments: [spec],
    });
  }

  // ============================================================================
  // INTENTS COLLECTION (3)
  // ============================================================================

  /**
   * Get the number of intents in the collection
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param intents - The Intents collection
   * @returns The count
   */
  static getLength(
    tx: Transaction,
    accountProtocolPackageId: string,
    intents: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'length'),
      arguments: [intents],
    });
  }

  /**
   * Check if an intent with the given key exists
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param intents - The Intents collection
   * @param key - The intent key to check
   * @returns Boolean indicating existence
   */
  static contains(
    tx: Transaction,
    accountProtocolPackageId: string,
    intents: ReturnType<Transaction['moveCall']>,
    key: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'contains'),
      arguments: [intents, tx.pure.string(key)],
    });
  }

  /**
   * Get an immutable reference to an intent by key
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome (store)
   * @param intents - The Intents collection
   * @param key - The intent key
   * @returns Reference to the Intent
   */
  static get(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intents: ReturnType<Transaction['moveCall']>,
    key: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'get'),
      typeArguments: [config.outcomeType],
      arguments: [intents, tx.pure.string(key)],
    });
  }

  /**
   * Get a mutable reference to an intent by key
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome (store)
   * @param intents - The Intents collection
   * @param key - The intent key
   * @returns Mutable reference to the Intent
   */
  static getMut(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intents: ReturnType<Transaction['moveCall']>,
    key: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'get_mut'),
      typeArguments: [config.outcomeType],
      arguments: [intents, tx.pure.string(key)],
    });
  }

  // ============================================================================
  // INTENT ACCESSORS (11)
  // ============================================================================

  /**
   * Get the type (TypeName) from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns The TypeName
   */
  static type_(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'type_'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get the key from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns The key string
   */
  static key(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'key'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get the description from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns The description string
   */
  static description(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'description'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get the account address from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns The account address
   */
  static account(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'account'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get the creator address from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns The creator address
   */
  static creator(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'creator'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get the creation time from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns The creation timestamp
   */
  static creationTime(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'creation_time'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get the execution times from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns Vector of execution timestamps
   */
  static executionTimes(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'execution_times'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get the expiration time from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns The expiration timestamp
   */
  static expirationTime(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'expiration_time'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get the role from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns The role string
   */
  static role(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'role'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get the action count from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns The number of actions
   */
  static actionCount(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'action_count'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get an immutable reference to the outcome from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns Reference to the Outcome
   */
  static outcome(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'outcome'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get a mutable reference to the outcome from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns Mutable reference to the Outcome
   */
  static outcomeMut(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'outcome_mut'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  /**
   * Get a reference to the action specs vector from an Intent
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @returns Reference to the action specs vector
   */
  static actionSpecs(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'action_specs'),
      typeArguments: [config.outcomeType],
      arguments: [intent],
    });
  }

  // ============================================================================
  // EXPIRED OPERATIONS (5)
  // ============================================================================

  /**
   * Remove an action spec from an Expired object
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param expired - The Expired object
   * @returns The removed ActionSpec
   */
  static removeActionSpec(
    tx: Transaction,
    accountProtocolPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'remove_action_spec'),
      arguments: [expired],
    });
  }

  /**
   * Mark an action as executed in the Expired struct
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param expired - The Expired object
   * @param index - The action index to mark
   */
  static markActionExecuted(
    tx: Transaction,
    accountProtocolPackageId: string,
    expired: ReturnType<Transaction['moveCall']>,
    index: number
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'mark_action_executed'),
      arguments: [expired, tx.pure.u64(index)],
    });
  }

  /**
   * Check if an action was executed
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param expired - The Expired object
   * @param index - The action index to check
   * @returns Boolean indicating if executed
   */
  static isActionExecuted(
    tx: Transaction,
    accountProtocolPackageId: string,
    expired: ReturnType<Transaction['moveCall']>,
    index: number
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'is_action_executed'),
      arguments: [expired, tx.pure.u64(index)],
    });
  }

  /**
   * Get the number of actions in the Expired struct
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param expired - The Expired object
   * @returns The action count
   */
  static expiredActionCount(
    tx: Transaction,
    accountProtocolPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'expired_action_count'),
      arguments: [expired],
    });
  }

  /**
   * Destroy an empty Expired object
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param expired - The Expired object (must be empty)
   */
  static destroyEmptyExpired(
    tx: Transaction,
    accountProtocolPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'destroy_empty_expired'),
      arguments: [expired],
    });
  }

  // ============================================================================
  // EXPIRED ACCESSORS (2)
  // ============================================================================

  /**
   * Get the account address from an Expired object
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param expired - The Expired object
   * @returns The account address
   */
  static expiredAccount(
    tx: Transaction,
    accountProtocolPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'expired_account'),
      arguments: [expired],
    });
  }

  /**
   * Get a reference to the action specs from an Expired object
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param expired - The Expired object
   * @returns Reference to the action specs vector
   */
  static expiredActionSpecs(
    tx: Transaction,
    accountProtocolPackageId: string,
    expired: ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'expired_action_specs'),
      arguments: [expired],
    });
  }

  // ============================================================================
  // ASSERTIONS (4)
  // ============================================================================

  /**
   * Assert that an intent belongs to the given account
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param intent - The Intent object
   * @param accountAddr - The expected account address
   */
  static assertIsAccount(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
    },
    intent: ReturnType<Transaction['moveCall']>,
    accountAddr: string
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'assert_is_account'),
      typeArguments: [config.outcomeType],
      arguments: [intent, tx.pure.address(accountAddr)],
    });
  }

  /**
   * Assert that the intent witness matches the intent type
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param config - Configuration object
   * @param config.outcomeType - Type parameter for the intent outcome
   * @param config.intentWitnessType - Type parameter for the intent witness (drop)
   * @param intent - The Intent object
   * @param intentWitness - The intent witness
   */
  static assertIsWitness(
    tx: Transaction,
    accountProtocolPackageId: string,
    config: {
      outcomeType: string;
      intentWitnessType: string;
    },
    intent: ReturnType<Transaction['moveCall']>,
    intentWitness: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'assert_is_witness'),
      typeArguments: [config.outcomeType, config.intentWitnessType],
      arguments: [intent, intentWitness],
    });
  }

  /**
   * Assert that an expired object belongs to the given account
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param expired - The Expired object
   * @param accountAddr - The expected account address
   */
  static assertExpiredIsAccount(
    tx: Transaction,
    accountProtocolPackageId: string,
    expired: ReturnType<Transaction['moveCall']>,
    accountAddr: string
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'assert_expired_is_account'),
      arguments: [expired, tx.pure.address(accountAddr)],
    });
  }

  /**
   * Assert that params have exactly one execution time (single execution)
   * @param tx - Transaction instance
   * @param accountProtocolPackageId - The account protocol package ID
   * @param params - The Params object
   */
  static assertSingleExecution(
    tx: Transaction,
    accountProtocolPackageId: string,
    params: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(accountProtocolPackageId, 'intents', 'assert_single_execution'),
      arguments: [params],
    });
  }
}
