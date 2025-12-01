/**
 * Staging Functions
 *
 * Exports staging function generator and utilities.
 *
 * @module core/staging
 */

export {
  getStagingTarget,
  addStagingCall,
  getLaunchpadActionIds,
  getProposalActionIds,
  getAllActionIds,
  isLaunchpadSupported,
  isProposalSupported,
  validateActionsForContext,
  type StagingPackageConfig,
  type StagingCallParams,
  type StagedActionResult,
} from './staging-generator';
