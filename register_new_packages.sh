#!/bin/bash

REGISTRY="0x582599b1d40503bd43618d678e32f0c4d55ee30e89af985f33a5451787c1f2f5"
ADMIN_CAP="0x8649022d5f4e3199e85a237246790e89de81da210d947a88f104e852ab101c92"

echo "Registering packages in PackageRegistry..."

# Register futarchy_factory
echo "Registering futarchy_factory..."
sui client call \
  --package 0xd0751a5281bd851ac7df5c62cd523239ddfa7dc321a7df3ddfc7400d65938ed6 \
  --module package_registry \
  --function add_package \
  --args "$REGISTRY" "$ADMIN_CAP" "futarchy_factory" 0xaf60dc22ca842d8498bf2a36fd9cc8396b677fa608c5521ae5c8df2f430d0d5c \
  --gas-budget 10000000

# Register futarchy_governance
echo "Registering futarchy_governance..."
sui client call \
  --package 0xd0751a5281bd851ac7df5c62cd523239ddfa7dc321a7df3ddfc7400d65938ed6 \
  --module package_registry \
  --function add_package \
  --args "$REGISTRY" "$ADMIN_CAP" "futarchy_governance" 0xa489033defe9d77ed8963993a85ccfb0e5b3f1dbaa34e386727b1aa724bf1bb5 \
  --gas-budget 10000000

# Register futarchy_governance_actions  
echo "Registering futarchy_governance_actions..."
sui client call \
  --package 0xd0751a5281bd851ac7df5c62cd523239ddfa7dc321a7df3ddfc7400d65938ed6 \
  --module package_registry \
  --function add_package \
  --args "$REGISTRY" "$ADMIN_CAP" "futarchy_governance_actions" 0x736d55ba713e64abc806d9b6749ff9f811c9310170d3c5212afa5a244009ace8 \
  --gas-budget 10000000

echo "✓ All packages registered"
