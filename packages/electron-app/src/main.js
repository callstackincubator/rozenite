import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';

const url = process.argv[process.argv.length - 1];

if (!url || !url.startsWith('http')) {
  console.error('Usage: rozenite-electron-app <url>');
  app.exit(1);
}

const iconPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icon.png');

app.setName('Rozenite');

// Matches the app's own dark theme (`--background`/`--foreground` in
// packages/ui/styles.css's `.dark` block) so the title bar blends into the
// page instead of standing out as a separate native strip.
const TITLE_BAR_BACKGROUND = '#201f24';
const TITLE_BAR_FOREGROUND = '#ffffff';
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

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.setIcon(iconPath);
  }

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Rozenite',
    icon: iconPath,
    // Electron's default window canvas is white until the page has
    // something to paint over it, so loading a dark page (this one, over
    // the network) shows a white flash first — see
    // https://www.electronjs.org/docs/latest/api/browser-window#showing-the-window-gracefully.
    // Matching the app's own background makes that gap invisible instead.
    backgroundColor: TITLE_BAR_BACKGROUND,
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
      color: TITLE_BAR_BACKGROUND,
      symbolColor: TITLE_BAR_FOREGROUND,
      height: SIDEBAR_HEADER_HEIGHT,
    },
  });
  window.once('ready-to-show', () => {
    window.show();
  });
  window.loadURL(url);
});

app.on('window-all-closed', () => {
  app.quit();
});
