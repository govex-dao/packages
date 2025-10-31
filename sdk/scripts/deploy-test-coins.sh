#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$(dirname "$SCRIPT_DIR")"
PACKAGES_DIR="$(dirname "$(dirname "$SDK_DIR")")"
DEPLOYMENTS_DIR="$SDK_DIR/deployments"
TMP_DIR="$SDK_DIR/tmp"

mkdir -p "$DEPLOYMENTS_DIR"
mkdir -p "$TMP_DIR"

echo -e "${BLUE}=== Deploying Test Coins for E2E Tests ===${NC}"
echo ""

# Function to deploy a test coin
deploy_test_coin() {
    local coin_name=$1
    local coin_symbol=$2
    local coin_desc=$3
    
    echo -e "${YELLOW}Deploying $coin_name...${NC}"
    
    # Create temporary coin module
    local coin_dir="$TMP_DIR/${coin_name}_coin"
    mkdir -p "$coin_dir/sources"
    
    # Create Move.toml
    cat > "$coin_dir/Move.toml" << MOVETOML
[package]
name = "${coin_name}_coin"
edition = "2024"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
${coin_name}_coin = "0x0"
MOVETOML

    # Create coin module
    cat > "$coin_dir/sources/coin.move" << 'MOVECODE'
module ${coin_name}_coin::coin {
    use sui::coin;

    public struct COIN has drop {}

    fun init(witness: COIN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9, // decimals
            b"${coin_symbol}",
            b"${coin_name}",
            b"${coin_desc}",
            option::none(),
            ctx
        );

        transfer::public_transfer(treasury, ctx.sender());
        transfer::public_transfer(metadata, ctx.sender());
    }
}
MOVECODE

    # Replace template variables
    sed -i '' "s/\${coin_name}/${coin_name}/g" "$coin_dir/sources/coin.move"
    sed -i '' "s/\${coin_symbol}/${coin_symbol}/g" "$coin_dir/sources/coin.move"
    sed -i '' "s/\${coin_desc}/${coin_desc}/g" "$coin_dir/sources/coin.move"

    # Build
    echo "Building ${coin_name}..."
    cd "$coin_dir"
    sui move build --skip-fetch-latest-git-deps 2>&1 | grep -E "(ERROR|error)" || true
    
    # Publish and capture JSON (stderr contains JSON + warnings)
    echo "Publishing ${coin_name}..."
    local temp_output="/tmp/deploy_${coin_name}_$$.txt"
    local json_file="$DEPLOYMENTS_DIR/${coin_name}.json"
    
    # Capture all output
    sui client publish --gas-budget 100000000 --json > "$temp_output" 2>&1
    
    # Extract JSON (everything between first { and last })
    # Find the start of the JSON object
    local json_start=$(grep -n "^{" "$temp_output" | tail -1 | cut -d: -f1)
    
    if [ -n "$json_start" ]; then
        # Extract from that line to end
        tail -n +$json_start "$temp_output" > "$json_file"
    else
        echo -e "${RED}✗ Failed to extract JSON from output${NC}"
        cat "$temp_output"
        rm -f "$temp_output"
        return 1
    fi
    
    rm -f "$temp_output"
    
    # Extract package ID
    local pkg_id=$(jq -r '.objectChanges[]? | select(.type == "published") | .packageId' "$json_file" 2>/dev/null | head -1)
    
    # Extract TreasuryCap
    local treasury_cap=$(jq -r '.objectChanges[]? | select(.objectType? and (.objectType | contains("::coin::TreasuryCap"))) | .objectId' "$json_file" 2>/dev/null | head -1)
    
    # Extract CoinMetadata  
    local metadata=$(jq -r '.objectChanges[]? | select(.objectType? and (.objectType | contains("::coin::CoinMetadata"))) | .objectId' "$json_file" 2>/dev/null | head -1)
    
    # Get coin type
    local coin_type=$(jq -r '.objectChanges[]? | select(.objectType? and (.objectType | contains("::coin::TreasuryCap"))) | .objectType' "$json_file" 2>/dev/null | sed 's/.*<\(.*\)>.*/\1/' | head -1)
    
    if [ -n "$pkg_id" ] && [ -n "$treasury_cap" ] && [ -n "$metadata" ]; then
        echo -e "${GREEN}✓ $coin_name deployed successfully${NC}"
        echo "  Package ID: $pkg_id"
        echo "  TreasuryCap: $treasury_cap"
        echo "  Metadata: $metadata"
        echo "  Type: $coin_type"
        echo "  JSON saved to: $json_file"
        echo "$coin_type"  # Return coin type for later use
        return 0
    else
        echo -e "${RED}✗ Failed to deploy $coin_name${NC}"
        echo "Package ID: $pkg_id"
        echo "TreasuryCap: $treasury_cap"
        echo "Metadata: $metadata"
        cat "$json_file"
        return 1
    fi
}

