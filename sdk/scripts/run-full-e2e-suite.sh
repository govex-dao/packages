#!/bin/bash

# Run Full E2E Test Suite
# This ensures both tests use the same package deployment

set -e  # Exit on any error

echo "================================================================================"
echo "FULL E2E TEST SUITE"
echo "================================================================================"
echo ""
echo "This script runs:"
echo "  1. Launchpad E2E test (creates fresh DAO with current packages)"
echo "  2. Proposal E2E test (uses DAO from step 1)"
echo ""
echo "IMPORTANT: Do NOT redeploy packages between these tests!"
echo ""

# Step 1: Run launchpad test to create fresh DAO
echo "================================================================================"
echo "STEP 1: LAUNCHPAD E2E TEST"
echo "================================================================================"
echo ""

cd /Users/admin/govex/packages/sdk
npm run launchpad-e2e-two-outcome

if [ $? -ne 0 ]; then
    echo "❌ Launchpad test failed!"
    exit 1
fi

echo ""
echo "✅ Launchpad test completed successfully!"
echo "   DAO info saved to: test-dao-info.json"
echo ""

# Small delay to ensure file is written
sleep 2

# Step 2: Run proposal test using DAO from step 1
echo "================================================================================"
echo "STEP 2: PROPOSAL E2E TEST"
echo "================================================================================"
echo ""

npm run test:proposal-with-swaps

if [ $? -ne 0 ]; then
    echo "❌ Proposal test failed!"
    exit 1
fi

echo ""
echo "================================================================================"
echo "🎉 FULL E2E TEST SUITE PASSED! 🎉"
echo "================================================================================"
echo ""
echo "Both tests completed successfully with the same package deployment."
echo ""
