import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_PLUGIN_INTEGRATIONS,
  isRozeniteIntegration,
  type RozeniteIntegration,
} from '@rozenite/tools';
import { ROZENITE_MANIFEST } from './constants.js';
import { logger } from './logger.js';

/**
 * A Rozenite plugin package as discovered on disk by walking up from a
 * resolved file to its nearest `package.json`.
 */
export type RozenitePluginPackage = {
  /** package.json `name` field. */
  name: string;
  /** realpath of the package root (the directory containing package.json). */
  root: string;
  /** `productionEntries` as declared in `dist/rozenite.json`; `[]` when absent. */
  productionEntries: string[];
  /**
   * `integrations` as declared in `dist/rozenite.json`; falls back to
   * {@link DEFAULT_PLUGIN_INTEGRATIONS} (`['react-native']`) for a plugin
   * published before this field existed, or one whose manifest doesn't
   * carry a valid value.
   */
  integrations: RozeniteIntegration[];
};

type PluginLookupResult = RozenitePluginPackage | null;

type PluginCacheEntry = {
  result: PluginLookupResult;
  /** `dist/rozenite.json` this entry's `result` was computed from, or null
   * when the walk never reached a package root (e.g. filesystem root). */
  manifestPath: string | null;
  /** mtime of `manifestPath` at computation time, or null when it did not
   * exist yet. Re-stat'd on every cache hit below. */
  manifestMtimeMs: number | null;
};

// Memoized per directory (both hits and misses), so repeated resolutions in
// a hot directory cost nothing. `resolveRequest` is synchronous and called
// on every module resolution, so this cannot afford to re-walk the
// filesystem per request -- but `rozenite dev` rebuilds a plugin's
// `dist/rozenite.json` while the bundler keeps running (its Vite watcher
// reacts to source changes), so a plain process-lifetime cache would keep
// answering with whatever the plugin looked like the first time it was
// resolved. Each entry instead carries the manifest's mtime and is re-stat'd
// on every hit, so a rebuild invalidates it on the next resolution.
const pluginCache = new Map<string, PluginCacheEntry>();

const statMtimeMs = (filePath: string): number | null => {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
};

const readJsonSafe = (filePath: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const readProductionEntries = (manifestPath: string): string[] => {
  const manifest = readJsonSafe(manifestPath);

  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    !Array.isArray((manifest as Record<string, unknown>).productionEntries)
  ) {
    // Covers both "no such field" and "the manifest failed to parse" -- a
    // malformed manifest must degrade to "no declared entries", never crash
    // a build.
    return [];
  }

  return (manifest as { productionEntries: unknown[] }).productionEntries.filter(
    (entry): entry is string => typeof entry === 'string',
  );
};

const readIntegrations = (manifestPath: string): RozeniteIntegration[] => {
  const manifest = readJsonSafe(manifestPath);

  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    !Array.isArray((manifest as Record<string, unknown>).integrations)
  ) {
    return [...DEFAULT_PLUGIN_INTEGRATIONS];
  }

  const integrations = (manifest as { integrations: unknown[] }).integrations.filter(
    isRozeniteIntegration,
  );

  return integrations.length > 0 ? integrations : [...DEFAULT_PLUGIN_INTEGRATIONS];
};

const readPackageNameOrNull = (packageJsonPath: string): string | null => {
  const packageJson = readJsonSafe(packageJsonPath);
  const name =
    packageJson !== null && typeof packageJson === 'object'
      ? (packageJson as Record<string, unknown>).name
      : undefined;

  return typeof name === 'string' ? name : null;
};

/**
 * A package root is a directory whose `package.json` names a package.
 *
 * The `name` check is load-bearing, not defensive. tsc cannot emit `.cjs`/
 * `.mjs`, so the plugin build drops a bare `{"type": "module"}` /
 * `{"type": "commonjs"}` marker into each output directory to tell Node how
 * to read the plain `.js` files next to it. Those markers sit between a
 * resolved file and its real package root - a plugin entry resolves to
 * `<plugin>/dist/react-native/react-native.js`, and
 * `dist/react-native/package.json` is the first `package.json` above it.
 * Treating one as a package root stops the walk two directories short of
 * `<plugin>/dist/rozenite.json`, so every plugin reads as "not a Rozenite
 * plugin" and the guard silently permits everything.
 */
const isPackageRoot = (dir: string): boolean => {
  return readPackageNameOrNull(path.join(dir, 'package.json')) !== null;
};

const realpathSafe = (dir: string): string => {
  try {
    return fs.realpathSync(dir);
  } catch {
    return dir;
  }
};

