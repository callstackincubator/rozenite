---
'@rozenite/tools': minor
'@rozenite/middleware': minor
'@rozenite/vite-plugin': minor
'@rozenite/runtime': minor
'@rozenite/app': minor
'rozenite': minor
---

Lay the groundwork for refusing a plugin on an integration it doesn't support, instead of loading it and breaking. Plugins can now declare which environments they work in — `react-native`, `react-native-web`, `lynx`, or `lynx-web` — via `integrations` in `rozenite.config.ts`; omitting it defaults to `['react-native']`, and the resolved list is always reported in the plugin manifest. Nothing enforces compatibility yet — that's a follow-up.

Resolving which integration a connected target actually is takes two halves. The dev server supplies the host it serves (`react-native` or `lynx`), which follows from the installed integration and so cannot be wrong. The other half — whether the target is a browser — is answered by the device itself: both DevTools hosts evaluate a small self-contained expression in the connected runtime during bootstrap, and `resolveIntegration` combines the two. Asking the device is what makes the answer immediate and certain; the alternative was reading React Native's `ReactNativeApplication.metadataUpdated`, an event Rozenite neither emits nor can order, so a host that asked early would report a browser target as native with no way to tell that answer from a real one. A probe that fails leaves the target unknown rather than guessing.

`@rozenite/middleware`'s `platform` config option, unreleased until now, is renamed to `integration` to avoid colliding with the device-OS meaning `platform` carries everywhere else in the system.
