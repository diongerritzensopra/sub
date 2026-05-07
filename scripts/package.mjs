import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Read version from manifest.json
const manifestPath = join(root, 'manifest.json');
const manifestContent = readFileSync(manifestPath, 'utf-8');
const manifest = JSON.parse(manifestContent);
const version = manifest.version;

// Create versioned zip filename
const zipFilename = `sub-extension-v${version}.zip`;

// Create zip from dist directory
console.log(`Creating ${zipFilename}...`);
execSync(`cd dist && zip -r ../${zipFilename} . && cd ..`, { stdio: 'inherit' });
console.log(`Done! Created ${zipFilename}`);

