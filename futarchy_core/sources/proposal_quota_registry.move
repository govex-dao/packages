// Copyright (c) Govex DAO LLC
// SPDX-License-Identifier: BUSL-1.1

/// Proposal quota registry for allowlisted addresses
/// Tracks recurring proposal quotas (N proposals per period at reduced fee)
/// Uses a simple vector for storage (optimized for small lists ~5 addresses)
module futarchy_core::proposal_quota_registry;

use std::string::String;
use sui::clock::Clock;
use sui::event;

// === Errors ===
const EInvalidQuotaParams: u64 = 0;

// === Structs ===

/// Entry in the quota registry: (address, quota_info)
public struct QuotaEntry has copy, drop, store {
    user: address,
    info: QuotaInfo,
}

/// Recurring quota: N proposals per period at reduced fee
public struct QuotaInfo has copy, drop, store {
    /// Number of proposals allowed per period
    quota_amount: u64,
    /// Time period in milliseconds (e.g., 30 days = 2_592_000_000)
    quota_period_ms: u64,
    /// Reduced fee (0 for free)
    reduced_fee: u64,
    /// Period start (aligned to boundaries, not drift)
    period_start_ms: u64,
    /// Usage in current period
    used_in_period: u64,
    /// Number of sponsorships allowed per period
    sponsor_quota_amount: u64,
    /// Sponsorships used in current period
    sponsor_quota_used: u64,
    /// Sponsorship period start (aligned to boundaries, not drift)
    sponsor_period_start_ms: u64,
}

/// Registry for a specific DAO's proposal quotas
/// Uses vector storage - optimized for small lists (~5 addresses max)
/// Note: dao_id validation removed - registry is embedded in FutarchyConfig
/// which is embedded in Account, so ownership is implicit
public struct ProposalQuotaRegistry has copy, drop, store {
    /// Vector of (address, quota_info) entries
    quotas: vector<QuotaEntry>,
}

// === Events ===

public struct QuotasSet has copy, drop {
    dao_id: ID,
    users: vector<address>,
    quota_amount: u64,
    quota_period_ms: u64,
    reduced_fee: u64,
    timestamp: u64,
}

public struct QuotasRemoved has copy, drop {
    dao_id: ID,
    users: vector<address>,
    timestamp: u64,
}

public struct QuotaUsed has copy, drop {
    dao_id: ID,
    user: address,
    remaining: u64,
    timestamp: u64,
}

public struct QuotaRefunded has copy, drop {
    dao_id: ID,
    user: address,
    remaining: u64,
    timestamp: u64,
    reason: String,
}

public struct SponsorQuotasSet has copy, drop {
    dao_id: ID,
    users: vector<address>,
    sponsor_quota_amount: u64,
    timestamp: u64,
}

public struct SponsorQuotaUsed has copy, drop {
    dao_id: ID,
    sponsor: address,
    proposal_id: ID,
    remaining: u64,
    timestamp: u64,
}

public struct SponsorQuotaRefunded has copy, drop {
    dao_id: ID,
    sponsor: address,
    proposal_id: ID,
    remaining: u64,
    timestamp: u64,
    reason: String,
}

// === Public Functions ===

/// Create a new empty quota registry
public fun new(): ProposalQuotaRegistry {
    ProposalQuotaRegistry {
        quotas: vector::empty(),
    }
}

/// Find index of user in quotas vector, returns (found, index)
fun find_user_index(quotas: &vector<QuotaEntry>, user: address): (bool, u64) {
    let mut i = 0;
    let len = quotas.length();
    while (i < len) {
        if (quotas.borrow(i).user == user) {
            return (true, i)
        };
        i = i + 1;
    };
    (false, 0)
}

