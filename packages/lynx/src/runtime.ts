/**
 * Rozenite's device-side runtime for Lynx. Importing this module installs
 * the `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` global that
 * `@rozenite/plugin-bridge` talks to on the device.
 *
 * ```ts
 * import '@rozenite/lynx/runtime';
 * ```
 *
 * `rozeniteLynxPlugin()` injects this module into the app's bundle via
 * `source.preEntry` automatically -- most apps never import it by hand. It
 * lives at this subpath, not `@rozenite/lynx`'s root, precisely so it can
 * have this import-time side effect: the root export is `<Rozenite />`, the
 * app-side seam (`./index.tsx`), which must do nothing on its own so it can
 * be rendered unconditionally, even in a production build.
 *
 * Import it once, at the app's entry point, before any plugin's
 * `useRozeniteDevToolsClient` runs, if you are not using
 * `rozeniteLynxPlugin()`'s automatic injection.
 */
import { setupRozenite } from './install.js';

export { setupRozenite } from './install.js';
export type { FuseboxReactDevToolsDispatcher } from './dispatcher.js';

setupRozenite();
