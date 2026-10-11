---
'rozenite': minor
---

`rozenite agent` has a shorter grammar. A call is now
`rozenite agent <domain> <tool> [--<arg> <value>…]`, with one flag per tool
argument taken from the tool's input schema (`--levels error,warning`,
`--noHost`, `--action '{"type":"x"}'`); `--args '<json>'` still works and
explicit flags win over it. `rozenite agent <domain>` lists a domain's tools,
`<tool> --schema` prints a tool's schema and `<tool> --help` describes its
arguments. An unknown flag fails and lists the tool's arguments.

`--session` is now optional on every agent command. Without it the CLI uses
`ROZENITE_SESSION`, then creates or reuses the session for `--device <id>`
(or `ROZENITE_DEVICE`), then for the only connected device, and otherwise
fails with the list of targets. The first command that creates a session
says so on stderr. `rozenite agent session stop` with no id stops that
session.

Other changes:

- `--limit` and `--cursor` page every listing, including a tool's own
  results, and a page's `next` is the command you ran with `--cursor` set;
  it no longer repeats the host, port or session id.
- `--fields all` selects every column. `targets` and `session list` print
  rows like every other listing and accept `--fields`, `--limit` and
  `--cursor`. `session list` used to print a bare array.
- Default projections leave out a column that is null on every row of a
  page; a column named with `--fields` is always printed.
- A tool that declares `pagination.itemsKey`, `pagination.meta` or `rows`
  is printed accordingly: rows from the declared key, only the declared
  metadata, and columns for unpaged lists.
- Domain listings print each tool's short name, and tool names ignore case,
  `-` and `_`.
- `rozenite agent tap <plugin> [--send <type> [--payload <json>]]` takes the
  plugin as an argument, and uses the same session resolution.
- JSON is compact when piped and indented on a terminal (default change:
  agent commands used to always print compact JSON unless `--pretty` was
  passed). `tap` writes NDJSON when piped and arrow lines on a terminal
  (default change: it used to print arrow lines unless `--json` was passed).

The previous spellings keep working: `<domain> call|call-tool --tool …
--args …`, `<domain> tools|list-tools`, `<domain> schema|get-tool-schema
--tool …`, `list-domains`, `--verbose`, `--json`, `--deviceId`, and
`tap --plugin/--type/-a`.
