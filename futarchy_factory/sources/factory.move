// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Factory for creating futarchy DAOs using account_protocol
/// This is the main entry point for creating DAOs in the Futarchy protocol
module futarchy_factory::factory;

use account_actions::currency;
use account_actions::vault;
use account_protocol::account::{Self, Account};
use account_protocol::intents::ActionSpec;
use account_protocol::package_registry::{Self, PackageRegistry};
use futarchy_factory::dao_init_executor;
use futarchy_core::dao_config;
use futarchy_core::futarchy_config::{Self, FutarchyConfig};
use futarchy_core::version;
use futarchy_markets_core::fee::{Self, FeeManager};
// NOTE: Spot pool is now created via init actions (liquidity_init_actions), not here
use futarchy_one_shot_utils::coin_registry;
use futarchy_one_shot_utils::constants;
use std::ascii::String as AsciiString;
use std::option::Option;
use std::string::{String, String as UTF8String};
use std::type_name::{Self, TypeName};
use std::vector;
use sui::clock::Clock;
use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};
use sui::event;
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::TxContext;
use sui::url;
use sui::vec_set::{Self, VecSet};

// === Storage Keys ===

/// Key for storing CoinMetadata in Account
public struct CoinMetadataKey<phantom CoinType> has copy, drop, store {}

/// Create a CoinMetadataKey for accessing stored coin metadata
public fun coin_metadata_key<CoinType>(): CoinMetadataKey<CoinType> {
    CoinMetadataKey<CoinType> {}
}

// === Errors ===
const EPaused: u64 = 1;
const EStableTypeNotAllowed: u64 = 2;
const EBadWitness: u64 = 3;
const EInvalidStateForAction: u64 = 11;
const EPermanentlyDisabled: u64 = 12;
const EAlreadyDisabled: u64 = 13;

// === Structs ===

/// One-time witness for factory initialization
public struct FACTORY has drop {}

/// Factory for creating futarchy DAOs
public struct Factory has key, store {
    id: UID,
    dao_count: u64,
    paused: bool,
    permanently_disabled: bool,
    owner_cap_id: ID,
    allowed_stable_types: VecSet<TypeName>,
    // Launchpad fee configuration (in MIST - 1 SUI = 1_000_000_000 MIST)
    launchpad_bid_fee: u64, // Fee users pay per contribution (default: 0.1 SUI)
    launchpad_cranker_reward: u64, // Reward crankers get per claim (default: 0.05 SUI)
    launchpad_settlement_reward: u64, // Reward per cap processed in settlement (default: 0.05 SUI)
}

/// Admin capability for factory operations
public struct FactoryOwnerCap has key, store {
    id: UID,
}

/// Validator capability for DAO verification
public struct ValidatorAdminCap has key, store {
    id: UID,
}

// === Events ===

public struct DAOCreated has copy, drop {
    account_id: address,
    dao_name: AsciiString,
    asset_type: UTF8String,
    stable_type: UTF8String,
    creator: address,
    affiliate_id: UTF8String,
    timestamp: u64,
}

public struct StableCoinTypeAdded has copy, drop {
    type_str: UTF8String,
    admin: address,
    timestamp: u64,
}

public struct StableCoinTypeRemoved has copy, drop {
    type_str: UTF8String,
    admin: address,
    timestamp: u64,
}

public struct FactoryPermanentlyDisabled has copy, drop {
    admin: address,
    dao_count_at_shutdown: u64,
    timestamp: u64,
}

public struct LaunchpadFeesUpdated has copy, drop {
    admin: address,
    old_bid_fee: u64,
    new_bid_fee: u64,
    old_cranker_reward: u64,
    new_cranker_reward: u64,
    old_settlement_reward: u64,
    new_settlement_reward: u64,
    timestamp: u64,
}

public struct VerificationApproved has copy, drop {
    dao_id: ID,
    verification_id: ID,
    level: u8,
    attestation_url: String,
    admin_review_text: String,
    validator: address,
    timestamp: u64,
}

