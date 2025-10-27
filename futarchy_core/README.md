# Futarchy Contract Cardinality

<img width="773" alt="image" src="https://github.com/user-attachments/assets/099f2353-a3d0-40f5-a850-c2eb3c7717e4" />


# Sequence Diagram

<img width="1048" alt="image" src="https://github.com/user-attachments/assets/707f7a38-9fce-4a98-a6af-1edd4621cd39" />


# Linting

Using this linter https://www.npmjs.com/package/@mysten/prettier-plugin-move

Run this in root
```
npm run prettier -- -w sources/amm/amm.move  
```

## Concatenating all .Move files for use with LLMs

Run these commands from the packages repository directory (`/Users/admin/govex/packages/`):

**Just Move Framework packages:**
```bash
find \
  move-framework/packages/protocol/sources \
  move-framework/packages/actions/sources \
  -type f -name '*.move' ! -name "*test*" ! -name "*Test*" -exec cat {} + > move_framework_only.txt
```

**Just Futarchy packages:**
```bash
find \
  futarchy_one_shot_utils/sources \
  futarchy_types/sources \
  futarchy_core/sources \
  futarchy_markets_core/sources \
  futarchy_markets_operations/sources \
  futarchy_markets_primitives/sources \
  futarchy_oracle_actions/sources \
  futarchy_factory/sources \
  futarchy_governance/sources \
  futarchy_governance_actions/sources \
  futarchy_actions/sources \
  -type f -name '*.move' ! -name "*test*" ! -name "*Test*" -exec cat {} + > futarchy_packages.txt
```

**All packages (Move Framework + Futarchy):**
```bash
find \
    move-framework/packages/protocol/sources \
    move-framework/packages/actions/sources \
    futarchy_one_shot_utils/sources \
    futarchy_types/sources \
    futarchy_core/sources \
    futarchy_markets_core/sources \
    futarchy_markets_operations/sources \
    futarchy_markets_primitives/sources \
    futarchy_oracle_actions/sources \
    futarchy_factory/sources \
    futarchy_governance/sources \
    futarchy_governance_actions/sources \
    futarchy_actions/sources \
    -type f -name '*.move' ! -name "*test*" ! -name "*Test*" -exec cat {} + > all_packages.txt
```


```
git add -N .
git diff HEAD | pbcopy
```


```
git diff | pbcopy
```


```
for pkg in */; do [ -f "$pkg/Move.toml" ] && (cd "$pkg" && output=$(sui move build --silence-warnings 2>&1 || true) && error_count=$(echo "$output" | grep -c -i "error") && echo "Errors in $pkg: $error_count"); done
```

``` tracing
/usr/local/bin/sui move test --coverage
~/sui-tracing/target/release/sui move coverage summary
~/sui-tracing/target/release/sui move coverage source --module math 
 ```

 script for getting un convered lines

 contracts/futarchy_one_shot_utils/extract_uncovered.sh

 more info here https://medium.com/the-sui-stack/code-in-move-7-unit-testing-on-sui-c22f0c2134a0