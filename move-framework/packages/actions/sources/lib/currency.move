// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

// Portions of this file are derived from the account.tech Move Framework project.
// Those portions remain licensed under the Apache License, Version 2.0.

/// Authenticated users can lock a TreasuryCap in the Account to restrict minting and burning operations,
/// as well as modifying the CoinMetadata.

module account_actions::currency;

// === Imports ===

use std::{
    string::{Self, String},
    ascii,
    option,

};
use sui::{
    coin::{Self, Coin, TreasuryCap, CoinMetadata},
    url::{Self, Url},
    bcs,
    object,
};
use account_protocol::{
    action_validation,
    account::{Self, Account, Auth},
    intents::{Self, Expired, Intent},
    executable::{Self, Executable},
    executable_resources,
    version_witness::VersionWitness,
    bcs_validation,
    package_registry::PackageRegistry,
};
use account_actions::{
    currency,
    version,
};
// === Use Fun Aliases ===

// === Errors ===

const ENoChange: u64 = 0;
const EWrongValue: u64 = 1;
const EMintDisabled: u64 = 2;
const EBurnDisabled: u64 = 3;
const ECannotUpdateName: u64 = 4;
const ECannotUpdateSymbol: u64 = 5;
const ECannotUpdateDescription: u64 = 6;
const ECannotUpdateIcon: u64 = 7;
const EMaxSupply: u64 = 8;
const EUnsupportedActionVersion: u64 = 9;

// === Action Type Markers ===

/// Disable currency operations
public struct CurrencyDisable has drop {}
/// Mint new currency
public struct CurrencyMint has drop {}
/// Burn currency
public struct CurrencyBurn has drop {}
/// Update currency metadata
public struct CurrencyUpdate has drop {}
/// Remove treasury cap (return to recipient)
public struct RemoveTreasuryCap has drop {}
/// Remove coin metadata (return to recipient)
public struct RemoveMetadata has drop {}

public fun currency_disable(): CurrencyDisable { CurrencyDisable {} }
public fun currency_mint(): CurrencyMint { CurrencyMint {} }
public fun currency_burn(): CurrencyBurn { CurrencyBurn {} }
public fun currency_update(): CurrencyUpdate { CurrencyUpdate {} }

/// Create a TreasuryCapKey witness (for PTB execution)
public fun treasury_cap_key<CoinType>(): TreasuryCapKey<CoinType> {
    TreasuryCapKey()
}

/// Create a CoinMetadataKey witness (for PTB execution)
public fun coin_metadata_key<CoinType>(): CoinMetadataKey<CoinType> {
    CoinMetadataKey()
}

// === Structs ===

/// Dynamic Object Field key for the TreasuryCap.
public struct TreasuryCapKey<phantom CoinType>() has copy, drop, store;
/// Dynamic Object Field key for the CoinMetadata.
public struct CoinMetadataKey<phantom CoinType>() has copy, drop, store;
/// Dynamic Field key for the CurrencyRules.
public struct CurrencyRulesKey<phantom CoinType>() has copy, drop, store;
/// Dynamic Field wrapper restricting access to a TreasuryCap, permissions are disabled forever if set.
public struct CurrencyRules<phantom CoinType> has store {
    // coin can have a fixed supply, can_mint must be true to be able to mint more
    max_supply: Option<u64>,
    // total amount minted
    total_minted: u64,
    // total amount burned
    total_burned: u64,
    // permissions
    can_mint: bool,
    can_burn: bool,
    can_update_symbol: bool,
    can_update_name: bool,
    can_update_description: bool,
    can_update_icon: bool,
}

/// Create a new CurrencyRules instance
public fun new_currency_rules<CoinType>(
    max_supply: Option<u64>,
    can_mint: bool,
    can_burn: bool,
    can_update_symbol: bool,
    can_update_name: bool,
    can_update_description: bool,
    can_update_icon: bool,
): CurrencyRules<CoinType> {
    CurrencyRules {
        max_supply,
        total_minted: 0,
        total_burned: 0,
        can_mint,
        can_burn,
        can_update_symbol,
        can_update_name,
        can_update_description,
        can_update_icon,
    }
}

/// Create a CurrencyRulesKey witness (for PTB execution)
public fun currency_rules_key<CoinType>(): CurrencyRulesKey<CoinType> {
    CurrencyRulesKey()
}

