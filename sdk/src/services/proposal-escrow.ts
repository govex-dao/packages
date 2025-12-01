/**
 * Proposal Escrow Operations
 *
 * Generic per-outcome escrow for proposal deposits with security model
 * preventing cross-outcome theft. Allows depositing coins or objects
 * that are only withdrawable if the specific outcome wins.
 *
 * @module proposal-escrow
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { TransactionUtils } from './transaction';

/**
 * Proposal Escrow operations
 *
 * Per-outcome escrow system for securing deposits based on proposal outcomes.
 * Each outcome can have its own escrow, and deposits can only be withdrawn
 * if that specific outcome wins.
 *
 * Security model:
 * - Each escrow is tied to a specific outcome index
 * - Receipt contains outcome_index and locked_outcome_count
 * - Withdrawal only allowed if proposal is finalized and outcome won
 *
 * @example Create and use escrow
 * ```typescript
 * const tx = new Transaction();
 *
 * // Create escrow for outcome 1 (Accept/Yes) - Note: outcome 0 = Reject/No
 * const [escrow, receipt] = ProposalEscrowOperations.createForOutcomeWithCoin(tx, {
 *   governancePackageId,
 *   proposalId,
 *   outcomeIndex: 1,
 *   depositAmount: 1000000n,
 *   assetType: "0x2::sui::SUI",
 *   stableType,
 * });
 *
 * // Store receipt in proposal
 * ProposalEscrowOperations.storeReceiptInProposal(tx, {
 *   governancePackageId,
 *   proposalId,
 *   outcomeIndex: 1,
 *   assetType: "0x2::sui::SUI",
 *   stableType,
 * }, receipt);
 *
 * // Transfer escrow to shared object
 * tx.transferObjects([escrow], tx.pure.address("0x..."));
 *
 * // Later, after proposal finalized and outcome 1 won:
 * const coins = ProposalEscrowOperations.withdrawAllCoins(tx, {
 *   governancePackageId,
 *   escrowId: "0xescrow...",
 *   proposalId,
 *   outcomeIndex: 1,
 *   assetType: "0x2::sui::SUI",
 *   stableType,
 * });
 * ```
 */
export class ProposalEscrowOperations {
  private client: SuiClient;
  private governancePackageId: string;

  constructor(client: SuiClient, governancePackageId: string) {
    this.client = client;
    this.governancePackageId = governancePackageId;
  }

