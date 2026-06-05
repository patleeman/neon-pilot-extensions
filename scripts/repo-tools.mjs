import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function fail(message) {
  console.error(message);
  process.exit(1);
}

export function readManifest() {
  return JSON.parse(readFileSync(resolve(repoRoot, 'neon.extensions.json'), 'utf8'));
}

export function listPackages(selectedIds = []) {
  const selected = new Set(selectedIds.filter(Boolean));
  const packages = (readManifest().packages ?? []).map((entry) => {
    if (!entry?.id || !entry?.path) fail('Each neon.extensions.json package needs id and path.');
    const packageRoot = resolve(repoRoot, entry.path);
    if (!existsSync(resolve(packageRoot, 'extension.json'))) fail(`No extension.json found for ${entry.id} at ${packageRoot}`);
    return { ...entry, packageRoot };
  });
  return selected.size ? packages.filter((entry) => selected.has(entry.id)) : packages;
}

export function readSelectedPackageIds(args) {
  const ids = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') {
      continue;
    }
    if (arg === '--extension' || arg === '--package') {
      if (!args[i + 1]) fail(`${arg} requires an extension id.`);
      ids.push(args[i + 1]);
      i += 1;
    } else if (arg === '--tag' || arg === '--out-dir') {
      i += 1;
    } else if (!arg.startsWith('--')) {
      ids.push(arg);
    }
  }
  return ids;
}

export function resolveNeonPilotRepo() {
  const candidates = [
    process.env.NEON_PILOT_REPO,
    resolve(repoRoot, '..', 'neon-pilot'),
    resolve(repoRoot, '..', '..', 'neon-pilot'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const root = resolve(candidate);
    if (existsSync(resolve(root, 'scripts', 'extension-build.mjs')) && existsSync(resolve(root, 'scripts', 'extension-pack.mjs'))) {
      return root;
    }
  }
  fail('Could not find a Neon Pilot checkout. Set NEON_PILOT_REPO=/path/to/neon-pilot.');
}
