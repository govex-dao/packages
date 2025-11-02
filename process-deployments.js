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
  try {
    console.log('Processing deployment JSONs...\n');

    // Check if deployments directory exists
    if (!fs.existsSync(DEPLOYMENTS_DIR)) {
      console.error(`✗ Error: Deployments directory not found: ${DEPLOYMENTS_DIR}`);
      process.exit(1);
    }

    const files = fs.readdirSync(DEPLOYMENTS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort();

    if (files.length === 0) {
      console.error(`✗ Error: No deployment JSON files found in ${DEPLOYMENTS_DIR}`);
      process.exit(1);
    }

    const allProcessed = {};
    let errorCount = 0;

    files.forEach(filename => {
      const packageName = filename.replace('.json', '');
      const filePath = path.join(DEPLOYMENTS_DIR, filename);

      console.log(`Processing: ${packageName}`);

      try {
        const deploymentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const processed = processDeployment(packageName, deploymentData);

        if (!processed.packageId) {
          console.warn(`  ⚠ Warning: No package ID found in ${filename}`);
          errorCount++;
        }

        // Save individual processed file
        const outputPath = path.join(PROCESSED_DIR, filename);
        fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));

        // Add to combined output
        allProcessed[packageName] = processed;

        console.log(`  Package ID: ${processed.packageId || 'N/A'}`);
        console.log(`  UpgradeCap: ${processed.upgradeCap?.objectId || 'N/A'}`);
        console.log(`  Admin Caps: ${processed.adminCaps.length}`);
        console.log(`  Shared Objects: ${processed.sharedObjects.length}`);
        console.log(`  Owned Objects: ${processed.ownedObjects.length}`);
        console.log('');
      } catch (error) {
        console.error(`  ✗ Error processing ${filename}: ${error.message}`);
        errorCount++;
      }
    });

    // Save combined file with all packages
    const combinedPath = path.join(PROCESSED_DIR, '_all-packages.json');
    fs.writeFileSync(combinedPath, JSON.stringify(allProcessed, null, 2));

    console.log(`✓ Processed ${files.length} deployment files`);
    if (errorCount > 0) {
      console.log(`⚠ ${errorCount} file(s) had warnings or errors`);
    }
    console.log(`✓ Individual files saved to: ${PROCESSED_DIR}`);
    console.log(`✓ Combined file saved to: ${combinedPath}`);

    // Exit with error code if there were errors
    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`✗ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main and handle any uncaught errors
try {
  main();
} catch (error) {
  console.error(`✗ Uncaught error: ${error.message}`);
  process.exit(1);
}
