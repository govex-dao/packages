/**
 * Error Mapping
 *
 * Maps Move error codes to human-readable messages.
 * Makes debugging much easier for SDK users.
 *
 * @module core/errors/error-mapping
 */

// ============================================================================
// ERROR CODE DEFINITIONS
// ============================================================================

/**
 * Move module error codes
 */
export const MOVE_ERROR_CODES: Record<string, Record<number, string>> = {
  // =========================================================================
  // ACCOUNT PROTOCOL ERRORS
  // =========================================================================
  'account_protocol::account': {
    0: 'Account not found',
    1: 'Not authorized to perform this action',
    2: 'Account is locked',
    3: 'Invalid account state',
  },

  'account_protocol::intents': {
    0: 'Intent not found',
    1: 'Intent already exists',
    2: 'Intent is expired',
    3: 'Intent is locked',
    4: 'Invalid intent state',
    5: 'Action index out of bounds',
    6: 'All actions not executed',
  },

  'account_protocol::executable': {
    0: 'Executable not found',
    1: 'Invalid action index',
    2: 'Action type mismatch',
    3: 'Not all actions executed',
  },

  // =========================================================================
  // ACCOUNT ACTIONS ERRORS
  // =========================================================================
  'account_actions::vault': {
    0: 'Vault not found',
    1: 'Insufficient balance in vault',
    2: 'Vault already exists',
    3: 'Coin type not approved for vault',
    4: 'Cannot deposit zero amount',
    5: 'Cannot withdraw zero amount',
    6: 'Vault is locked',
  },

  'account_actions::currency': {
    0: 'TreasuryCap not found',
    1: 'CoinMetadata not found',
    2: 'Minting is disabled',
    3: 'Burning is disabled',
    4: 'Symbol update is disabled',
    5: 'Name update is disabled',
    6: 'Description update is disabled',
    7: 'Icon update is disabled',
    8: 'Cannot mint zero amount',
    9: 'Cannot burn zero amount',
  },

  'account_actions::stream': {
    0: 'Stream not found',
    1: 'Stream is not active',
    2: 'Stream is not cancellable',
    3: 'Not the stream beneficiary',
    4: 'No tokens available to claim',
    5: 'Claim window has passed',
    6: 'Cliff time not reached',
    7: 'Stream already cancelled',
    8: 'Invalid stream parameters',
  },

  'account_actions::transfer': {
    0: 'Object not found',
    1: 'Not authorized to transfer',
    2: 'Invalid recipient',
  },

  'account_actions::package_upgrade': {
    0: 'UpgradeCap not found',
    1: 'Package not found',
    2: 'Invalid upgrade digest',
    3: 'Upgrade policy violation',
    4: 'Upgrade ticket not found',
    5: 'CommitCap not found',
    6: 'Reclaim delay not elapsed',
  },

  'account_actions::memo': {
    0: 'Memo too long',
  },

  'account_actions::access_control': {
    0: 'Object not found in storage',
    1: 'Object is already borrowed',
    2: 'Cannot return object that was not borrowed',
  },

  // =========================================================================
  // FUTARCHY CORE ERRORS
  // =========================================================================
  'futarchy_core::futarchy_config': {
    0: 'DAO is terminated',
    1: 'Proposals are disabled',
    2: 'Invalid configuration',
    3: 'DAO not found',
  },

  'futarchy_core::dao_config': {
    0: 'Invalid trading period',
    1: 'Invalid review period',
    2: 'Invalid fee configuration',
    3: 'Invalid governance settings',
  },

  // =========================================================================
  // FUTARCHY ACTIONS ERRORS
  // =========================================================================
  'futarchy_actions::config_actions': {
    0: 'DAO is already terminated',
    1: 'Cannot enable proposals on terminated DAO',
    2: 'Invalid parameter update',
    3: 'Action version not supported',
  },

  'futarchy_actions::quota_actions': {
    0: 'User already has quota',
    1: 'Invalid quota parameters',
    2: 'Quota period too short',
  },

  'futarchy_actions::liquidity_init_actions': {
    1: 'Invalid amount - must be positive',
    2: 'Invalid ratio - fee too high',
    3: 'Unsupported action version',
  },

  'futarchy_actions::liquidity_actions': {
    0: 'Pool not found',
    1: 'Insufficient liquidity',
    2: 'Slippage exceeded',
    3: 'Invalid pool state',
    4: 'LP token not found',
    5: 'Invalid swap direction',
    6: 'Zero amount not allowed',
    7: 'Minimum output not met',
    8: 'Pool already exists',
    9: 'Fee too high (max 10000 bps)',
    10: 'Insufficient LP tokens',
    11: 'No fees to collect',
    12: 'Insufficient fee balance',
  },

  'futarchy_actions::dissolution_actions': {
    0: 'DAO is not terminated',
    1: 'Dissolution unlock time not reached',
    2: 'Dissolution capability already exists',
  },

  // =========================================================================
  // FUTARCHY GOVERNANCE ACTIONS ERRORS
  // =========================================================================
  'futarchy_governance_actions::package_registry_actions': {
    0: 'Package already exists',
    1: 'Package not found',
    2: 'Invalid package address',
    3: 'Account creation is paused',
    4: 'Account creation is not paused',
  },

  'futarchy_governance_actions::protocol_admin_actions': {
    0: 'Factory is already paused',
    1: 'Factory is not paused',
    2: 'Factory is permanently disabled',
    3: 'Stable type already registered',
    4: 'Stable type not found',
    5: 'Verification level already exists',
    6: 'Verification level not found',
    7: 'Insufficient fees to withdraw',
    8: 'Coin fee config already exists',
    9: 'Coin fee config not found',
    10: 'No pending fee changes',
  },

  // =========================================================================
  // FUTARCHY ORACLE ERRORS
  // =========================================================================
  'futarchy_oracle::oracle_actions': {
    0: 'Grant not found',
    1: 'Grant is not cancelable',
    2: 'Grant has already been executed',
    3: 'Grant has expired',
    4: 'Price threshold not met',
    5: 'Earliest execution time not reached',
    6: 'Invalid tier configuration',
  },

  // =========================================================================
  // FUTARCHY MARKETS ERRORS
  // =========================================================================
  'futarchy_markets_core::proposal': {
    0: 'Proposal not found',
    1: 'Proposal is not in correct state',
    2: 'Not authorized to modify proposal',
    3: 'Outcome index out of bounds',
    4: 'Cannot execute - winner not determined',
    5: 'Proposal already finalized',
    6: 'Trading period not ended',
    7: 'Review period not ended',
  },

  'futarchy_markets_core::unified_spot_pool': {
    0: 'Pool not found',
    1: 'Insufficient input amount',
    2: 'Insufficient output amount',
    3: 'Slippage tolerance exceeded',
    4: 'Pool is locked',
    5: 'Invalid fee parameters',
  },

  // =========================================================================
  // LAUNCHPAD ERRORS
  // =========================================================================
  'futarchy_launchpad::launchpad': {
    0: 'Raise not found',
    1: 'Raise is not active',
    2: 'Raise has ended',
    3: 'Raise target not met',
    4: 'Raise target exceeded',
    5: 'Not the raise creator',
    6: 'Intent already staged',
    7: 'Cannot execute - raise not finalized',
    8: 'Invalid raise parameters',
  },
};

