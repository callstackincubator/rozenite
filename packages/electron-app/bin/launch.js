#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { resolveBrandedExecutable } from '../src/branded-bundle.js';

const url = process.argv[2];

if (!url) {
  console.error('Usage: rozenite-electron-app <url>');
  process.exit(1);
}

const mainPath = fileURLToPath(new URL('../src/main.js', import.meta.url));
// Falls back to Electron's own binary — which works, just under the name
// "Electron" in the Dock and menu bar. See `branded-bundle.js`.
const executablePath = resolveBrandedExecutable(electronPath) ?? electronPath;

const child = spawn(executablePath, [mainPath, url], { stdio: 'inherit' });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
