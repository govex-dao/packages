This is a Sui move implementation of a smart account for a DAO governed by futarchy.

The production packages are:

    // Upgradable and extensible smart account with primative actions
    (Heavily adapted fork of the Move Framework by Account.tech)
    move-framework/packages/protocol/sources
    move-framework/packages/actions/sources

    // Core futarchy creator and types
    futarchy_core/sources
    futarchy_factory/sources
    futarchy_governance/sources

    // V2 style AMM that supports auto-arbitrade and futarchy TWAP oracle across N conditional outcomes
    futarchy_markets_core/sources
    futarchy_markets_operations/sources
    futarchy_markets_primitives/sources

    // Futarchy related actions for the smart account to execute
    futarchy_governance_actions/sources
    futarchy_actions/sources
    futarchy_oracle_actions/sources

    // Auxilary helper packages
    futarchy_one_shot_utils/sources
    futarchy_types/sources
