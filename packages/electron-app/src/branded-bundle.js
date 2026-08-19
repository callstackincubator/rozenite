import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * macOS reads an app's name from its bundle's `Info.plist` when the
 * process registers with LaunchServices — before any JavaScript runs — so
 * `app.setName()` can't reach it. Running Electron's own bundle therefore
 * shows "Electron" in the Dock, the Cmd+Tab switcher, the menu bar title,
 * and Activity Monitor, no matter what the app calls itself at runtime.
 *
 * The fix until this package ships as a properly packaged app: keep a
 * renamed copy of the vendored `Electron.app` in the user's cache and
 * launch that instead. Three things make this cheap rather than the usual
 * bundle-patching hack:
 *
 * - The copy is made with `cp -Rc`, APFS's copy-on-write clone: ~0.1s for
 *   a ~700MB bundle, allocating no new blocks.
 * - The vendored bundle is ad-hoc "linker-signed" with no
 *   `Contents/_CodeSignature`, so nothing seals `Info.plist` and no
 *   re-signing is needed. (It doesn't pass `codesign --verify` as shipped
 *   either, so this doesn't degrade anything.)
 * - Every failure is recoverable by just launching Electron's own binary,
 *   which is what the caller does when this returns `null`.
 */

const BUNDLE_NAME = 'Rozenite.app';
const EXECUTABLE_NAME = 'Rozenite';
// Distinct from Electron's `com.github.Electron`, so LaunchServices
// registers this as its own app rather than serving a cached "Electron"
// identity for it.
const BUNDLE_IDENTIFIER = 'dev.rozenite.app';

/** `…/Electron.app/Contents/MacOS/Electron` → `…/Electron.app`. */
export const getBundlePath = (executablePath) => {
  const marker = `${path.sep}Contents${path.sep}MacOS${path.sep}`;
  const index = executablePath.indexOf(marker);

  return index === -1 ? null : executablePath.slice(0, index);
};

/**
 * Where the branded copy for a given Electron version lives. Keyed by
 * version so an Electron upgrade builds a fresh copy instead of launching
 * a stale one.
 */
export const getCacheDirectory = (version, homeDirectory = os.homedir()) =>
  path.join(homeDirectory, 'Library', 'Caches', 'rozenite', `electron-${version}`);

const readElectronVersion = (bundlePath) => {
  try {
    const plist = fs.readFileSync(path.join(bundlePath, 'Contents', 'Info.plist'), 'utf8');
    const match = /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(plist);

    return match ? match[1] : null;
  } catch {
    return null;
  }
};

const run = (command, args) => spawnSync(command, args, { stdio: 'ignore' }).status === 0;

/**
 * Clones are copy-on-write, so a cache directory for a version that is no
 * longer installed keeps its blocks alive and starts costing real disk.
 */
const removeOtherVersions = (cacheDirectory) => {
  const parent = path.dirname(cacheDirectory);

  let entries;
  try {
    entries = fs.readdirSync(parent);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.startsWith('electron-') && path.join(parent, entry) !== cacheDirectory) {
      fs.rmSync(path.join(parent, entry), { recursive: true, force: true });
    }
  }
};

const buildBrandedBundle = (sourceBundle, cacheDirectory) => {
  // Built under a temporary name and moved into place, so a half-built
  // bundle is never visible to a concurrent `rozenite open`.
  const stagingDirectory = `${cacheDirectory}.staging-${process.pid}`;
  const stagedBundle = path.join(stagingDirectory, BUNDLE_NAME);

  try {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
    fs.mkdirSync(stagingDirectory, { recursive: true });

    // `-c` is the clone; without APFS support it fails outright rather
    // than silently falling back to a real 700MB copy, which is the
    // outcome we want — a slow launch is worse than the Electron name.
    if (!run('cp', ['-Rc', sourceBundle, stagedBundle])) {
      return null;
    }

    const infoPlist = path.join(stagedBundle, 'Contents', 'Info.plist');
    const branded = run('/usr/libexec/PlistBuddy', [
      '-c',
      `Set :CFBundleName ${EXECUTABLE_NAME}`,
      '-c',
      `Set :CFBundleDisplayName ${EXECUTABLE_NAME}`,
      '-c',
      `Set :CFBundleIdentifier ${BUNDLE_IDENTIFIER}`,
      '-c',
      `Set :CFBundleExecutable ${EXECUTABLE_NAME}`,
      infoPlist,
    ]);

    if (!branded) {
      return null;
    }

    // Renaming the executable is what fixes the process name in Activity
    // Monitor and the force-quit dialog; the signature lives inside the
    // Mach-O, so moving the file doesn't disturb it.
    fs.renameSync(
      path.join(stagedBundle, 'Contents', 'MacOS', 'Electron'),
      path.join(stagedBundle, 'Contents', 'MacOS', EXECUTABLE_NAME),
    );

    fs.mkdirSync(path.dirname(cacheDirectory), { recursive: true });
    fs.renameSync(stagingDirectory, cacheDirectory);

    return path.join(cacheDirectory, BUNDLE_NAME, 'Contents', 'MacOS', EXECUTABLE_NAME);
  } catch {
    return null;
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  }
};

/**
 * The executable to actually spawn: a branded copy of Electron's bundle if
 * one can be had, otherwise `null` for "just use Electron's own binary".
 * Only ever does anything on macOS — on Windows and Linux the app name
 * comes from places this trick doesn't reach.
 */
export const resolveBrandedExecutable = (electronExecutable) => {
  if (process.platform !== 'darwin') {
    return null;
  }

  const sourceBundle = getBundlePath(electronExecutable);

  if (!sourceBundle) {
    return null;
  }

  const version = readElectronVersion(sourceBundle);

  if (!version) {
    return null;
  }

  const cacheDirectory = getCacheDirectory(version);
  const executable = path.join(cacheDirectory, BUNDLE_NAME, 'Contents', 'MacOS', EXECUTABLE_NAME);

  if (fs.existsSync(executable)) {
    return executable;
  }

  const built = buildBrandedBundle(sourceBundle, cacheDirectory);

  if (built) {
    removeOtherVersions(cacheDirectory);
  }

  return built;
};