/** The package at `packageRoot` is a Rozenite plugin iff this manifest exists. */
const readPluginAtPackageRoot = (packageRoot: string): PluginLookupResult => {
  const manifestPath = path.join(packageRoot, 'dist', ROZENITE_MANIFEST);

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const name = readPackageNameOrNull(path.join(packageRoot, 'package.json'));

  if (name === null) {
    return null;
  }

  return {
    name,
    root: realpathSafe(packageRoot),
    productionEntries: readProductionEntries(manifestPath),
    integrations: readIntegrations(manifestPath),
  };
};

const findPluginForDirectory = (dir: string): PluginCacheEntry => {
  const cached = pluginCache.get(dir);

  if (cached && statMtimeMs(cached.manifestPath ?? '') === cached.manifestMtimeMs) {
    return cached;
  }

  let entry: PluginCacheEntry;

  if (isPackageRoot(dir)) {
    // The first *named* package.json going up is the package root, whether
    // or not it turns out to be a Rozenite plugin -- we never look past it.
    const manifestPath = path.join(dir, 'dist', ROZENITE_MANIFEST);
    entry = {
      result: readPluginAtPackageRoot(dir),
      manifestPath,
      manifestMtimeMs: statMtimeMs(manifestPath),
    };
  } else {
    const parentDir = path.dirname(dir);
    entry =
      parentDir === dir
        ? { result: null, manifestPath: null, manifestMtimeMs: null }
        : findPluginForDirectory(parentDir);
  }

  pluginCache.set(dir, entry);
  return entry;
};

/**
 * Realpath'd file path -> the Rozenite plugin package containing it, or
 * null. Walks up from the file's directory to the first `package.json`;
 * that package is a Rozenite plugin iff `dist/rozenite.json` exists there.
 */
export const findRozenitePluginForFile = (filePath: string): RozenitePluginPackage | null => {
  return findPluginForDirectory(path.dirname(filePath)).result;
};

const DEV_ENTRY_BASENAME = 'rozenite.dev';

/**
 * True when the importing file's own layout says it is (part of) the dev
 * entry: its basename starts with `rozenite.dev` (matches `rozenite.dev.tsx`,
 * `rozenite.dev.ios.tsx`, ...), or any path segment of it is a `rozenite.dev`
 * directory.
 */
export const isDevEntryOrigin = (originModulePath: string): boolean => {
  const segments = originModulePath.split(path.sep);
  const basename = segments[segments.length - 1] ?? '';

  if (basename.startsWith(DEV_ENTRY_BASENAME)) {
    return true;
  }

  return segments.includes(DEV_ENTRY_BASENAME);
};

const formatImportedFrom = (importedFrom: string, projectRoot: string): string => {
  const relative = path.relative(projectRoot, importedFrom);
  const isInsideProjectRoot =
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);

  return isInsideProjectRoot ? relative : importedFrom;
};

/** The two user-facing messages, so Metro, Re.Pack and Lynx cannot drift. */
export const formatProductionGuardError = (args: {
  plugin: RozenitePluginPackage;
  importedFrom: string;
  projectRoot: string;
  /**
   * The function whose `allowInProduction` option bypasses this check --
   * `withRozenite()` for Metro and Re.Pack, `rozeniteLynxPlugin()` for
   * Lynx. Defaults to `withRozenite()`, the Metro/Re.Pack spelling, so
   * existing callers that predate this option keep the exact message they
   * already have tests and docs pinned to.
   */
  setupFunctionName?: string;
}): string => {
  const { plugin, importedFrom, projectRoot, setupFunctionName = 'withRozenite()' } = args;
  const declaration =
    plugin.productionEntries.length === 0
      ? 'declares no production entry points'
      : 'does not declare this file as a production entry point';

  return [
    `${plugin.name} is a Rozenite plugin and ${declaration}.`,
    `Imported from: ${formatImportedFrom(importedFrom, projectRoot)}`,
    `Move plugin wiring into rozenite.dev.tsx, or declare this file in productionEntries in rozenite.config.ts. To bypass this check for ${plugin.name} only, pass allowInProduction: ['${plugin.name}'] to ${setupFunctionName}.`,
  ].join('\n');
};

/** The two integration-mismatch messages, mirroring the production-guard pair above. */
export const formatIntegrationMismatchError = (args: {
  plugin: RozenitePluginPackage;
  importedFrom: string;
  projectRoot: string;
  targetIntegration: RozeniteIntegration;
}): string => {
  const { plugin, importedFrom, projectRoot, targetIntegration } = args;

  return [
    `${plugin.name} is a Rozenite plugin that does not declare "${targetIntegration}" support.`,
    `Declared integrations: ${plugin.integrations.join(', ')}.`,
    `Imported from: ${formatImportedFrom(importedFrom, projectRoot)}`,
    `This plugin was not built for this target and must not be bundled with it.`,
  ].join('\n');
};

