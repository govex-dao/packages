This is a Sui move implementation of futarchy governed smart account.

The production packages are:

    // Upgradable and extensible smart account with primitive actions
    (Heavily adapted fork of the Move Framework by Account.tech)
    move-framework/packages/protocol/sources
    move-framework/packages/actions/sources

    // Core futarchy creator, executor and types
    futarchy_core/sources
    futarchy_factory/sources
    futarchy_governance/sources

    // Mixed spot and conditional V2 style AMM with auto-arbitrage, futarchy TWAP oracle and N conditional outcome support
    futarchy_markets_core/sources
    futarchy_markets_operations/sources
    futarchy_markets_primitives/sources

    // Futarchy related actions for the smart account to execute
    futarchy_governance_actions/sources
    futarchy_actions/sources
    futarchy_oracle_actions/sources

    // Auxiliary helper packages
    futarchy_one_shot_utils/sources
    futarchy_types/sources