/// Action disabling permissions marked as true, cannot be reenabled.
public struct DisableAction<phantom CoinType> has store, drop {
    mint: bool,
    burn: bool,
    update_symbol: bool,
    update_name: bool,
    update_description: bool,
    update_icon: bool,
}
/// Action minting new coins.
public struct MintAction<phantom CoinType> has store, drop {
    amount: u64,
}
/// Action burning coins.
public struct BurnAction<phantom CoinType> has store, drop {
    amount: u64,
}
/// Action updating a CoinMetadata object using a locked TreasuryCap.
public struct UpdateAction<phantom CoinType> has store, drop {
    symbol: Option<ascii::String>,
    name: Option<String>,
    description: Option<String>,
    icon_url: Option<ascii::String>,
}

// === Public functions ===

/// Authenticated users can lock a TreasuryCap.
public fun lock_cap<CoinType>(
    auth: Auth,
    account: &mut Account,
    registry: &PackageRegistry,
    treasury_cap: TreasuryCap<CoinType>,
    max_supply: Option<u64>,
) {
    account.verify(auth);

    let rules = CurrencyRules<CoinType> {
        max_supply,
        total_minted: 0,
        total_burned: 0,
        can_mint: true,
        can_burn: true,
        can_update_symbol: true,
        can_update_name: true,
        can_update_description: true,
        can_update_icon: true,
    };
    account.add_managed_data(registry, CurrencyRulesKey<CoinType>(), rules, version::current());
    account::add_managed_asset(account, registry, TreasuryCapKey<CoinType>(), treasury_cap, version::current());
}

/// Lock treasury cap during initialization - works on unshared Accounts
/// This function is for use during account creation, before the account is shared.
/// SAFETY: This function MUST only be called on unshared Accounts.
/// Calling this on a shared Account bypasses Auth checks.
public(package) fun do_lock_cap_unshared< CoinType>(
    account: &mut Account,
    registry: &PackageRegistry,
    treasury_cap: TreasuryCap<CoinType>,
) {
    // SAFETY REQUIREMENT: Account must be unshared
    // Default rules with no max supply
    let rules = CurrencyRules<CoinType> {
        max_supply: option::none(),
        total_minted: 0,
        total_burned: 0,
        can_mint: true,
        can_burn: true,
        can_update_symbol: true,
        can_update_name: true,
        can_update_description: true,
        can_update_icon: true,
    };
    account.add_managed_data(registry, CurrencyRulesKey<CoinType>(), rules, version::current());
    account::add_managed_asset(account, registry, TreasuryCapKey<CoinType>(), treasury_cap, version::current());
}

/// Mint coins during initialization - works on unshared Accounts
/// Transfers minted coins directly to recipient
/// SAFETY: This function MUST only be called on unshared Accounts.
/// Calling this on a shared Account bypasses Auth checks.
public(package) fun do_mint_unshared< CoinType>(
    account: &mut Account,
    registry: &PackageRegistry,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    // SAFETY REQUIREMENT: Account must be unshared
    let rules: &mut CurrencyRules<CoinType> =
        account.borrow_managed_data_mut(registry, CurrencyRulesKey<CoinType>(), version::current());

    assert!(rules.can_mint, EMintDisabled);
    if (rules.max_supply.is_some()) {
        let total_supply = rules.total_minted - rules.total_burned;
        assert!(amount + total_supply <= *rules.max_supply.borrow(), EMaxSupply);
    };

    rules.total_minted = rules.total_minted + amount;

    let cap: &mut TreasuryCap<CoinType> =
        account.borrow_managed_asset_mut(registry, TreasuryCapKey<CoinType>(), version::current());

    let coin = cap.mint(amount, ctx);
    transfer::public_transfer(coin, recipient);
}

/// Mint coins to Coin object during initialization - works on unshared Accounts
/// Returns Coin for further use in the same transaction
public(package) fun do_mint_to_coin_unshared< CoinType>(
    account: &mut Account,
    registry: &PackageRegistry,
    amount: u64,
    ctx: &mut TxContext,
): Coin<CoinType> {
    let rules: &mut CurrencyRules<CoinType> =
        account.borrow_managed_data_mut(registry, CurrencyRulesKey<CoinType>(), version::current());

    assert!(rules.can_mint, EMintDisabled);
    if (rules.max_supply.is_some()) {
        let total_supply = rules.total_minted - rules.total_burned;
        assert!(amount + total_supply <= *rules.max_supply.borrow(), EMaxSupply);
    };

    rules.total_minted = rules.total_minted + amount;

    let cap: &mut TreasuryCap<CoinType> =
        account.borrow_managed_asset_mut(registry, TreasuryCapKey<CoinType>(), version::current());

    cap.mint(amount, ctx)
}