export const formatIntegrationMismatchAdvisory = (args: {
  plugin: RozenitePluginPackage;
  importedFrom: string;
  projectRoot: string;
  targetIntegration: RozeniteIntegration;
}): string => {
  const { plugin, importedFrom, projectRoot, targetIntegration } = args;

  return [
    `warning: ${plugin.name} imported from ${formatImportedFrom(importedFrom, projectRoot)}, but it does not declare "${targetIntegration}" support.`,
    `         Declared integrations: ${plugin.integrations.join(', ')}. This will fail your production build.`,
  ].join('\n');
};

export const formatDevAdvisory = (args: {
  plugin: RozenitePluginPackage;
  importedFrom: string;
  projectRoot: string;
}): string => {
  const { plugin, importedFrom, projectRoot } = args;

  return [
    `warning: ${plugin.name} imported from ${formatImportedFrom(importedFrom, projectRoot)}.`,
    `         Plugin imports belong in rozenite.dev.tsx. This will fail your production build.`,
  ].join('\n');
};

// Warn-once bookkeeping, keyed by the caller-supplied key (per the
// documented `${importedFrom}\0${plugin.name}` shape).
const warnedKeys = new Set<string>();

/** Warn-once bookkeeping keyed by `${importedFrom}\0${plugin.name}`. */
export const warnOnceForImport = (key: string, message: string): void => {
  if (warnedKeys.has(key)) {
    return;
  }

  warnedKeys.add(key);
  logger.warn(message);
};

/** Locate `<projectRoot>/rozenite.dev` (extensionless) — the bundler resolves the extension. */
export const getDevEntrySpecifier = (projectRoot: string): string => {
  return path.join(projectRoot, 'rozenite.dev');
};

// The app-side seam packages: `@rozenite/react-native` for React Native,
// `@rozenite/lynx` for Lynx (its `.` export -- see `packages/lynx/src/index.tsx`).
// Both ship the identical dev-entry-redirect shape, so one set covers them.
const SEAM_PACKAGE_NAMES = new Set(['@rozenite/react-native', '@rozenite/lynx']);

// The relative specifier a seam's `index.tsx` emits for its dev-entry seam
// (`import DevEntry from './dev-entry.js'`). Matched with and without the
// extension since the CJS/ESM emit may differ -- `@rozenite/react-native`'s
// unbundled tsc build keeps the literal `./dev-entry.js` from source in
// both its ESM and CJS output, while `@rozenite/lynx`'s Rollup-bundled
// build rewrites its CJS chunk's `require()` to the sibling chunk's actual
// extension, `./dev-entry.cjs`.
const SEAM_DEV_ENTRY_REQUESTS = new Set(['./dev-entry.js', './dev-entry', './dev-entry.cjs']);

// Separate cache from `pluginCache`: this walk answers "what package is this
// file inside", not "is this file inside a Rozenite plugin", and the seam
// package itself is not a Rozenite plugin (it ships no dist/rozenite.json).
const packageNameCache = new Map<string, string | null>();

const findPackageNameForDirectory = (dir: string): string | null => {
  const cached = packageNameCache.get(dir);

  if (cached !== undefined) {
    return cached;
  }

  // Same module-type-marker hazard as `findPluginForDirectory`: the seam's
  // own CommonJS output carries a nameless `{"type": "commonjs"}` marker, so
  // stopping at the first package.json would fail to recognise the seam and
  // silently skip the dev-entry redirect for CJS consumers.
  const name = readPackageNameOrNull(path.join(dir, 'package.json'));
  let result: string | null;

  if (name !== null) {
    result = name;
  } else {
    const parentDir = path.dirname(dir);
    result = parentDir === dir ? null : findPackageNameForDirectory(parentDir);
  }

  packageNameCache.set(dir, result);
  return result;
};

/**
 * True when this request is one of the seam packages (`@rozenite/react-native`,
 * `@rozenite/lynx`) asking for its shipped noop -- i.e. `originModulePath`
 * resolves (by walking up to its nearest package.json) to that package, and
 * `request` is its dev-entry specifier. "Seam not installed" (no such
 * package.json found) is "no match", never an error -- an app that does not
 * use `<Rozenite />` must still build.
 */
export const isSeamDevEntryRequest = (originModulePath: string, request: string): boolean => {
  if (!SEAM_DEV_ENTRY_REQUESTS.has(request)) {
    return false;
  }

  const packageName = findPackageNameForDirectory(path.dirname(originModulePath));

  return packageName !== null && SEAM_PACKAGE_NAMES.has(packageName);
};
