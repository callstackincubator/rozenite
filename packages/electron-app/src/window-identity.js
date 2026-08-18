/**
 * Pure helpers for deciding *which* window a launch request belongs to.
 * Kept out of `main.js` so they can be tested without booting Electron.
 */

/**
 * The launch URL out of a process argv. Both the initial launch
 * (`electron <main.js> <url>`) and a hand-off from a second process
 * (Electron's `second-instance` event, which forwards that process's raw
 * argv) put it last, but scanning for the last `http(s)` argument keeps
 * this working if Electron/Chromium ever appends switches of its own.
 */
export const parseLaunchUrl = (argv) => {
  for (let index = argv.length - 1; index >= 0; index--) {
    const candidate = argv[index];

    if (typeof candidate === 'string' && /^https?:\/\//.test(candidate)) {
      return candidate;
    }
  }

  return null;
};

/**
 * Identity of the *device* a launch URL points at, used to decide whether
 * a second `rozenite open` should get a new window or just focus the one
 * already showing that device.
 *
 * Not the URL itself: its `ws` parameter carries a `page` id that Metro
 * reassigns on every JS reload (see `ParsedTarget` in
 * `packages/app/src/connection/target-from-url.ts`), so two launches for
 * the same device rarely produce byte-identical URLs. The device id is
 * the stable part — scoped by origin, since device ids are per-Metro
 * counters and two Metro instances on different ports will both hand out
 * a device `1`.
 *
 * Falls back to the whole URL when the shape is unrecognised: a key that's
 * too specific only costs an extra window, while collapsing unparseable
 * URLs onto one key would focus a window showing a different device.
 */
export const getWindowKey = (url) => {
  let target;

  try {
    target = new URL(url);
  } catch {
    return url;
  }

  const ws = target.searchParams.get('ws');

  if (!ws) {
    return url;
  }

  try {
    // `ws` is normally a path rooted at the same origin
    // (`/inspector/debug?device=…`); the base makes that parseable and is
    // ignored when `ws` is already absolute.
    const deviceId = new URL(ws, target.origin).searchParams.get('device');

    return deviceId ? `${target.origin}|${deviceId}` : url;
  } catch {
    return url;
  }
};
