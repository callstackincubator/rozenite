---
'@rozenite/storage-plugin': minor
'@rozenite/vite-plugin': minor
'rozenite': minor
---

Add plugin `./sdk` entrypoints for typed agent tool descriptors backed by the
same tool contracts used at runtime.

The storage plugin now ships `@rozenite/storage-plugin/sdk` with typed
`storageTools` descriptors and shared tool contract exports, and the Rozenite
build pipeline now bundles per-target SDK declarations so plugin SDK entrypoints
publish clean `dist/sdk/index.d.ts` files.
