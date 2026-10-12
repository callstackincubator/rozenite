// Plain ESM on purpose: `@rozenite/electron-app` runs its tests with
// `node --test` on the Node versions CI uses, which cannot import TypeScript.
// The types live next to this file in `index.d.mts`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Files that must never be published. They are development-only: fixtures,
 * tests, and the configuration used to build the package itself.
 */
const DEVELOPMENT_ONLY = [
  [/(^|\/)rozenite\.config\.[cm]?[jt]s$/, 'dev-host fixtures and flows'],
  [/(^|\/)__tests__\//, 'test directory'],
  [/(^|\/)__fixtures__\//, 'fixture directory'],
  [/(^|\/)metro-fixtures\//, 'test fixtures'],
  [/\.(test|spec)\.[cm]?[jt]sx?$/, 'test file'],
  [/\.(test|spec)\.d\.[cm]?ts(\.map)?$/, 'declaration stub for a test file'],
  [/(^|\/)vitest\.(setup|config)\.[cm]?[jt]s$/, 'test configuration'],
  [/(^|\/)vite\.config\.[cm]?[jt]s$/, 'build configuration'],
  [/(^|\/)tsconfig[^/]*\.json$/, 'TypeScript project configuration'],
  [/(^|\/)eslint\.config\.[cm]?[jt]s$/, 'lint configuration'],
  [/\.tsbuildinfo$/, 'tsc incremental build cache'],
  [/(^|\/)node_modules\//, 'installed dependencies'],
];

const MANIFEST_PATH_FIELDS = ['main', 'module', 'types', 'typings', 'react-native', 'browser'];

const CODE_FILE = /\.(js|mjs|cjs|ts|tsx|mts|cts)$/;
const RELATIVE_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"\n]*)\1/g;
const RESOLVE_EXTENSIONS = [
  '',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.d.ts',
  '.d.mts',
  '.d.cts',
  '.json',
  '.css',
];

const hasCondition = (value, condition) => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    Object.hasOwn(value, condition) ||
    Object.values(value).some((entry) => hasCondition(entry, condition))
  );
};

const withoutCondition = (value, condition) => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== condition)
      .map(([key, entry]) => [key, withoutCondition(entry, condition)]),
  );
};

const walk = (directory, base = directory) => {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return walk(entryPath, base);
    }

    return [path.relative(base, entryPath).split(path.sep).join('/')];
  });
};

const toGlobExpression = (pattern) => {
  return new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
};

