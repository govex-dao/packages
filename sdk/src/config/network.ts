import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";

export type NetworkType = "mainnet" | "testnet" | "devnet" | "localnet";

export interface NetworkConfig {
    network: NetworkType | string;
    url: string;
    client: SuiClient;
}

/**
 * Creates a SuiClient for the specified network
 * @param network - Network type or custom RPC URL
 * @returns NetworkConfig with client, network type, and URL
 */
export function createNetworkConfig(
    network: NetworkType | string
): NetworkConfig {
    const isStandardNetwork =
        network === "mainnet" ||
        network === "testnet" ||
        network === "devnet" ||
        network === "localnet";

    const url = isStandardNetwork
        ? getFullnodeUrl(network as NetworkType)
        : network;

    const client = new SuiClient({ url });

    return {
        network,
        url,
        client,
    };
}