/// Set quotas for multiple users (batch operation)
/// Pass empty quota_amount to remove quotas
/// dao_id is passed for event emission only (ownership validated by caller via Account access)
public fun set_quotas(
    registry: &mut ProposalQuotaRegistry,
    dao_id: ID,
    users: vector<address>,
    quota_amount: u64,
    quota_period_ms: u64,
    reduced_fee: u64,
    clock: &Clock,
) {
    // Validate params if setting (not removing)
    if (quota_amount > 0) {
        assert!(quota_period_ms > 0, EInvalidQuotaParams);
    };

    let now = clock.timestamp_ms();
    let mut i = 0;
    let len = users.length();

    while (i < len) {
        let user = *users.borrow(i);

        if (quota_amount == 0) {
            // Remove quota
            let (found, idx) = find_user_index(&registry.quotas, user);
            if (found) {
                registry.quotas.remove(idx);
            };
        } else {
            // Set/update quota
            let info = QuotaInfo {
                quota_amount,
                quota_period_ms,
                reduced_fee,
                period_start_ms: now,
                used_in_period: 0,
                sponsor_quota_amount: 0, // Default: no sponsorship quota
                sponsor_quota_used: 0,
                sponsor_period_start_ms: now,
            };

            let (found, idx) = find_user_index(&registry.quotas, user);
            if (found) {
                // Update existing entry
                let entry = registry.quotas.borrow_mut(idx);
                entry.info = info;
            } else {
                // Add new entry
                registry.quotas.push_back(QuotaEntry { user, info });
            };
        };

        i = i + 1;
    };

    // Emit appropriate event
    if (quota_amount == 0) {
        event::emit(QuotasRemoved {
            dao_id,
            users,
            timestamp: now,
        });
    } else {
        event::emit(QuotasSet {
            dao_id,
            users,
            quota_amount,
            quota_period_ms,
            reduced_fee,
            timestamp: now,
        });
    };
}

/// Check quota availability (read-only, no state mutation)
/// Returns (has_quota, reduced_fee)
public fun check_quota_available(
    registry: &ProposalQuotaRegistry,
    user: address,
    clock: &Clock,
): (bool, u64) {
    let (found, idx) = find_user_index(&registry.quotas, user);
    if (!found) {
        return (false, 0)
    };

    let info = &registry.quotas.borrow(idx).info;
    let now = clock.timestamp_ms();

    // Calculate periods elapsed for alignment (no drift)
    let periods_elapsed = (now - info.period_start_ms) / info.quota_period_ms;

    // If period expired, quota resets
    let used = if (periods_elapsed > 0) {
        0
    } else {
        info.used_in_period
    };

    let has_quota = used < info.quota_amount;
    (has_quota, info.reduced_fee)
}

/// Use one quota slot (called AFTER proposal succeeds)
/// This prevents quota loss if proposal creation fails
/// dao_id is passed for event emission only
public fun use_quota(
    registry: &mut ProposalQuotaRegistry,
    dao_id: ID,
    user: address,
    clock: &Clock,
) {
    let (found, idx) = find_user_index(&registry.quotas, user);
    if (!found) {
        return
    };

    let info = &mut registry.quotas.borrow_mut(idx).info;
    let now = clock.timestamp_ms();

    // Reset period if expired (aligned to boundaries)
    let periods_elapsed = (now - info.period_start_ms) / info.quota_period_ms;
    if (periods_elapsed > 0) {
        info.period_start_ms = info.period_start_ms + (periods_elapsed * info.quota_period_ms);
        info.used_in_period = 0;
    };

    // Use one slot (should always have quota here, but safe increment)
    if (info.used_in_period < info.quota_amount) {
        info.used_in_period = info.used_in_period + 1;

        event::emit(QuotaUsed {
            dao_id,
            user,
            remaining: info.quota_amount - info.used_in_period,
            timestamp: now,
        });
    };
}

