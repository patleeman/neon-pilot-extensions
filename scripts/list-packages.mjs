#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync(resolve('neon.extensions.json'), 'utf8'));
for (const entry of manifest.packages ?? []) {
  console.log(`${entry.id}\t${entry.path}`);
}
