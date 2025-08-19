const fs = require('fs');
const path = require('path');

// Read package.json to get the version
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get version from environment variable, or use package.json version, or generate a dev version
const version = process.env.VERSION || packageJson.version || `dev-${new Date().toISOString()}`;

const versionData = {
  version: version,
};

// The path to write the version file to.
// We write it inside `src` so it's easily importable by the frontend code.
const outputPath = path.join(__dirname, '../src/version.json');

// Write the version data to the file.
fs.writeFileSync(outputPath, JSON.stringify(versionData, null, 2));

console.log(`Version ${version} injected into ${outputPath}`); 