# 0004 — One agent list contract

**Status:** Accepted — not yet implemented

**Related:** [callstackincubator/rozenite#320](https://github.com/callstackincubator/rozenite/issues/320),
[callstackincubator/rozenite#527](https://github.com/callstackincubator/rozenite/pull/527),
[ADR 0003](./0003-shared-host-protocol.md) decision 7

## Context

An agent tool that returns a list is the most common kind of agent tool, and
the one an agent calls most often. Today such tools page five different ways
and answer in three different shapes:

| Where | Paging | Cursor | Result shape |
|---|---|---|---|
| CLI `domains` and `<domain> tools` listings | client-side offset | `{v,kind,scope,index}` | `{items,page}` |
| middleware `network.listRequests` | offset + generation stamp | `{v,scope,index,generation}` | `{items,page}` + the whole `recording` block |
| middleware `console.getMessages` | position over an append-only log | bare position | `{items,page,meta}` |
| middleware React lists (`getTree`, `searchNodes`, …) | offset + tool + device + filters hash | `{v,tool,deviceId,offset,filtersHash}` | `{items,page,totalCount,…}` |
| `storage.list-entries` | offset wrapped in a cursor | `{version,target,offset}` | `{items,page,total,…}` |
| `tanstack-query.list-*` | cursor | plugin-private | `{items,page}` + the whole cache summary |
| `network-activity.list*` | cursor + generation | plugin-private | `{items,page}` + the whole `recording` block |
| `redux-devtools.list-actions` | raw `offset`/`limit` | none | `{store,total,offset,limit,items}` |
| `react-navigation.list-actions` | raw `offset`/`limit`, default 100 | none | `{total,offset,limit,items}` |
| `file-system.list-entries` | raw `offset`/`limit`, default 100 | none | `{provider,path,total,offset,limit,entries}` |

Lists that do not page at all (`list-storages`, `list-stores`,
`list-sections`, `list-roots`, `targets`, `session list`) each put their rows
under a key of their own choosing.

Three things follow from this:

1. **Offset paging over a live app skips rows.** The app keeps running while
   the agent pages. A row deleted behind the offset shifts every later row
   down one, so the next page silently omits one; an insertion silently
   repeats one. Issue #320 documented this for `storage`, `file-system` and
   `redux-devtools` and was closed as stale; the three raw-offset tools above
   still have the defect.
2. **The CLI's compact output reaches only half the surface.** Columnar
   `cols`/`rows` encoding and the `--fields` projection apply to a result
   only when the tool declares `pagination` and answers `{items, page}`. The
   three raw-offset tools, every non-paginated list, and every `details` call
   go out as fully expanded JSON with no projection.
3. **Page metadata is whatever the tool happened to spread in.** The two
   network domains attach a nine-key `recording` block to every page and to
   every details call; TanStack attaches a thirteen-counter cache summary.
   Measured against the row data they accompany, these blocks cost 45–70
   tokens per page and say the same thing on every page.

The shared primitive that would prevent all of this exists
(`packages/middleware/src/agent/runtime/pagination/`) but is private to the
middleware and tied to its circular buffer, which is why every plugin
hand-rolled its own. Limits were unified on 20 / 100 by #527; this ADR
settles the rest.

Rozenite stays on `2.x`, so nothing here renames or removes a key an SDK
consumer can read today. Every change is additive to the wire shape, or a
change of default that an argument can undo.

## Decision

1. **One shape.** An agent tool that returns a list answers
   `{ items: Row[], page: { limit, hasMore, nextCursor?, reset? }, …meta }`
   and accepts `{ limit?, cursor?, …filters }`. `limit` defaults to 20 and
   caps at 100 (`DEFAULT_PAGE_LIMIT` / `MAX_PAGE_LIMIT` in
   `@rozenite/agent-shared`). `offset` is not part of the contract. The three
   tools that still accept it keep accepting it for the rest of `2.x`, marked
   deprecated in their schema, and gain `cursor`.

2. **Cursors resume after a row, never at an index.** A cursor encodes the
   key of the last row returned (`keyOf(row)`: `seq`, `actionId`, `id`,
   `key`, `path`, `requestId`, `queryHash`, `nodeId`, …) plus an optional
   `scope` and `generation`. The next page starts after the row carrying that
   key in the *current* list. If no row carries it, or the generation has
   moved on, the tool answers `{ items: [], page: { …, reset: true } }`, which
   already means "restart this listing" to the CLI and the docs. A deletion
   behind the cursor therefore cannot skip a row and an insertion cannot
   repeat one. Cursors are opaque base64url strings; their encoding may
   change in any release.

   The console domain's position-over-a-log engine already satisfies this
   (its key *is* the position) and is unchanged. Its row `cursor` field
   becomes the row's `seq`, so one column serves as identity, cursor and
   `before`/`after` anchor.

3. **One implementation, exported.** `@rozenite/agent-shared` gains
   `paginateArray(rows, { keyOf, limit, cursor, scope?, generation? })` and
   the `encodeCursor` / `decodeCursor` pair it uses, browser-safe (no
   `Buffer`, no `node:` imports). It replaces the CLI's listing pager, the
   middleware's network pager and React pager, and every plugin pager. The
   middleware's log-position engine stays where it is, for the console
   domain only.

4. **Non-row metadata is declared, not inferred.** `AgentToolPagination`
   gains two optional fields:
   - `itemsKey?: string` — the key holding the rows when it is not `items`
     (`file-system.list-entries` keeps `entries`).
   - `meta?: string[]` — the top-level keys, besides the rows and the page,
     that the CLI prints with a page. Undeclared means "print everything",
     today's behaviour, so third-party tools are unaffected. `[]` means
     "print nothing but the rows". Built-in and official tools declare the
     keys worth a page: `total`, `totalCount`, `roots`, `truncated`,
     `droppedCount`. The SDK result is untouched; only the CLI's rendering
     changes.

5. **Non-paginated lists declare their rows the same way.** `AgentTool`
   gains `rows?: { key?: string; fields: string[]; defaultFields?: string[] }`
   with the same validation as `pagination.fields`. A tool with `rows`
   answers whatever it answers today; the CLI projects `result[key ?? 'items']`
   onto `defaultFields`, encodes it columnar at two or more rows, and accepts
   `--fields` for it. `list-storages` declares `{ key: 'storages', … }`,
   `list-stores` declares `stores`, and so on. The CLI's own `targets` and
   `session list` listings follow the same rule.

6. **Defaults may change in a minor; keys may not.** A tool may change which
   columns it returns by default, how many bytes or how deep a value it
   returns by default, and what it attaches to a page by default, as long as
   every column stays reachable through `fields` / `--fields`, every byte
   through `maxBytes` / `offset`, every level through `maxDepth` /
   `maxValueLength` / `path`, and every key stays where an SDK consumer
   finds it today. Each such change ships with a changeset that names the
   old and new default.

7. **Bounded reads everywhere.** A tool that returns a body, a file, a store
   or a serialized value takes the knobs `react.getComponent` already has
   and uses the same defaults:
   - `maxBytes` (default 16 384) and `offset` for `getRequestBody`,
     `getResponseBody` (both network domains), `read-text-file`; the result
     reports `totalBytes` and `truncated`.
   - `maxDepth` (default 4), `maxValueLength` (default 512) and `maxItems`
     (default 100, at most 10 000: array items or object keys kept per
     level, the rest marked `"[+N items]"` / `"[+N keys]": true`) for
     `get-store-state`, `get-action-details`, `get-query-details`,
     `get-mutation-details`; `path` selects a sub-tree. One implementation,
     `boundValue` in `@rozenite/agent-shared`, serves all four, and no cut
     splits a UTF-16 surrogate pair.
   - `read-image-file` answers with metadata only (`path`, `mimeTypeHint`,
     `size`) unless `inline: true` asks for the data URI, and the inline
     form is bounded by `maxBytes` (default 262 144). Plugin tools run on
     the device, so a Metro-managed artifact is not available to them.
     `export-file` exists to move bytes and is unchanged apart from
     `maxBytes` defaulting to 1 048 576. `read-text-file` keeps its 10 MB
     ceiling only as the `maxBytes` maximum.
   - `getRequestDetails` takes `include` (default `["headers"]`); `timing`,
     `initiator.stack`, cookies and `redirectChain` are opt-in.
     `initiator.type` is always present.
   - `react-navigation.list-actions` rows carry `id`, `timestamp`, `type` and
     the target route name by default; `state` and `origin` move behind
     `include` and a new `get-action-details`.

8. **Default columns are chosen by redundancy, in the open.** A column
   leaves the default projection only when another default column carries
   the same information (`nodeId` and `label`; `queryHash` and `queryKey`;
   `avgDurationMs` given `totalDurationMs` and `renderCount`) or when it is
   null or constant on nearly every row (`source` on console rows,
   `elementType` on tree rows). The CLI additionally elides a column whose
   value is null on every row of a page unless `--fields` named it; `cols` is
   read on every page, so the shape stays self-describing.

## Consequences

- `@rozenite/agent-shared` is the one place pagination lives and the one
  place plugin authors import it from; the middleware's private
  `pagination/` directory shrinks to the console log engine.
- The three raw-offset tools stop skipping rows. Their SDK result types gain
  `page`; `total`, `offset` and `limit` remain and keep their meaning (the
  effective start index is still reported).
- Every list the CLI prints, paginated or not, built-in or plugin, is
  columnar at two or more rows and projectable with `--fields`.
- A page carries only the metadata its tool declared worth carrying; the
  `recording` and cache-summary blocks are still one status call away and
  still present in SDK results.
- The worst default payloads today (`react-navigation.list-actions` with
  full state and stack per entry, 10 MB file reads, unbounded bodies and
  Redux state) become one page of short rows or 16 KB, with the rest one
  argument away.
- `paginateArray` requires `keyOf` to return a unique key per row and
  throws on a duplicate, since a cursor that names a key shared by two rows
  cannot say which one it means.
- `AgentTool` grows three optional fields; nothing that exists today becomes
  invalid. Tools from older plugins keep printing exactly as before.
- Cursors issued before the upgrade stop working across it. They are
  documented as opaque and short-lived. The shared pager cannot decode an
  old cursor, so it rejects it as invalid ("Run the command again without
  cursor") rather than answering `reset: true`; upgrading restarts Metro or
  rebuilds the app, which empties the lists those cursors pointed into
  anyway. The console domain's cursors are the exception and keep working.
- Tests that pinned null-filled columnar rows, `--cursor` payload formats or
  the exact set of keys on a page are updated with the change that invalidates
  them; the drift test from ADR 0003 keeps `BUILT_IN_DOMAIN_TOOL_NAMES`
  honest across the tool additions here (`get-action-details`).
