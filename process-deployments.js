#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEPLOYMENTS_DIR = path.join(__dirname, 'deployments');
const PROCESSED_DIR = path.join(__dirname, 'deployments-processed');

// Ensure processed directory exists
if (!fs.existsSync(PROCESSED_DIR)) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

function processDeployment(packageName, deploymentData) {
  const objectChanges = deploymentData.objectChanges || [];
  const result = {
    packageName,
    transactionDigest: deploymentData.digest,
    packageId: null,
    upgradeCap: null,
    adminCaps: [],
    sharedObjects: [],
    ownedObjects: []
  };

  objectChanges.forEach(change => {
    // Skip mutated objects (gas coins, etc)
    if (change.type === 'mutated') {
      return;
    }

    // Extract published package
    if (change.type === 'published') {
      result.packageId = change.packageId;
      return;
    }

    // Only process created objects from here
    if (change.type !== 'created') {
      return;
    }

    const objectType = change.objectType || '';
    const objectId = change.objectId;
    const owner = change.owner;

    // Skip SUI coins and Publisher
    if (objectType.includes('::coin::Coin<0x2::sui::SUI>') ||
        objectType === '0x2::package::Publisher') {
      return;
    }

    // Extract UpgradeCap
    if (objectType === '0x2::package::UpgradeCap') {
      result.upgradeCap = {
        objectId,
        objectType,
        owner
      };
      return;
    }

    // Extract Admin Caps (anything ending with "Cap")
    if (objectType.match(/Cap$/)) {
      result.adminCaps.push({
        name: objectType.split('::').pop(), // Get the last part (e.g., "FactoryOwnerCap")
        objectId,
        objectType,
        owner
      });
      return;
    }

    // Extract Shared Objects
    if (owner && owner.Shared) {
      result.sharedObjects.push({
        name: objectType.split('::').pop(), // Get the last part
        objectId,
        objectType,
        owner,
        initialSharedVersion: owner.Shared.initial_shared_version
      });
      return;
    }

    // Everything else that's owned and not a coin goes to ownedObjects
    if (owner && owner.AddressOwner) {
      result.ownedObjects.push({
        name: objectType.split('::').pop(),
        objectId,
        objectType,
        owner
      });
    }
  });

  return result;
}

function main() {
  console.log('Processing deployment JSONs...\n');

  const files = fs.readdirSync(DEPLOYMENTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  const allProcessed = {};

  files.forEach(filename => {
    const packageName = filename.replace('.json', '');
    const filePath = path.join(DEPLOYMENTS_DIR, filename);

    console.log(`Processing: ${packageName}`);

    const deploymentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const processed = processDeployment(packageName, deploymentData);

    // Save individual processed file
    const outputPath = path.join(PROCESSED_DIR, filename);
    fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));

    // Add to combined output
    allProcessed[packageName] = processed;

    console.log(`  Package ID: ${processed.packageId}`);
    console.log(`  UpgradeCap: ${processed.upgradeCap?.objectId || 'N/A'}`);
    console.log(`  Admin Caps: ${processed.adminCaps.length}`);
    console.log(`  Shared Objects: ${processed.sharedObjects.length}`);
    console.log(`  Owned Objects: ${processed.ownedObjects.length}`);
    console.log('');
  });

  // Save combined file with all packages
  const combinedPath = path.join(PROCESSED_DIR, '_all-packages.json');
  fs.writeFileSync(combinedPath, JSON.stringify(allProcessed, null, 2));

  console.log(`✓ Processed ${files.length} deployment files`);
  console.log(`✓ Individual files saved to: ${PROCESSED_DIR}`);
  console.log(`✓ Combined file saved to: ${combinedPath}`);
}

main();