  /**
   * Create escrow for specific outcome with coin deposit
   *
   * Creates a new ProposalEscrow and EscrowReceipt tied to a specific outcome.
   * The deposited coins can only be withdrawn if this outcome wins.
   *
   * @param tx - Transaction
   * @param config - Escrow configuration
   * @param depositCoin - Coin to deposit (TransactionArgument)
   * @returns TransactionArgument tuple [ProposalEscrow, EscrowReceipt]
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   * const depositCoin = tx.splitCoins(tx.gas, [1000000]);
   *
   * const [escrow, receipt] = ProposalEscrowOperations.createForOutcomeWithCoin(tx, {
   *   governancePackageId,
   *   proposalId: "0x123...",
   *   outcomeIndex: 1, // Accept/Yes (0 = Reject/No)
   *   assetType: "0x2::sui::SUI",
   *   stableType,
   * }, depositCoin);
   * ```
   */
  static createForOutcomeWithCoin(
    tx: Transaction,
    config: {
      governancePackageId: string;
      proposalId: string;
      outcomeIndex: number;
      assetType: string;
      stableType: string;
      clock?: string;
    },
    depositCoin: ReturnType<Transaction['splitCoins']>
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'create_for_outcome_with_coin'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.proposalId), // proposal
        tx.pure.u64(config.outcomeIndex), // outcome_index
        depositCoin, // deposit
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }

  /**
   * Create escrow for specific outcome with object deposit
   *
   * Creates escrow for depositing arbitrary objects (NFTs, etc.) instead of coins.
   *
   * @param tx - Transaction
   * @param config - Escrow configuration
   * @param objectId - Object to deposit
   * @param objectType - Full type of object (e.g., "0x123::nft::MyNFT")
   * @returns TransactionArgument tuple [ProposalEscrow, EscrowReceipt]
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * const [escrow, receipt] = ProposalEscrowOperations.createForOutcomeWithObject(tx, {
   *   governancePackageId,
   *   proposalId,
   *   outcomeIndex: 0,
   *   assetType,
   *   stableType,
   * }, nftObjectId, "0xabc::nft::MyNFT");
   * ```
   */
  static createForOutcomeWithObject(
    tx: Transaction,
    config: {
      governancePackageId: string;
      proposalId: string;
      outcomeIndex: number;
      assetType: string;
      stableType: string;
      clock?: string;
    },
    objectId: string,
    objectType: string
  ): ReturnType<Transaction['moveCall']> {
    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'create_for_outcome_with_object'
      ),
      typeArguments: [config.assetType, config.stableType, objectType],
      arguments: [
        tx.object(config.proposalId), // proposal
        tx.pure.u64(config.outcomeIndex), // outcome_index
        tx.object(objectId), // object
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }

  /**
   * Store escrow receipt in proposal
   *
   * Stores the receipt in the proposal's dynamic fields, keyed by outcome index.
   * This allows later retrieval for withdrawal validation.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @param receipt - EscrowReceipt from create call
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   * const [escrow, receipt] = ProposalEscrowOperations.createForOutcomeWithCoin(...);
   *
   * ProposalEscrowOperations.storeReceiptInProposal(tx, {
   *   governancePackageId,
   *   proposalId,
   *   outcomeIndex: 0,
   *   assetType,
   *   stableType,
   * }, receipt);
   * ```
   */
  static storeReceiptInProposal(
    tx: Transaction,
    config: {
      governancePackageId: string;
      proposalId: string;
      outcomeIndex: number;
      assetType: string;
      stableType: string;
    },
    receipt: ReturnType<Transaction['moveCall']>
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'store_receipt_in_proposal'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.proposalId), // proposal
        tx.pure.u64(config.outcomeIndex), // outcome_index
        receipt, // receipt
      ],
    });
  }

  /**
   * Withdraw partial amount from escrow
   *
   * Withdraws a specific amount using the receipt for validation.
   * Receipt remains valid for future withdrawals.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @param amount - Amount to withdraw
   * @returns TransactionArgument for withdrawn Coin
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * const coin = ProposalEscrowOperations.withdrawPartial(tx, {
   *   governancePackageId,
   *   escrowId: "0xescrow...",
   *   proposalId,
   *   outcomeIndex: 0,
   *   assetType,
   *   stableType,
   *   amount: 500000n,
   * });
   * ```
   */
  static withdrawPartial(
    tx: Transaction,
    config: {
      governancePackageId: string;
      escrowId: string;
      proposalId: string;
      outcomeIndex: number;
      assetType: string;
      stableType: string;
      amount: bigint;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    // Get receipt from proposal
    const receipt = tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'get_receipt_from_proposal'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.proposalId), tx.pure.u64(config.outcomeIndex)],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'withdraw_partial'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.escrowId), // escrow
        tx.object(config.proposalId), // proposal
        receipt, // receipt
        tx.pure.u64(config.amount), // amount
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }

  /**
   * Withdraw all coins from escrow
   *
   * Withdraws entire balance and consumes the receipt.
   * This is the most common withdrawal pattern.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @returns TransactionArgument for withdrawn Coin
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * // Proposal finalized and outcome 0 won
   * const allCoins = ProposalEscrowOperations.withdrawAllCoins(tx, {
   *   governancePackageId,
   *   escrowId: "0xescrow...",
   *   proposalId,
   *   outcomeIndex: 0,
   *   assetType,
   *   stableType,
   * });
   *
   * tx.transferObjects([allCoins], tx.pure.address(recipientAddress));
   * ```
   */
  static withdrawAllCoins(
    tx: Transaction,
    config: {
      governancePackageId: string;
      escrowId: string;
      proposalId: string;
      outcomeIndex: number;
      assetType: string;
      stableType: string;
      clock?: string;
    }
  ): ReturnType<Transaction['moveCall']> {
    // Get receipt from proposal (this removes it from proposal)
    const receipt = tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'get_receipt_from_proposal'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.proposalId), tx.pure.u64(config.outcomeIndex)],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'withdraw_all_coins'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [
        tx.object(config.escrowId), // escrow
        tx.object(config.proposalId), // proposal
        receipt, // receipt (consumed)
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }

  /**
   * Withdraw specific object from escrow
   *
   * Withdraws a specific object (NFT, etc.) using receipt validation.
   *
   * @param tx - Transaction
   * @param config - Configuration
   * @param objectIdToWithdraw - ID of object to withdraw
   * @param objectType - Full type of object
   * @returns TransactionArgument for withdrawn object
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   *
   * const nft = ProposalEscrowOperations.withdrawObject(tx, {
   *   governancePackageId,
   *   escrowId,
   *   proposalId,
   *   outcomeIndex: 0,
   *   assetType,
   *   stableType,
   * }, nftObjectId, "0xabc::nft::MyNFT");
   *
   * tx.transferObjects([nft], tx.pure.address(recipientAddress));
   * ```
   */
  static withdrawObject(
    tx: Transaction,
    config: {
      governancePackageId: string;
      escrowId: string;
      proposalId: string;
      outcomeIndex: number;
      assetType: string;
      stableType: string;
      clock?: string;
    },
    objectIdToWithdraw: string,
    objectType: string
  ): ReturnType<Transaction['moveCall']> {
    // Get receipt from proposal
    const receipt = tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'get_receipt_from_proposal'
      ),
      typeArguments: [config.assetType, config.stableType],
      arguments: [tx.object(config.proposalId), tx.pure.u64(config.outcomeIndex)],
    });

    return tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'withdraw_object'
      ),
      typeArguments: [config.assetType, config.stableType, objectType],
      arguments: [
        tx.object(config.escrowId), // escrow
        tx.object(config.proposalId), // proposal
        receipt, // receipt
        tx.pure.id(objectIdToWithdraw), // object_id
        tx.object(config.clock || '0x6'), // clock
      ],
    });
  }

  /**
   * Destroy empty escrow
   *
   * Cleans up empty escrow object after all withdrawals.
   *
   * @param tx - Transaction
   * @param escrowId - Escrow object ID
   * @param assetType - Asset coin type
   *
   * @example
   * ```typescript
   * const tx = new Transaction();
   * ProposalEscrowOperations.destroyEmpty(tx, escrowId, assetType);
   * ```
   */
  static destroyEmpty(
    tx: Transaction,
    config: {
      governancePackageId: string;
      escrowId: string;
      assetType: string;
    }
  ): void {
    tx.moveCall({
      target: TransactionUtils.buildTarget(
        config.governancePackageId,
        'proposal_escrow',
        'destroy_empty'
      ),
      typeArguments: [config.assetType],
      arguments: [tx.object(config.escrowId)],
    });
  }

  /**
   * Check if proposal has escrow receipt for outcome
   *
   * View function to check if a specific outcome has an escrow receipt.
   *
   * @param proposalId - Proposal object ID
   * @param outcomeIndex - Outcome index to check
   * @param assetType - Asset type
   * @param stableType - Stable type
   * @returns Promise<boolean> - True if receipt exists
   */
  async hasEscrowReceipt(
    proposalId: string,
    outcomeIndex: number,
    assetType: string,
    stableType: string
  ): Promise<boolean> {
    const result = await this.client.devInspectTransactionBlock({
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      transactionBlock: (() => {
        const tx = new Transaction();
        tx.moveCall({
          target: TransactionUtils.buildTarget(
            this.governancePackageId,
            'proposal_escrow',
            'has_escrow_receipt'
          ),
          typeArguments: [assetType, stableType],
          arguments: [tx.object(proposalId), tx.pure.u64(outcomeIndex)],
        });
        return tx;
      })(),
    });

    if (result.results && result.results[0]?.returnValues) {
      const value = result.results[0].returnValues[0];
      return value[0][0] === 1;
    }

    return false;
  }

  /**
   * Get escrow balance
   *
   * View function to get current coin balance in escrow.
   *
   * @param escrowId - Escrow object ID
   * @param assetType - Asset coin type
   * @returns Promise<bigint> - Current balance
   */
  async getBalance(escrowId: string, assetType: string): Promise<bigint> {
    const result = await this.client.devInspectTransactionBlock({
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      transactionBlock: (() => {
        const tx = new Transaction();
        tx.moveCall({
          target: TransactionUtils.buildTarget(
            this.governancePackageId,
            'proposal_escrow',
            'balance'
          ),
          typeArguments: [assetType],
          arguments: [tx.object(escrowId)],
        });
        return tx;
      })(),
    });

    if (result.results && result.results[0]?.returnValues) {
      const value = result.results[0].returnValues[0];
      return BigInt('0x' + Buffer.from(value[0]).toString('hex'));
    }

    return 0n;
  }

  /**
   * Check if escrow is empty
   *
   * View function to check if escrow has no coins or objects.
   *
   * @param escrowId - Escrow object ID
   * @param assetType - Asset coin type
   * @returns Promise<boolean> - True if empty
   */
  async isEmpty(escrowId: string, assetType: string): Promise<boolean> {
    const result = await this.client.devInspectTransactionBlock({
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      transactionBlock: (() => {
        const tx = new Transaction();
        tx.moveCall({
          target: TransactionUtils.buildTarget(
            this.governancePackageId,
            'proposal_escrow',
            'is_empty'
          ),
          typeArguments: [assetType],
          arguments: [tx.object(escrowId)],
        });
        return tx;
      })(),
    });

    if (result.results && result.results[0]?.returnValues) {
      const value = result.results[0].returnValues[0];
      return value[0][0] === 1;
    }

    return false;
  }
}
