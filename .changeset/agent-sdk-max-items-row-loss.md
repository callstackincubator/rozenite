---
"@rozenite/agent-sdk": patch
"@rozenite/agent-shared": minor
---

Fix `autoPaginate.maxItems` silently dropping rows and reporting a `nextCursor` that skipped past them. The auto-pagination helper now requests exactly the rows still needed on every call (including the first), so a well-behaved tool's own cursor stays correct by construction instead of pointing past rows the caller never received.

For tools that clamp or ignore the requested `limit` and still return more rows than asked, the extra rows are trimmed and the page's `nextCursor` is dropped rather than propagated (it can no longer be trusted to resume correctly). This is now signalled explicitly via a new `truncated: true` field on `PageEnvelope` (`@rozenite/agent-shared`), paired with `hasMore: true`, meaning "rows were dropped; resume position is unknown - restart pagination or narrow the query."