public struct VerificationRejected has copy, drop {
    dao_id: ID,
    verification_id: ID,
    reason: String,
    validator: address,
    timestamp: u64,
}

public struct DaoScoreSet has copy, drop {
    dao_id: ID,
    score: u64,
    reason: String,
    validator: address,
    timestamp: u64,
}

// === Internal Helper Functions ===
// Note: Action registry removed - using statically-typed pattern like move-framework

// Test helpers removed - no longer needed without action registry

// === Public Functions ===

fun init(witness: FACTORY, ctx: &mut TxContext) {
    assert!(sui::types::is_one_time_witness(&witness), EBadWitness);

    let owner_cap = FactoryOwnerCap {
        id: object::new(ctx),
    };

    let factory = Factory {
        id: object::new(ctx),
        dao_count: 0,
        paused: false,
        permanently_disabled: false,
        owner_cap_id: object::id(&owner_cap),
        allowed_stable_types: vec_set::empty(),
        // Initialize with default launchpad fees
        launchpad_bid_fee: constants::launchpad_bid_fee_per_contribution(),
        launchpad_cranker_reward: constants::launchpad_cranker_reward_per_claim(),
        launchpad_settlement_reward: constants::launchpad_reward_per_cap_processed(),
    };

    let validator_cap = ValidatorAdminCap {
        id: object::new(ctx),
    };

    transfer::share_object(factory);
    transfer::public_transfer(owner_cap, ctx.sender());
    transfer::public_transfer(validator_cap, ctx.sender());
}

/// Create a new futarchy DAO with init specs
///
/// Uses default configuration for all DAO settings. Use init_specs to customize:
/// - MetadataUpdate: Set dao_name, icon_url, description
/// - TradingParamsUpdate: Set min amounts, review/trading periods, fees
/// - TwapConfigUpdate: Set TWAP parameters
/// - GovernanceUpdate: Set max outcomes, fees, etc.
/// - CreatePool: Create spot pool with LP tokens
/// - CreateStream: Set up vesting schedules
///
/// This creates a DAO and stages init intents that can be executed in the same PTB:
/// 1. Factory creates DAO and stages intents (this function)
/// 2. PTB calls dao_init_executor::begin_execution() to start executing intents
/// 3. PTB calls do_* action functions for each init action
/// 4. PTB calls dao_init_executor::finalize_execution() to complete
///
/// All steps happen in ONE transaction - if any fails, nothing is created.
public fun create_dao<AssetType: drop, StableType: drop>(
    factory: &mut Factory,
    registry: &PackageRegistry,
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    affiliate_id: UTF8String, // Partner identifier (UUID from subclient, empty string if none)
    treasury_cap: TreasuryCap<AssetType>,
    coin_metadata: CoinMetadata<AssetType>,
    init_specs: vector<ActionSpec>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Validate caps at entry point
    coin_registry::validate_coin_set(&treasury_cap, &coin_metadata);

    create_dao_internal<AssetType, StableType>(
        factory,
        registry,
        fee_manager,
        payment,
        affiliate_id,
        treasury_cap,
        coin_metadata,
        init_specs,
        clock,
        ctx,
    );
}