/// Refund one quota slot (called when proposal using quota is evicted)
/// Only decrements if user has used quota in current period
/// dao_id is passed for event emission only
public fun refund_quota(
    registry: &mut ProposalQuotaRegistry,
    dao_id: ID,
    user: address,
    clock: &Clock,
) {
    use std::string;

    let (found, idx) = find_user_index(&registry.quotas, user);
    if (!found) {
        return
    };

    let info = &mut registry.quotas.borrow_mut(idx).info;
    let now = clock.timestamp_ms();

    // Reset period if expired (aligned to boundaries)
    let periods_elapsed = (now - info.period_start_ms) / info.quota_period_ms;
    if (periods_elapsed > 0) {
        info.period_start_ms = info.period_start_ms + (periods_elapsed * info.quota_period_ms);
        info.used_in_period = 0;

        // Emit event for period reset (no refund needed)
        event::emit(QuotaRefunded {
            dao_id,
            user,
            remaining: info.quota_amount, // Full quota available in new period
            timestamp: now,
            reason: string::utf8(b"period_expired"),
        });
        return
    };

    // Decrement usage if any quota was used
    if (info.used_in_period > 0) {
        info.used_in_period = info.used_in_period - 1;

        // Emit refund event
        event::emit(QuotaRefunded {
            dao_id,
            user,
            remaining: info.quota_amount - info.used_in_period,
            timestamp: now,
            reason: string::utf8(b"proposal_evicted"),
        });
    };
}

// === Sponsorship Quota Functions ===

/// Set sponsorship quotas for multiple users (batch operation)
/// Pass 0 to disable sponsorship quota for users
/// dao_id is passed for event emission only
public fun set_sponsor_quotas(
    registry: &mut ProposalQuotaRegistry,
    dao_id: ID,
    users: vector<address>,
    sponsor_quota_amount: u64,
    clock: &Clock,
) {
    let now = clock.timestamp_ms();
    let mut i = 0;
    let len = users.length();

    while (i < len) {
        let user = *users.borrow(i);

        // Only update if user has existing quota info
        let (found, idx) = find_user_index(&registry.quotas, user);
        if (found) {
            let info = &mut registry.quotas.borrow_mut(idx).info;
            info.sponsor_quota_amount = sponsor_quota_amount;
            info.sponsor_quota_used = 0; // Reset usage
            info.sponsor_period_start_ms = now; // Reset period
        };

        i = i + 1;
    };

    // Emit event
    event::emit(SponsorQuotasSet {
        dao_id,
        users,
        sponsor_quota_amount,
        timestamp: now,
    });
}

/// Check sponsorship quota availability (read-only, no state mutation)
/// Returns (has_quota, remaining)
/// dao_id is passed for API consistency (not used in this read-only function)
public fun check_sponsor_quota_available(
    registry: &ProposalQuotaRegistry,
    _dao_id: ID,
    sponsor: address,
    clock: &Clock,
): (bool, u64) {
    let (found, idx) = find_user_index(&registry.quotas, sponsor);
    if (!found) {
        return (false, 0)
    };

    let info = &registry.quotas.borrow(idx).info;
    let now = clock.timestamp_ms();

    // If no sponsor quota configured, return false
    if (info.sponsor_quota_amount == 0) {
        return (false, 0)
    };

    // Calculate periods elapsed for alignment (no drift)
    let periods_elapsed = (now - info.sponsor_period_start_ms) / info.quota_period_ms;

    // If period expired, quota resets
    let used = if (periods_elapsed > 0) {
        0
    } else {
        info.sponsor_quota_used
    };

    let remaining = info.sponsor_quota_amount - used;
    let has_quota = remaining > 0;
    (has_quota, remaining)
}

/// Use one sponsorship quota slot (called AFTER sponsorship succeeds)
/// dao_id is passed for event emission only
public fun use_sponsor_quota(
    registry: &mut ProposalQuotaRegistry,
    dao_id: ID,
    sponsor: address,
    proposal_id: ID,
    clock: &Clock,
) {
    let (found, idx) = find_user_index(&registry.quotas, sponsor);
    if (!found) {
        return
    };

    let info = &mut registry.quotas.borrow_mut(idx).info;
    let now = clock.timestamp_ms();

    // Skip if no sponsor quota configured
    if (info.sponsor_quota_amount == 0) {
        return
    };

    // Reset period if expired (aligned to boundaries)
    let periods_elapsed = (now - info.sponsor_period_start_ms) / info.quota_period_ms;
    if (periods_elapsed > 0) {
        info.sponsor_period_start_ms =
            info.sponsor_period_start_ms + (periods_elapsed * info.quota_period_ms);
        info.sponsor_quota_used = 0;
    };

    // Use one slot (should always have quota here, but safe increment)
    if (info.sponsor_quota_used < info.sponsor_quota_amount) {
        info.sponsor_quota_used = info.sponsor_quota_used + 1;

        event::emit(SponsorQuotaUsed {
            dao_id,
            sponsor,
            proposal_id,
            remaining: info.sponsor_quota_amount - info.sponsor_quota_used,
            timestamp: now,
        });
    };
}

