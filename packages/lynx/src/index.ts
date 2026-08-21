/**
 * Rozenite's device-side runtime for Lynx. Importing this module installs
 * the `__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__` global that
 * `@rozenite/plugin-bridge` talks to on the device.
 *
 * ```ts
 * import '@rozenite/lynx';
 * ```
 *
 * Import it once, at the app's entry point, before any plugin's
 * `useRozeniteDevToolsClient` runs.
 */
import { setupRozenite } from './install.js';

export { setupRozenite } from './install.js';
export type { FuseboxReactDevToolsDispatcher } from './dispatcher.js';

setupRozenite();
