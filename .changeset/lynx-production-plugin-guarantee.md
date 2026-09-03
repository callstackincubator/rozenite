---
'@rozenite/lynx': minor
'@rozenite/middleware': minor
'@rozenite/tools': minor
---

Extend the [production guarantee](https://github.com/callstackincubator/rozenite/issues/492) landed
for Metro and Re.Pack to Lynx: a `rspeedy build` now fails, naming the importing file, if it resolves
into a Rozenite plugin package through anything other than that plugin's declared production entry.

`@rozenite/lynx` gets the same app-side seam React Native has. Render `<Rozenite />` (this package's
`.` export) once, unconditionally, at your app root, and move plugin wiring into a `rozenite.dev.tsx`
next to your `lynx.config.ts`. `rozeniteLynxPlugin()` redirects the seam to that file in development
and to a shipped noop in production, using the same `RozeniteResolverPlugin` (from `@rozenite/middleware`)
that Re.Pack installs — Metro, Re.Pack and Lynx now share one implementation of both the dev-entry
redirect and the production guard.

The guard also checks that a resolved plugin declares Lynx support in its manifest's `integrations`
field: a plugin published only for React Native resolving into a Lynx bundle now fails the same way,
naming the integrations it does declare.

**Breaking:** `rozeniteLynxPlugin`'s device runtime moved from `@rozenite/lynx`'s root export to
`@rozenite/lynx/runtime`. The root export is now the seam (`<Rozenite />`) instead, which must be
side-effect-free so it can be rendered unconditionally in production. If you previously followed the
manual fallback (`if (__DEV__) { require('@rozenite/lynx'); }`) for a non-rspeedy build pipeline,
change it to `require('@rozenite/lynx/runtime')`. Apps that only ever used `rozeniteLynxPlugin()`'s
automatic injection are unaffected.

**Breaking:** `rozeniteLynxPlugin` no longer declares `apply: 'serve'`, so its resolver guard now runs
during `rspeedy build` as well as `rspeedy dev` — this is the point of the change, but it means a
plugin import that previously shipped silently into a Lynx release bundle now fails the build. Move
plugin wiring into `rozenite.dev.tsx`, declare a `productionEntries` entry in the plugin's
`rozenite.config.ts`, or pass `allowInProduction: ['some-plugin']` (logged loudly on every build) as an
escape hatch.
