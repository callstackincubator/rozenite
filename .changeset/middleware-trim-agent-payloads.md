---
'@rozenite/middleware': minor
---

Make the built-in agent domains cheaper to read by default, with everything
they returned before still one argument away.

- `console.getMessages`: a row's `cursor` is now its `seq` as a string, and a
  page's `nextCursor` is the `seq` of its last row. `cursor`, `before` and
  `after` accept a `seq` as a number or a numeric string; cursors issued by
  earlier releases keep working. Default columns change from
  `seq,timestamp,level,source,text` to `seq,timestamp,level,text`; `source`,
  `context` and `cursor` remain available through `fields`.
- `network.getRequestBody` and `network.getResponseBody` return at most
  `maxBytes` bytes (default 16384, previously the whole body) starting at
  `offset` (default 0). Results gain `totalBytes`, `truncated` and, when
  bytes remain, `nextOffset`. Bytes are counted on the decoded text when
  `decoded` is `true`, otherwise on the returned string.
- `network.getRequestDetails` takes `include` (default `["headers"]`;
  accepts `headers`, `timing`, `initiator`, `cookies`, `redirectChain`).
  By default `initiator` carries only its `type` (previously the full
  initiator with its stack), `response.timing`, `requestAssociatedCookies`,
  `responseBlockedCookies` and `redirectChain` are left out (previously
  always present), and keys whose value would be `null` are omitted from
  `request` (previously present as `null`).
- `react.getTree` default columns change from
  `nodeId,label,displayName,elementType,childCount,depth,errorCount,warningCount`
  to `label,displayName,childCount,depth`.
- `react.getChildren` default columns change from
  `nodeId,label,displayName,elementType,childCount,errorCount,warningCount`
  to `label,displayName,childCount`.
- `react.searchNodes` default columns change from
  `nodeId,label,displayName,elementType,childCount,parentLabel,errorCount,warningCount`
  to `label,displayName,childCount,parentLabel`.
- `react.getComponentRenders` default columns drop `avgDurationMs`.
- `react.getTree` accepts a component label (`@c12`) for `root`, like every
  other React tool that takes a node.
- React profiling results round every duration and timestamp to at most
  three decimals.

- `network.listRequests` and the React list tools page with the shared
  `paginateArray` from `@rozenite/agent-shared`: a cursor now resumes after
  the last row it returned instead of at an index, so a row that appears or
  disappears earlier in the list no longer makes a page skip or repeat one.
  When the row a cursor names is gone, the page answers `reset: true`.
  Cursors issued by earlier releases are rejected; restart the listing.
- Every paginated built-in tool declares `pagination.meta`, the result keys
  worth printing with a page (`getMessages`: `meta`; `getTree`: `roots`,
  `totalCount`; `getErrors`, `getComponentRenders`, `getProfileTimeline`:
  `totalCount`, `summary`; `getRenderData`: `commit`, `summary`; the rest,
  including `listRequests`, nothing). Results themselves still carry every
  key, including `listRequests`' `recording` block.

Every dropped column is still listed in the tool's `fields`.
