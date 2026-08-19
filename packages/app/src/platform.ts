/**
 * This app is served over plain HTTP and can be opened either inside the
 * `@rozenite/electron-app` shell or directly in a regular browser tab (see
 * `App.tsx`'s `TargetUrlError` messaging) — `TitleBar` must only render its
 * draggable strip in the former case. There's no IPC/preload bridge to ask
 * the main process directly (this page never gets Node integration), so
 * this falls back to what every Chromium-based renderer already exposes.
 */
export const isElectron = (): boolean => /\bElectron\//.test(navigator.userAgent);

/** Only meaningful for `isElectron()` — macOS is the one platform where the
 * window keeps its traffic lights when `titleBarStyle: 'hidden'` is set
 * (see `packages/electron-app/src/main.js`), so it's the one platform
 * `TitleBar` needs to reserve space for them. */
export const isMac = (): boolean => /\bMac\b/.test(navigator.userAgent);
