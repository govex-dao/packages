#!/bin/bash

packages=(
    "move-framework/packages/protocol"
    "move-framework/packages/actions"
    "futarchy_one_shot_utils"
    "futarchy_types"
    "futarchy_core"
    "futarchy_markets_core"
    "futarchy_markets_operations"
    "futarchy_markets_primitives"
    "futarchy_oracle_actions"
    "futarchy_factory"
    "futarchy_governance"
    "futarchy_governance_actions"
    "futarchy_actions"
)

BASE_DIR="/Users/admin/govex/packages"

echo "Running tests for all packages..."
echo ""

for pkg in "${packages[@]}"; do
    echo "========== Testing: $pkg =========="

    if [ -d "$BASE_DIR/$pkg" ]; then
        cd "$BASE_DIR/$pkg"
        result=$(sui move test --silence-warnings 2>&1)
        echo "$result" | grep -E "(Test result:|FAIL)" || echo "Build/test error"
    else
        echo "Directory not found: $BASE_DIR/$pkg"
    fi
    echo ""
done

echo "All tests completed!"
