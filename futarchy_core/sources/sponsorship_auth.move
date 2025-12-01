// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Sponsorship authorization witness for proposal sponsorship operations.
///
/// This module lives in futarchy_core (a leaf package) to break the circular
/// dependency between futarchy_markets_core and futarchy_governance.
///
/// Security model:
/// - SponsorshipAuth can only be created via create() which requires a witness
/// - The witness type must come from futarchy_governance package (verified at runtime)
/// - This ensures only authorized modules can create SponsorshipAuth
module futarchy_core::sponsorship_auth;

use std::ascii;
use std::type_name;

// === Errors ===
const EUnauthorizedWitness: u64 = 0;

// === Constants ===
// Only witnesses from futarchy_governance package can create SponsorshipAuth
const AUTHORIZED_PACKAGE_PREFIX: vector<u8> = b"futarchy_governance::";

// === Structs ===

/// Authorization witness for sponsorship operations.
/// Only futarchy_governance package can create instances of this struct.
/// Consumed when calling protected sponsorship functions in proposal.move.
public struct SponsorshipAuth has drop {}

// === Public Functions ===

/// Create a SponsorshipAuth by providing a witness from an authorized package.
/// The witness type must come from futarchy_governance package.
///
/// Example usage (in futarchy_governance::proposal_sponsorship):
/// ```
/// struct Witness has drop {}
/// let auth = sponsorship_auth::create(Witness {});
/// ```
public fun create<W: drop>(_witness: W): SponsorshipAuth {
    // Verify witness comes from authorized package
    assert_authorized_witness<W>();
    SponsorshipAuth {}
}

// === Internal Functions ===

/// Verify that a witness type comes from the authorized package (futarchy_governance)
fun assert_authorized_witness<W: drop>() {
    let witness_type = type_name::get<W>();
    let type_string = type_name::into_string(witness_type);
    let type_bytes = ascii::as_bytes(&type_string);

    // Check that type starts with "futarchy_governance::"
    let prefix = &AUTHORIZED_PACKAGE_PREFIX;
    let prefix_len = vector::length(prefix);
    let type_len = vector::length(type_bytes);

    assert!(type_len >= prefix_len, EUnauthorizedWitness);

    let mut i = 0;
    while (i < prefix_len) {
        assert!(
            *vector::borrow(type_bytes, i) == *vector::borrow(prefix, i),
            EUnauthorizedWitness
        );
        i = i + 1;
    };
}

// === Test Helpers ===

#[test_only]
/// Create a SponsorshipAuth for testing purposes.
/// This bypasses the package verification and should only be used in tests.
public fun create_for_testing(): SponsorshipAuth {
    SponsorshipAuth {}
}
