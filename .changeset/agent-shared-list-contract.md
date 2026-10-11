---
'@rozenite/agent-shared': minor
'@rozenite/agent-bridge': minor
---

Agent tools that return lists can now page them with `paginateArray`, the
same pager the built-in tools use. Its cursors resume after the last row
returned rather than at an index, so rows added or removed while an agent
pages through a live app are never skipped or repeated; when the row a
cursor points at is gone, the page answers `reset: true` instead. The
`encodeCursor` / `decodeCursor` helpers it uses run in Hermes, Lynx and the
browser.

A paginated tool can now declare `pagination.itemsKey` when its rows are not
under `items`, and `pagination.meta` to name the top-level result keys worth
printing with each page. A tool that returns a list without paging it can
declare `rows` (with `defineRowsAgentToolContract`) so agents can project
its columns with `--fields`. All three are optional; tools that do not
declare them are unchanged.
