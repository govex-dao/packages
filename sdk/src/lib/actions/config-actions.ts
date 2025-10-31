/**
 * Configuration actions for DAO initialization and governance
 *
 * These actions modify DAO configuration (futarchy_config::FutarchyConfig)
 * and can be executed during DAO creation or through governance proposals.
 *
 * Package: futarchy_actions
 * Module: config_actions
 */

import { bcs } from "@mysten/sui/bcs";
import { InitActionSpec } from "../../types/init-actions";
import { concatBytes, serializeOptionString, serializeOptionU64, serializeOptionBool } from "./bcs-utils";

/**
 * Configuration action builders for DAO settings
 */
export class ConfigActions {
    /**
     * Update DAO metadata (name, icon, description)
     *
     * Matches Move: MetadataUpdate action
     *
     * @param params - Metadata fields to update (all optional)
     * @returns InitActionSpec for use in createDAOWithInitSpecs
     *
     * @example
     * ```typescript
     * const action = ConfigActions.updateMetadata({
     *     daoName: "My DAO",
     *     iconUrl: "https://example.com/icon.png",
     *     description: "A futarchy-based governance DAO"
     * });
     * ```
     */
    static updateMetadata(params: {
        daoName?: string;
        iconUrl?: string;
        description?: string;
    }): InitActionSpec {
        // Serialize each optional field
        const daoNameBytes = serializeOptionString(params.daoName);
        const iconUrlBytes = serializeOptionString(params.iconUrl);
        const descriptionBytes = serializeOptionString(params.description);

        // Concatenate all fields (matches Move struct field order)
        const actionData = concatBytes(daoNameBytes, iconUrlBytes, descriptionBytes);

        return {
            actionType: "futarchy_actions::config_actions::MetadataUpdate",
            actionData,
        };
    }

    /**
     * Update DAO name only
     *
     * Matches Move: UpdateName action
     *
     * @param newName - New DAO name (ASCII string)
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = ConfigActions.updateName("New DAO Name");
     * ```
     */
    static updateName(newName: string): InitActionSpec {
        const actionData = Array.from(bcs.string().serialize(newName).toBytes());

        return {
            actionType: "futarchy_actions::config_actions::UpdateName",
            actionData,
        };
    }

    /**
     * Enable or disable proposal creation
     *
     * Matches Move: SetProposalsEnabled action
     *
     * @param enabled - True to enable proposals, false to disable
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = ConfigActions.setProposalsEnabled(true);
     * ```
     */
    static setProposalsEnabled(enabled: boolean): InitActionSpec {
        const actionData = Array.from(bcs.bool().serialize(enabled).toBytes());

        return {
            actionType: "futarchy_actions::config_actions::SetProposalsEnabled",
            actionData,
        };
    }

    /**
     * Update trading parameters
     *
     * Matches Move: TradingParamsUpdate action
     *
     * @param params - Trading parameters to update
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = ConfigActions.updateTradingParams({
     *     minAssetAmount: 1000n,
     *     minStableAmount: 1000n,
     *     ammTotalFeeBps: 30 // 0.3%
     * });
     * ```
     */
    static updateTradingParams(params: {
        minAssetAmount?: bigint | number;
        minStableAmount?: bigint | number;
        ammTotalFeeBps?: number;
    }): InitActionSpec {
        const minAssetBytes = serializeOptionU64(params.minAssetAmount);
        const minStableBytes = serializeOptionU64(params.minStableAmount);
        const ammFeeBytes = serializeOptionU64(params.ammTotalFeeBps);

        const actionData = concatBytes(minAssetBytes, minStableBytes, ammFeeBytes);

        return {
            actionType: "futarchy_actions::config_actions::TradingParamsUpdate",
            actionData,
        };
    }