const resolvesInside = (fromFile, specifier, fileSet) => {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const withoutJsExtension = base.replace(/\.(js|mjs|cjs)$/, '');

  for (const candidateBase of [base, withoutJsExtension]) {
    for (const extension of RESOLVE_EXTENSIONS) {
      if (fileSet.has(candidateBase + extension)) {
        return true;
      }
    }

    for (const extension of RESOLVE_EXTENSIONS.slice(1)) {
      if (fileSet.has(`${candidateBase}/index${extension}`)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Packs the package exactly as `pnpm publish` would (so `publishConfig`
 * overrides and `workspace:` rewrites are applied), and unpacks the tarball
 * into a throwaway directory.
 */
const pack = (packageRoot) => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rozenite-pack-'));

  try {
    execFileSync('pnpm', ['pack', '--pack-destination', workDir], {
      cwd: packageRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const tarball = fs.readdirSync(workDir).find((file) => file.endsWith('.tgz'));
    const unpackedDir = path.join(workDir, 'unpacked');
    fs.mkdirSync(unpackedDir);
    execFileSync('tar', [
      '-xzf',
      path.join(workDir, tarball),
      '-C',
      unpackedDir,
      '--strip-components=1',
    ]);

    const files = walk(unpackedDir).sort();
    const manifest = JSON.parse(fs.readFileSync(path.join(unpackedDir, 'package.json'), 'utf8'));

    return { workDir, unpackedDir, files, manifest };
  } catch (error) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw error;
  }
};

/**
 * Checks what `pnpm pack` would publish for `packageRoot`.
 *
 * - Every `main`/`module`/`types`/`react-native`/`browser`, `bin` and
 *   `exports` target, for every condition, is in the tarball.
 * - The published `exports` is the source `exports` without the
 *   `development` condition, which only resolves inside this workspace.
 * - No development-only file (tests, fixtures, `rozenite.config.*`, build
 *   configuration) is in the tarball.
 * - Every relative import inside a shipped module resolves inside the tarball.
 *
 * The package must be built first.
 *
 * @param {string} packageRoot
 * @param {{ allowDevelopmentFilesUnder?: string[], skipImportCheckUnder?: string[] }} [options]
 */
export const inspectPackedPackage = (packageRoot, options = {}) => {
  const allowDevelopmentFilesUnder = options.allowDevelopmentFilesUnder ?? [];
  // Panels are standalone browser bundles; their strings can look like imports.
  const skipImportCheckUnder = options.skipImportCheckUnder ?? ['dist/devtools/'];
  const sourceManifest = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
  );
  const packed = pack(packageRoot);
  const problems = [];

  try {
    const { manifest, files, unpackedDir } = packed;
    const fileSet = new Set(files);

    // 1. Published `exports` carries no workspace-only condition.
    if (hasCondition(manifest.exports, 'development')) {
      problems.push(
        'published exports still has a `development` condition; strip it with `publishConfig.exports`',
      );
    }

    const expectedExports = withoutCondition(sourceManifest.exports, 'development');

    if (JSON.stringify(manifest.exports ?? null) !== JSON.stringify(expectedExports ?? null)) {
      problems.push(
        'published exports differs from `exports` without `development`; update `publishConfig.exports` to match',
      );
    }

    if (JSON.stringify(manifest).includes('workspace:')) {
      problems.push('published package.json still contains a `workspace:` dependency');
    }

    // 2. Every target is in the tarball.
    const targets = [];

    for (const field of MANIFEST_PATH_FIELDS) {
      if (typeof manifest[field] === 'string') {
        targets.push([field, manifest[field]]);
      }
    }

    if (typeof manifest.bin === 'string') {
      targets.push(['bin', manifest.bin]);
    } else if (manifest.bin) {
      for (const [name, target] of Object.entries(manifest.bin)) {
        targets.push([`bin.${name}`, target]);
      }
    }

    const walkExports = (value, trail) => {
      if (typeof value === 'string') {
        targets.push([`exports${trail}`, value]);
      } else if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) {
          walkExports(entry, `${trail}[${key}]`);
        }
      }
    };

    walkExports(manifest.exports, '');

    for (const [field, target] of targets) {
      const relative = target.replace(/^\.\//, '');
      const present = relative.includes('*')
        ? files.some((file) => toGlobExpression(relative).test(file))
        : fileSet.has(relative);

      if (!present) {
        problems.push(`${field} -> ${target} is not in the tarball`);
      }
    }

    // 3. No development-only file is published.
    for (const file of files) {
      if (allowDevelopmentFilesUnder.some((prefix) => file.startsWith(prefix))) {
        continue;
      }

      const match = DEVELOPMENT_ONLY.find(([pattern]) => pattern.test(file));

      if (match) {
        problems.push(`${file} is published but is development-only (${match[1]})`);
      }
    }

    // 4. Shipped modules do not import files that were left out.
    for (const file of files) {
      if (!CODE_FILE.test(file) || skipImportCheckUnder.some((prefix) => file.startsWith(prefix))) {
        continue;
      }

      const source = fs.readFileSync(path.join(unpackedDir, file), 'utf8');

      for (const match of source.matchAll(RELATIVE_SPECIFIER)) {
        const specifier = match[2].split('?')[0];

        if (!resolvesInside(file, specifier, fileSet)) {
          problems.push(`${file} imports ${specifier}, which is not in the tarball`);
        }
      }
    }

    return { name: manifest.name, files, manifest, problems };
  } finally {
    fs.rmSync(packed.workDir, { recursive: true, force: true });
  }
};
