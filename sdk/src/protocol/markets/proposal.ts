/**
 * Proposal Module
 *
 * Core proposal management for futarchy governance.
 *
 * Lifecycle:
 * 1. PREMARKET - Proposal created, awaiting initialization
 * 2. REVIEW - Market initialized, in review period
 * 3. LIVE - Trading active
 * 4. FINALIZED - Winner determined, ready for execution
 *
 * Key Features:
 * - Multi-outcome prediction markets (2-N outcomes)
 * - TWAP-based resolution
 * - Intent specs for executable actions
 * - Sponsorship system for reduced barriers
 * - Quantum LP management
 *
 * @module proposal
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';

/**
 * Proposal Static Functions
 *
 * Comprehensive proposal lifecycle management.
 */
export class Proposal {
  // ============================================================================
  // Cancel Witness Functions
  // ============================================================================

  static cancelWitnessProposal(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      witness: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'cancel_witness_proposal'),
      arguments: [config.witness],
    });
  }

  static cancelWitnessOutcomeIndex(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      witness: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'cancel_witness_outcome_index'),
      arguments: [config.witness],
    });
  }

  // ============================================================================
  // Creation Functions
  // ============================================================================

  /**
   * Create a PREMARKET proposal without market/escrow/liquidity.
   * ALL governance parameters (review period, trading period, fees, TWAP config, etc.)
   * are now read from DAO config stored in the dao_account.
   *
   * SECURITY NOTE: This prevents governance bypass attacks where callers could
   * previously control critical parameters like review periods and fee rates.
   */
  static newPremarket(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      protocolPackageId: string; // For ActionSpec type
      assetType: string;
      stableType: string;
      daoAccountId: string; // ALL governance config read from here
      treasuryAddress: string;
      title: string;
      introductionDetails: string;
      metadata: string;
      outcomeMessages: string[];
      outcomeDetails: string[];
      proposer: string;
      usedQuota: boolean;
      feePayment: ReturnType<Transaction['moveCall']> | ReturnType<Transaction['splitCoins']>; // Coin<StableType> for proposal fee
      intentSpecForYes?: ReturnType<Transaction['moveCall']>; // Option<vector<ActionSpec>>
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    // Create Option::None for intent_spec_for_yes if not provided
    const intentSpec = config.intentSpecForYes || tx.moveCall({
      target: '0x1::option::none',
      typeArguments: [`vector<${config.protocolPackageId}::intents::ActionSpec>`],
      arguments: [],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'new_premarket'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.daoAccountId),
        tx.pure.address(config.treasuryAddress),
        tx.pure.string(config.title),
        tx.pure.string(config.introductionDetails),
        tx.pure.string(config.metadata),
        tx.pure.vector('string', config.outcomeMessages),
        tx.pure.vector('string', config.outcomeDetails),
        tx.pure.address(config.proposer),
        tx.pure.bool(config.usedQuota),
        config.feePayment,
        intentSpec,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static createEscrowForMarket(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'create_escrow_for_market'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.object(config.clock || '0x6')],
    });
  }

  static registerOutcomeCapsWithEscrow(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      assetConditionalCoin: string;
      stableConditionalCoin: string;
      proposal: ReturnType<Transaction['moveCall']>;
      assetTreasuryCap: ReturnType<Transaction['moveCall']>;
      stableTreasuryCap: ReturnType<Transaction['moveCall']>;
      assetMetadata: ReturnType<Transaction['moveCall']>;
      stableMetadata: ReturnType<Transaction['moveCall']>;
      outcomeIdx: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'register_outcome_caps_with_escrow'),
      typeArguments: [config.assetType, config.stableType, config.assetConditionalCoin, config.stableConditionalCoin],
      arguments: [
        config.proposal,
        config.assetTreasuryCap,
        config.stableTreasuryCap,
        config.assetMetadata,
        config.stableMetadata,
        tx.pure.u64(config.outcomeIdx),
      ],
    });
  }

  static createConditionalAmmPools(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      initialAsset: ReturnType<Transaction['moveCall']>;
      initialStable: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'create_conditional_amm_pools'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.initialAsset,
        config.initialStable,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static addOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      conditionalCoinConfig: ReturnType<Transaction['moveCall']>;
      proposal: ReturnType<Transaction['moveCall']>;
      message: string;
      assetAmount: bigint;
      stableAmount: bigint;
      creatorFee: bigint;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'add_outcome'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.conditionalCoinConfig,
        config.proposal,
        tx.pure.string(config.message),
        tx.pure.u64(config.assetAmount),
        tx.pure.u64(config.stableAmount),
        tx.pure.u64(config.creatorFee),
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static addOutcomeWithFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      conditionalCoinConfig: ReturnType<Transaction['moveCall']>;
      proposal: ReturnType<Transaction['moveCall']>;
      message: string;
      assetAmount: bigint;
      stableAmount: bigint;
      creatorFee: bigint;
      feeManager: ReturnType<Transaction['moveCall']>;
      payment: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'add_outcome_with_fee'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.conditionalCoinConfig,
        config.proposal,
        tx.pure.string(config.message),
        tx.pure.u64(config.assetAmount),
        tx.pure.u64(config.stableAmount),
        tx.pure.u64(config.creatorFee),
        config.feeManager,
        config.payment,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static initializeMarketFields(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'initialize_market_fields'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.object(config.clock || '0x6')],
    });
  }

  static emitMarketInitialized(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      proposalId: string;
      escrowId: string;
      ammPoolIds: string[];
      marketStateId: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'emit_market_initialized'),
      arguments: [
        tx.object(config.proposalId),
        tx.object(config.escrowId),
        tx.pure.vector('address', config.ammPoolIds),
        tx.object(config.marketStateId),
      ],
    });
  }

  static takeFeeEscrow(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'take_fee_escrow'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  // ============================================================================
  // TWAP Functions
  // ============================================================================

  static getTwapsForProposal(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      spotPool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_twaps_for_proposal'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.spotPool,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static calculateCurrentWinnerByPrice(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      prices: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'calculate_current_winner_by_price'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, config.prices],
    });
  }

  static calculateCurrentWinner(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      spotPool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'calculate_current_winner'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.spotPool,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static getTwapPrices(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_twap_prices'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getLastTwapUpdate(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_last_twap_update'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getTwapByOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_twap_by_outcome'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static getWinningTwap(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_winning_twap'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  // ============================================================================
  // State Functions
  // ============================================================================

  static isFinalized(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'is_finalized'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static state(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'state'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static isLive(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'is_live'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getWinningOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_winning_outcome'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static isWinningOutcomeSet(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'is_winning_outcome_set'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static advanceState(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      spotPool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'advance_state'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.spotPool,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  static setState(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      newState: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'set_state'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.newState)],
    });
  }

  static setTwapPrices(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      prices: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'set_twap_prices'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, config.prices],
    });
  }

  static setLastTwapUpdate(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      timestamp: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'set_last_twap_update'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u64(config.timestamp)],
    });
  }

  static setWinningOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'set_winning_outcome'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static finalizeProposal(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      spotPool: ReturnType<Transaction['moveCall']>;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'finalize_proposal'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        config.spotPool,
        tx.object(config.clock || '0x6'),
      ],
    });
  }

  // ============================================================================
  // Metadata/Info Functions (Continued in next section due to length)
  // ============================================================================

  static treasuryAddress(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'treasury_address'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getId(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_id'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static escrowId(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'escrow_id'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static marketStateId(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'market_state_id'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getMarketInitializedAt(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_market_initialized_at'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static outcomeCount(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'outcome_count'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getNumOutcomes(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_num_outcomes'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static proposer(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'proposer'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static createdAt(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'created_at'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getMetadata(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_metadata'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getIntroductionDetails(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_introduction_details'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getAmmPoolIds(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_amm_pool_ids'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getState(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_state'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getDaoId(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_dao_id'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static proposalId(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'proposal_id'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getCreatedAt(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_created_at'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getReviewPeriodMs(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_review_period_ms'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getTradingPeriodMs(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_trading_period_ms'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getTwapThreshold(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_twap_threshold'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getTwapStartDelay(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_twap_start_delay'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getTwapInitialObservation(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_twap_initial_observation'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getTwapStepMax(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_twap_step_max'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getAmmTotalFeeBps(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_amm_total_fee_bps'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getMarketInitParams(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_market_init_params'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getOutcomeCreators(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_outcome_creators'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getOutcomeCreator(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_outcome_creator'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static getOutcomeCreatorFee(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_outcome_creator_fee'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static getOutcomeCreatorFees(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_outcome_creator_fees'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getLiquidityProvider(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_liquidity_provider'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getProposer(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_proposer'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getUsedQuota(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_used_quota'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static isWithdrawOnly(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'is_withdraw_only'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static setWithdrawOnlyMode(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      mode: boolean;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'set_withdraw_only_mode'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.bool(config.mode)],
    });
  }

  static getOutcomeMessages(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_outcome_messages'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  // ============================================================================
  // Intent Spec Functions
  // ============================================================================

  static getIntentSpecForOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_intent_spec_for_outcome'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static takeIntentSpecForOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'take_intent_spec_for_outcome'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static makeCancelWitness(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'make_cancel_witness'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static setIntentSpecForOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
      intentSpec: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'set_intent_spec_for_outcome'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx), config.intentSpec],
    });
  }

  static hasIntentSpec(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'has_intent_spec'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static getActionsForOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_actions_for_outcome'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static clearIntentSpecForOutcome(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'clear_intent_spec_for_outcome'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal, tx.pure.u8(config.outcomeIdx)],
    });
  }

  static emitOutcomeMutated(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      proposalId: string;
      outcomeIdx: number;
      numActions: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'emit_outcome_mutated'),
      arguments: [
        tx.object(config.proposalId),
        tx.pure.u8(config.outcomeIdx),
        tx.pure.u64(config.numActions),
      ],
    });
  }

  static setOutcomeCreator(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      outcomeIdx: number;
      creator: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'set_outcome_creator'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        tx.pure.u8(config.outcomeIdx),
        tx.pure.address(config.creator),
      ],
    });
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  static id(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'id'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static idAddress(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'id_address'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  // ============================================================================
  // Sponsorship Functions
  // ============================================================================

  static getSponsoredBy(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_sponsored_by'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getSponsorThresholdReduction(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_sponsor_threshold_reduction'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static isSponsored(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'is_sponsored'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static setSponsorship(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
      sponsor: string;
      thresholdReduction: bigint;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'set_sponsorship'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        config.proposal,
        tx.pure.address(config.sponsor),
        tx.pure.u64(config.thresholdReduction),
      ],
    });
  }

  static clearSponsorship(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'clear_sponsorship'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }

  static getEffectiveTwapThreshold(
    tx: Transaction,
    config: {
      marketsCorePackageId: string;
      assetType: string;
      stableType: string;
      proposal: ReturnType<Transaction['moveCall']>;
    }
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.marketsCorePackageId, 'proposal', 'get_effective_twap_threshold'),
      typeArguments: [config.assetType, config.stableType],
      arguments: [config.proposal],
    });
  }
}
