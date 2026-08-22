---
"@rozenite/require-profiler-plugin": minor
"@rozenite/ui": minor
---

Rebuild the Require Profiler DevTools panel on `@rozenite/ui`, so it follows the shared theme and the light/dark switch like every other panel. A sidebar lists every recorded require chain with its duration and module count and can hide chains below a duration threshold, replacing the previous prev/next stepper and options modal — and because durations now travel with the chain list, the threshold applies to chains that have not been opened yet. The main pane switches between the flame graph and a "Top modules" table ranking the chain's modules by self time, a filter box highlights matching frames and narrows the table, and selecting a module opens a detail pane with its self time, total time, dependency count, and path. Require timings are now recorded with `performance.now()` where the runtime provides it, so fast modules no longer all report 0ms.

The Metro instrumentation now defends its own dev-only boundary, underneath `withRozenite`'s `enabled` gate rather than relying on it alone. `withRozeniteRequireProfiler` accepts an `enabled` option that defaults to `process.env.NODE_ENV !== 'production'`, and the polyfill it injects is guarded by `__DEV__` so Metro strips it from release bundles — covering configs that enable Rozenite unconditionally and setups that apply the wrapper without `withRozenite`.

`@rozenite/ui` gains a `FlameGraph` component — a themed, responsive flame graph with zooming, selection, highlighting, and a heat legend.