/// Checks if a TreasuryCap exists for a given coin type.
public fun has_cap<CoinType>(
    account: &Account
): bool {
    account.has_managed_asset(TreasuryCapKey<CoinType>())
}

/// Borrows a mutable reference to the TreasuryCap for a given coin type.
/// This is used by oracle mints and other patterns that need direct cap access
/// to bypass object-level policies (only Account access matters).
public fun borrow_treasury_cap_mut<CoinType>(
    account: &mut Account,
    registry: &PackageRegistry,
): &mut TreasuryCap<CoinType> {
    account.borrow_managed_asset_mut(registry, TreasuryCapKey<CoinType>(), version::current())
}

/// Borrows the CurrencyRules for a given coin type.
public fun borrow_rules<CoinType>(
    account: &Account,
    registry: &PackageRegistry
): &CurrencyRules<CoinType> {
    account.borrow_managed_data(registry, CurrencyRulesKey<CoinType>(), version::current())
}

/// Returns the total supply of a given coin type.
public fun coin_type_supply<CoinType>(account: &Account, registry: &PackageRegistry): u64 {
    let cap: &TreasuryCap<CoinType> =
        account.borrow_managed_asset(registry, TreasuryCapKey<CoinType>(), version::current());
    cap.total_supply()
}

/// Returns the maximum supply of a given coin type.
public fun max_supply<CoinType>(lock: &CurrencyRules<CoinType>): Option<u64> {
    lock.max_supply
}

/// Returns the total amount minted of a given coin type.
public fun total_minted<CoinType>(lock: &CurrencyRules<CoinType>): u64 {
    lock.total_minted
}

/// Returns the total amount burned of a given coin type.
public fun total_burned<CoinType>(lock: &CurrencyRules<CoinType>): u64 {
    lock.total_burned
}

/// Returns true if the coin type can mint.
public fun can_mint<CoinType>(lock: &CurrencyRules<CoinType>): bool {
    lock.can_mint
}

/// Returns true if the coin type can burn.
public fun can_burn<CoinType>(lock: &CurrencyRules<CoinType>): bool {
    lock.can_burn
}

/// Returns true if the coin type can update the symbol.
public fun can_update_symbol<CoinType>(lock: &CurrencyRules<CoinType>): bool {
    lock.can_update_symbol
}

/// Returns true if the coin type can update the name.
public fun can_update_name<CoinType>(lock: &CurrencyRules<CoinType>): bool {
    lock.can_update_name
}

/// Returns true if the coin type can update the description.
public fun can_update_description<CoinType>(lock: &CurrencyRules<CoinType>): bool {
    lock.can_update_description
}

/// Returns true if the coin type can update the icon.
public fun can_update_icon<CoinType>(lock: &CurrencyRules<CoinType>): bool {
    lock.can_update_icon
}

/// Read metadata from a CoinMetadata object
/// Simple helper to extract all metadata fields in one call
/// Returns: (decimals, symbol, name, description, icon_url)
public fun read_coin_metadata<CoinType>(
    metadata: &CoinMetadata<CoinType>,
): (u8, ascii::String, String, String, ascii::String) {
    (
        metadata.get_decimals(),
        metadata.get_symbol(),
        metadata.get_name(),
        metadata.get_description(),
        metadata.get_icon_url().extract().inner_url()
    )
}

/// Anyone can burn coins they own if enabled.
public fun public_burn<Config: store, CoinType>(
    account: &mut Account,
    registry: &PackageRegistry,
    coin: Coin<CoinType>
) {
    let rules_mut: &mut CurrencyRules<CoinType> =
        account.borrow_managed_data_mut(registry, CurrencyRulesKey<CoinType>(), version::current());
    assert!(rules_mut.can_burn, EBurnDisabled);
    rules_mut.total_burned = rules_mut.total_burned + coin.value();

    let cap_mut: &mut TreasuryCap<CoinType> =
        account.borrow_managed_asset_mut(registry, TreasuryCapKey<CoinType>(), version::current());
    cap_mut.burn(coin);
}

// === Destruction Functions ===

/// Destroy a MintAction after serialization
public fun destroy_mint_action<CoinType>(action: MintAction<CoinType>) {
    let MintAction { amount: _ } = action;
}

/// Destroy a BurnAction after serialization
public fun destroy_burn_action<CoinType>(action: BurnAction<CoinType>) {
    let BurnAction { amount: _ } = action;
}

