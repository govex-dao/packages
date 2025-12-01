/**
 * Errors Module
 *
 * Exports error mapping and translation functions.
 *
 * @module core/errors
 */

export {
  // Error codes
  MOVE_ERROR_CODES,

  // Error class
  SDKMoveError,

  // Translation
  translateMoveError,
  withErrorTranslation,

  // Helpers
  isMoveError,
  isInsufficientBalanceError,
  isDaoTerminatedError,
  isProposalsDisabledError,
  isSlippageError,
} from './error-mapping';
