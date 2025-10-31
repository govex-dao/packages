/**
 * Governance actions for proposal and voting configuration
 *
 * These actions configure governance parameters for the DAO.
 * Can be executed during DAO creation or through governance proposals.
 *
 * Package: futarchy_governance_actions
 * Module: governance_intents
 */

import { bcs } from "@mysten/sui/bcs";
import { InitActionSpec } from "../../types/init-actions";
import { concatBytes, serializeOptionU64, serializeOptionBool } from "./bcs-utils";

/**
 * Governance action builders for voting and proposal configuration
 */
export class GovernanceActions {
    /**
     * Set minimum voting power required to create proposals
     *
     * @param minPower - Minimum voting power (in base units)
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = GovernanceActions.setMinVotingPower(1000n);
     * ```
     */
    static setMinVotingPower(minPower: bigint | number): InitActionSpec {
        const actionData = Array.from(bcs.u64().serialize(BigInt(minPower)).toBytes());

        return {
            actionType: "futarchy_governance_actions::governance_intents::SetMinVotingPower",
            actionData,
        };
    }

    /**
     * Set minimum quorum required for proposals to pass
     *
     * @param quorum - Minimum quorum (in base units)
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = GovernanceActions.setQuorum(10000n);
     * ```
     */
    static setQuorum(quorum: bigint | number): InitActionSpec {
        const actionData = Array.from(bcs.u64().serialize(BigInt(quorum)).toBytes());

        return {
            actionType: "futarchy_governance_actions::governance_intents::SetQuorum",
            actionData,
        };
    }

    /**
     * Update voting period configuration
     *
     * @param params - Voting period parameters
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = GovernanceActions.updateVotingPeriod({
     *     reviewPeriodMs: 86400000, // 1 day
     *     votingPeriodMs: 259200000, // 3 days
     *     executionDelayMs: 86400000 // 1 day
     * });
     * ```
     */
    static updateVotingPeriod(params: {
        reviewPeriodMs?: number;
        votingPeriodMs?: number;
        executionDelayMs?: number;
    }): InitActionSpec {
        const reviewBytes = serializeOptionU64(params.reviewPeriodMs);
        const votingBytes = serializeOptionU64(params.votingPeriodMs);
        const executionBytes = serializeOptionU64(params.executionDelayMs);

        const actionData = concatBytes(reviewBytes, votingBytes, executionBytes);

        return {
            actionType: "futarchy_governance_actions::governance_intents::UpdateVotingPeriod",
            actionData,
        };
    }

    /**
     * Enable or disable delegation
     *
     * @param enabled - True to enable delegation, false to disable
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = GovernanceActions.setDelegationEnabled(true);
     * ```
     */
    static setDelegationEnabled(enabled: boolean): InitActionSpec {
        const actionData = Array.from(bcs.bool().serialize(enabled).toBytes());

        return {
            actionType: "futarchy_governance_actions::governance_intents::SetDelegationEnabled",
            actionData,
        };
    }

    /**
     * Update proposal deposit requirements
     *
     * @param params - Deposit configuration
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = GovernanceActions.updateProposalDeposit({
     *     depositAmount: 1000n,
     *     refundOnPass: true,
     *     refundOnFail: false
     * });
     * ```
     */
    static updateProposalDeposit(params: {
        depositAmount?: bigint | number;
        refundOnPass?: boolean;
        refundOnFail?: boolean;
    }): InitActionSpec {
        const depositBytes = serializeOptionU64(params.depositAmount);
        const refundPassBytes = serializeOptionBool(params.refundOnPass);
        const refundFailBytes = serializeOptionBool(params.refundOnFail);

        const actionData = concatBytes(depositBytes, refundPassBytes, refundFailBytes);

        return {
            actionType: "futarchy_governance_actions::governance_intents::UpdateProposalDeposit",
            actionData,
        };
    }
}
