import type { ReactElement } from 'react';
import DevEntry from './dev-entry.js';

/**
 * The Rozenite app-side seam. Render it unconditionally from your app root:
 *
 * ```tsx
 * import Rozenite from '@rozenite/react-native';
 *
 * <Rozenite />
 * ```
 *
 * In development, `withRozenite()` redirects the import below to your
 * project's `rozenite.dev` file. In production it resolves to a shipped
 * noop, and no plugin code is ever included in the bundle.
 */
const Rozenite = (): ReactElement => <DevEntry />;

export default Rozenite;