/// Internal function to create a DAO with default configs
/// All configuration is done via init_specs (init actions)
#[allow(lint(share_owned))]
fun create_dao_internal<AssetType: drop, StableType: drop>(
    factory: &mut Factory,
    registry: &PackageRegistry,
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    affiliate_id: UTF8String,
    treasury_cap: TreasuryCap<AssetType>,
    coin_metadata: CoinMetadata<AssetType>,
    init_specs: vector<ActionSpec>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Check factory is not permanently disabled
    assert!(!factory.permanently_disabled, EPermanentlyDisabled);

    // Check factory is active
    assert!(!factory.paused, EPaused);

    // Check if StableType is allowed
    let stable_type_name = type_name::with_defining_ids<StableType>();
    assert!(factory.allowed_stable_types.contains(&stable_type_name), EStableTypeNotAllowed);

    // Process payment
    fee::deposit_dao_creation_payment(fee_manager, payment, clock, ctx);

    // DoS protection: limit affiliate_id length (UUID is 36 chars, leave room for custom IDs)
    assert!(affiliate_id.length() <= 64, EInvalidStateForAction);

    // Use all default configs - init actions will set real values
    let trading_params = dao_config::default_trading_params();
    let twap_config = dao_config::default_twap_config();
    let governance_config = dao_config::default_governance_config();

    // Minimal metadata - init actions will update
    let metadata_config = dao_config::new_metadata_config(
        b"DAO".to_ascii_string(), // Default name (init actions will override)
        url::new_unsafe_from_bytes(b""), // Empty icon (init actions will override)
        b"".to_string(), // Empty description (init actions will override)
    );

    let dao_config = dao_config::new_dao_config(
        trading_params,
        twap_config,
        governance_config,
        metadata_config,
        dao_config::default_conditional_coin_config(),
        dao_config::default_quota_config(),
        dao_config::default_sponsorship_config(),
    );

    // --- Phase 1: Create all objects in memory (no sharing) ---

    // Create fee manager for this DAO
    let _dao_fee_manager_id = object::id(fee_manager); // Use factory fee manager for now

    // NOTE: Spot pool is NOT created here - it will be created via init actions
    // (liquidity_init_actions::init_create_pool) which allows proper LP coin type handling.
    // The init_specs should include a CreatePool action with LP treasury cap.

    // Create the futarchy configuration
    let config = futarchy_config::new<AssetType, StableType>(
        dao_config,
    );

    // Create the account with PackageRegistry validation for security
    let mut account = futarchy_config::new_with_package_registry(registry, config, ctx);

    // Action registry removed - using statically-typed pattern

    // Initialize the default treasury vault using base vault module
    let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
        &account,
        registry,
        version::current(),
        futarchy_config::authenticate(&account, ctx),
    );
    vault::open<FutarchyConfig>(auth, &mut account, registry, std::string::utf8(b"treasury"), ctx);

    // Pre-approve common coin types for permissionless deposits
    // This enables anyone to send SUI, AssetType, or StableType to the DAO
    // (enables revenue/donations without governance proposals)
    let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
        &account,
        registry,
        version::current(),
        futarchy_config::authenticate(&account, ctx),
    );
    vault::approve_coin_type<FutarchyConfig, SUI>(
        auth,
        &mut account,
        registry,
        std::string::utf8(b"treasury"),
    );

    let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
        &account,
        registry,
        version::current(),
        futarchy_config::authenticate(&account, ctx),
    );
    vault::approve_coin_type<FutarchyConfig, AssetType>(
        auth,
        &mut account,
        registry,
        std::string::utf8(b"treasury"),
    );

    let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
        &account,
        registry,
        version::current(),
        futarchy_config::authenticate(&account, ctx),
    );
    vault::approve_coin_type<FutarchyConfig, StableType>(
        auth,
        &mut account,
        registry,
        std::string::utf8(b"treasury"),
    );

    // Lock treasury cap and store coin metadata using Move framework's currency module
    // TreasuryCap is stored via currency::lock_cap for proper atomic borrowing
    // CoinMetadata is stored separately for metadata updates via intents
    let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
        &account,
        registry,
        version::current(),
        futarchy_config::authenticate(&account, ctx),
    );

    // Store TreasuryCap
    currency::lock_cap(
        auth,
        &mut account,
        registry,
        treasury_cap,
        option::none(), // No max supply limit for now
    );

    // Store CoinMetadata for DAO governance control over coin metadata
    account.add_managed_asset(
        registry,
        CoinMetadataKey<AssetType> {},
        coin_metadata,
        version::current(),
    );

    // Note: ProposalQuotaRegistry is now embedded in FutarchyConfig

    // --- Phase 3: Create Intents from Init Specs (before sharing) ---
    // If init_specs are provided, create intents that can be executed after sharing
    dao_init_executor::create_intents_from_specs_for_factory(
        &mut account,
        registry,
        &init_specs,
        clock,
        ctx,
    );

    // Get account ID before sharing
    let account_id = object::id_address(&account);

    // --- Phase 4: Final Atomic Sharing ---
    // All objects are shared at the end of the function. If any step above failed,
    // the transaction would abort and no objects would be created.
    // NOTE: Spot pool is created and shared via init actions, not here.
    transfer::public_share_object(account);

    // --- Phase 5: Update Factory State and Emit Event ---

    // Update factory state
    factory.dao_count = factory.dao_count + 1;

    // Emit event with default metadata (init actions will update actual values)
    event::emit(DAOCreated {
        account_id,
        dao_name: b"DAO".to_ascii_string(), // Default (init actions will set real name)
        asset_type: get_type_string<AssetType>(),
        stable_type: get_type_string<StableType>(),
        creator: ctx.sender(),
        affiliate_id,
        timestamp: clock.timestamp_ms(),
    });
}

