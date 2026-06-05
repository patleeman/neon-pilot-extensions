#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { fail, listPackages, readSelectedPackageIds, repoRoot, resolveNeonPilotRepo } from './repo-tools.mjs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out-dir');
const outDir = resolve(outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : resolve(repoRoot, 'release-artifacts'));
const neonPilotRepo = resolveNeonPilotRepo();
const packages = listPackages(readSelectedPackageIds(args));
if (packages.length === 0) fail('No matching extension packages found.');

mkdirSync(outDir, { recursive: true });
for (const entry of packages) {
  const outputPath = resolve(outDir, `${entry.id}.neon-extension.zip`);
  console.log(`Packing ${entry.id} -> ${outputPath}`);
  const result = spawnSync(
    process.execPath,
    [resolve(neonPilotRepo, 'scripts', 'extension-pack.mjs'), entry.packageRoot, '--out', outputPath],
    { cwd: neonPilotRepo, stdio: 'inherit' },
  );
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
