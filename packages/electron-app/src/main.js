import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron';
import { getWindowKey, parseLaunchUrl } from './window-identity.js';

const DOCS_URL = 'https://rozenite.dev/docs/getting-started';

const iconPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icon.png');

// Matches the app's own `--background`/`--foreground` in
// packages/ui/styles.css (its `:root` and `.dark` blocks) so the window
// chrome blends into the page instead of standing out as a separate native
// strip. Which pair applies is decided by `nativeTheme` rather than pinned
// to dark: the page itself picks its theme from `prefers-color-scheme` (see
// packages/app/index.html), so hardcoding one would give light-mode users a
// dark window canvas and, on Windows/Linux, a permanently dark caption strip.
const CHROME_COLORS = {
  dark: { background: '#201f24', symbol: '#ffffff' },
  light: { background: '#ffffff', symbol: '#201f24' },
};
// Height of `Sidebar.Header` (Tailwind's `h-12`, see `Shell.tsx`) — used
// as-is for the Windows/Linux overlay, whose window controls sit at the
// top *right* and so never conflict with anything the sidebar header does.
const SIDEBAR_HEADER_HEIGHT = 48;
// macOS traffic lights sit at the top *left* instead, over the same corner
// as the sidebar header's logo — `MAC_TRAFFIC_LIGHT_STRIP_PX` in
// `packages/app/src/window-controls.tsx` reserves a strip above that logo
// exactly this tall for them, rather than sizing the header itself to fit
// both side by side.
const MAC_TRAFFIC_LIGHT_STRIP_HEIGHT = 28;
// Below roughly this, the sidebar/panel split stops being usable at all.
const MIN_WINDOW_WIDTH = 640;
const MIN_WINDOW_HEIGHT = 400;

/** Live windows by `getWindowKey(url)` — see `openOrFocusWindow`. */
const windows = new Map();

const getChromeColors = () =>
  nativeTheme.shouldUseDarkColors ? CHROME_COLORS.dark : CHROME_COLORS.light;

/**
 * Hands a URL to the user's browser instead of opening it in-app. Anything
 * that isn't plain web navigation is dropped rather than passed to the OS,
 * so a plugin panel can't get `shell.openExternal` to run an arbitrary
 * `file:`/custom-scheme handler.
 */
const openExternally = (url) => {
  try {
    const { protocol } = new URL(url);

    if (protocol === 'http:' || protocol === 'https:') {
      void shell.openExternal(url);
    }
  } catch {
    // Not a URL we can hand off; dropping it is the safe outcome.
  }
};

const isSameOrigin = (url, other) => {
  try {
    return new URL(url).origin === new URL(other).origin;
  } catch {
    return false;
  }
};

