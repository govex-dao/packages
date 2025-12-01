// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

#[test_only]
module futarchy_core::sponsorship_auth_tests;

use futarchy_core::sponsorship_auth;

// === Test Structs ===

/// Witness from futarchy_core (unauthorized - wrong package)
public struct UnauthorizedWitness has drop {}

// === Security Tests ===

/// Test that a witness from an unauthorized package (futarchy_core) is rejected
/// This verifies the runtime package verification works correctly
#[test]
#[expected_failure(abort_code = sponsorship_auth::EUnauthorizedWitness)]
fun test_unauthorized_package_witness_rejected() {
    // Try to create SponsorshipAuth with a witness from futarchy_core
    // This should fail because only futarchy_governance:: witnesses are allowed
    let _auth = sponsorship_auth::create(UnauthorizedWitness {});
}

/// Test that create_for_testing works (bypasses package verification)
#[test]
fun test_create_for_testing_works() {
    let auth = sponsorship_auth::create_for_testing();
    // Auth was created successfully - the type system ensures it's valid
    // Just need to consume it (has drop ability)
    let _ = auth;
}
