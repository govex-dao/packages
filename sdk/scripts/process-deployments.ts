import * as fs from 'fs';
import * as path from 'path';

interface DeploymentJSON {
  digest: string;
  objectChanges?: Array<{
    type: string;
    packageId?: string;
    objectId?: string;
    objectType?: string;
    owner?: any;
  }>;
}

interface ProcessedDeployment {
  packageName: string;
  transactionDigest: string;
  packageId: string;
  upgradeCap?: {
    objectId: string;
    objectType: string;
    owner: any;
  };
  adminCaps: Array<{
    name: string;
    objectId: string;
    objectType: string;
    owner: any;
  }>;
  sharedObjects: Array<{
    name: string;
    objectId: string;
    objectType: string;
    owner: any;
    initialSharedVersion?: number;
  }>;
  ownedObjects: Array<any>;
}

function extractTypeName(fullType: string): string {
  // Extract the simple name from a type like "0xabc::module::TypeName"
  const parts = fullType.split('::');
  return parts[parts.length - 1];
}

function processDeployment(packageName: string, deploymentPath: string): ProcessedDeployment {
  const rawData: DeploymentJSON = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const objectChanges = rawData.objectChanges ?? [];

  const processed: ProcessedDeployment = {
    packageName,
    transactionDigest: rawData.digest,
    packageId: '',
    adminCaps: [],
    sharedObjects: [],
    ownedObjects: [],
  };

  // Find the published package
  const publishedPkg = objectChanges.find((obj) => obj.type === 'published');
  if (publishedPkg?.packageId) {
    processed.packageId = publishedPkg.packageId;
  }

  // Process all created objects
  const createdObjects = objectChanges.filter((obj) => obj.type === 'created');

  for (const obj of createdObjects) {
    if (!obj.objectType || !obj.objectId) continue;

    // UpgradeCap
    if (obj.objectType.includes('::package::UpgradeCap')) {
      processed.upgradeCap = {
        objectId: obj.objectId,
        objectType: obj.objectType,
        owner: obj.owner,
      };
      continue;
    }

    // Admin caps (anything with "AdminCap" or "OwnerCap" in the name)
    if (obj.objectType.includes('AdminCap') || obj.objectType.includes('OwnerCap')) {
      processed.adminCaps.push({
        name: extractTypeName(obj.objectType),
        objectId: obj.objectId,
        objectType: obj.objectType,
        owner: obj.owner,
      });
      continue;
    }

    // Shared objects
    if (obj.owner && typeof obj.owner === 'object' && 'Shared' in obj.owner) {
      processed.sharedObjects.push({
        name: extractTypeName(obj.objectType),
        objectId: obj.objectId,
        objectType: obj.objectType,
        owner: obj.owner,
        initialSharedVersion: obj.owner.Shared.initial_shared_version,
      });
      continue;
    }
  }

  return processed;
}

function main() {
  const deploymentsDir = path.join(__dirname, '../../deployments');
  const processedDir = path.join(__dirname, '../../deployments-processed');

  // Ensure output directory exists
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  // Read all deployment JSON files
  const files = fs.readdirSync(deploymentsDir).filter((f) => f.endsWith('.json'));

  const allPackages: Record<string, ProcessedDeployment> = {};

  for (const file of files) {
    const packageName = file.replace('.json', '');
    const deploymentPath = path.join(deploymentsDir, file);

    console.log(`Processing ${packageName}...`);

    try {
      const processed = processDeployment(packageName, deploymentPath);
      allPackages[packageName] = processed;

      // Write individual package file
      const outputPath = path.join(processedDir, file);
      fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));
      console.log(`✓ ${packageName} processed`);
    } catch (error: any) {
      console.error(`✗ Failed to process ${packageName}: ${error.message}`);
    }
  }

  // Write combined _all-packages.json
  const allPackagesPath = path.join(processedDir, '_all-packages.json');
  fs.writeFileSync(allPackagesPath, JSON.stringify(allPackages, null, 2));
  console.log(`\n✓ All packages written to ${allPackagesPath}`);
}

main();
