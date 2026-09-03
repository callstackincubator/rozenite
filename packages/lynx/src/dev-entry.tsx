/**
 * The shipped noop. This is what `<Rozenite />` renders when nothing
 * redirects the `./dev-entry.js` request made from `./index.tsx`.
 *
 * In development, `@rozenite/lynx/rspeedy`'s `rozeniteLynxPlugin` (via the
 * shared `RozeniteResolverPlugin` from `@rozenite/middleware`) redirects
 * that request to the app's `rozenite.dev` file. In production nothing
 * redirects it, so this module is what ships -- which is why it must stay a
 * plain `() => null` after `process.env.NODE_ENV` is folded, with no hooks,
 * no imports and no plugin code behind it. Mirrors
 * `@rozenite/react-native`'s `src/dev-entry.tsx` exactly, so the two seams
 * cannot drift.
 */

let hasWarned = false;

const RozeniteDevEntry = () => {
  // Warning from the render body rather than an effect keeps the whole
  // block foldable: in a production bundle this collapses to `() => null`,
  // with no hook call left behind. `hasWarned` keeps a double render from
  // logging twice.
  if (process.env.NODE_ENV !== 'production' && !hasWarned) {
    hasWarned = true;
    console.warn(
      '[Rozenite] <Rozenite /> rendered but no dev entry was found, so nothing was loaded.\n' +
        '           Check that rozeniteLynxPlugin() is in your lynx.config.ts plugins, and\n' +
        '           that rozenite.dev.tsx exists next to it.',
    );
  }

  return null;
};

export default RozeniteDevEntry;
