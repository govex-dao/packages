#!/bin/bash

# Script to run tests for all packages one by one
# Press Enter to continue after each package

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
    "action_tests"
)

BASE_DIR="/Users/admin/govex/packages"

echo "=================================="
echo "Running tests for all packages"
echo "Press Enter after each package to continue"
echo "=================================="
echo ""

for pkg in "${packages[@]}"; do
    echo ""
    echo "=================================="
    echo "Package: $pkg"
    echo "=================================="

    if [ -d "$BASE_DIR/$pkg" ]; then
        cd "$BASE_DIR/$pkg"
        echo "Running: sui move test --silence-warnings"
        echo ""
        sui move test --silence-warnings

        echo ""
        echo "Finished: $pkg"
        echo "Press Enter to continue to next package..."
        read
    else
        echo "WARNING: Directory not found: $BASE_DIR/$pkg"
        echo "Press Enter to continue..."
        read
    fi
done

echo ""
echo "=================================="
echo "All packages tested!"
echo "=================================="
