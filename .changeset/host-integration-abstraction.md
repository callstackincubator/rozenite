---
'@rozenite/integration': minor
'@rozenite/middleware': minor
'@rozenite/lynx-dev': minor
---

Add `@rozenite/integration`, extracting what differs between the React Native and Lynx dev-server integrations - verifying the environment, resolving and serving a debugger frontend, and patching a bundler's dev middleware - behind a single `RozeniteIntegrationProvider` contract. `@rozenite/middleware` no longer branches on "is this Lynx?" internally: `initializeRozenite` now takes an `integration` implementation instead of an `integration: 'react-native' | 'lynx'` string, defaulting to `createReactNativeIntegration(...)` so `@rozenite/metro` and `@rozenite/repack` need no changes, while `@rozenite/lynx-dev` passes its own Lynx implementation. `RozeniteConfig`'s unreleased `integration` field is removed in favor of this.
