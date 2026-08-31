---
'@rozenite/middleware': minor
'@rozenite/agent-sdk': minor
'rozenite': minor
---

Make the React agent domain answer render-performance questions in one call, and
cut the noise out of component-tree reads.

- `getComponentRenders` aggregates a whole profiling session into one row per
  component — render count, total/average/max render time, and why it rendered —
  so "what was slow" and "what re-rendered too often" no longer mean paging
  `getRenderData` once per commit.
- `getProfileTimeline` lists every commit with its duration and rendered-fiber
  count, chronologically or slowest first, and stays queryable after
  `stopProfiling`.
- `getErrors` lists the components React logged errors or warnings against;
  those counts now appear on ordinary tree and node reads too.
- `getTree`, `getChildren`, and `searchNodes` accept `noHost: true`, which hides
  plain host components and promotes their children to the nearest visible
  ancestor. Off by default, and largely a safety net: React DevTools already
  hides host components at the backend, so they rarely reach the tree at all.
- `getComponent`, `getProps`, `getState`, and `getHooks` accept `maxValueLength`
  (default 512) so a single base64 or serialized-blob prop cannot dominate a
  response.
