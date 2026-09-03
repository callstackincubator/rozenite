# 0001 — Plugins never enter production bundles

**Status:** Accepted

**Related:** [callstackincubator/rozenite#415](https://github.com/callstackincubator/rozenite/issues/415), [callstackincubator/rozenite#445](https://github.com/callstackincubator/rozenite/pull/445)

## Context

Every Rozenite plugin hand-wrote a `react-native.ts` shim that re-declared its
export surface, re-sniffed the environment, and hand-wrote a no-op twin per
function — the only thing keeping plugin code out of production bundles. That
made inclusion *survivable* rather than *impossible*:

- It rested on transform-order luck: elimination depended on
  `process.env.NODE_ENV` inlining plus Metro's transform ordering, which
  nothing pinned.
- A wrong stub was silent — a stub returning the wrong shape broke a
  production build in a way nothing caught.
- It only worked for plugins that opted in. A third-party plugin exporting a
  hook straight from its package index defeated the whole design, and there
  was no framework-level guarantee against that.

The goal (#415): nothing reaches production except what its author
explicitly declared for production, uniform across official and third-party
plugins, requiring no cooperation from a plugin author beyond the manifest
they already ship.

Two mechanisms that look like they could fix this cannot:

- **A `development` export condition.** `metro-config` defaults
  `unstable_conditionNames: []`, and React Native's preset adds only
  `require`/`import`/`react-native`. A `development` condition never matches
  under Metro.
- **A resolver that redirects real → stub in production.** `withRozenite`
  historically returned the config untouched when `enabled === false` or
  when bundling for release — production bundling was exactly the case where
  Rozenite's Metro config did not run, so there was nothing to redirect with.

**Why Metro cannot inject a dev entry.** An earlier design considered having
the bundler itself inject plugin wiring as an extra entry point in
development. Metro has no way to add artificial dependencies to an entry
point — a config transformer can shape *how* the graph resolves, not add
edges into it that the entry file didn't ask for. Metro's
`runBeforeMainModule` looks like it could serve this purpose, but it only
reorders modules already reachable from the graph; it cannot pull in a file
nothing imports. Concretely, there is no hook that turns
`config.transformer.someOption = 'rozenite.dev'` into "and also require this
file before running the app". This is why the app-side seam package (below)
exists at all: the only place code can be added to a bundle is a real import
somewhere in the graph, so Rozenite ships one.

## Decision

1. **A new app-side seam package, `@rozenite/react-native`.** Apps render
   `<Rozenite />` once at the root, unconditionally — there is no `__DEV__`
   guard for a user to write or forget. It statically imports a real noop it
   ships (`./dev-entry.js`); `react` is its only peer dependency. No
   `__DEV__` guard exists on the seam's own side either: `__DEV__ ?
   require('…') : null` is a bare `require` in a `"type": "module"` package,
   which is fatal under rspack's harmony-module handling. A static import
   plus a resolver decision works in both bundlers, and shipping a real noop
   (rather than relying purely on the redirect) keeps failure modes
   graceful — no resolver installed, or no `rozenite.dev` file, degrades to
   "renders nothing" instead of an unresolvable specifier or a broken build.

2. **All plugin wiring lives in `rozenite.dev.tsx`**, an ordinary project
   file (or a `rozenite.dev/` directory, with platform extensions working
   for free — `rozenite.dev.ios.tsx`, `rozenite.dev/index.web.tsx`). In
   development, the bundler's resolver redirects the seam's `./dev-entry.js`
   request to this file, resolved through the host resolver so the project's
   own `sourceExts`/`resolve.extensions` and platform extensions apply. All
   wiring living in one project-owned file — rather than scattered across
   whatever component happens to need a plugin's hook — is what makes the
   redirect a single resolver decision instead of a search.

3. **The production guard is installed unconditionally by `withRozenite`
   (Metro) and its Re.Pack equivalent, in both `enabled: true` and
   `enabled: false`.** A production build that resolves into a Rozenite
   plugin package throws, naming the offending file. This is a behavior
   change: `enabled: false` used to mean "do nothing"; it now means "no dev
   server, guard still active". Turning Rozenite off is not a way to opt out
   of the guarantee — that path is exactly the production path the guard
   exists for. The same mistake warns (not throws) in development, so it
   surfaces while it is being made rather than at release time.

4. **`productionEntries`** is the escape hatch for a plugin that genuinely
   needs a touchpoint running in production — a hook called once per form
   instance (`rhf-plugin`), a store enhancer (`redux-devtools-plugin`), an
   override lookup a running app consults (`feature-flags-plugin`,
   `network-activity-plugin`). A plugin declares
   `productionEntries: ['./register']` in `rozenite.config.ts`; the build
   exposes that export subpath and the resolver permits it — and only it —
   to resolve in production.

   This is **declared, not verified**: the resolver does not traverse a
   declared entry's import graph to confirm it is "really" safe. Any such
   rule is either loose enough to prove nothing or tight enough to block
   legitimate code, and both teach people to ignore the check. The
   declaration is the author's explicit statement, in the same category as
   `sideEffects: false` or `"type": "module"` — a wrong declaration is a bug
   to report, not an attack to defend against. The one thing the resolver
   does verify is that a declared entry actually resolves, so a typo reads
   as a build error instead of silently meaning "declared nothing".

5. **`allowInProduction: ['some-plugin']`** is the outer escape hatch,
   logged loudly on every build it applies to. Without one, the first
   person the guard blocks incorrectly would fork the config and lose the
   guarantee entirely; with one, defeating the guarantee for a package is
   visible in every build log rather than silent.

6. **The rspack resolver plugin lives in `@rozenite/middleware`, not
   `@rozenite/repack`.** Re.Pack and (per #492) Lynx both need the identical
   dev-entry redirect and production guard installed on an rspack
   compiler, and neither should have to depend on the other to get it.
   Putting the plugin in the middleware — which both already depend on for
   the guard's shared core (`findRozenitePluginForFile`,
   `formatProductionGuardError`, etc.) — means `@rozenite/lynx` (#492) can
   install it through Rsbuild's `modifyRspackConfig` directly. The plugin
   keeps hand-written structural types for the slice of the
   `NormalModuleFactory`-hooks surface it touches and imports nothing from
   `@rspack/core`, so pulling it into the middleware adds no rspack
   dependency there.

7. **Metro and Re.Pack cannot drift.** Both implement the same decision
   table (importer inside the plugin → allow; resolved file outside any
   plugin → allow; plugin in `allowInProduction` → allow; resolved file is a
   declared entry → allow; otherwise throw in production / warn in
   development), and both call into the same shared core in
   `@rozenite/middleware` for the plugin lookup and the two user-facing
   messages, so the message and the rule read identically regardless of
   bundler.

## Consequences

- Any plugin resolution in a production build is by definition a bypass —
  there is no origin rule, path convention, or resolution-chain tracking to
  keep in sync, because in a correct production build the seam already
  resolves to the noop and no legitimate resolution into a plugin package
  can occur at all.
- This applies uniformly to third-party plugins with no cooperation beyond
  the manifest (`dist/rozenite.json`) every plugin already ships one of.
- `enabled: false` is a breaking behavior change for any project relying on
  it to fully disable Rozenite, including the guard.
- `withRozeniteRequireProfiler`'s Metro polyfill injection
  (`serializer.getPolyfills`) reaches the bundle by absolute path rather
  than through module resolution, so the resolver guard structurally cannot
  see it. That gap is closed separately, by having the transformer itself
  skip when Metro is bundling for release.
- A plugin's declared `productionEntries` must themselves be inert in
  production — the resolver permits the import because the author declared
  it, so whatever the entry file exports is what runs in a shipped app. Each
  plugin needing one re-exports from its own `react-native.ts` (which
  already folds to a no-op once `NODE_ENV` is inlined) rather than from
  `src/**` directly, so there remains one definition of the production
  behavior instead of a second copy that can drift.
- `@rozenite/middleware` gains one more export surface
  (`RozeniteResolverPlugin`) consumed by both `@rozenite/repack` today and
  `@rozenite/lynx` later, without gaining an rspack dependency itself.
- Lynx is explicitly out of scope here — see
  [callstackincubator/rozenite#492](https://github.com/callstackincubator/rozenite/issues/492),
  which depends on this ADR's decisions landing first and adds its own ADR
  for the seam/runtime export split and the build-mode guard specific to
  Rsbuild.

## Alternatives considered

- **Generated dev/production entry points, `*.stub.ts` siblings, and a
  type-level stub/implementation compatibility check** (the original #402
  RFC). Once inclusion is a build error, "make inclusion safe" stops being a
  requirement, so the generated-stub machinery, its return-type table, and
  the type-level compatibility check it needed are no longer necessary.
- **`NODE_ENV` folding as the sole elimination mechanism.** Still true at
  the language level (`__DEV__`/`NODE_ENV` are what actually deletes code
  from a bundle), but it cannot be the *guarantee* — it depends on
  transform ordering nothing pins, and it does nothing for a plugin that
  never bothered to write a shim in the first place.
- **A CI assertion that Metro's production graph contains no real plugin
  modules.** Superseded by the resolver guard itself: a build-time throw
  during every build, not a separate check that could be skipped or run out
  of date with the code it audits.
- **Bundler-injected dev entries instead of an app-side seam.** Ruled out
  for Metro (see Context: no way to add artificial dependencies to an entry
  point) and, per #492, unnecessary for Lynx once the seam pattern already
  exists.