// Intent functions

/// Creates a DisableAction and adds it to an intent.

/// Processes a DisableAction and disables the permissions marked as true.
public fun do_disable<Outcome: store, CoinType, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version_witness: VersionWitness,
    _intent_witness: IW,
) {
    executable.intent().assert_is_account(account.addr());

    // Get BCS bytes from ActionSpec
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // CRITICAL: Assert that the action type is what we expect
    action_validation::assert_action_type<CurrencyDisable>(spec);


    let action_data = intents::action_spec_data(spec);

    // Check version before deserialization
    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // Create BCS reader and deserialize
    let mut reader = bcs::new(*action_data);
    let mint = bcs::peel_bool(&mut reader);
    let burn = bcs::peel_bool(&mut reader);
    let update_symbol = bcs::peel_bool(&mut reader);
    let update_name = bcs::peel_bool(&mut reader);
    let update_description = bcs::peel_bool(&mut reader);
    let update_icon = bcs::peel_bool(&mut reader);

    // Validate all bytes consumed
    bcs_validation::validate_all_bytes_consumed(reader);

    let rules_mut: &mut CurrencyRules<CoinType> =
        account.borrow_managed_data_mut(registry, CurrencyRulesKey<CoinType>(), version_witness);

    // if disabled, can be true or false, it has no effect
    if (mint) rules_mut.can_mint = false;
    if (burn) rules_mut.can_burn = false;
    if (update_symbol) rules_mut.can_update_symbol = false;
    if (update_name) rules_mut.can_update_name = false;
    if (update_description) rules_mut.can_update_description = false;
    if (update_icon) rules_mut.can_update_icon = false;

    // Increment action index
    executable::increment_action_idx(executable);
}

/// Deletes a DisableAction from an expired intent.
public fun delete_disable<CoinType>(expired: &mut Expired) {
    let _spec = intents::remove_action_spec(expired);
    // ActionSpec has drop, so it's automatically cleaned up
}


/// Processes an UpdateAction, updates the CoinMetadata.
public fun do_update<Outcome: store, CoinType, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    metadata: &mut CoinMetadata<CoinType>,
    version_witness: VersionWitness,
    _intent_witness: IW,
) {
    executable.intent().assert_is_account(account.addr());

    // Get BCS bytes from ActionSpec
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // CRITICAL: Assert that the action type is what we expect
    action_validation::assert_action_type<CurrencyUpdate>(spec);


    let action_data = intents::action_spec_data(spec);

    // Check version before deserialization
    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // Create BCS reader and deserialize
    let mut reader = bcs::new(*action_data);

    // Deserialize Option fields
    let symbol = if (bcs::peel_bool(&mut reader)) {
        option::some(bcs::peel_vec_u8(&mut reader).to_ascii_string())
    } else {
        option::none()
    };

    let name = if (bcs::peel_bool(&mut reader)) {
        option::some(bcs::peel_vec_u8(&mut reader).to_string())
    } else {
        option::none()
    };

    let description = if (bcs::peel_bool(&mut reader)) {
        option::some(bcs::peel_vec_u8(&mut reader).to_string())
    } else {
        option::none()
    };

    let icon_url = if (bcs::peel_bool(&mut reader)) {
        option::some(bcs::peel_vec_u8(&mut reader).to_ascii_string())
    } else {
        option::none()
    };

    // Validate all bytes consumed
    bcs_validation::validate_all_bytes_consumed(reader);

    let rules_mut: &mut CurrencyRules<CoinType> =
        account.borrow_managed_data_mut(registry, CurrencyRulesKey<CoinType>(), version_witness);

    if (!rules_mut.can_update_symbol) assert!(symbol.is_none(), ECannotUpdateSymbol);
    if (!rules_mut.can_update_name) assert!(name.is_none(), ECannotUpdateName);
    if (!rules_mut.can_update_description) assert!(description.is_none(), ECannotUpdateDescription);
    if (!rules_mut.can_update_icon) assert!(icon_url.is_none(), ECannotUpdateIcon);

    let (default_symbol, default_name, default_description, default_icon_url) =
        (metadata.get_symbol(), metadata.get_name(), metadata.get_description(), metadata.get_icon_url().extract().inner_url());
    let cap: &TreasuryCap<CoinType> =
        account.borrow_managed_asset(registry, TreasuryCapKey<CoinType>(), version_witness);

    cap.update_symbol(metadata, symbol.get_with_default(default_symbol));
    cap.update_name(metadata, name.get_with_default(default_name));
    cap.update_description(metadata, description.get_with_default(default_description));
    cap.update_icon_url(metadata, icon_url.get_with_default(default_icon_url));

    // Increment action index
    executable::increment_action_idx(executable);
}

