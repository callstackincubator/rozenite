import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { monorepoRoot } from '../metro/paths.js';

export type RspeedyFixture = {
  /** Absolute, symlink-free path to the throwaway Lynx app. */
  root: string;
  cleanup: () => void;
};

const FIXTURE_PACKAGE_NAME = 'rozenite-release-bundle-fixture-lynx';

/**
 * Creates a throwaway Lynx app on disk, mirroring `../metro/fixture.ts`'s
 * `createFixture` for rspeedy instead of Metro: `node_modules` is symlinked
 * to the monorepository's hoisted `node_modules` so `@lynx-js/rspeedy`,
 * `@lynx-js/react-rsbuild-plugin` and the Rozenite packages under test
 * resolve from the fixture exactly as they would in a real app.
 * `realpathSync` is required for the same reason as the Metro fixture:
 * macOS hands out `/var/...` temp paths that are symlinks to
 * `/private/var/...`, and rspack's watcher/resolver can disagree about
 * which one a file lives under.
 */
export const createRspeedyFixture = (files: Record<string, string>): RspeedyFixture => {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'rozenite-release-bundle-lynx-')));

  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(
      { name: FIXTURE_PACKAGE_NAME, version: '0.0.0', private: true, type: 'module' },
      null,
      2,
    ),
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