#[test_only]
/// Internal function to create a DAO for testing
/// Uses default configs like the production version - customize via init_specs
fun create_dao_internal_test<AssetType: drop, StableType: drop>(
    factory: &mut Factory,
    registry: &PackageRegistry,
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    treasury_cap: TreasuryCap<AssetType>,
    coin_metadata: CoinMetadata<AssetType>,
    init_specs: vector<ActionSpec>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Check factory is not permanently disabled
    assert!(!factory.permanently_disabled, EPermanentlyDisabled);

    // Check factory is active
    assert!(!factory.paused, EPaused);

    // Check if StableType is allowed
    let stable_type_name = type_name::with_defining_ids<StableType>();
    assert!(factory.allowed_stable_types.contains(&stable_type_name), EStableTypeNotAllowed);

    // Process payment
    fee::deposit_dao_creation_payment(fee_manager, payment, clock, ctx);

    let affiliate_id = b"".to_string();

    // Use all default configs - init actions will set real values
    let trading_params = dao_config::default_trading_params();
    let twap_config = dao_config::default_twap_config();
    let governance_config = dao_config::default_governance_config();

    // Minimal metadata - init actions will update
    let metadata_config = dao_config::new_metadata_config(
        b"DAO".to_ascii_string(),
        url::new_unsafe_from_bytes(b""),
        b"".to_string(),
    );

    let dao_config = dao_config::new_dao_config(
        trading_params,
        twap_config,
        governance_config,
        metadata_config,
        dao_config::default_conditional_coin_config(),
        dao_config::default_quota_config(),
        dao_config::default_sponsorship_config(),
    );

    // --- Phase 1: Create all objects in memory (no sharing) ---

    // Create fee manager for this DAO
    let _dao_fee_manager_id = object::id(fee_manager); // Use factory fee manager for now

    // NOTE: Spot pool is NOT created here - it will be created via init actions
    // (liquidity_init_actions::init_create_pool) which allows proper LP coin type handling.

    // Create the futarchy configuration (uses safe default: challenge enabled = true)
    let config = futarchy_config::new<AssetType, StableType>(
        dao_config,
    );

    // Create the account using test function
    let mut account = futarchy_config::new_account_test(config, registry, ctx);

    // Initialize the default treasury vault (test version)
    {
        use account_protocol::version_witness;
        let test_version = version_witness::new_for_testing(@account_protocol);
        let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
            &account,
            registry,
            test_version,
            futarchy_config::authenticate(&account, ctx),
        );
        vault::open<FutarchyConfig>(
            auth,
            &mut account,
            registry,
            std::string::utf8(b"treasury"),
            ctx,
        );

        // Pre-approve common coin types for permissionless deposits
        let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
            &account,
            registry,
            test_version,
            futarchy_config::authenticate(&account, ctx),
        );
        vault::approve_coin_type<FutarchyConfig, SUI>(
            auth,
            &mut account,
            registry,
            std::string::utf8(b"treasury"),
        );

        let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
            &account,
            registry,
            test_version,
            futarchy_config::authenticate(&account, ctx),
        );
        vault::approve_coin_type<FutarchyConfig, AssetType>(
            auth,
            &mut account,
            registry,
            std::string::utf8(b"treasury"),
        );

        let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
            &account,
            registry,
            test_version,
            futarchy_config::authenticate(&account, ctx),
        );
        vault::approve_coin_type<FutarchyConfig, StableType>(
            auth,
            &mut account,
            registry,
            std::string::utf8(b"treasury"),
        );
    };

    // Lock treasury cap and store coin metadata using Move framework's currency module
    // TreasuryCap is stored via currency::lock_cap for proper atomic borrowing
    // CoinMetadata is stored separately for metadata updates via intents
    let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
        &account,
        registry,
        version::current(),
        futarchy_config::authenticate(&account, ctx),
    );

    // Store TreasuryCap
    currency::lock_cap(
        auth,
        &mut account,
        registry,
        treasury_cap,
        option::none(), // No max supply limit for now
    );

    // Store CoinMetadata for DAO governance control over coin metadata
    account.add_managed_asset(
        registry,
        CoinMetadataKey<AssetType> {},
        coin_metadata,
        version::current(),
    );

    // Note: ProposalQuotaRegistry is now embedded in FutarchyConfig

    // --- Phase 3: Create Intents from Init Specs (before sharing) ---
    // If init_specs are provided, create intents that can be executed after sharing
    dao_init_executor::create_intents_from_specs_for_factory(
        &mut account,
        registry,
        &init_specs,
        clock,
        ctx,
    );

    // Get account ID before sharing
    let account_id = object::id_address(&account);

    // --- Phase 4: Final Atomic Sharing ---
    // All objects are shared at the end of the function. If any step above failed,
    // the transaction would abort and no objects would be created.
    // NOTE: Spot pool is created and shared via init actions, not here.
    transfer::public_share_object(account);

    // --- Phase 5: Update Factory State and Emit Event ---

    // Update factory state
    factory.dao_count = factory.dao_count + 1;

    // Emit event with default metadata
    event::emit(DAOCreated {
        account_id,
        dao_name: b"DAO".to_ascii_string(),
        asset_type: get_type_string<AssetType>(),
        stable_type: get_type_string<StableType>(),
        creator: ctx.sender(),
        affiliate_id,
        timestamp: clock.timestamp_ms(),
    });
}

