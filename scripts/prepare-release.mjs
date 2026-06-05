#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { fail, listPackages, readManifest, readSelectedPackageIds, repoRoot, resolveNeonPilotRepo } from './repo-tools.mjs';

const args = process.argv.slice(2);
const tagIndex = args.indexOf('--tag');
const tag = tagIndex >= 0 ? args[tagIndex + 1] : '';
if (!tag) fail('Usage: pnpm run release:prepare -- --tag vX.Y.Z [--extension id]');

const outIndex = args.indexOf('--out-dir');
const outDir = resolve(outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : resolve(repoRoot, 'release-artifacts', tag));
const neonPilotRepo = resolveNeonPilotRepo();
const packages = listPackages(readSelectedPackageIds(args));
if (packages.length === 0) fail('No matching extension packages found.');

mkdirSync(outDir, { recursive: true });
const releasePackages = [];
for (const entry of packages) {
  console.log(`Building ${entry.id}`);
  run(neonPilotRepo, [resolve(neonPilotRepo, 'scripts', 'extension-build.mjs'), entry.packageRoot]);

  const artifact = `${entry.id}.neon-extension.zip`;
  const outputPath = resolve(outDir, artifact);
  console.log(`Packing ${entry.id} -> ${outputPath}`);
  run(neonPilotRepo, [resolve(neonPilotRepo, 'scripts', 'extension-pack.mjs'), entry.packageRoot, '--out', outputPath]);

  releasePackages.push({
    id: entry.id,
    path: entry.path,
    channel: entry.channel ?? 'stable',
    tag,
    artifact,
    sha256: sha256(outputPath),
  });
}

const sourceManifest = readManifest();
writeFileSync(
  resolve(outDir, 'neon-extension-catalog.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      tag,
      source: sourceManifest.repository,
      publisher: sourceManifest.publisher,
      packages: releasePackages,
    },
    null,
    2,
  )}\n`,
);

console.log(`Prepared ${releasePackages.length} extension release artifacts in ${outDir}`);
console.log(`Publish with: gh release create ${tag} ${outDir}/*.neon-extension.zip ${outDir}/neon-extension-catalog.json --repo patleeman/neon-pilot-extensions`);

function run(cwd, commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, { cwd, stdio: 'inherit' });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