    /**
     * Update TWAP (Time-Weighted Average Price) configuration
     *
     * Matches Move: TwapConfigUpdate action
     *
     * @param params - TWAP configuration parameters
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = ConfigActions.updateTwapConfig({
     *     twapStartDelay: 3600000, // 1 hour in ms
     *     twapStepMax: 100,
     *     twapInitialObservation: 1000000n
     * });
     * ```
     */
    static updateTwapConfig(params: {
        twapStartDelay?: number;
        twapStepMax?: number;
        twapInitialObservation?: bigint | number;
        twapThreshold?: {
            value: bigint | number;
            negative: boolean;
        };
    }): InitActionSpec {
        const startDelayBytes = serializeOptionU64(params.twapStartDelay);
        const stepMaxBytes = serializeOptionU64(params.twapStepMax);
        const initialObsBytes = serializeOptionU64(params.twapInitialObservation);

        // Serialize optional SignedU128
        let thresholdBytes: Uint8Array;
        if (params.twapThreshold) {
            const valueBytes = bcs.u128().serialize(BigInt(params.twapThreshold.value)).toBytes();
            const negativeBytes = bcs.bool().serialize(params.twapThreshold.negative).toBytes();
            const signedU128Bytes = concatBytes(valueBytes, negativeBytes);
            thresholdBytes = bcs.option(bcs.vector(bcs.u8())).serialize(Array.from(new Uint8Array(signedU128Bytes))).toBytes();
        } else {
            thresholdBytes = bcs.option(bcs.vector(bcs.u8())).serialize(null).toBytes();
        }

        const actionData = concatBytes(startDelayBytes, stepMaxBytes, initialObsBytes, thresholdBytes);

        return {
            actionType: "futarchy_actions::config_actions::TwapConfigUpdate",
            actionData,
        };
    }

    /**
     * Update governance settings
     *
     * Matches Move: GovernanceUpdate action
     *
     * @param params - Governance parameters to update
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = ConfigActions.updateGovernance({
     *     reviewPeriodMs: 86400000, // 1 day
     *     tradingPeriodMs: 259200000, // 3 days
     *     maxOutcomes: 5
     * });
     * ```
     */
    static updateGovernance(params: {
        reviewPeriodMs?: number;
        tradingPeriodMs?: number;
        maxOutcomes?: number;
    }): InitActionSpec {
        const reviewBytes = serializeOptionU64(params.reviewPeriodMs);
        const tradingBytes = serializeOptionU64(params.tradingPeriodMs);
        const maxOutcomesBytes = serializeOptionU64(params.maxOutcomes);

        const actionData = concatBytes(reviewBytes, tradingBytes, maxOutcomesBytes);

        return {
            actionType: "futarchy_actions::config_actions::GovernanceUpdate",
            actionData,
        };
    }

    /**
     * Update custom metadata table
     *
     * Matches Move: MetadataTableUpdate action
     *
     * @param entries - Key-value pairs for metadata
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = ConfigActions.updateMetadataTable([
     *     { key: "website", value: "https://dao.example.com" },
     *     { key: "twitter", value: "@myDAO" }
     * ]);
     * ```
     */
    static updateMetadataTable(entries: Array<{ key: string; value: string }>): InitActionSpec {
        const keys = entries.map((e) => e.key);
        const values = entries.map((e) => e.value);

        const keysBytes = bcs.vector(bcs.string()).serialize(keys).toBytes();
        const valuesBytes = bcs.vector(bcs.string()).serialize(values).toBytes();

        const actionData = concatBytes(keysBytes, valuesBytes);

        return {
            actionType: "futarchy_actions::config_actions::MetadataTableUpdate",
            actionData,
        };
    }

    /**
     * Update sponsorship configuration
     *
     * Matches Move: SponsorshipConfigUpdate action
     *
     * @param params - Sponsorship settings
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = ConfigActions.updateSponsorshipConfig({
     *     enabled: true,
     *     minSponsorshipAmount: 1000n
     * });
     * ```
     */
    static updateSponsorshipConfig(params: {
        enabled?: boolean;
        minSponsorshipAmount?: bigint | number;
    }): InitActionSpec {
        const enabledBytes = serializeOptionBool(params.enabled);
        const minAmountBytes = serializeOptionU64(params.minSponsorshipAmount);

        const actionData = concatBytes(enabledBytes, minAmountBytes);

        return {
            actionType: "futarchy_actions::config_actions::SponsorshipConfigUpdate",
            actionData,
        };
    }

    /**
     * Permanently terminate the DAO
     *
     * Matches Move: TerminateDao action
     * WARNING: This is irreversible
     *
     * @returns InitActionSpec
     *
     * @example
     * ```typescript
     * const action = ConfigActions.terminateDao();
     * ```
     */
    static terminateDao(): InitActionSpec {
        // This action has no parameters, just marker type
        const actionData: number[] = [];

        return {
            actionType: "futarchy_actions::config_actions::TerminateDao",
            actionData,
        };
    }
}
