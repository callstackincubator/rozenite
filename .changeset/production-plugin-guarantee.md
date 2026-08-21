---
'@rozenite/react-native': minor
'@rozenite/metro': minor
'@rozenite/repack': minor
'@rozenite/middleware': minor
'@rozenite/tools': minor
'@rozenite/vite-plugin': minor
'@rozenite/redux-devtools-plugin': minor
'@rozenite/feature-flags-plugin': minor
'@rozenite/rhf-plugin': minor
'@rozenite/network-activity-plugin': minor
'@rozenite/require-profiler-plugin': minor
'rozenite': minor
---

Guarantee that Rozenite plugins never reach a production bundle. Until now the
only thing keeping plugin code out of a release was a shim each plugin wrote by
hand, which made inclusion survivable rather than impossible and did nothing at
all for a third-party plugin that exported a hook from its package index.

Apps now install `@rozenite/react-native` and render `<Rozenite />` once at the
app root — unconditionally, with no `__DEV__` guard to write or forget — and
move every plugin hook call into a `rozenite.dev.tsx` next to their bundler
config. In development the Metro and Re.Pack resolvers redirect the seam to that
file; in production it resolves to a shipped noop, so nothing reachable from it
can enter the bundle. The dev entry may be a single file or a `rozenite.dev/`
directory, and platform extensions (`rozenite.dev.ios.tsx`,
`rozenite.dev/index.web.tsx`) work for free. `rozenite init` scaffolds it.

Importing a plugin package from ordinary app code is now a **production build
error** naming the file that did it, enforced in the resolver rather than by
convention. The same mistake prints a warning during development, so it surfaces
while it is being made rather than at release.

A plugin that genuinely needs to run in production declares it: a root
`register.ts` plus `productionEntries: ['./register']` in its
`rozenite.config.ts` gets a `./register` export the resolver permits, and nothing
else in the package. `@rozenite/redux-devtools-plugin` (store enhancer),
`@rozenite/feature-flags-plugin` (flag evaluation), `@rozenite/rhf-plugin`
(per-form hook) and `@rozenite/network-activity-plugin` (on-boot recording) now
ship one — import those symbols from `<plugin>/register`.

Breaking: `withRozenite(config, { enabled: false })` no longer means "do
nothing". It still starts no dev server and adds no middleware, but the guard
stays active, so turning Rozenite off is not a way to opt out of the guarantee.
Use `allowInProduction: ['some-plugin']` for that, which is logged loudly on
every build.

Also fixes `withRozeniteRequireProfiler` shipping its instrumentation polyfill
into release bundles. Metro adds `serializer.getPolyfills` entries to the graph
by absolute path rather than through module resolution, so the resolver guard
could never have seen it; it is now skipped when Metro is bundling for release.