// === Launchpad Support ===

/// Create DAO for launchpad completion - NO FEE CHARGED
/// Launchpad already collected its own fee when raise was created
/// This is public(package) so only launchpad module can call it
public(package) fun create_dao_unshared_for_launchpad<AssetType: drop, StableType: drop>(
    factory: &mut Factory,
    registry: &PackageRegistry,
    treasury_cap: Option<TreasuryCap<AssetType>>,
    coin_metadata: Option<CoinMetadata<AssetType>>,
    clock: &Clock,
    ctx: &mut TxContext,
): Account {
    // Check factory is not permanently disabled
    assert!(!factory.permanently_disabled, EPermanentlyDisabled);

    // Check factory is active
    assert!(!factory.paused, EPaused);

    // Check if StableType is allowed
    let stable_type_name = type_name::with_defining_ids<StableType>();
    assert!(factory.allowed_stable_types.contains(&stable_type_name), EStableTypeNotAllowed);

    // NO FEE PAYMENT - launchpad already collected fee

    // Use all default configs - init actions will set real values
    let trading_params = dao_config::default_trading_params();
    let twap_config = dao_config::default_twap_config();
    let governance_config = dao_config::default_governance_config();

    // Minimal metadata - init actions will update
    let metadata_config = dao_config::new_metadata_config(
        b"DAO".to_ascii_string(), // Default name (init actions will override)
        url::new_unsafe_from_bytes(b""), // Empty icon (init actions will override)
        b"".to_string(), // Empty description (init actions will override)
    );

    let dao_config = dao_config::new_dao_config(
        trading_params,
        twap_config,
        governance_config,
        metadata_config,
        dao_config::default_conditional_coin_config(),
        dao_config::default_quota_config(),
        dao_config::default_sponsorship_config(),
    );

    // Create the futarchy config with safe default
    let config = futarchy_config::new<AssetType, StableType>(
        dao_config,
    );

    // Create account with config
    let mut account = futarchy_config::new_with_package_registry(registry, config, ctx);

    // NOTE: Spot pool is NOT auto-created for launchpad DAOs
    // It will be created via init actions, allowing the DAO to own the LP tokens

    // Lock treasury cap and store coin metadata (if provided)
    // TreasuryCap is stored via currency::lock_cap for proper atomic borrowing
    // CoinMetadata is stored separately for metadata updates via intents
    // For launchpad pre-create flow, these will be none and added later via init_actions

    // Validate caps if both are provided
    if (treasury_cap.is_some() && coin_metadata.is_some()) {
        coin_registry::validate_coin_set(
            option::borrow(&treasury_cap),
            option::borrow(&coin_metadata),
        );
    };

    if (treasury_cap.is_some()) {
        let auth = account::new_auth<FutarchyConfig, futarchy_config::ConfigWitness>(
            &account,
            registry,
            version::current(),
            futarchy_config::authenticate(&account, ctx),
        );
        currency::lock_cap(
            auth,
            &mut account,
            registry,
            treasury_cap.destroy_some(),
            option::none(), // max_supply
        );
    } else {
        treasury_cap.destroy_none();
    };

    // Store CoinMetadata for DAO governance control over coin metadata
    if (coin_metadata.is_some()) {
        account.add_managed_asset(
            registry,
            CoinMetadataKey<AssetType> {},
            coin_metadata.destroy_some(),
            version::current(),
        );
    } else {
        coin_metadata.destroy_none();
    };

    // Note: ProposalQuotaRegistry is now embedded in FutarchyConfig

    // Update factory state
    factory.dao_count = factory.dao_count + 1;

    // Emit event with default metadata (init actions will update)
    let account_id = object::id_address(&account);
    event::emit(DAOCreated {
        account_id,
        dao_name: b"DAO".to_ascii_string(),
        asset_type: get_type_string<AssetType>(),
        stable_type: get_type_string<StableType>(),
        creator: ctx.sender(),
        affiliate_id: b"launchpad".to_string(), // Mark as launchpad-created DAO
        timestamp: clock.timestamp_ms(),
    });

    account
}

