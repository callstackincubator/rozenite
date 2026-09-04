# 0002 — Rozenite plugins never enter Lynx production bundles

**Status:** Accepted

**Related:** [callstackincubator/rozenite#492](https://github.com/callstackincubator/rozenite/issues/492),
[callstackincubator/rozenite#415](https://github.com/callstackincubator/rozenite/issues/415),
[0001](./0001-plugins-never-enter-production-bundles.md)

## Context

ADR 0001 establishes, for React Native, that nothing from a Rozenite plugin
reaches a production bundle unless its author declared it: apps mount
`<Rozenite />` from `@rozenite/react-native` once, all plugin wiring lives in
`rozenite.dev.tsx`, the bundler resolver redirects the seam to that file in
development and to a shipped noop in production, and a production build that
resolves into a plugin package through anything other than a declared
`productionEntries` subpath fails, naming the importing file. The rspack
implementation of that resolver (`RozeniteResolverPlugin`) lives in
`@rozenite/middleware` so that more than one bundler integration can install
it.

Lynx has none of this. Plugin device halves are imported straight from app
code (`apps/playground-lynx/src/plugins/*` import `useRozeniteControlsPlugin`,
`useTanStackQueryDevTools`, …), and the only thing keeping that code out of a
release is each plugin's hand-written `react-native.ts` shim folding on
`__DEV__` — inclusion is survivable, not impossible, and a third-party plugin
exporting a hook from its package index defeats it entirely.

The current rspeedy integration cannot close that gap:

- `rozeniteLynxPlugin` (`packages/lynx/src/rspeedy.ts`) is `apply: 'serve'`
  and additionally gated on `NODE_ENV`, so it never runs during
  `rspeedy build`. That is correct for the dev server, the DebugRouter
  transport and the runtime injection, but it means nothing observes a
  production build at all.
- The root export of `@rozenite/lynx` *is* the injected device runtime and
  calls `setupRozenite()` at import time. The plugin injects it through
  `source.preEntry`; the app never imports it.
- `packages/test-utils` drives Metro only. Nothing can prove a Lynx release
  bundle is clean.

Two facts shape what the Lynx design can look like:

- **Some plugins mount components at the root.** A bundler-injected entry
  can register hooks, but it has no React tree to mount into. The seam
  component is therefore required on Lynx as well, not just a React Native
  workaround.
- **ReactLynx runs effects on the background thread only.** Hooks inside a
  dev entry rendered from the ReactLynx root are naturally background-only.
  The main-thread inertness the runtime needs is already handled by the
  `__BACKGROUND__` gate in `packages/lynx/src/install.ts` and does not need
  to be repeated in a seam.

## Decision

Lynx gets the same DX and the same enforcement as React Native, through the
same shared resolver plugin, with one package-shape change.

### `<Rozenite />` is exported from `@rozenite/lynx`

`@rozenite/lynx` splits into side-effect-free-by-construction entries:

| Entry | Contents |
|---|---|
| `@rozenite/lynx` | The seam: `<Rozenite />` rendering a statically imported `./dev-entry.js` noop, mirroring `@rozenite/react-native`. React (via ReactLynx) is its only peer. Importing it does nothing. |
| `@rozenite/lynx/runtime` | The injected device runtime (today's root export). `setupRozenite()` and the `__BACKGROUND__` gate live here. `rozeniteLynxPlugin` points `source.preEntry` at this subpath. |
| `@rozenite/lynx/rspeedy` | Unchanged. |

The seam cannot share the root entry with the runtime: an app imports the
seam unconditionally, so a side-effectful root would install the dispatcher
in every production build — the exact leak this ADR exists to prevent.

The README's manual fallback for non-rspeedy pipelines
(`if (__DEV__) require('@rozenite/lynx')`) moves to the `/runtime` subpath.
This is the one user-visible break and gets its own changeset entry.

### The rspeedy plugin installs the guard in both modes

`rozeniteLynxPlugin` drops `apply: 'serve'`. Inside `setup`:

- The dev server, middleware, DebugRouter transport and `preEntry` runtime
  injection stay serve-only and `enabled`-gated, exactly as today.
- The resolver guard is installed unconditionally — in `serve` and in
  `build` — via `api.modifyRspackConfig`, by appending the shared
  `RozeniteResolverPlugin` from `@rozenite/middleware`. `isDev` derives from
  the Rsbuild mode, not `NODE_ENV`. `installDevEntryRedirect` is true only
  when Rozenite is enabled.

Semantics match Metro and Re.Pack: `enabled: false` means "no dev server,
guard still active"; a production build that resolves into a Rozenite plugin
package through anything but a declared `productionEntries` subpath fails,
naming the importing file; the same mistake warns in development;
`allowInProduction` is the escape hatch and is logged loudly.

No new rspack mechanics are needed. `beforeResolve` for the dev-entry
redirect and `afterResolve` plus `compilation.errors.push(new
WebpackError(...))` for the guard were verified against rspack for Re.Pack,
and Rsbuild leaves `normalModuleFactory` hooks intact.

### `rozenite.dev.tsx` is identical

Project root, resolved through `resolve.extensions`, flat file or
`rozenite.dev/` directory.

**Deferred:** `rozenite init` scaffolding this file and printing the mount
snippet for Lynx projects, as this section originally promised, has not
landed. `packages/cli`'s `init-command.ts` is entirely React-Native-shaped
today -- Lynx-project detection, an rspeedy config wrapper, and a
Lynx-flavoured mount snippet are all new work, not a small addition to the
existing flow, and tracked separately rather than folded into this change.
Everything else in this ADR -- the seam, the resolver guard, and the
integration check -- does not depend on it: a Lynx project can adopt
`rozeniteLynxPlugin()` and `rozenite.dev.tsx` today by hand, following this
package's README, exactly as a React Native project could before `rozenite
init` supported it.

### Integration gating rides the same resolver

`dist/rozenite.json` now carries `integrations`. The Lynx guard also refuses
a plugin that does not declare `lynx` (or `lynx-web` for web targets):
warning in development, error in production, same message shape as the
production guard. A React Native-only plugin resolving into a Lynx bundle is
a mistake the resolver can name just as well.

### A rspeedy release-bundle bench

`@rozenite/test-utils` gains a rspeedy counterpart to `bundleForRelease()`
that builds a throwaway ReactLynx app in production mode and reports
`rozeniteModules` / `panelModules` from emitted module paths, so the Lynx
guard gets the same non-vacuous tests `docs/agents/release-bundle-testing.md`
requires: a deliberate plugin import fails naming the file, a declared
production entry succeeds, `enabled: false` still guards, and a clean app
with `rozenite.dev.tsx` ships zero `rozenite.dev` modules and zero plugin
`src/**`.

## Consequences

- App authors get one convention across React Native and Lynx: mount
  `<Rozenite />` once, wire plugins in `rozenite.dev.tsx`, never write a
  `__DEV__` guard.
- Plugin authors get nothing new to do. `productionEntries`,
  `allowInProduction` and the manifest are shared, and `integrations` is
  already populated.
- `rozeniteLynxPlugin` runs (minimally) during `rspeedy build`. A clean
  production build pays one memoized `package.json` walk per resolved
  module; a dirty one fails instead of shipping.
- The `@rozenite/lynx` root export changes meaning. Anyone who followed the
  manual `require('@rozenite/lynx')` fallback must move to
  `@rozenite/lynx/runtime`.
- Verified during implementation: `@lynx-js/react` does not depend on
  `react` at all -- it is its own implementation of the React runtime, not
  an alias for it -- so the apparent `react` resolution in the playground
  came from elsewhere in the workspace, not from `@lynx-js/react`. The Lynx
  seam is therefore built against `@lynx-js/react`'s own `jsx-runtime`
  (`jsxImportSource: '@lynx-js/react'` at build time, `@lynx-js/react`
  external in `packages/lynx/vite.seam.config.ts`), not shared source with
  `@rozenite/react-native`'s seam -- as anticipated above, this does not
  change the decision, only which JSX runtime the built seam imports.

## Alternatives considered

- **Keep `rozeniteLynxPlugin` serve-only and ship a separate guard plugin.**
  Rejected. A guard users can forget to install is the same weak link the
  seam removes on the app side. The guard has value only if it is present in
  the build the user did not think about.
- **Inject `rozenite.dev.tsx` through `preEntry` instead of a seam.** Rejected.
  It cannot mount root components, and it would give Lynx a different
  convention from React Native, where injection is impossible (Metro has no
  way to add artificial dependencies to an entry point; run-before-main-module
  only reorders modules already in the graph).
- **Export the seam from the existing root entry next to the runtime.**
  Rejected: the root entry has import-time side effects, so the seam would
  ship the dispatcher install to production.
- **A `__DEV__`-folded seam instead of a resolver redirect.** Rejected for
  the same reason as in 0001: a bare `require` inside a strict ES module is
  fatal under rspack, and folding rests on transform order nothing pins.
