---
'@rozenite/react-navigation-plugin': minor
---

Add dispatch-origin inspection for navigation actions.

Captured actions now expose where they were dispatched from: a source-mapped origin frame (resolved via Metro on the React Native side), the full parsed stack with library frames distinguished from app frames, an optional code-frame snippet, and a confidence level. The detail panel renders a new "Dispatch Origin" section; the sidebar shows a compact `filename.tsx:line` preview. The `list-actions` agent tool returns the same `origin` payload, replacing the previous raw `stack` string field on `NavigationActionHistoryEntry`.