---
"@rozenite/vite-plugin": patch
---

Fix intermittent runtime crashes caused by faulty bundling when transforming `require()` in the plugin build: the previous interop led to `interopDefault` errors in the React Native bundle.
