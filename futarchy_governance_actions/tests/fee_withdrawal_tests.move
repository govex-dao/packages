#[test_only]
module futarchy_governance_actions::fee_withdrawal_tests;

use futarchy_markets_core::fee::{Self, FeeManager, FeeAdminCap};
use sui::clock::{Self, Clock};
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

// === Test Constants ===
const ADMIN: address = @0xAD;
const USER: address = @0x1;

// === Test Helpers ===

/// Create a test clock
#[test_only]
fun create_test_clock(timestamp_ms: u64, ctx: &mut TxContext): Clock {
    let mut clock = clock::create_for_testing(ctx);
    clock::set_for_testing(&mut clock, timestamp_ms);
    clock
}

// === Basic Fee Withdrawal Tests ===

#[test]
/// Test basic fee deposit and withdrawal flow for SUI
fun test_deposit_and_withdraw_sui_fees() {
    let mut scenario = ts::begin(ADMIN);

    // Create test clock
    let clock = create_test_clock(0, ts::ctx(&mut scenario));

    // Create FeeManager and FeeAdminCap for testing
    fee::create_fee_manager_for_testing(ts::ctx(&mut scenario));
    ts::next_tx(&mut scenario, ADMIN);

    let mut fee_manager = ts::take_shared<FeeManager>(&scenario);
    let fee_admin_cap = ts::take_from_sender<FeeAdminCap>(&scenario);

    // Deposit some SUI fees
    let fee_amount = 1_000_000_000; // 1 SUI
    let fees = coin::mint_for_testing<SUI>(fee_amount, ts::ctx(&mut scenario));
    let fees_balance = coin::into_balance(fees);
    fee::deposit_fees<SUI>(&mut fee_manager, fees_balance, &clock);

    // Verify fees were deposited
    assert!(fee::get_fee_balance<SUI>(&fee_manager) == fee_amount, 0);

    // Withdraw all fees
    let withdrawn = fee::withdraw_fees_as_coin<SUI>(
        &mut fee_manager,
        &fee_admin_cap,
        0, // 0 means withdraw all
        &clock,
        ts::ctx(&mut scenario),
    );

    // Verify withdrawal amount
    assert!(withdrawn.value() == fee_amount, 1);

    // Verify balance is now zero
    assert!(fee::get_fee_balance<SUI>(&fee_manager) == 0, 2);

    // Clean up
    coin::burn_for_testing(withdrawn);
    ts::return_shared(fee_manager);
    ts::return_to_sender(&scenario, fee_admin_cap);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test partial fee withdrawal
fun test_partial_fee_withdrawal() {
    let mut scenario = ts::begin(ADMIN);
    let clock = create_test_clock(0, ts::ctx(&mut scenario));

    // Create FeeManager
    fee::create_fee_manager_for_testing(ts::ctx(&mut scenario));
    ts::next_tx(&mut scenario, ADMIN);

    let mut fee_manager = ts::take_shared<FeeManager>(&scenario);
    let fee_admin_cap = ts::take_from_sender<FeeAdminCap>(&scenario);

    // Deposit fees
    let total_amount = 10_000_000_000; // 10 SUI
    let fees = coin::mint_for_testing<SUI>(total_amount, ts::ctx(&mut scenario));
    fee::deposit_fees<SUI>(&mut fee_manager, coin::into_balance(fees), &clock);

    // Withdraw partial amount
    let withdraw_amount = 3_000_000_000; // 3 SUI
    let withdrawn = fee::withdraw_fees_as_coin<SUI>(
        &mut fee_manager,
        &fee_admin_cap,
        withdraw_amount,
        &clock,
        ts::ctx(&mut scenario),
    );

    // Verify withdrawal
    assert!(withdrawn.value() == withdraw_amount, 0);
    assert!(fee::get_fee_balance<SUI>(&fee_manager) == total_amount - withdraw_amount, 1);

    // Clean up
    coin::burn_for_testing(withdrawn);
    ts::return_shared(fee_manager);
    ts::return_to_sender(&scenario, fee_admin_cap);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
/// Test withdrawing from empty fee manager returns zero coin
fun test_withdraw_from_empty_manager() {
    let mut scenario = ts::begin(ADMIN);
    let clock = create_test_clock(0, ts::ctx(&mut scenario));

    // Create FeeManager (no fees deposited)
    fee::create_fee_manager_for_testing(ts::ctx(&mut scenario));
    ts::next_tx(&mut scenario, ADMIN);

    let mut fee_manager = ts::take_shared<FeeManager>(&scenario);
    let fee_admin_cap = ts::take_from_sender<FeeAdminCap>(&scenario);

    // Try to withdraw from empty manager
    let withdrawn = fee::withdraw_fees_as_coin<SUI>(
        &mut fee_manager,
        &fee_admin_cap,
        0,
        &clock,
        ts::ctx(&mut scenario),
    );

    // Should return zero coin
    assert!(withdrawn.value() == 0, 0);

    // Clean up
    coin::burn_for_testing(withdrawn);
    ts::return_shared(fee_manager);
    ts::return_to_sender(&scenario, fee_admin_cap);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// === Integration Test Notes ===

/// NOTE: Full end-to-end governance fee withdrawal test would require:
///
/// 1. Setting up protocol DAO Account with managed assets
/// 2. Creating PackageRegistry and registering packages
/// 3. Transferring FeeAdminCap to DAO account as managed asset with key "protocol:fee_admin_cap"
/// 4. Creating a proposal with Intent containing WithdrawFeesToTreasury action
/// 5. Creating Executable from approved proposal
/// 6. Executing the governance action via do_withdraw_fees_to_treasury
/// 7. Verifying fees deposited into DAO vault
///
/// This requires extensive setup across multiple packages (AccountProtocol, futarchy_core, etc.)
/// and is better suited for SDK-level integration tests using TypeScript.
///
/// The tests above verify the core withdrawal functionality works correctly.
/// SDK integration tests should verify the governance action execution flow.