// === Admin Functions ===

/// Toggle factory pause state (reversible)
public entry fun toggle_pause(factory: &mut Factory, cap: &FactoryOwnerCap) {
    assert!(object::id(cap) == factory.owner_cap_id, EBadWitness);
    factory.paused = !factory.paused;
}

/// Permanently disable the factory - THIS CANNOT BE REVERSED
/// Once called, no new DAOs can ever be created from this factory
/// Existing DAOs are unaffected and continue to operate normally
public entry fun disable_permanently(
    factory: &mut Factory,
    cap: &FactoryOwnerCap,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(cap) == factory.owner_cap_id, EBadWitness);

    // Idempotency check: prevent duplicate disable and event emission
    assert!(!factory.permanently_disabled, EAlreadyDisabled);

    factory.permanently_disabled = true;

    event::emit(FactoryPermanentlyDisabled {
        admin: ctx.sender(),
        dao_count_at_shutdown: factory.dao_count,
        timestamp: clock.timestamp_ms(),
    });
}

/// Add an allowed stable coin type
public entry fun add_allowed_stable_type<StableType>(
    factory: &mut Factory,
    owner_cap: &FactoryOwnerCap,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(owner_cap) == factory.owner_cap_id, EBadWitness);
    let type_name_val = type_name::with_defining_ids<StableType>();

    if (!factory.allowed_stable_types.contains(&type_name_val)) {
        factory.allowed_stable_types.insert(type_name_val);

        event::emit(StableCoinTypeAdded {
            type_str: get_type_string<StableType>(),
            admin: ctx.sender(),
            timestamp: clock.timestamp_ms(),
        });
    }
}