/// Deletes an UpdateAction from an expired intent.
public fun delete_update<CoinType>(expired: &mut Expired) {
    let _spec = intents::remove_action_spec(expired);
    // ActionSpec has drop, so it's automatically cleaned up
}

/// Creates a MintAction and adds it to an intent with descriptor.

/// Processes a MintAction, mints and returns new coins.
public fun do_mint<Outcome: store, CoinType, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version_witness: VersionWitness,
    _intent_witness: IW,
    ctx: &mut TxContext
): Coin<CoinType> {
    executable.intent().assert_is_account(account.addr());

    // Get BCS bytes from ActionSpec
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // CRITICAL: Assert that the action type is what we expect
    action_validation::assert_action_type<CurrencyMint>(spec);


    let action_data = intents::action_spec_data(spec);

    // Check version before deserialization
    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // Create BCS reader and deserialize
    let mut reader = bcs::new(*action_data);
    let amount = bcs::peel_u64(&mut reader);

    // Validate all bytes consumed
    bcs_validation::validate_all_bytes_consumed(reader);

    let total_supply = currency::coin_type_supply<CoinType>(account, registry);
    let rules_mut: &mut CurrencyRules<CoinType> =
        account.borrow_managed_data_mut(registry, CurrencyRulesKey<CoinType>(), version_witness);

    assert!(rules_mut.can_mint, EMintDisabled);
    if (rules_mut.max_supply.is_some()) assert!(amount + total_supply <= *rules_mut.max_supply.borrow(), EMaxSupply);

    rules_mut.total_minted = rules_mut.total_minted + amount;

    let cap_mut: &mut TreasuryCap<CoinType> =
        account.borrow_managed_asset_mut(registry, TreasuryCapKey<CoinType>(), version_witness);

    // Mint the coin
    let coin = cap_mut.mint(amount, ctx);

    // Store coin info in context for potential use by later actions
    // PTBs handle object flow naturally - no context storage needed

    // Increment action index
    executable::increment_action_idx(executable);

    coin
}

/// Deletes a MintAction from an expired intent.
public fun delete_mint<CoinType>(expired: &mut Expired) {
    let _spec = intents::remove_action_spec(expired);
    // ActionSpec has drop, so it's automatically cleaned up
}


/// Processes a BurnAction, burns coins taken from executable_resources.
/// DETERMINISTIC: Takes coin from executable_resources (from previous action), NOT from PTB!
/// The resource_name in ActionSpec tells us which resource to take.
public fun do_init_burn<Outcome: store, CoinType, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    version_witness: VersionWitness,
    _intent_witness: IW,
) {
    executable.intent().assert_is_account(account.addr());

    // Get BCS bytes from ActionSpec
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // CRITICAL: Assert that the action type is what we expect
    action_validation::assert_action_type<CurrencyBurn>(spec);


    let action_data = intents::action_spec_data(spec);

    // Check version before deserialization
    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // Create BCS reader and deserialize
    // ActionSpec contains: amount, resource_name (where to take coin from)
    let mut reader = bcs::new(*action_data);
    let amount = bcs::peel_u64(&mut reader);
    let resource_name = std::string::utf8(bcs::peel_vec_u8(&mut reader));

    // Validate all bytes consumed
    bcs_validation::validate_all_bytes_consumed(reader);

    // Take coin from executable_resources (deterministic - from previous action!)
    let coin: Coin<CoinType> = executable_resources::take_coin(
        executable::uid_mut(executable),
        resource_name,
    );

    assert!(amount == coin.value(), EWrongValue);

    let rules_mut: &mut CurrencyRules<CoinType> =
        account.borrow_managed_data_mut(registry, CurrencyRulesKey<CoinType>(), version_witness);
    assert!(rules_mut.can_burn, EBurnDisabled);

    rules_mut.total_burned = rules_mut.total_burned + amount;

    let cap_mut: &mut TreasuryCap<CoinType> =
        account.borrow_managed_asset_mut(registry, TreasuryCapKey<CoinType>(), version_witness);

    // Increment action index
    executable::increment_action_idx(executable);

    cap_mut.burn(coin);
}

/// Deletes a BurnAction from an expired intent.
public fun delete_burn<CoinType>(expired: &mut Expired) {
    let _spec = intents::remove_action_spec(expired);
    // ActionSpec has drop, so it's automatically cleaned up
}

