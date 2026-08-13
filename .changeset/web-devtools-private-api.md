---
'@rozenite/web': patch
---

Replace private `react-native/src/private/...` and `react-native/Libraries/...` imports in the React DevTools Fusebox bootstrap with local, vendored equivalents, so the package no longer depends on React Native's internal module paths (compatible with [Strict TypeScript API](https://reactnative.dev/docs/strict-typescript-api)).