# Deploy both test coins
echo "Deploying test coins on devnet..."
echo ""

ASSET_TYPE=$(deploy_test_coin "test_asset" "ASSET" "Test asset coin for DAO governance" | tail -1)
echo ""
STABLE_TYPE=$(deploy_test_coin "test_stable" "STABLE" "Test stable coin for payments" | tail -1)
echo ""

# Add stable coin to factory allowed types
echo -e "${BLUE}=== Adding Test Stable to Factory Allowed Types ===${NC}"

FACTORY_JSON="$PACKAGES_DIR/packages/deployments/futarchy_factory.json"

if [ -f "$FACTORY_JSON" ]; then
    FACTORY_PKG=$(jq -r '.objectChanges[]? | select(.type == "published") | .packageId' "$FACTORY_JSON" 2>/dev/null | head -1)
    FACTORY_OBJ=$(jq -r '.objectChanges[]? | select(.objectType? and (.objectType | contains("::factory::Factory"))) | .objectId' "$FACTORY_JSON" 2>/dev/null | head -1)
    OWNER_CAP=$(jq -r '.objectChanges[]? | select(.objectType? and (.objectType | contains("::factory::FactoryOwnerCap"))) | .objectId' "$FACTORY_JSON" 2>/dev/null | head -1)

    if [ -n "$FACTORY_PKG" ] && [ -n "$FACTORY_OBJ" ] && [ -n "$OWNER_CAP" ] && [ -n "$STABLE_TYPE" ]; then
        echo "Factory Package: $FACTORY_PKG"
        echo "Factory Object: $FACTORY_OBJ"
        echo "Owner Cap: $OWNER_CAP"
        echo "Adding stable type: $STABLE_TYPE"
        echo ""

        sui client call \
            --package "$FACTORY_PKG" \
            --module factory \
            --function add_allowed_stable_type \
            --type-args "$STABLE_TYPE" \
            --args "$FACTORY_OBJ" "$OWNER_CAP" 0x6 \
            --gas-budget 10000000

        echo -e "${GREEN}✓ Test stable coin added to factory allowed types${NC}"
    else
        echo -e "${YELLOW}⚠ Could not add stable type to factory (missing factory deployment or coin type)${NC}"
        echo "  Factory PKG: $FACTORY_PKG"
        echo "  Factory OBJ: $FACTORY_OBJ"
        echo "  Owner Cap: $OWNER_CAP"
        echo "  Stable Type: $STABLE_TYPE"
    fi
else
    echo -e "${YELLOW}⚠ Factory deployment not found at: $FACTORY_JSON${NC}"
    echo "  Test stable will need to be manually added to allowed types"
fi

echo ""
echo -e "${GREEN}=== Test Coins Deployed ===${NC}"
echo ""
echo "Test coin deployment JSONs saved to:"
echo "  - $DEPLOYMENTS_DIR/test_asset.json"
echo "  - $DEPLOYMENTS_DIR/test_stable.json"
echo ""
echo "The test scripts will automatically load these coins from the JSON files."