// === Removal Functions (for launchpad failure cases) ===

/// Remove TreasuryCap from Account during init and transfer to recipient
/// This is package-visible so only trusted modules can call it
/// Used when a launchpad raise fails and we need to return the cap to creator
public(package) fun do_remove_treasury_cap_unshared<CoinType>(
    account: &mut Account,
    registry: &PackageRegistry,
    recipient: address,
) {
    // Extract TreasuryCap from Account
    let treasury_cap = account::remove_managed_asset<TreasuryCapKey<CoinType>, TreasuryCap<CoinType>>(
        account,
        registry,
        TreasuryCapKey<CoinType>(),
        version::current()
    );

    // Also remove the CurrencyRules since the cap is leaving
    let rules = account::remove_managed_data<CurrencyRulesKey<CoinType>, CurrencyRules<CoinType>>(
        account,
        registry,
        CurrencyRulesKey<CoinType>(),
        version::current()
    );

    // Properly destroy the CurrencyRules struct
    let CurrencyRules {
        max_supply: _,
        total_minted: _,
        total_burned: _,
        can_mint: _,
        can_burn: _,
        can_update_symbol: _,
        can_update_name: _,
        can_update_description: _,
        can_update_icon: _,
    } = rules;

    // Transfer TreasuryCap to recipient
    transfer::public_transfer(treasury_cap, recipient);
}

/// Init action: Remove TreasuryCap from Account and return to recipient
/// Follows the 3-layer action execution pattern (see IMPORTANT_ACTION_EXECUTION_PATTERN.md)
/// Used for failure_specs in launchpad raises - returns treasury cap to creator when raise fails
public fun do_init_remove_treasury_cap<Config: store, Outcome: store, CoinType, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    _version_witness: VersionWitness,
    _intent_witness: IW,
) {
    // 1. Assert account ownership
    executable.intent().assert_is_account(account.addr());

    // 2. Get current ActionSpec from Executable
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // 3. CRITICAL: Validate action type (using marker type)
    action_validation::assert_action_type<RemoveTreasuryCap>(spec);

    // 4. Check version
    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // 5. Deserialize ReturnTreasuryCapAction from BCS bytes
    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);
    let recipient = bcs::peel_address(&mut reader);

    // 6. Validate all bytes consumed (security)
    bcs_validation::validate_all_bytes_consumed(reader);

    // 7. Execute with deserialized params
    do_remove_treasury_cap_unshared<CoinType>(
        account,
        registry,
        recipient,  // ← From ActionSpec, not PTB!
    );

    // 8. Increment action index
    executable::increment_action_idx(executable);
}

/// Init action: Remove CoinMetadata from Account and return to recipient
/// Follows the 3-layer action execution pattern (see IMPORTANT_ACTION_EXECUTION_PATTERN.md)
/// Used for failure_specs in launchpad raises - returns metadata to creator when raise fails
public fun do_init_remove_metadata<Config: store, Outcome: store, Key: copy + drop + store, CoinType, IW: drop>(
    executable: &mut Executable<Outcome>,
    account: &mut Account,
    registry: &PackageRegistry,
    key: Key,
    _version_witness: VersionWitness,
    _intent_witness: IW,
) {
    // 1. Assert account ownership
    executable.intent().assert_is_account(account.addr());

    // 2. Get current ActionSpec from Executable
    let specs = executable.intent().action_specs();
    let spec = specs.borrow(executable.action_idx());

    // 3. CRITICAL: Validate action type (using marker type)
    action_validation::assert_action_type<RemoveMetadata>(spec);

    // 4. Check version
    let spec_version = intents::action_spec_version(spec);
    assert!(spec_version == 1, EUnsupportedActionVersion);

    // 5. Deserialize ReturnMetadataAction from BCS bytes
    let action_data = intents::action_spec_data(spec);
    let mut reader = bcs::new(*action_data);
    let recipient = bcs::peel_address(&mut reader);

    // 6. Validate all bytes consumed (security)
    bcs_validation::validate_all_bytes_consumed(reader);

    // 7. Remove metadata from account
    let metadata = account::remove_managed_asset<Key, CoinMetadata<CoinType>>(
        account,
        registry,
        key,
        version::current()
    );

    // 8. Transfer metadata to recipient
    transfer::public_transfer(metadata, recipient);

    // 9. Increment action index
    executable::increment_action_idx(executable);
}
