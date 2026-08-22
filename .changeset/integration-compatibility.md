---
'@rozenite/tools': minor
'@rozenite/middleware': minor
'@rozenite/vite-plugin': minor
'rozenite': minor
---

Lay the groundwork for refusing a plugin on an integration it doesn't support, instead of loading it and breaking. Plugins can now declare which environments they work in — `react-native`, `react-native-web`, `lynx`, or `lynx-web` — via `integrations` in `rozenite.config.ts`; omitting it defaults to `['react-native']`, and the resolved list is always reported in the plugin manifest. `@rozenite/middleware` gains a `Rozenite.getEnvironment` CDP domain, answered by the inspector proxy, so a connected target's actual integration can be resolved per-connection (device platform aware: a browser target under a React Native host is `react-native-web`, and likewise `lynx-web` for Lynx) rather than assumed; the dev server's configured host integration is served as a pre-handshake fallback for when that domain isn't available. Nothing in this release enforces compatibility yet — that's a follow-up.

`@rozenite/middleware`'s `platform` config option, unreleased until now, is renamed to `integration` to avoid colliding with the device-OS meaning `platform` carries everywhere else in the system.
