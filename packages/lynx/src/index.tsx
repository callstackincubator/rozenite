import type { ReactElement } from '@lynx-js/react';
import DevEntry from './dev-entry.js';

/**
 * The Rozenite app-side seam for Lynx. Render it unconditionally from your
 * app root:
 *
 * ```tsx
 * import Rozenite from '@rozenite/lynx';
 *
 * <Rozenite />
 * ```
 *
 * In development, `rozeniteLynxPlugin()` redirects the import below to your
 * project's `rozenite.dev` file. In production it resolves to a shipped
 * noop, and no plugin code is ever included in the bundle. Mirrors
 * `@rozenite/react-native`'s `src/index.tsx` exactly, so the two seams
 * cannot drift; see `@rozenite/lynx/runtime` for the device-side runtime
 * this package also ships.
 */
const Rozenite = (): ReactElement => <DevEntry />;

export default Rozenite;