/// Remove an allowed stable coin type
public entry fun remove_allowed_stable_type<StableType>(
    factory: &mut Factory,
    owner_cap: &FactoryOwnerCap,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(owner_cap) == factory.owner_cap_id, EBadWitness);
    let type_name_val = type_name::with_defining_ids<StableType>();
    if (factory.allowed_stable_types.contains(&type_name_val)) {
        factory.allowed_stable_types.remove(&type_name_val);

        event::emit(StableCoinTypeRemoved {
            type_str: get_type_string<StableType>(),
            admin: ctx.sender(),
            timestamp: clock.timestamp_ms(),
        });
    }
}

/// Update launchpad fee configuration
/// All fees are in MIST (1 SUI = 1_000_000_000 MIST)
public entry fun update_launchpad_fees(
    factory: &mut Factory,
    owner_cap: &FactoryOwnerCap,
    new_bid_fee: u64,
    new_cranker_reward: u64,
    new_settlement_reward: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(object::id(owner_cap) == factory.owner_cap_id, EBadWitness);

    let old_bid_fee = factory.launchpad_bid_fee;
    let old_cranker_reward = factory.launchpad_cranker_reward;
    let old_settlement_reward = factory.launchpad_settlement_reward;

    factory.launchpad_bid_fee = new_bid_fee;
    factory.launchpad_cranker_reward = new_cranker_reward;
    factory.launchpad_settlement_reward = new_settlement_reward;

    event::emit(LaunchpadFeesUpdated {
        admin: ctx.sender(),
        old_bid_fee,
        new_bid_fee,
        old_cranker_reward,
        new_cranker_reward,
        old_settlement_reward,
        new_settlement_reward,
        timestamp: clock.timestamp_ms(),
    });
}

/// Burn the factory owner cap
public entry fun burn_factory_owner_cap(factory: &Factory, cap: FactoryOwnerCap) {
    // It is good practice to check ownership one last time before burning,
    // even though only the owner can call this.
    assert!(object::id(&cap) == factory.owner_cap_id, EBadWitness);
    let FactoryOwnerCap { id } = cap;
    id.delete();
}

// === Validator Functions ===

