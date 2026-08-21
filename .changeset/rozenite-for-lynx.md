---
'rozenite': minor
---

Add Rozenite for Lynx. `@rozenite/lynx` installs the device runtime in a Lynx app's background thread, and `@rozenite/lynx-dev` adds an rspeedy plugin that serves the Rozenite standalone app and bridges Lynx's DebugRouter transport to the inspector protocol the app already speaks — so the same panels, plugin catalogue and CLI work against a Lynx app with no DevTools-side changes. `@rozenite/middleware` gains a `platform` option that skips its React Native lookups, and `@rozenite/plugin-bridge` now runs in Lynx's background runtime. Every plugin's React Native entry point used to treat any runtime without a `window` as a server and quietly install a no-op, which disabled all of them on Lynx; they now share `@rozenite/plugin-bridge`'s platform check instead of each re-deriving it, and asking for a client on Lynx's main-thread runtime fails with an `UnsupportedPlatformError` rather than a `TypeError`.
