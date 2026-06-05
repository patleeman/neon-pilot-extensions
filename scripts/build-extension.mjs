#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { fail, listPackages, readSelectedPackageIds, resolveNeonPilotRepo } from './repo-tools.mjs';

const args = process.argv.slice(2);
const neonPilotRepo = resolveNeonPilotRepo();
const packages = listPackages(readSelectedPackageIds(args));
if (packages.length === 0) fail('No matching extension packages found.');

for (const entry of packages) {
  console.log(`Building ${entry.id}`);
  const result = spawnSync(process.execPath, [resolve(neonPilotRepo, 'scripts', 'extension-build.mjs'), entry.packageRoot], {
    cwd: neonPilotRepo,
    stdio: 'inherit',
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
