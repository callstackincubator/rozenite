---
name: console
description: Read, filter, and paginate React Native console messages from the app, and clear the log buffer when needed.
domain: console
---

Read, filter, and paginate React Native console messages from the app, and clear the log buffer when needed.

## Tools

```sh
npx rozenite agent console getMessages
npx rozenite agent console getMessages --levels error,warning
npx rozenite agent console getMessages --text "network request failed"
npx rozenite agent console getMessages --limit 50 --order asc
npx rozenite agent console getMessages --before 120 --limit 10
npx rozenite agent console clearMessages
```

`getMessages` takes `--levels` (`verbose`, `info`, `warning`, `error`),
`--text` (substring), `--since` (timestamp in milliseconds), `--order`
(`desc` by default, newest first), `--before` / `--after` (a `seq`), and the
usual `--limit` / `--cursor`.

## Flow

Logs are captured automatically. Use `getMessages`, filtered and paged as
needed, then `clearMessages` if you want a clean slate before reproducing an
issue.

Rows default to `seq`, `timestamp`, `level` and `text`. `source`, `context`
and `cursor` are one `--fields` away, for example
`--fields seq,level,text,context`, or `--fields all` for every column.

## Reading around an entry

Every row's `seq` marks that exact entry, and it is also the cursor: a page's
`next` command resumes with `--cursor <seq of the last row>`. A `seq` is a
position in the app's log and nothing else. It is not tied to the filters or
the order of the request that produced it, so any `seq` works anywhere a
position is accepted:

- `--before <seq>` returns only entries older than it.
- `--after <seq>` returns only entries newer than it.
- `--cursor <seq>` resumes a listing after it, in whichever `--order` is
  requested.

To see the ten messages leading up to a crash, find the error with
`getMessages --levels error`, take its `seq`, then run
`getMessages --before <seq> --limit 10`. There is no need to repeat the level
filter. Use `--before` and `--after` together to bound a range from both ends,
and page inside that range with `--cursor` as usual.
