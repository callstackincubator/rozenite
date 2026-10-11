---
'@rozenite/network-activity-plugin': minor
---

`listRequests` and `listRealtimeConnections` now page with the shared agent
cursor, keyed by `requestId`: requests captured while an agent pages no
longer shift the next page, and a cursor from an earlier recording, or one
whose request was evicted, answers `reset: true` instead of an error. An
invalid `limit` is now an error instead of quietly falling back to 20.

Default changes, each reachable through an argument:

- `getRequestBody` / `getResponseBody`: the whole body → at most 16384 bytes.
  `offset` and `maxBytes` read any range, and the result reports
  `totalBytes`, `truncated` and, when truncated, `nextOffset`, like the
  built-in `network` domain.
- Pages printed by the CLI: the full `recording` block → nothing but the
  rows. The SDK result still carries it, and `getRecordingStatus` returns it.
