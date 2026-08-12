#!/usr/bin/env node

import crx3 from 'crx3';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pemPath = process.env.CHROME_EXTENSION_PEM_PATH;

if (!pemPath) {
  console.error('Error: CHROME_EXTENSION_PEM_PATH is required');
  process.exit(1);
}

// crx3 silently generates a fresh key (and a different extension ID) if
// keyPath doesn't exist, instead of failing — guard against that explicitly.
if (!existsSync(pemPath)) {
  console.error(`Error: no key file found at CHROME_EXTENSION_PEM_PATH (${pemPath})`);
  process.exit(1);
}

const distPath = path.join(packageRoot, 'dist');
const buildDir = path.join(packageRoot, 'build');
const crxPath = path.join(buildDir, 'rozenite.crx');

mkdirSync(buildDir, { recursive: true });

await crx3([distPath], {
  keyPath: pemPath,
  crxPath,
});

console.log(`Signed extension written to ${crxPath}`);
