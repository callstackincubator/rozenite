---
'@rozenite/middleware': minor
---

Enrich the `getRenderData` agent tool so each rendered fiber also reports its resolved `displayName` and a `changedKeys` object — the exact changed prop/state/context key names plus `hooks`/`isFirstMount` flags — alongside the existing category-level `changeTypeHints`. This lets a coding agent (or a human) see not just that a component re-rendered, but which specific props/state/context/hooks invalidated it, without a second round-trip to resolve fiber IDs to component names.
