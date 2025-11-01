  ---
  ⚠️ Critical Issues

  1. Type Name Fragility (C-)
  let expected_type = type_name::get<CreateStreamAction>();
  assert!(action_specs::action_type(action_spec) == expected_type, ...);

  Problem: type_name::get() includes the package ID. On package upgrades, this
  breaks!

  Before upgrade: 0x123::stream_init_actions::CreateStreamAction
  After upgrade:  0x456::stream_init_actions::CreateStreamAction
                  ^^^^ Different! Validation fails!

  Fix: Use a string constant or dedicated type discriminator:
  const ACTION_STREAM: vector<u8> = b"CREATE_STREAM_V1";

  public struct CreateStreamAction has drop {
      action_type_tag: vector<u8>, // Set to ACTION_STREAM
      // ... fields
  }

  2. Manual BCS Deserialization (D)
  let mut bcs_reader = bcs::new(*action_data);
  let vault_name = string::utf8(bcs::peel_vec_u8(&mut bcs_reader));
  let beneficiary = bcs::peel_address(&mut bcs_reader);
  // ... 9 more lines

  Problems:
  - ❌ Field order dependency - Add a field? Breaks everything
  - ❌ Type mismatch hell - Wrong peel function = runtime abort
  - ❌ Option handling fragile - Manual bool + conditional peel
  - ❌ Maintenance nightmare - Every struct change needs dispatcher update

  Better Alternatives:

  Option A: Use store + Dynamic Fields (Recommended)
  public struct CreateStreamAction has store, drop {
      vault_name: String,
      beneficiary: address,
      // ... no BCS needed!
  }

  // Staging:
  df::add(&mut raise.id, ActionKey { index: 0 }, action); // Store directly

  // Dispatching:
  let action: &CreateStreamAction = df::borrow(&raise.id, ActionKey { index: 0 });
  // No deserialization!

  Option B: Use Sui's BCS with proper abilities
  public struct CreateStreamAction has drop, copy {
      // With 'copy', can use bcs::from_bytes
  }

  let action: CreateStreamAction = bcs::from_bytes(*action_data); // One line!

  3. Witness Pattern Undocumented (C)
  witness: W,
  What is W? Why is it needed? Where does it come from?

  Missing:
  - Documentation on what witness proves
  - Example of valid witness types
  - Error if wrong witness passed

  4. No Versioning Strategy (C)
  public struct CreateStreamAction has drop {
      // What if we need to add a field?
  }

  Problem: Any change breaks old staged specs. Need:
  public struct CreateStreamActionV1 has drop { ... }
  public struct CreateStreamActionV2 has drop {
      // New fields
  }

  // Dispatcher handles both versions
  match action_version {
      1 => dispatch_v1(...),
      2 => dispatch_v2(...),
  }

  ---
  🤔 Architectural Questions

  1. Why BCS at all?

  You're serializing in Move, storing bytes, then deserializing in Move. This is:
  - Gas expensive (2x serialization cost)
  - Fragile (manual peeling)
  - Complex (version handling hard)

  Alternative: Store typed objects with store ability:
  public struct StagedAction has store {
      action_type: u8, // Discriminator
      stream_action: Option<StreamAction>,
      pool_action: Option<PoolAction>,
      // Only one is Some
  }

  Pros:
  - No serialization overhead
  - Type-safe access
  - Easy versioning (add new variants)
  - Clear error messages

  Cons:
  - Larger on-chain storage (but you're storing anyway)

  2. Hot Potato vs Builder Pattern?

  Current:
  let unshared = begin();
  execute_stream(&mut unshared);
  execute_pool(&mut unshared);
  finalize(unshared); // Must consume

  Alternative - Sui Builder Pattern:
  let mut builder = begin();
  builder.execute_stream();
  builder.execute_pool();
  let dao = builder.finish(); // Returns Account/Pool, not hot potato

  Tradeoff: Hot potato is more restrictive (good for security) but less flexible.

  3. Gas Costs

  Deserializing in Move is expensive. Consider:
  - Current: BCS in Move = ~2-3k gas per field
  - Alternative: Pass deserialized params from TypeScript PTB = 0 gas

  But you'd lose binding! So gas cost is security cost.

  ---
  📊 Overall Grade: B+

  | Aspect           | Grade | Notes                                     |
  |------------------|-------|-------------------------------------------|
  | Security Concept | A+    | Sequential enforcement is brilliant       |
  | Implementation   | B-    | BCS deserialization is fragile            |
  | Maintainability  | C+    | Field order dependency risky              |
  | Gas Efficiency   | B     | BCS overhead acceptable for security      |
  | Upgradeability   | C     | Type name fragility on upgrades           |
  | Documentation    | C     | Missing key details (witness, versioning) |

  ---
  🎯 Recommendations

  Immediate (P0):
  1. Replace type_name::get() with string constants
  2. Add extensive comments on BCS field order
  3. Document the witness pattern

  Short-term (P1):
  4. Consider store + dynamic fields instead of BCS
  5. Add version discriminator to action structs
  6. Write integration tests for full PTB flow

  Long-term (P2):
  7. Consider code-generating dispatchers from structs
  8. Add migration path for action spec upgrades
  9. Benchmark gas costs vs alternative patterns

  ---
  💡 Principal Engineer Take

  The Good: You've identified a real security problem (rug pull risk) and solved it
  with a solid cryptographic binding pattern (staged specs → enforced execution). The
   hot potato + sequential index is clean and correct.

  The Concerning: The implementation details (BCS manual deserialization, type name
  comparison) are fragile in ways that will hurt you in 6 months when you need to
  upgrade or add features.

  The Verdict: Ship it for MVP, but refactor the serialization layer before mainnet.
  Consider this a v0.1 that proves the pattern works, then rebuild with store +
  dynamic fields or generated dispatchers for v1.0.

  Bottom line: Solid architecture, brittle implementation. A+ concept execution, C+
  code maintainability.

  Would you like me to prototype the store + dynamic fields alternative?