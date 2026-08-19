import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  getBundlePath,
  getCacheDirectory,
  resolveBrandedExecutable,
} from '../src/branded-bundle.js';

describe('getBundlePath', () => {
  it('walks up from the executable to the bundle root', () => {
    assert.equal(
      getBundlePath('/x/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
      '/x/node_modules/electron/dist/Electron.app',
    );
  });

  it('returns null for a path that is not inside a bundle', () => {
    assert.equal(getBundlePath('/usr/local/bin/electron'), null);
  });
});

describe('getCacheDirectory', () => {
  it('keys the cache by Electron version, so an upgrade rebuilds', () => {
    assert.notEqual(
      getCacheDirectory('33.4.11', '/Users/x'),
      getCacheDirectory('34.0.0', '/Users/x'),
    );
  });

  it('lives under the user cache directory', () => {
    assert.equal(
      getCacheDirectory('33.4.11', '/Users/x'),
      path.join('/Users/x', 'Library', 'Caches', 'rozenite', 'electron-33.4.11'),
    );
  });
});

describe('resolveBrandedExecutable', () => {
  it('declines when the executable is not inside an app bundle', () => {
    // Also the shape every non-macOS platform takes, where this returns
    // null unconditionally and the caller uses Electron's own binary.
    assert.equal(resolveBrandedExecutable('/usr/local/bin/electron'), null);
  });

  it('declines rather than throwing when the bundle does not exist', () => {
    assert.equal(resolveBrandedExecutable('/nope/Missing.app/Contents/MacOS/Electron'), null);
  });
});
