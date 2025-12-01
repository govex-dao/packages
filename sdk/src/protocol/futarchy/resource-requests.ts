/**
 * Resource Requests Module
 *
 * Generic hot potato pattern for requesting and fulfilling resources. Ensures resources
 * are provided in the same transaction using type-safe receipts.
 *
 * PATTERN:
 * 1. Create ResourceRequest<T> hot potato
 * 2. Add context data to request
 * 3. Fulfill request with resources
 * 4. Get ResourceReceipt<T> confirming fulfillment
 *
 * @module resource-requests
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Resource Requests Static Functions
 *
 * Provides hot potato pattern for type-safe resource requests.
 */
export class ResourceRequests {
  /**
   * Create a new resource request with context
   *
   * The phantom type T ensures type safety between request and fulfillment.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ResourceRequest<T> hot potato
   *
   * @example
   * ```typescript
   * const request = ResourceRequests.newRequest(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   * });
   * ```
   */
  static newRequest(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'new_request'
      ),
      typeArguments: [config.actionType],
    });
  }

  /**
   * Add context data to a request
   *
   * Can be called multiple times to store any data needed for fulfillment.
   *
   * @param tx - Transaction
   * @param config - Configuration
   *
   * @example
   * ```typescript
   * ResourceRequests.addContext(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   valueType: '0x2::sui::SUI',
   *   request,
   *   key: 'amount',
   *   value: tx.pure.u64(1000),
   * });
   * ```
   */
  static addContext(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      valueType: string;
      request: ReturnType<Transaction['moveCall']>;
      key: string;
      value: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'add_context'
      ),
      typeArguments: [config.actionType, config.valueType],
      arguments: [
        config.request,
        tx.pure.string(config.key),
        config.value,
      ],
    });
  }

  /**
   * Get context data from a request
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Context value of type V
   *
   * @example
   * ```typescript
   * const amount = ResourceRequests.getContext(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   valueType: 'u64',
   *   request,
   *   key: 'amount',
   * });
   * ```
   */
  static getContext(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      valueType: string;
      request: ReturnType<Transaction['moveCall']>;
      key: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'get_context'
      ),
      typeArguments: [config.actionType, config.valueType],
      arguments: [
        config.request,
        tx.pure.string(config.key),
      ],
    });
  }

  /**
   * Check if context exists
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Boolean indicating if context key exists
   *
   * @example
   * ```typescript
   * const exists = ResourceRequests.hasContext(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   request,
   *   key: 'amount',
   * });
   * ```
   */
  static hasContext(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      request: ReturnType<Transaction['moveCall']>;
      key: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'has_context'
      ),
      typeArguments: [config.actionType],
      arguments: [
        config.request,
        tx.pure.string(config.key),
      ],
    });
  }

  /**
   * Consume a request and return a receipt
   *
   * The actual resource provision happens in the action-specific fulfill function.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ResourceReceipt<T>
   *
   * @example
   * ```typescript
   * const receipt = ResourceRequests.fulfill(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   request,
   * });
   * ```
   */
  static fulfill(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      request: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'fulfill'
      ),
      typeArguments: [config.actionType],
      arguments: [config.request],
    });
  }

  /**
   * Get request ID
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Request ID
   *
   * @example
   * ```typescript
   * const id = ResourceRequests.requestId(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   request,
   * });
   * ```
   */
  static requestId(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      request: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'request_id'
      ),
      typeArguments: [config.actionType],
      arguments: [config.request],
    });
  }

  /**
   * Get receipt ID
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Receipt ID
   *
   * @example
   * ```typescript
   * const id = ResourceRequests.receiptId(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   receipt,
   * });
   * ```
   */
  static receiptId(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      receipt: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'receipt_id'
      ),
      typeArguments: [config.actionType],
      arguments: [config.receipt],
    });
  }

  /**
   * Take context data from a request (for fulfillment)
   *
   * Removes the context value from the request.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Context value of type V
   *
   * @example
   * ```typescript
   * const amount = ResourceRequests.takeContext(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   valueType: 'u64',
   *   request,
   *   key: 'amount',
   * });
   * ```
   */
  static takeContext(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      valueType: string;
      request: ReturnType<Transaction['moveCall']>;
      key: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'take_context'
      ),
      typeArguments: [config.actionType, config.valueType],
      arguments: [
        config.request,
        tx.pure.string(config.key),
      ],
    });
  }

  /**
   * Get mutable context access
   *
   * Returns mutable reference to the context UID for advanced use cases.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Mutable UID reference
   *
   * @example
   * ```typescript
   * const contextUid = ResourceRequests.contextMut(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   request,
   * });
   * ```
   */
  static contextMut(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      request: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'context_mut'
      ),
      typeArguments: [config.actionType],
      arguments: [config.request],
    });
  }

  /**
   * Create a new resource request with an action stored as context
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ResourceRequest<T> with action in context
   *
   * @example
   * ```typescript
   * const request = ResourceRequests.newResourceRequest(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   action,
   * });
   * ```
   */
  static newResourceRequest(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      action: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'new_resource_request'
      ),
      typeArguments: [config.actionType],
      arguments: [config.action],
    });
  }

  /**
   * Extract the action from a resource request
   *
   * Cleans up the request and returns the stored action.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns Action of type T
   *
   * @example
   * ```typescript
   * const action = ResourceRequests.extractAction(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   request,
   * });
   * ```
   */
  static extractAction(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      request: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'extract_action'
      ),
      typeArguments: [config.actionType],
      arguments: [config.request],
    });
  }

  /**
   * Create a receipt after fulfilling a request with an action
   *
   * Drops the action since it's been processed.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns ResourceReceipt<T>
   *
   * @example
   * ```typescript
   * const receipt = ResourceRequests.createReceipt(tx, {
   *   futarchyCorePackageId,
   *   actionType: '0xPKG::module::Action',
   *   action,
   * });
   * ```
   */
  static createReceipt(
    tx: Transaction,
    config: {
      futarchyCorePackageId: string;
      actionType: string;
      action: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.futarchyCorePackageId,
        'resource_requests',
        'create_receipt'
      ),
      typeArguments: [config.actionType],
      arguments: [config.action],
    });
  }
}