// ============================================================================
// ERROR TRANSLATION
// ============================================================================

/**
 * SDKError with additional context
 */
export class SDKMoveError extends Error {
  constructor(
    message: string,
    public readonly module: string,
    public readonly errorCode: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SDKMoveError';
  }
}

/**
 * Parse a Move abort message to extract module and error code
 */
function parseMoveAbort(errorMessage: string): { module: string; code: number } | null {
  // Common patterns:
  // "MoveAbort(MoveLocation { module: ModuleId { address: 0x..., name: Identifier("module") }, function: 0, instruction: 0 }, 1)"
  // "VMError with status ABORTED at location ... with code 1"
  // "Error: MoveAbort in module::function, code 1"

  // Pattern 1: Standard MoveAbort format
  const pattern1 = /module.*?name:\s*(?:Identifier\(")?([\w_]+)(?:"\))?.*?},\s*(\d+)/;
  const match1 = errorMessage.match(pattern1);
  if (match1) {
    return { module: match1[1], code: parseInt(match1[2], 10) };
  }

  // Pattern 2: Simple abort format
  const pattern2 = /abort(?:ed)?.*?(\d+)/i;
  const match2 = errorMessage.match(pattern2);
  if (match2) {
    return { module: 'unknown', code: parseInt(match2[1], 10) };
  }

  // Pattern 3: Module::code format
  const pattern3 = /([\w_]+)::([\w_]+).*?code[:\s]+(\d+)/i;
  const match3 = errorMessage.match(pattern3);
  if (match3) {
    return { module: `${match3[1]}::${match3[2]}`, code: parseInt(match3[3], 10) };
  }

  return null;
}

/**
 * Translate a Move error to a human-readable message
 */
export function translateMoveError(error: Error | string): SDKMoveError {
  const errorMessage = typeof error === 'string' ? error : error.message;

  const parsed = parseMoveAbort(errorMessage);

  if (!parsed) {
    // Could not parse, return generic error
    return new SDKMoveError(
      `Move execution failed: ${errorMessage}`,
      'unknown',
      -1,
      error instanceof Error ? error : undefined
    );
  }

  const { module, code } = parsed;

  // Try to find a matching error message
  let humanMessage: string | undefined;

  // Try exact module match first
  for (const [moduleKey, codes] of Object.entries(MOVE_ERROR_CODES)) {
    if (moduleKey.includes(module) || module.includes(moduleKey.split('::').pop()!)) {
      humanMessage = codes[code];
      if (humanMessage) {
        return new SDKMoveError(`${humanMessage} (${moduleKey} error code ${code})`, moduleKey, code, error instanceof Error ? error : undefined);
      }
    }
  }

  // No match found
  return new SDKMoveError(
    `Move execution failed in module "${module}" with error code ${code}`,
    module,
    code,
    error instanceof Error ? error : undefined
  );
}

/**
 * Wrap an async function to translate Move errors
 */
export function withErrorTranslation<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    try {
      return (await fn(...args)) as Awaited<ReturnType<T>>;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Move')) {
        throw translateMoveError(error);
      }
      throw error;
    }
  };
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

/**
 * Check if an error is a specific Move error
 */
export function isMoveError(error: unknown, module: string, code: number): boolean {
  if (error instanceof SDKMoveError) {
    return error.module.includes(module) && error.errorCode === code;
  }
  return false;
}

/**
 * Check if error is an insufficient balance error
 */
export function isInsufficientBalanceError(error: unknown): boolean {
  return isMoveError(error, 'vault', 1);
}

/**
 * Check if error is a DAO terminated error
 */
export function isDaoTerminatedError(error: unknown): boolean {
  return isMoveError(error, 'futarchy_config', 0) || isMoveError(error, 'config_actions', 0);
}

/**
 * Check if error is a proposals disabled error
 */
export function isProposalsDisabledError(error: unknown): boolean {
  return isMoveError(error, 'futarchy_config', 1);
}

/**
 * Check if error is a slippage error
 */
export function isSlippageError(error: unknown): boolean {
  return isMoveError(error, 'unified_spot_pool', 3) || isMoveError(error, 'liquidity_actions', 2);
}
