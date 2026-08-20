---
'rozenite': minor
---

Build plugin React Native, Metro and SDK entry points with `tsc` instead of Vite; Vite now builds only the DevTools panels. Metro and SDK entry points ship as CommonJS behind the `default` condition, so they can be both `require`d from a `metro.config.js` and `import`ed from a `metro.config.mjs`. `rozenite build` no longer prints build tool output unless it fails or `--verbose` is passed.
