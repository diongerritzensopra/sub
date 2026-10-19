import { realpath, readFile, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { Buffer } from 'node:buffer';
import * as prettier from 'prettier';

const pathKeys = new Set([
  'file',
  'filepath',
  'filename',
  'path',
  'target',
  'targetpath',
]);
const patchPathPatterns = [
  /^\*\*\* (?:Add|Update) File: (.+?)\s*$/gm,
  /^\*\*\* Move to: (.+?)\s*$/gm,
  /^\+\+\+ (?:b\/)?(.+?)\s*$/gm,
];

function isWithinRoot(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot !== '' &&
    pathFromRoot !== '..' &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot)
  );
}

function addPath(paths, candidate) {
  const filePath = candidate.trim();
  if (filePath && !filePath.includes('\n')) {
    paths.add(filePath);
  }
}

function collectPatchPaths(paths, text) {
  for (const pattern of patchPathPatterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1] !== '/dev/null') {
        addPath(paths, match[1]);
      }
    }
  }
}

function collectPaths(paths, value, key = '') {
  if (typeof value === 'string') {
    if (pathKeys.has(key.toLowerCase().replaceAll('_', ''))) {
      addPath(paths, value);
    }
    collectPatchPaths(paths, value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPaths(paths, item);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectPaths(paths, childValue, childKey);
    }
  }
}

async function readHookInput() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error('Could not parse Copilot post-tool hook input.', {
      cause: error,
    });
  }
}

async function formatChangedFiles() {
  const hookInput = await readHookInput();
  const toolName = hookInput.tool_name ?? hookInput.toolName;
  if (
    toolName &&
    !['apply_patch', 'create', 'edit', 'str_replace_editor', 'write'].includes(
      toolName.toLowerCase(),
    )
  ) {
    return;
  }

  const toolInput = hookInput.tool_input ?? hookInput.toolArgs;
  const paths = new Set();
  if (typeof toolInput === 'string') {
    try {
      collectPaths(paths, JSON.parse(toolInput));
    } catch {
      collectPaths(paths, toolInput);
    }
  } else {
    collectPaths(paths, toolInput);
  }

  const root = await realpath(process.cwd());
  for (const inputPath of paths) {
    const candidate = resolve(root, inputPath);
    if (!isWithinRoot(root, candidate)) {
      continue;
    }

    let filePath;
    try {
      filePath = await realpath(candidate);
    } catch {
      continue;
    }
    if (!isWithinRoot(root, filePath) || !(await stat(filePath)).isFile()) {
      continue;
    }

    const fileInfo = await prettier.getFileInfo(filePath);
    if (fileInfo.ignored || !fileInfo.inferredParser) {
      continue;
    }

    const source = Buffer.from(await readFile(filePath)).toString('utf8');
    const config = await prettier.resolveConfig(filePath);
    const formatted = await prettier.format(source, {
      ...config,
      filepath: filePath,
    });
    if (formatted !== source) {
      await writeFile(filePath, formatted);
    }
  }
}

formatChangedFiles().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
