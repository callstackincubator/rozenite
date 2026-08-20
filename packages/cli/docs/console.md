---
name: console
description: Read, filter, and paginate React Native console messages from the app, and clear the log buffer when needed.
domain: console
---

Read, filter, and paginate React Native console messages from the app, and clear the log buffer when needed.

## Tools

- `clearMessages` -> `{}`
- `getMessages` -> `{}` | `{"cursor":"<cursor>"}` | `{"limit":50}` | `{"levels":["error"]}` | `{"text":"warning"}` | `{"before":"<cursor>","order":"desc"}`

## Flow

Logs are captured automatically. Use `getMessages` -> optional filtered and paginated reads -> `clearMessages`.

CLI discovery listings and paginated `getMessages` calls use columnar `cols`
and `rows` output when two or more rows are returned. Tool metadata remains
present, and `next` replaces the page envelope when another page is available.

By default `getMessages` omits the bulky `context` and `cursor` columns. Pass
`--fields context,cursor` (or any subset) or `--verbose` to include them.

## Reading around an entry

Every item carries a `cursor` marking that exact entry, in the same format
`next` hands back. A cursor is a position and nothing else — it is not tied to
the filters or the order of the request that produced it, so any cursor works
anywhere a position is accepted:

- `before` returns only entries older than it.
- `after` returns only entries newer than it.
- `cursor` resumes a listing from it, in whichever `order` is requested.

To see the ten messages preceding a crash, request
`{"levels":["error"],"fields":"cursor"}`, take the failing item's `cursor`, then
call `{"before":"<cursor>","order":"desc","limit":10}` — no need to repeat the
level filter. Use `before` and `after` together to bound a range from both ends,
and page inside that range with `cursor` as usual.
