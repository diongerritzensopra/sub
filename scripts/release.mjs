import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manifestPath = join(root, 'manifest.json');
const packageJsonPath = join(root, 'package.json');
const packageLockPath = join(root, 'package-lock.json');

function run(command, capture = false) {
  try {
    if (capture) {
      return execSync(command, { cwd: root, encoding: 'utf8' }).trim();
    }

    execSync(command, { cwd: root, stdio: 'inherit' });
    return '';
  } catch (error) {
    const exitCode = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
    fail(`Command failed${exitCode !== undefined ? ` (exit code ${exitCode})` : ''}: ${command}`);
  }
}

function fail(message) {
  console.error(`\nRelease failed: ${message}`);
  process.exit(1);
}

function parseSemver(value, label) {
  const match = SEMVER_REGEX.exec(value);
  if (!match) {
    fail(`Invalid ${label} \"${value}\". Expected x.y.z`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function determineNextVersion(currentVersion, args) {
  const hasPatchFlag = args.includes('--patch');
  const hasMajorFlag = args.includes('--major');

  if (hasPatchFlag && hasMajorFlag) {
    fail('Use either --patch or --major, not both');
  }

  const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
  if (positionalArgs.length > 1) {
    fail(`Unexpected arguments: ${positionalArgs.join(', ')}`);
  }

  const explicitVersion = positionalArgs[0];
  if (explicitVersion && (hasPatchFlag || hasMajorFlag)) {
    fail('Do not combine an explicit version with --patch or --major');
  }

  if (explicitVersion) {
    parseSemver(explicitVersion, 'version');
    return explicitVersion;
  }

  const [major, minor, patch] = parseSemver(currentVersion, 'current manifest version');

  if (hasMajorFlag) {
    return `${major + 1}.0.0`;
  }

  if (hasPatchFlag) {
    return `${major}.${minor}.${patch + 1}`;
  }

  return `${major}.${minor + 1}.0`;
}

function assertGitPreconditions() {
  const status = run('git --no-pager status --porcelain', true);
  if (status) {
    fail('Working tree is not clean. Commit or stash changes before running release.');
  }

  const branch = run('git --no-pager rev-parse --abbrev-ref HEAD', true);
  if (branch !== 'main') {
    fail(`Current branch is \"${branch}\". Switch to \"main\" before running release.`);
  }

  const tagsOnHead = run('git --no-pager tag --points-at HEAD', true)
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const hasVersionTagOnHead = tagsOnHead.some((tag) => /^v?\d+\.\d+\.\d+$/.test(tag));
  if (hasVersionTagOnHead) {
    fail(`Current commit already has a version tag: ${tagsOnHead.join(', ')}`);
  }
}

function writeJson(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  assertGitPreconditions();

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'));

  const currentVersion = manifest.version;
  const newVersion = determineNextVersion(currentVersion, process.argv.slice(2));

  if (newVersion === currentVersion) {
    fail(`Resolved version ${newVersion} matches current version.`);
  }

  const targetTag = `v${newVersion}`;
  const existingTag = run(`git --no-pager tag -l ${targetTag}`, true);
  if (existingTag) {
    fail(`Tag ${targetTag} already exists.`);
  }

  console.log(`Releasing ${currentVersion} -> ${newVersion}`);

  console.log('Running unit tests...');
  run('npm test');

  console.log('Running build...');
  run('npm run build');

  manifest.version = newVersion;
  packageJson.version = newVersion;
  packageLock.version = newVersion;
  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = newVersion;
  }

  writeJson(manifestPath, manifest);
  writeJson(packageJsonPath, packageJson);
  writeJson(packageLockPath, packageLock);

  run(`git add manifest.json package.json package-lock.json`);
  run(`git commit -m "[release] v${newVersion}"`);
  run(`git tag ${targetTag}`);

  console.log('Creating distributable zip...');
  run('node scripts/package.mjs');

  console.log(`Release completed: ${newVersion}`);
}

main();

