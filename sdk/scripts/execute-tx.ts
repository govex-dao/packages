/**
 * Generic script to execute SDK transactions
 *
 * This script provides utilities to:
 * - Load the SDK with deployment config
 * - Get the active Sui address from CLI
 * - Sign and execute transactions
 * - Handle results and errors
 */

import { FutarchySDK } from '../src/sdk/FutarchySDK';
import { TransactionUtils } from '../src/lib/transaction';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ===== Configuration =====

export type Network = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

export interface ExecuteConfig {
    network: Network;
    showEffects?: boolean;
    showObjectChanges?: boolean;
    showEvents?: boolean;
    dryRun?: boolean; // If true, only dry run. If false, actually execute
}

// ===== Utilities =====

/**
 * Get active address from Sui CLI
 */
export function getActiveAddress(): string {
    return execSync('sui client active-address', { encoding: 'utf8' }).trim();
}

/**
 * Get active environment from Sui CLI
 */
export function getActiveEnv(): Network {
    return execSync('sui client active-env', { encoding: 'utf8' }).trim() as Network;
}

/**
 * Load deployments config
 */
export function loadDeployments(): any {
    const deploymentsPath = path.join(__dirname, '../../deployments-processed/_all-packages.json');
    const data = fs.readFileSync(deploymentsPath, 'utf8');
    return JSON.parse(data);
}

/**
 * Load test coins info (non-shared TreasuryCaps with owned CoinMetadata for launchpad testing)
 */
export function loadTestCoins(): {
    asset: { packageId: string; type: string; treasuryCap: string; metadata: string };
    stable: { packageId: string; type: string; treasuryCap: string; metadata: string };
} {
    return {
        asset: {
            packageId: '0x12b868400ecd6a97183d11ffefaa2ba0863bb30d0567f5c37be326b1139fc2a3',
            type: '0x12b868400ecd6a97183d11ffefaa2ba0863bb30d0567f5c37be326b1139fc2a3::coin::COIN',
            treasuryCap: '0x802e1b01c7fdbf8f9cabf4fd261533273f959038de5b62acd6e154c8800c1029',
            metadata: '0x0ac45f34e44473e570ad3eeed92680452f4b5110883ed492840730567844f15b',
        },
        stable: {
            packageId: '0x3aaa86858931d542e56f0b58e24f21e8fc30671d026d057d335a2ebc559ff71c',
            type: '0x3aaa86858931d542e56f0b58e24f21e8fc30671d026d057d335a2ebc559ff71c::coin::COIN',
            treasuryCap: '0x96c964b1c62c291f35df8d7c2766aedf690002202cfef7ac614c3fa34c35e6e6',
            metadata: '0x55576fd4cfe8cd4e0d64e3931aef0232863ae9ce43ab1e80d406ecd109afd16b',
        },
    };
}

/**
 * Initialize SDK with current network
 */
export async function initSDK(network?: Network): Promise<FutarchySDK> {
    const deployments = loadDeployments();
    const actualNetwork = network || getActiveEnv();

    console.log(`🚀 Initializing SDK on ${actualNetwork}...`);

    const sdk = await FutarchySDK.init({
        network: actualNetwork,
        deployments,
    });

    console.log(`✅ SDK initialized`);
    console.log(`   Network: ${sdk.network.network}`);
    console.log(`   RPC: ${sdk.network.url}`);

    return sdk;
}

/**
 * Execute a transaction using Sui CLI
 * This method doesn't require managing keypairs - uses whatever is active in sui CLI
 */
