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
 *
 * `./dev-entry.js` is marked `external` in `vite.seam.config.ts` (built
 * separately by `vite.dev-entry.config.ts`), rather than being a same-build
 * Rollup entry this one statically imports. That is load-bearing, not
 * incidental: `RozeniteResolverPlugin` (`@rozenite/middleware`) rewrites
 * this exact request to a *different* module -- the app's own
 * `rozenite.dev.tsx` -- at resolve time, and Rollup has no way to know
 * that while bundling. Left as a same-build reference, Rollup's CJS output
 * statically inlines a direct, un-interop'd access to whatever shape it
 * knows *this build's own* `dev-entry.tsx` has (a bare `module.exports =
 * fn`, since Rollup controls both sides) -- which is wrong once the
 * request is redirected to a real ES module, compiled independently by
 * rspack/webpack, whose CJS interop wraps a default export as `{ default:
 * fn, __esModule: true }`. `external` makes Rollup treat the reference the
 * way it treats any dependency it does not control: with a real runtime
 * `__esModule` check before deciding whether to unwrap `.default`, which
 * handles both shapes correctly.
 */
const Rozenite = (): ReactElement => <DevEntry />;

export default Rozenite;
