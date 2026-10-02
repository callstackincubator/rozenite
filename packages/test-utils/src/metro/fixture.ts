import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
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
 * Windows only lets unprivileged users create directory symlinks with
 * Developer Mode or admin rights, so a `'dir'` symlink throws `EPERM`.
 * Junctions work for local directories without extra privileges.
 */
export const getDirectoryLinkType = (
  platform: NodeJS.Platform = process.platform,
): 'junction' | 'dir' => (platform === 'win32' ? 'junction' : 'dir');

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
  const nodeModulesLink = path.join(root, 'node_modules');
  // Junction targets must be absolute.
  symlinkSync(path.resolve(monorepoRoot, 'node_modules'), nodeModulesLink, getDirectoryLinkType());

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }

  return {
    root,
    cleanup: () => {
      // Remove the link itself first so the recursive removal below can never
      // traverse into the monorepo's real `node_modules`.
      try {
        unlinkSync(nodeModulesLink);
      } catch {
        // Already gone; nothing to unlink.
      }
      rmSync(root, { recursive: true, force: true });
    },
  };
};
