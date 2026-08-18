#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const url = process.argv[2];

if (!url) {
  console.error('Usage: rozenite-electron-app <url>');
  process.exit(1);
}

const mainPath = fileURLToPath(new URL('../src/main.js', import.meta.url));

const child = spawn(electronPath, [mainPath, url], { stdio: 'inherit' });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