const createWindow = (url, key) => {
  const colors = getChromeColors();

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: 'Rozenite',
    icon: iconPath,
    // Electron's default window canvas is white until the page has
    // something to paint over it, so loading a dark page (this one, over
    // the network) shows a white flash first — see
    // https://www.electronjs.org/docs/latest/api/browser-window#showing-the-window-gracefully.
    // Matching the app's own background makes that gap invisible instead.
    backgroundColor: colors.background,
    // Belt-and-suspenders alongside backgroundColor, per the same guide:
    // keep the window hidden until the page has actually rendered once, so
    // there's nothing — not even a themed blank canvas — to flash before
    // real content appears.
    show: false,
    // Hides the native title bar while keeping the traffic
    // lights/window-controls, so the page's own sidebar header can render
    // in their place instead of a separate OS-drawn bar — the same look
    // Codex and Claude Code use.
    titleBarStyle: 'hidden',
    // Only meaningful on macOS; centers the traffic lights within
    // MAC_TRAFFIC_LIGHT_STRIP_HEIGHT (light diameter ~12px, so top =
    // height/2 - 6).
    trafficLightPosition: { x: 16, y: MAC_TRAFFIC_LIGHT_STRIP_HEIGHT / 2 - 6 },
    // Windows/Linux equivalent of trafficLightPosition — macOS ignores this.
    titleBarOverlay: {
      color: colors.background,
      symbolColor: colors.symbol,
      height: SIDEBAR_HEADER_HEIGHT,
    },
  });

  // Links in the app (`Link external`, e.g. the setup guide and the npm
  // links on the Plugins screen) are `target="_blank"`. Electron's default
  // is to satisfy those with a second BrowserWindow, which here means the
  // documentation site opening inside a chrome-less window with no address
  // bar and no way back. They belong in the user's browser.
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    openExternally(target);
    return { action: 'deny' };
  });

  // Same reasoning for top-level navigation, which additionally has to
  // hold against the panels: plugin bundles are served by the same Metro
  // instance as this app, so a panel iframe is same-origin with it and can
  // navigate the whole shell away. Off-origin navigation is never
  // something this window should perform.
  window.webContents.on('will-navigate', (event, target) => {
    if (!isSameOrigin(target, url)) {
      event.preventDefault();
      openExternally(target);
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('closed', () => {
    windows.delete(key);
  });

  window.loadURL(url);

  return window;
};

const focusWindow = (window) => {
  if (window.isMinimized()) {
    window.restore();
  }

  if (!window.isVisible()) {
    window.show();
  }

  // `rozenite open` is run from a terminal that currently owns the
  // foreground, so on macOS the window won't actually come forward
  // without the app explicitly taking focus first.
  app.focus({ steal: true });
  window.focus();
};

/**
 * Opens `url`, or focuses the window already showing that device.
 *
 * Running `rozenite open` twice for the same device should surface the
 * window you already have (with all of its panel state) rather than open a
 * second one against the same debugger — while a genuinely different
 * device still gets its own window.
 */
const openOrFocusWindow = (url) => {
  const key = getWindowKey(url);
  const existing = windows.get(key);

  if (existing && !existing.isDestroyed()) {
    focusWindow(existing);
    return;
  }

  windows.set(key, createWindow(url, key));
};

/**
 * Replaces Electron's stock menu, which ships Chromium's browser
 * accelerators and a "Help → Learn More" pointing at electronjs.org.
 *
 * Reload is deliberately absent: panels surviving a JS-VM reload is this
 * app's headline feature (see the `shellMounted` latch in
 * `packages/app/src/App.tsx`), and Cmd/Ctrl+R would throw away every
 * panel's state — the exact thing the app is built to preserve. Dropping
 * the menu item drops the accelerator with it.
 *
 * Windows/Linux get no menu at all rather than this one: with
 * `titleBarStyle: 'hidden'` a menu bar would render inside the window,
 * above the app's own sidebar header. Chromium still handles the native
 * editing shortcuts there without a menu.
 */
const installApplicationMenu = () => {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'toggleDevTools' }] },
      { role: 'windowMenu' },
      {
        role: 'help',
        submenu: [
          {
            label: 'Rozenite Documentation',
            click: () => openExternally(DOCS_URL),
          },
        ],
      },
    ]),
  );
};

const launchUrl = parseLaunchUrl(process.argv);

if (!launchUrl) {
  console.error('Usage: rozenite-electron-app <url>');
  app.exit(1);
}

// Must precede `requestSingleInstanceLock`: the lock is scoped to the
// app's `userData` directory, which is derived from the app name.
app.setName('Rozenite');

// One process owns every Rozenite window, so that a second `rozenite open`
// can be answered by the process that already has the windows — either by
// focusing the one for that device or by adding a sibling window for a new
// one. Without the lock each launch would be its own Electron process,
// with its own dock entry and no way to see the others.
if (!app.requestSingleInstanceLock()) {
  // The owning process gets our argv via `second-instance` below and takes
  // it from here.
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const url = parseLaunchUrl(argv);

    if (url) {
      openOrFocusWindow(url);
    }
  });

  // Keeps the chrome in step when the OS appearance is switched while the
  // app is running; the page follows the same change through its own
  // `prefers-color-scheme` styles.
  nativeTheme.on('updated', () => {
    const colors = getChromeColors();

    for (const window of windows.values()) {
      if (window.isDestroyed()) {
        continue;
      }

      window.setBackgroundColor(colors.background);

      // Windows-only API; macOS draws the traffic lights itself.
      if (process.platform !== 'darwin') {
        window.setTitleBarOverlay({
          color: colors.background,
          symbolColor: colors.symbol,
          height: SIDEBAR_HEADER_HEIGHT,
        });
      }
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'darwin') {
      app.dock.setIcon(iconPath);
    }

    installApplicationMenu();
    openOrFocusWindow(launchUrl);
  });
}

// Quits on every platform, macOS included: each window exists to show one
// device that `rozenite open` picked, so with the last one closed there is
// nothing for a dock click to reactivate.
app.on('window-all-closed', () => {
  app.quit();
});
