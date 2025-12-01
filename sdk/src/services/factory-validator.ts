import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { BaseTransactionBuilder, TransactionUtils } from "./transaction";

/**
 * Factory validator operations requiring ValidatorAdminCap
 * These are privileged operations for managing DAO verification and scoring
 */
export class FactoryValidatorOperations {
    private client: SuiClient;
    private factoryPackageId: string;
    private packageRegistryId: string;

    constructor(
        client: SuiClient,
        factoryPackageId: string,
        packageRegistryId: string
    ) {
        this.client = client;
        this.factoryPackageId = factoryPackageId;
        this.packageRegistryId = packageRegistryId;
    }

    /**
     * Approve a DAO verification request
     *
     * @param config - Verification approval configuration
     * @param validatorCapId - ValidatorAdminCap object ID
     * @param clock - Clock object ID
     * @returns Transaction for approving verification
     *
     * @example
     * ```typescript
     * const tx = validatorOps.approveVerification({
     *   daoAccountId: "0xDAO_ID",
     *   verificationId: "0xVERIFICATION_REQUEST_ID",
     *   level: 3, // Gold tier
     *   attestationUrl: "https://govex.io/verification/abc123",
     *   adminReviewText: "KYC completed, team verified, contracts audited"
     * }, validatorCapId);
     * ```
     */
    approveVerification(
        config: {
            daoAccountId: string;
            verificationId: string;
            level: number; // 0-255, higher = more trusted
            attestationUrl: string;
            adminReviewText: string;
        },
        validatorCapId: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.factoryPackageId,
            "factory",
            "approve_verification"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(validatorCapId), // _validator_cap
                tx.object(config.daoAccountId), // target_dao
                tx.object(this.packageRegistryId), // registry
                tx.pure.id(config.verificationId), // verification_id
                tx.pure.u8(config.level), // level
                tx.pure.string(config.attestationUrl), // attestation_url
                tx.pure.string(config.adminReviewText), // admin_review_text
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Reject a DAO verification request
     *
     * @param config - Verification rejection configuration
     * @param validatorCapId - ValidatorAdminCap object ID
     * @param clock - Clock object ID
     * @returns Transaction for rejecting verification
     *
     * @example
     * ```typescript
     * const tx = validatorOps.rejectVerification({
     *   daoAccountId: "0xDAO_ID",
     *   verificationId: "0xVERIFICATION_REQUEST_ID",
     *   reason: "Incomplete documentation, failed KYC checks"
     * }, validatorCapId);
     * ```
     */
    rejectVerification(
        config: {
            daoAccountId: string;
            verificationId: string;
            reason: string;
        },
        validatorCapId: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.factoryPackageId,
            "factory",
            "reject_verification"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(validatorCapId), // _validator_cap
                tx.object(config.daoAccountId), // target_dao
                tx.object(this.packageRegistryId), // registry
                tx.pure.id(config.verificationId), // verification_id
                tx.pure.string(config.reason), // reason
                tx.object(clock), // clock
            ],
        });

        return tx;
    }

    /**
     * Set or update a DAO's quality/reputation score
     * Score is visible to users and affects DAO ranking/visibility
     *
     * @param config - Score configuration
     * @param validatorCapId - ValidatorAdminCap object ID
     * @param clock - Clock object ID
     * @returns Transaction for setting DAO score
     *
     * @example
     * ```typescript
     * const tx = validatorOps.setDaoScore({
     *   daoAccountId: "0xDAO_ID",
     *   score: 85, // 0-100 score
     *   reason: "Active governance, good liquidity, verified team"
     * }, validatorCapId);
     * ```
     */
    setDaoScore(
        config: {
            daoAccountId: string;
            score: number; // 0-18446744073709551615 (u64)
            reason: string;
        },
        validatorCapId: string,
        clock: string = "0x6"
    ): Transaction {
        const builder = new BaseTransactionBuilder(this.client);
        const tx = builder.getTransaction();

        const target = TransactionUtils.buildTarget(
            this.factoryPackageId,
            "factory",
            "set_dao_score"
        );

        tx.moveCall({
            target,
            arguments: [
                tx.object(validatorCapId), // _validator_cap
                tx.object(config.daoAccountId), // target_dao
                tx.object(this.packageRegistryId), // registry
                tx.pure.u64(config.score), // score
                tx.pure.string(config.reason), // reason
                tx.object(clock), // clock
            ],
        });

        return tx;
    }
}
