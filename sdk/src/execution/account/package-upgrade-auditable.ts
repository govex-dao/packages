/**
 * Package Upgrade Auditable Account Actions
 *
 * Enhanced auditable upgrade proposal with source verification.
 * Provides comprehensive audit metadata for package upgrades including source code verification,
 * build verification, audit trails, and verifier attestations.
 *
 * @module package-upgrade-auditable
 */

import { Transaction } from '@mysten/sui/transactions';
import { TransactionUtils } from '../../services/transaction';
import { hexToBytes } from '../../utils/hex';

/**
 * Package Upgrade Auditable Account Action Builders
 *
 * Static utilities for building auditable upgrade actions with comprehensive audit metadata.
 *
 * @example Create and manage auditable upgrade proposal
 * ```typescript
 * const tx = new Transaction();
 *
 * // Propose upgrade with audit metadata
 * PackageUpgradeAuditable.proposeAuditableUpgrade(tx, {
 *   accountActionsPackageId,
 * }, auth, account, registry, packageName, bytecodeDigest, auditMetadata, executionTimeMs, clock);
 *
 * // Add verifier attestation
 * PackageUpgradeAuditable.addVerifierAttestation(tx, {
 *   accountActionsPackageId,
 * }, auth, account, registry, packageName, bytecodeDigest, signature, clock);
 *
 * // Get full audit metadata
 * const metadata = PackageUpgradeAuditable.getAuditMetadata(tx, {
 *   accountActionsPackageId,
 * }, account, registry, packageName, bytecodeDigest);
 *
 * // Create audit metadata
 * const auditMetadata = PackageUpgradeAuditable.newAuditMetadata(tx, {
 *   accountActionsPackageId,
 * }, sourceCodeHash, moveTomlHash, compilerVersion, buildTimestampMs, dependenciesHash,
 *   gitCommitHash, githubReleaseTag, auditReportUrl);
 * ```
 */
export class PackageUpgradeAuditable {
  // ============================================================================
  // PROPOSAL (1)
  // ============================================================================

