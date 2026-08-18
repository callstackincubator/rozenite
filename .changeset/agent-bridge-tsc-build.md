---
'@rozenite/agent-bridge': patch
---

Fix `@rozenite/agent-bridge` shipping its real implementation (and its `@rozenite/plugin-bridge` RPC dependency) in production Metro bundles. The package now builds with `tsc` instead of bundling through `@rozenite/vite-plugin` (which is meant for devtools plugins with a web panel, not a plain hook library), so the `NODE_ENV`-gated `require()` in its entry point stays untouched and Metro can dead-code-eliminate it in release builds as intended.
