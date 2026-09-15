---
'rozenite': minor
'@rozenite/tools': minor
---

`rozenite init` now detects rspeedy/Rsbuild (Lynx) projects — via
`lynx.config.ts`/`lynx.config.js`, or `@lynx-js/rspeedy` in `package.json` —
installs `@rozenite/lynx` as a dev dependency, and adds `rozeniteLynxPlugin()`
to the `plugins` array in `lynx.config.ts`, mirroring what it already does for
Metro and Re.Pack. It also reminds you to turn on Lynx DevTool, since that
switch is off by default and Rozenite finds nothing to connect to without it.