  /**
   * Propose upgrade with full audit trail
   * Creates an auditable upgrade proposal with comprehensive verification metadata.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The name of the package to upgrade
   * @param bytecodeDigest - The bytecode digest to verify against
   * @param auditMetadata - The comprehensive audit metadata for the upgrade
   * @param executionTimeMs - The execution time in milliseconds
   * @param clock - The clock object
   */
  static proposeAuditableUpgrade(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: string | ReturnType<Transaction['moveCall']>,
    bytecodeDigest: string | ReturnType<Transaction['moveCall']>,
    auditMetadata: ReturnType<Transaction['moveCall']>,
    executionTimeMs: bigint | string | ReturnType<Transaction['moveCall']>,
    clock: string | ReturnType<Transaction['moveCall']>
  ): void {
    // Handle package name - if string, convert to pure string
    const packageNameArg = typeof packageName === 'string' ? tx.pure.string(packageName) : packageName;

    // Handle bytecode digest - if string, convert to pure vector<u8>
    const bytecodeDigestArg =
      typeof bytecodeDigest === 'string' ? tx.pure.vector('u8', hexToBytes(bytecodeDigest)) : bytecodeDigest;

    // Handle execution time - if string/bigint, convert to pure u64
    const executionTimeArg =
      typeof executionTimeMs === 'string' || typeof executionTimeMs === 'bigint' ? tx.pure.u64(executionTimeMs) : executionTimeMs;

    // Handle clock - if string, wrap with tx.object()
    const clockArg = typeof clock === 'string' ? tx.object(clock) : clock;

    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade_auditable', 'propose_auditable_upgrade'),
      arguments: [auth, account, registry, packageNameArg, bytecodeDigestArg, auditMetadata, executionTimeArg, clockArg],
    });
  }

  // ============================================================================
  // ATTESTATION (1)
  // ============================================================================

  /**
   * Add independent verifier attestation
   * Allows an independent verifier to add their signature attestation to an upgrade proposal.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param auth - The authentication witness
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The name of the package
   * @param bytecodeDigest - The bytecode digest of the proposal
   * @param signature - The verifier's signature over the digest
   * @param clock - The clock object
   */
  static addVerifierAttestation(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    auth: ReturnType<Transaction['moveCall']>,
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: string | ReturnType<Transaction['moveCall']>,
    bytecodeDigest: string | ReturnType<Transaction['moveCall']>,
    signature: string | ReturnType<Transaction['moveCall']>,
    clock: string | ReturnType<Transaction['moveCall']>
  ): void {
    // Handle package name - if string, convert to pure string
    const packageNameArg = typeof packageName === 'string' ? tx.pure.string(packageName) : packageName;

    // Handle bytecode digest - if string, convert to pure vector<u8>
    const bytecodeDigestArg =
      typeof bytecodeDigest === 'string' ? tx.pure.vector('u8', hexToBytes(bytecodeDigest)) : bytecodeDigest;

    // Handle signature - if string, convert to pure vector<u8>
    const signatureArg =
      typeof signature === 'string' ? tx.pure.vector('u8', hexToBytes(signature)) : signature;

    // Handle clock - if string, wrap with tx.object()
    const clockArg = typeof clock === 'string' ? tx.object(clock) : clock;

    tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade_auditable', 'add_verifier_attestation'),
      arguments: [auth, account, registry, packageNameArg, bytecodeDigestArg, signatureArg, clockArg],
    });
  }

  // ============================================================================
  // RETRIEVAL (1)
  // ============================================================================

  /**
   * Get full audit metadata for proposal
   * Retrieves the comprehensive audit metadata associated with an upgrade proposal.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param account - The account object
   * @param registry - The package registry object
   * @param packageName - The name of the package
   * @param bytecodeDigest - The bytecode digest of the proposal
   * @returns The audit metadata
   */
  static getAuditMetadata(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    account: ReturnType<Transaction['moveCall']>,
    registry: ReturnType<Transaction['moveCall']>,
    packageName: string | ReturnType<Transaction['moveCall']>,
    bytecodeDigest: string | ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    // Handle package name - if string, convert to pure string
    const packageNameArg = typeof packageName === 'string' ? tx.pure.string(packageName) : packageName;

    // Handle bytecode digest - if string, convert to pure vector<u8>
    const bytecodeDigestArg =
      typeof bytecodeDigest === 'string' ? tx.pure.vector('u8', hexToBytes(bytecodeDigest)) : bytecodeDigest;

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade_auditable', 'get_audit_metadata'),
      arguments: [account, registry, packageNameArg, bytecodeDigestArg],
    });
  }

  // ============================================================================
  // METADATA CONSTRUCTION (1)
  // ============================================================================

  /**
   * Create audit metadata
   * Helper function to construct audit metadata for testing and scripts.
   * @param tx - Transaction instance
   * @param config - Configuration object
   * @param config.accountActionsPackageId - The account actions package ID
   * @param sourceCodeHash - SHA256 of all source files
   * @param moveTomlHash - SHA256 of Move.toml
   * @param compilerVersion - Compiler version (e.g., "sui-move 1.18.0")
   * @param buildTimestampMs - When built (milliseconds)
   * @param dependenciesHash - Hash of all dependency versions
   * @param gitCommitHash - Git SHA of source
   * @param githubReleaseTag - GitHub release tag (e.g., "v3.0.0")
   * @param auditReportUrl - Link to audit report
   * @returns The constructed audit metadata
   */
  static newAuditMetadata(
    tx: Transaction,
    config: {
      accountActionsPackageId: string;
    },
    sourceCodeHash: string | ReturnType<Transaction['moveCall']>,
    moveTomlHash: string | ReturnType<Transaction['moveCall']>,
    compilerVersion: string | ReturnType<Transaction['moveCall']>,
    buildTimestampMs: bigint | string | ReturnType<Transaction['moveCall']>,
    dependenciesHash: string | ReturnType<Transaction['moveCall']>,
    gitCommitHash: string | ReturnType<Transaction['moveCall']>,
    githubReleaseTag: string | ReturnType<Transaction['moveCall']>,
    auditReportUrl: string | ReturnType<Transaction['moveCall']>
  ): ReturnType<Transaction['moveCall']> {
    // Handle source code hash - if string, convert to pure vector<u8>
    const sourceCodeHashArg =
      typeof sourceCodeHash === 'string' ? tx.pure.vector('u8', hexToBytes(sourceCodeHash)) : sourceCodeHash;

    // Handle move toml hash - if string, convert to pure vector<u8>
    const moveTomlHashArg =
      typeof moveTomlHash === 'string' ? tx.pure.vector('u8', hexToBytes(moveTomlHash)) : moveTomlHash;

    // Handle compiler version - if string, convert to pure string
    const compilerVersionArg = typeof compilerVersion === 'string' ? tx.pure.string(compilerVersion) : compilerVersion;

    // Handle build timestamp - if string/bigint, convert to pure u64
    const buildTimestampArg =
      typeof buildTimestampMs === 'string' || typeof buildTimestampMs === 'bigint'
        ? tx.pure.u64(buildTimestampMs)
        : buildTimestampMs;

    // Handle dependencies hash - if string, convert to pure vector<u8>
    const dependenciesHashArg =
      typeof dependenciesHash === 'string' ? tx.pure.vector('u8', hexToBytes(dependenciesHash)) : dependenciesHash;

    // Handle git commit hash - if string, convert to pure string
    const gitCommitHashArg = typeof gitCommitHash === 'string' ? tx.pure.string(gitCommitHash) : gitCommitHash;

    // Handle github release tag - if string, convert to pure string
    const githubReleaseTagArg = typeof githubReleaseTag === 'string' ? tx.pure.string(githubReleaseTag) : githubReleaseTag;

    // Handle audit report url - if string, convert to pure string
    const auditReportUrlArg = typeof auditReportUrl === 'string' ? tx.pure.string(auditReportUrl) : auditReportUrl;

    return tx.moveCall({
      target: TransactionUtils.buildTarget(config.accountActionsPackageId, 'package_upgrade_auditable', 'new_audit_metadata'),
      arguments: [
        sourceCodeHashArg,
        moveTomlHashArg,
        compilerVersionArg,
        buildTimestampArg,
        dependenciesHashArg,
        gitCommitHashArg,
        githubReleaseTagArg,
        auditReportUrlArg,
      ],
    });
  }
}
