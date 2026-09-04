import { ControlsPlayground } from './ControlsPlayground.jsx';
import { FeatureFlagsPlayground } from './FeatureFlagsPlayground.jsx';
import { RhfPlayground } from './RhfPlayground.jsx';
import { TanStackQueryPlayground } from './TanStackQueryPlayground.jsx';

/**
 * The Lynx dev entry. `rozeniteLynxPlugin()` redirects
 * `@rozenite/lynx`'s `<Rozenite />` here in development; none of this is
 * reachable in a production bundle.
 *
 * Every playground panel below both wires a plugin's DevTools hook and
 * renders the on-device UI that shows a remote change taking effect, so the
 * whole showcase lives under this `rozenite.dev/` directory rather than
 * only the hook calls -- `<Rozenite />` sits in `../src/App.tsx` exactly
 * where these panels used to render directly. Keeping every panel as a
 * sibling file *inside* `rozenite.dev/`, rather than importing them from
 * `../src/plugins/`, matters beyond organisation: `RozeniteResolverPlugin`
 * only skips its "move this into rozenite.dev.tsx" dev-time advisory for an
 * importer whose own path has a `rozenite.dev` segment (see
 * `isDevEntryOrigin` in `@rozenite/middleware`'s `production-guard.ts`) --
 * an importer one directory outside it would warn on every plugin hook
 * call below, even though production is unaffected either way.
 */
export default function RozeniteDevEntry() {
  return (
    <>
      <ControlsPlayground />
      <FeatureFlagsPlayground />
      <RhfPlayground />
      <TanStackQueryPlayground />
    </>
  );
}