/// Approve DAO verification request
/// Validators can approve a DAO's verification and set their attestation URL
public entry fun approve_verification(
    _validator_cap: &ValidatorAdminCap,
    target_dao: &mut Account,
    registry: &PackageRegistry,
    verification_id: ID,
    level: u8,
    attestation_url: String,
    admin_review_text: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let dao_id = object::id(target_dao);

    // Get mutable config to update verification level and review text
    let config = futarchy_config::internal_config_mut(target_dao, registry, version::current());
    futarchy_config::set_verification_level(config, level);
    futarchy_config::set_admin_review_text(config, admin_review_text);

    // Get mutable state to update pending flag and URL
    let dao_state = futarchy_config::state_mut_from_account(target_dao, registry);
    futarchy_config::set_verification_pending(dao_state, false);
    futarchy_config::set_attestation_url(dao_state, attestation_url);

    // Emit event for transparency
    event::emit(VerificationApproved {
        dao_id,
        verification_id,
        level,
        attestation_url,
        admin_review_text,
        validator: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

/// Reject DAO verification request
/// Validators can reject a verification request with a reason
public entry fun reject_verification(
    _validator_cap: &ValidatorAdminCap,
    target_dao: &mut Account,
    registry: &PackageRegistry,
    verification_id: ID,
    reason: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let dao_id = object::id(target_dao);

    // Get mutable state to reset verification status and clear attestation URL
    let dao_state = futarchy_config::state_mut_from_account(target_dao, registry);
    futarchy_config::set_verification_pending(dao_state, false);
    futarchy_config::set_attestation_url(dao_state, b"".to_string());

    // Emit event for transparency
    event::emit(VerificationRejected {
        dao_id,
        verification_id,
        reason,
        validator: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

/// Set DAO quality/reputation score
/// Validators can assign scores to DAOs for reputation/filtering purposes
public entry fun set_dao_score(
    _validator_cap: &ValidatorAdminCap,
    target_dao: &mut Account,
    registry: &PackageRegistry,
    score: u64,
    reason: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let dao_id = object::id(target_dao);

    // Get the DAO's config using internal_config_mut
    let config = futarchy_config::internal_config_mut(target_dao, registry, version::current());
    futarchy_config::set_dao_score(config, score);

    // Emit event for transparency
    event::emit(DaoScoreSet {
        dao_id,
        score,
        reason,
        validator: ctx.sender(),
        timestamp: clock.timestamp_ms(),
    });
}

// === View Functions ===

/// Get DAO count
public fun dao_count(factory: &Factory): u64 {
    factory.dao_count
}

/// Check if factory is paused (reversible)
public fun is_paused(factory: &Factory): bool {
    factory.paused
}

/// Check if factory is permanently disabled (irreversible)
public fun is_permanently_disabled(factory: &Factory): bool {
    factory.permanently_disabled
}

/// Check if a stable type is allowed
public fun is_stable_type_allowed<StableType>(factory: &Factory): bool {
    let type_name_val = type_name::with_defining_ids<StableType>();
    factory.allowed_stable_types.contains(&type_name_val)
}

/// Get launchpad bid fee (what users pay per contribution)
public fun launchpad_bid_fee(factory: &Factory): u64 {
    factory.launchpad_bid_fee
}

/// Get launchpad cranker reward (what crankers earn per claim)
public fun launchpad_cranker_reward(factory: &Factory): u64 {
    factory.launchpad_cranker_reward
}

/// Get launchpad settlement reward (reward per cap processed during settlement)
public fun launchpad_settlement_reward(factory: &Factory): u64 {
    factory.launchpad_settlement_reward
}

/// Get the permanently disabled error code (for external modules)
public fun permanently_disabled_error(): u64 {
    EPermanentlyDisabled
}

/// Read CoinMetadata from Account
/// Fully public function for market creation to access coin metadata
public fun borrow_coin_metadata<CoinType>(
    account: &Account,
    registry: &PackageRegistry,
): &CoinMetadata<CoinType> {
    account.borrow_managed_asset<CoinMetadataKey<CoinType>, CoinMetadata<CoinType>>(
        registry,
        CoinMetadataKey<CoinType> {},
        version::current(),
    )
}

// === Private Functions ===

fun get_type_string<T>(): UTF8String {
    let type_name_obj = type_name::with_original_ids<T>();
    let type_str = type_name_obj.into_string().into_bytes();
    type_str.to_string()
}

// === Test Functions ===

#[test_only]
public fun create_factory(ctx: &mut TxContext) {
    let owner_cap = FactoryOwnerCap {
        id: object::new(ctx),
    };

    let factory = Factory {
        id: object::new(ctx),
        dao_count: 0,
        paused: false,
        permanently_disabled: false,
        owner_cap_id: object::id(&owner_cap),
        allowed_stable_types: vec_set::empty(),
        launchpad_bid_fee: constants::launchpad_bid_fee_per_contribution(),
        launchpad_cranker_reward: constants::launchpad_cranker_reward_per_claim(),
        launchpad_settlement_reward: constants::launchpad_reward_per_cap_processed(),
    };

    let validator_cap = ValidatorAdminCap {
        id: object::new(ctx),
    };

    transfer::share_object(factory);
    transfer::public_transfer(owner_cap, ctx.sender());
    transfer::public_transfer(validator_cap, ctx.sender());
}

#[test_only]
/// Create a DAO for testing
/// Uses default configs - customize via init_specs
public fun create_dao_test<AssetType: drop, StableType: drop>(
    factory: &mut Factory,
    registry: &package_registry::PackageRegistry,
    fee_manager: &mut FeeManager,
    payment: Coin<SUI>,
    treasury_cap: TreasuryCap<AssetType>,
    coin_metadata: CoinMetadata<AssetType>,
    init_specs: vector<ActionSpec>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Validate caps at entry point
    coin_registry::validate_coin_set(&treasury_cap, &coin_metadata);

    create_dao_internal_test<AssetType, StableType>(
        factory,
        registry,
        fee_manager,
        payment,
        treasury_cap,
        coin_metadata,
        init_specs,
        clock,
        ctx,
    );
}
