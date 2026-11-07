---
"rozenite": patch
---

Fix `rozenite build` and `rozenite dev` failing on plugins that depend on packages publishing their types only through `exports`, like React Native 0.87+, and on TypeScript 6. Every entry point is now type checked with `bundler` resolution before its CommonJS output is emitted, and a type error no longer leaves a partial build behind.
