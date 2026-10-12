---
'@rozenite/agent-bridge': patch
'@rozenite/agent-sdk': patch
'@rozenite/agent-shared': patch
'@rozenite/controls-plugin': patch
'@rozenite/feature-flags-plugin': patch
'@rozenite/file-system-plugin': patch
'@rozenite/lynx-dev': patch
'@rozenite/metro': patch
'@rozenite/middleware': patch
'@rozenite/network-activity-plugin': patch
'@rozenite/react-navigation-plugin': patch
'@rozenite/redux-devtools-plugin': patch
'@rozenite/repack': patch
'@rozenite/storage-plugin': patch
'@rozenite/tanstack-query-plugin': patch
'@rozenite/vite-plugin': patch
'rozenite': patch
---

Fix dev-mode bundles (Re.Pack, webpack, Rspack and Vite) failing to resolve
`@rozenite/agent-bridge`, `@rozenite/agent-shared` and the other packages
that publish an `exports` map: it carried a `development` condition pointing at
TypeScript source that was not in the package. The published packages no
longer have that condition, so these tools pick the built output in every mode.
`rozenite build` also stops adding a `development` condition to a plugin's
`./sdk` export.
