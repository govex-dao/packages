import { SuiClient, SuiObjectResponse, SuiEventFilter } from "@mysten/sui/client";

/**
 * Query utilities for reading on-chain data
 */
export class QueryHelper {
    private client: SuiClient;

    constructor(client: SuiClient) {
        this.client = client;
    }

    /**
     * Get an object with full content
     */
    async getObject(objectId: string): Promise<SuiObjectResponse> {
        return this.client.getObject({
            id: objectId,
            options: {
                showContent: true,
                showOwner: true,
                showType: true,
                showDisplay: true,
            },
        });
    }

    /**
     * Get multiple objects
     */
    async getObjects(objectIds: string[]): Promise<SuiObjectResponse[]> {
        return this.client.multiGetObjects({
            ids: objectIds,
            options: {
                showContent: true,
                showOwner: true,
                showType: true,
            },
        });
    }

    /**
     * Get objects owned by an address
     */
    async getOwnedObjects(address: string, filter?: { StructType: string }) {
        return this.client.getOwnedObjects({
            owner: address,
            filter,
            options: {
                showContent: true,
                showType: true,
            },
        });
    }

    /**
     * Get dynamic fields of an object
     */
    async getDynamicFields(parentObjectId: string) {
        return this.client.getDynamicFields({
            parentId: parentObjectId,
        });
    }

    /**
     * Get a dynamic field object
     */
    async getDynamicFieldObject(parentObjectId: string, name: any) {
        return this.client.getDynamicFieldObject({
            parentId: parentObjectId,
            name,
        });
    }

    /**
     * Query events by type
     */
    async queryEvents(query: SuiEventFilter) {
        return this.client.queryEvents({
            query,
        });
    }

    /**
     * Helper: Extract field value from object content
     */
    extractField<T = any>(
        object: SuiObjectResponse,
        fieldPath: string
    ): T | undefined {
        if (!object.data?.content || object.data.content.dataType !== "moveObject") {
            return undefined;
        }

        const fields = object.data.content.fields as any;
        const parts = fieldPath.split(".");

        let current = fields;
        for (const part of parts) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[part];
        }

