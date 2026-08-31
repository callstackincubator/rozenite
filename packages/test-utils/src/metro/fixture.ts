import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { monorepoRoot } from './paths.js';

export type Fixture = {
  /** Absolute, symlink-free path to the throwaway app. */
  root: string;
  cleanup: () => void;
};

const FIXTURE_PACKAGE_NAME = 'rozenite-release-bundle-fixture';

/**
 * Creates a throwaway React Native app on disk.
 *
 * `node_modules` is symlinked to the monorepository's hoisted
 * `node_modules` so `react-native`, `expo` and the Babel presets resolve
 * from the fixture exactly as they would in a real app. `realpathSync` is
 * required because macOS hands out `/var/...` temp paths that are symlinks
 * to `/private/var/...`, which Metro refuses to watch.
 */
export const createFixture = (files: Record<string, string>): Fixture => {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'rozenite-release-bundle-')));

  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: FIXTURE_PACKAGE_NAME, version: '0.0.0', private: true }, null, 2),
  );
  writeFileSync(
    path.join(root, 'app.json'),
    JSON.stringify({ expo: { name: FIXTURE_PACKAGE_NAME, slug: FIXTURE_PACKAGE_NAME } }, null, 2),
  );
  symlinkSync(path.join(monorepoRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};
