const fs = require('fs');
const path = require('path');

// Get version from environment variable, or generate a dev version
const version = process.env.VERSION || `dev-${new Date().toISOString()}`;

const versionData = {
  version: version,
};

// The path to write the version file to.
// We write it inside `src` so it's easily importable by the frontend code.
const outputPath = path.join(__dirname, '../src/version.json');

// Write the version data to the file.
fs.writeFileSync(outputPath, JSON.stringify(versionData, null, 2));

console.log(`Version ${version} injected into ${outputPath}`); 