/// Refund one sponsorship quota slot (called when sponsored proposal is evicted/cancelled)
/// Only decrements if sponsor has used quota in current period
/// dao_id is passed for event emission only
public fun refund_sponsor_quota(
    registry: &mut ProposalQuotaRegistry,
    dao_id: ID,
    sponsor: address,
    proposal_id: ID,
    clock: &Clock,
) {
    use std::string;

    let (found, idx) = find_user_index(&registry.quotas, sponsor);
    if (!found) {
        return
    };

    let info = &mut registry.quotas.borrow_mut(idx).info;
    let now = clock.timestamp_ms();

    // Skip if no sponsor quota configured
    if (info.sponsor_quota_amount == 0) {
        return
    };

    // Reset period if expired (aligned to boundaries)
    let periods_elapsed = (now - info.sponsor_period_start_ms) / info.quota_period_ms;
    if (periods_elapsed > 0) {
        info.sponsor_period_start_ms =
            info.sponsor_period_start_ms + (periods_elapsed * info.quota_period_ms);
        info.sponsor_quota_used = 0;

        // Emit event for period reset (no refund needed)
        event::emit(SponsorQuotaRefunded {
            dao_id,
            sponsor,
            proposal_id,
            remaining: info.sponsor_quota_amount, // Full quota available in new period
            timestamp: now,
            reason: string::utf8(b"period_expired"),
        });
        return
    };

    // Decrement usage if any quota was used
    if (info.sponsor_quota_used > 0) {
        info.sponsor_quota_used = info.sponsor_quota_used - 1;

        // Emit refund event
        event::emit(SponsorQuotaRefunded {
            dao_id,
            sponsor,
            proposal_id,
            remaining: info.sponsor_quota_amount - info.sponsor_quota_used,
            timestamp: now,
            reason: string::utf8(b"proposal_evicted_or_cancelled"),
        });
    };
}

// === View Functions ===

/// Get quota info with remaining count
/// Returns (has_quota, remaining, reduced_fee)
public fun get_quota_status(
    registry: &ProposalQuotaRegistry,
    user: address,
    clock: &Clock,
): (bool, u64, u64) {
    let (found, idx) = find_user_index(&registry.quotas, user);
    if (!found) {
        return (false, 0, 0)
    };

    let info = &registry.quotas.borrow(idx).info;
    let now = clock.timestamp_ms();

    let periods_elapsed = (now - info.period_start_ms) / info.quota_period_ms;
    let used = if (periods_elapsed > 0) { 0 } else { info.used_in_period };
    let remaining = info.quota_amount - used;

    (remaining > 0, remaining, info.reduced_fee)
}

/// Check if user has any quota
public fun has_quota(registry: &ProposalQuotaRegistry, user: address): bool {
    let (found, _) = find_user_index(&registry.quotas, user);
    found
}

// === Getter Functions ===

public fun quota_amount(info: &QuotaInfo): u64 { info.quota_amount }

public fun quota_period_ms(info: &QuotaInfo): u64 { info.quota_period_ms }

public fun reduced_fee(info: &QuotaInfo): u64 { info.reduced_fee }

public fun period_start_ms(info: &QuotaInfo): u64 { info.period_start_ms }

public fun used_in_period(info: &QuotaInfo): u64 { info.used_in_period }

public fun sponsor_quota_amount(info: &QuotaInfo): u64 { info.sponsor_quota_amount }

public fun sponsor_quota_used(info: &QuotaInfo): u64 { info.sponsor_quota_used }

public fun sponsor_period_start_ms(info: &QuotaInfo): u64 { info.sponsor_period_start_ms }

// === Test Helpers ===

#[test_only]
/// Create a new quota registry for testing (legacy signature compatibility)
public fun new_for_testing(_dao_id: ID, _ctx: &mut TxContext): ProposalQuotaRegistry {
    new()
}