        return current as T;
    }

    /**
     * Helper: Get all DAOs from Factory events
     */
    async getDAOsCreatedByAddress(
        factoryPackageId: string,
        creator: string
    ): Promise<any[]> {
        const eventType = `${factoryPackageId}::factory::DAOCreated`;

        const response = await this.queryEvents({
            MoveEventType: eventType,
        });

        // Filter by creator
        return response.data
            .filter((event) => {
                const parsedJson = event.parsedJson as any;
                return parsedJson?.creator === creator;
            })
            .map((event) => event.parsedJson);
    }

    /**
     * Helper: Get all DAOs from Factory
     */
    async getAllDAOs(factoryPackageId: string): Promise<any[]> {
        const eventType = `${factoryPackageId}::factory::DAOCreated`;

        const response = await this.queryEvents({
            MoveEventType: eventType,
        });

        return response.data.map((event) => event.parsedJson);
    }

    /**
     * Get DAO (Account) object
     */
    async getDAO(accountId: string): Promise<SuiObjectResponse> {
        return this.getObject(accountId);
    }

    /**
     * Get proposal object
     */
    async getProposal(proposalId: string): Promise<SuiObjectResponse> {
        return this.getObject(proposalId);
    }

    /**
     * Get market object
     */
    async getMarket(marketId: string): Promise<SuiObjectResponse> {
        return this.getObject(marketId);
    }

    /**
     * Get user's token balance
     */
    async getBalance(address: string, coinType: string) {
        return this.client.getBalance({
            owner: address,
            coinType,
        });
    }

    /**
     * Get all coin balances for an address
     */
    async getAllBalances(address: string) {
        return this.client.getAllBalances({
            owner: address,
        });
    }

    // ===== Launchpad Queries =====

    /**
     * Get all raises from events
     */
    async getAllRaises(factoryPackageId: string): Promise<any[]> {
        const eventType = `${factoryPackageId}::launchpad::RaiseCreated`;

        const response = await this.queryEvents({
            MoveEventType: eventType,
        });

        return response.data.map((event) => event.parsedJson);
    }

    /**
     * Get raises created by a specific address
     */
    async getRaisesByCreator(
        factoryPackageId: string,
        creator: string
    ): Promise<any[]> {
        const allRaises = await this.getAllRaises(factoryPackageId);
        return allRaises.filter((raise: any) => raise.creator === creator);
    }

    /**
     * Get Raise object details
     */
    async getRaise(raiseId: string): Promise<SuiObjectResponse> {
        return this.getObject(raiseId);
    }

    /**
     * Get contribution events for a raise
     */
    async getContributions(
        factoryPackageId: string,
        raiseId: string
    ): Promise<any[]> {
        const eventType = `${factoryPackageId}::launchpad::ContributionAdded`;

        const response = await this.queryEvents({
            MoveEventType: eventType,
        });

        return response.data
            .map((event) => event.parsedJson)
            .filter((event: any) => event.raise_id === raiseId);
    }

    /**
     * Get contributions by a specific contributor
     */
    async getContributionsByAddress(
        factoryPackageId: string,
        contributor: string
    ): Promise<any[]> {
        const eventType = `${factoryPackageId}::launchpad::ContributionAdded`;

        const response = await this.queryEvents({
            MoveEventType: eventType,
        });

        return response.data
            .map((event) => event.parsedJson)
            .filter((event: any) => event.contributor === contributor);
    }

    /**
     * Get contribution for a specific user in a specific raise
     */
    async getUserContribution(
        raiseId: string,
        contributor: string
    ): Promise<any | null> {
        try {
            // The contribution is stored as a dynamic field
            const contributorKey = {
                type: "ContributorKey",
                value: { contributor },
            };

            const contribution = await this.getDynamicFieldObject(
                raiseId,
                contributorKey
            );

            return contribution;
        } catch (error) {
            // User hasn't contributed
            return null;
        }
    }

    /**
     * Check if a raise is settled
     */
    async isRaiseSettled(raiseId: string): Promise<boolean> {
        const raise = await this.getRaise(raiseId);
        const settlementDone = this.extractField<boolean>(raise, "settlement_done");
        return settlementDone ?? false;
    }

    /**
     * Get raise state (0=FUNDING, 1=SUCCESSFUL, 2=FAILED)
     */
    async getRaiseState(raiseId: string): Promise<number> {
        const raise = await this.getRaise(raiseId);
        const state = this.extractField<number>(raise, "state");
        return state ?? 0;
    }

    /**
     * Get total raised amount
     */
    async getTotalRaised(raiseId: string): Promise<bigint> {
        const raise = await this.getRaise(raiseId);
        const vaultBalance = this.extractField<string>(
            raise,
            "stable_coin_vault.value"
        );
        return BigInt(vaultBalance || "0");
    }

    /**
     * Get claim events (tokens claimed)
     */
    async getTokenClaims(
        factoryPackageId: string,
        raiseId: string
    ): Promise<any[]> {
        const eventType = `${factoryPackageId}::launchpad::TokensClaimed`;

        const response = await this.queryEvents({
            MoveEventType: eventType,
        });

        return response.data
            .map((event) => event.parsedJson)
            .filter((event: any) => event.raise_id === raiseId);
    }

    /**
     * Get refund events
     */
    async getRefundClaims(
        factoryPackageId: string,
        raiseId: string
    ): Promise<any[]> {
        const eventType = `${factoryPackageId}::launchpad::RefundClaimed`;

        const response = await this.queryEvents({
            MoveEventType: eventType,
        });

        return response.data
            .map((event) => event.parsedJson)
            .filter((event: any) => event.raise_id === raiseId);
    }
}