export async function executeTransaction(
    sdk: FutarchySDK,
    tx: Transaction,
    config: ExecuteConfig = { network: 'devnet', showEffects: true, showObjectChanges: true, showEvents: true, dryRun: false }
): Promise<any> {
    const sender = getActiveAddress();
    console.log(`\n📝 ${config.dryRun ? 'Dry running' : 'Executing'} transaction...`);
    console.log(`   Sender: ${sender}`);

    try {
        // Set the sender on the transaction
        tx.setSender(sender);

        if (config.dryRun) {
            // Serialize the transaction for dry run
            const serializedTx = await tx.build({ client: sdk.client });

            const result = await sdk.client.dryRunTransactionBlock({
                transactionBlock: serializedTx,
            });

            console.log('\n✅ Dry run successful!');
            console.log('   Status:', result.effects.status.status);

            if (result.effects.status.status === 'failure') {
                console.log('\n❌ Transaction would fail with error:');
                console.log(JSON.stringify(result.effects.status, null, 2));
                throw new Error(`Transaction dry run failed: ${JSON.stringify(result.effects.status.error)}`);
            }

            return {
                success: true,
                dryRun: result,
                transaction: tx,
                note: 'Dry run completed. To execute for real, set dryRun: false',
            };
        } else {
            // Actually execute the transaction
            console.log('\n⚡ Executing transaction on-chain FOR REAL...');
            console.log('   💦 SQUIRTING AWAY...\n');

            // Get keypair from sui config
            const suiConfigPath = path.join(require('os').homedir(), '.sui', 'sui_config', 'client.yaml');
            const configYaml = fs.readFileSync(suiConfigPath, 'utf8');

            // Extract keystore path
            const keystoreMatch = configYaml.match(/keystore:\s*\n\s*File:\s*(.+)/);
            if (!keystoreMatch) {
                throw new Error('Could not find keystore path in sui config');
            }

            const keystorePath = keystoreMatch[1].trim().replace('~', require('os').homedir());
            const keystore = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));

            // Find the keypair for the active address
            const activeAddress = sender;
            let privateKeyBase64: string | null = null;

            for (const key of keystore) {
                try {
                    const keypair = Ed25519Keypair.fromSecretKey(Buffer.from(key, 'base64').slice(1));
                    if (keypair.getPublicKey().toSuiAddress() === activeAddress) {
                        privateKeyBase64 = key;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!privateKeyBase64) {
                throw new Error(`Could not find keypair for address ${activeAddress}`);
            }

            const keypair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKeyBase64, 'base64').slice(1));

            const result = await sdk.client.signAndExecuteTransaction({
                transaction: tx,
                signer: keypair,
                options: {
                    showEffects: config.showEffects,
                    showObjectChanges: config.showObjectChanges,
                    showEvents: config.showEvents,
                },
            });

            if (result.effects?.status?.status === 'success') {
                console.log('\n✅ Transaction executed successfully!');
                console.log(`   Digest: ${result.digest}`);

                if (config.showObjectChanges && result.objectChanges) {
                    console.log(`\n📦 Object Changes:`);
                    result.objectChanges.forEach((change: any) => {
                        if (change.type === 'created') {
                            console.log(`   Created: ${change.objectType}`);
                            console.log(`     ID: ${change.objectId}`);
                        } else if (change.type === 'mutated') {
                            console.log(`   Mutated: ${change.objectType}`);
                            console.log(`     ID: ${change.objectId}`);
                        } else if (change.type === 'transferred') {
                            console.log(`   Transferred to: ${change.recipient.AddressOwner || change.recipient}`);
                            console.log(`     ID: ${change.objectId}`);
                        }
                    });
                }

                if (config.showEvents && result.events && result.events.length > 0) {
                    console.log(`\n📢 Events:`);
                    result.events.forEach((event: any) => {
                        console.log(`   ${event.type}`);
                        console.log(`   ${JSON.stringify(event.parsedJson, null, 2)}`);
                    });
                }

                return result;
            } else {
                console.error('\n❌ Transaction failed:', result.effects?.status);
                throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
            }
        }
    } catch (error) {
        console.error('\n❌ Transaction failed:', error);

        // Try to print more details if available
        if ((error as any).cause?.effects?.status) {
            console.error('\nStatus:', JSON.stringify((error as any).cause.effects.status, null, 2));
        }

        throw error;
    }
}

/**
 * Execute with keypair (if available)
 * WARNING: Only use with test keypairs, never production keys!
 */
export async function executeTransactionWithKeypair(
    sdk: FutarchySDK,
    tx: Transaction,
    keypair: Ed25519Keypair,
    config: ExecuteConfig = { network: 'devnet', showEffects: true, showObjectChanges: true, showEvents: true }
): Promise<any> {
    console.log(`\n📝 Executing transaction with keypair...`);
    console.log(`   Sender: ${keypair.getPublicKey().toSuiAddress()}`);

    try {
        const result = await sdk.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEffects: config.showEffects,
                showObjectChanges: config.showObjectChanges,
                showEvents: config.showEvents,
            },
        });

        if (result.effects?.status?.status === 'success') {
            console.log('\n✅ Transaction successful!');
            console.log(`   Digest: ${result.digest}`);

            if (config.showObjectChanges && result.objectChanges) {
                console.log(`\n📦 Object Changes:`);
                result.objectChanges.forEach((change: any) => {
                    if (change.type === 'created') {
                        console.log(`   Created: ${change.objectType}`);
                        console.log(`     ID: ${change.objectId}`);
                    }
                });
            }

            if (config.showEvents && result.events && result.events.length > 0) {
                console.log(`\n📢 Events:`);
                result.events.forEach((event: any) => {
                    console.log(`   ${event.type}`);
                    console.log(`   ${JSON.stringify(event.parsedJson, null, 2)}`);
                });
            }

            return result;
        } else {
            console.error('\n❌ Transaction failed:', result.effects?.status);
            throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
        }
    } catch (error) {
        console.error('\n❌ Transaction execution failed:', error);
        throw error;
    }
}

/**
 * Pretty print transaction for debugging
 */
export function printTransaction(tx: Transaction): void {
    console.log('\n📋 Transaction Details:');
    console.log(JSON.stringify(tx, null, 2));
}

/**
 * Helper to wait for transaction confirmation
 */
export async function waitForTransaction(sdk: FutarchySDK, digest: string): Promise<any> {
    console.log(`\n⏳ Waiting for transaction ${digest}...`);
    const result = await sdk.client.waitForTransaction({
        digest,
        options: {
            showEffects: true,
            showObjectChanges: true,
            showEvents: true,
        },
    });
    console.log('✅ Transaction confirmed');
    return result;
}

// ===== Export everything =====
export default {
    getActiveAddress,
    getActiveEnv,
    loadDeployments,
    loadTestCoins,
    initSDK,
    executeTransaction,
    executeTransactionWithKeypair,
    printTransaction,
    waitForTransaction,
};
