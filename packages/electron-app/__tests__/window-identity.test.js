import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getWindowKey, parseLaunchUrl } from '../src/window-identity.js';

const appUrl = (ws, appId = 'com.example.app') =>
  `http://localhost:8081/rozenite/app/?ws=${encodeURIComponent(ws)}&appId=${encodeURIComponent(appId)}`;

describe('parseLaunchUrl', () => {
  it('reads the URL off a launch argv', () => {
    assert.equal(
      parseLaunchUrl([
        '/path/to/electron',
        '/path/to/main.js',
        'http://localhost:8081/rozenite/app/',
      ]),
      'http://localhost:8081/rozenite/app/',
    );
  });

  it('takes the last URL, so trailing Chromium switches do not shadow it', () => {
    assert.equal(
      parseLaunchUrl(['electron', 'http://first/', '--some-switch', 'http://second/']),
      'http://second/',
    );
  });

  it('returns null when no URL was passed', () => {
    assert.equal(parseLaunchUrl(['/path/to/electron', '/path/to/main.js']), null);
  });

  it('ignores non-web arguments that merely look path-like', () => {
    assert.equal(parseLaunchUrl(['electron', 'file:///tmp/main.js', '--flag']), null);
  });
});

describe('getWindowKey', () => {
  it('is the same for two launches against the same device', () => {
    // Metro hands out a fresh `page` on every JS reload, so the same
    // device is rarely launched with a byte-identical URL.
    const first = appUrl('/inspector/debug?device=42&page=1');
    const second = appUrl('/inspector/debug?device=42&page=7');

    assert.equal(getWindowKey(first), getWindowKey(second));
  });

  it('differs between devices', () => {
    const first = appUrl('/inspector/debug?device=42&page=1');
    const second = appUrl('/inspector/debug?device=43&page=1');

    assert.notEqual(getWindowKey(first), getWindowKey(second));
  });

  it('differs between Metro instances handing out the same device id', () => {
    const first = appUrl('/inspector/debug?device=1&page=1');
    const second = first.replace('localhost:8081', 'localhost:8082');

    assert.notEqual(getWindowKey(first), getWindowKey(second));
  });

  it('ignores the appId, which does not distinguish two devices running one app', () => {
    const ws = '/inspector/debug?device=42&page=1';

    assert.equal(getWindowKey(appUrl(ws, 'com.a')), getWindowKey(appUrl(ws, 'com.b')));
  });

  it('handles a `ws` parameter given as an absolute host:port form', () => {
    const key = getWindowKey(appUrl('localhost:8081/inspector/debug?device=42&page=1'));

    assert.ok(key.endsWith('|42'));
  });

  it('falls back to the whole URL when there is no device to key on', () => {
    // A key that is too specific costs an extra window; one that is too
    // broad would focus a window showing a different device.
    const noWs = 'http://localhost:8081/rozenite/app/';
    const noDevice = appUrl('/inspector/debug?page=1');

    assert.equal(getWindowKey(noWs), noWs);
    assert.equal(getWindowKey(noDevice), noDevice);
    assert.equal(getWindowKey('not a url'), 'not a url');
  });
});
