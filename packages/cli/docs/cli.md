---
name: cli
description: Shell-driven `rozenite agent ...` workflow — command syntax, sessions, the listing/pagination output contract, calls, and the end-to-end flow.
---

# CLI

Use this doc for shell-driven `rozenite agent ...` workflows and live
debugging from the terminal. Read the `core` doc first for ground truths
shared with the SDK workflow (built-in domains, plugin domain tokens, and
when live session data beats source code).

If the task instead needs a Node.js or TypeScript script, wrapper,
automation, or agent runtime built on top of Rozenite, use the `sdk` doc
instead.

- Use `npx rozenite` for Rozenite commands.
- Run `npx rozenite` from the app root where Metro is started for the target
  app. In monorepos, this is usually the app package root, not the
  repository root.

## Commands

```bash
npx rozenite agent domains                                # list domains
npx rozenite agent <domain>                               # list a domain's tools
npx rozenite agent <domain> <tool> --help                 # a tool's arguments
npx rozenite agent <domain> <tool> --schema               # a tool's input schema
npx rozenite agent <domain> <tool> [--<arg> <value>...]   # call a tool
npx rozenite agent session stop                           # stop the session
```

Example: `npx rozenite agent console getMessages --levels error --limit 10`.

## Sessions

- The first command creates the agent session for the connected device, or
  reuses the one already running; when it creates one it prints one line on
  stderr saying so. Every later command reuses it. There is no separate
  start step.
- With more than one device connected, the command fails and lists the
  targets (`id`, name, integration). Pick the right `id` and pass
  `--device <id>`, or set `ROZENITE_DEVICE=<id>` once for the shell.
- `npx rozenite agent targets` lists connected targets. If the expected
  target is missing, ask the user to run the app on a device.
- An open session holds the device's only debugger connection. Stop it with
  `npx rozenite agent session stop` when the work is done.
- `--session <id>` (or `ROZENITE_SESSION`) uses one specific session; you
  rarely need it. Session IDs are public runtime identifiers, not secrets.
- A flag you type wins over the environment: the CLI uses `--session`, then
  `--device`, then `ROZENITE_SESSION`, then `ROZENITE_DEVICE`, then the only
  connected device.

## Calling tools

- A tool's arguments are flags named after its input schema:
  - text, number and boolean arguments take one value (`--id @c12`,
    `--limit 10`); a boolean flag on its own means `true` (`--noHost`);
  - list arguments repeat or take commas (`--levels error,warning`);
  - object arguments take JSON (`--action '{"type":"counter/increment"}'`).
- `--args '<json>'` passes arguments as one JSON object; flags win over it.
  Use it for an argument named like a CLI option (`session`, `device`,
  `host`, `port`, `pretty`, `fields`, `limit`, `cursor`, `args`, `schema`).
- An unknown flag fails and lists the tool's arguments.
- A value that starts with `-` goes after `=`: `--search=-n`.
- Tool names ignore case, `-` and `_`: `getmessages`, `get-messages` and
  `getMessages` are the same tool.
- Get a tool's arguments from its domain doc (`npx rozenite skills list`,
  then `npx rozenite skills show <id>`) or from `<tool> --help`. Skip
  discovery when the doc already names the tool and its arguments.

## Listing output contract

Agent commands print JSON: compact when piped, indented on a terminal, and
indented anywhere with `--pretty`. Every list — `domains`, a domain's
tools, `targets`, `session list`, and every tool that declares its rows —
follows the same shape:

- With two or more rows: columns,
  `{"cols":["id","kind"],"rows":[["console","static"],["react","static"]]}`.
  `cols` is the column order; a missing value is `null` in its row.
- With zero or one row: objects, `{"items":[{"id":"console","kind":"static"}]}`.
  A missing value is left out.
- A column that is `null` on every row of a page is left out, unless you
  asked for it with `--fields`. Read `cols` on every page.
- Each listing prints a default set of columns. `--fields <csv>` picks
  columns; `--fields all` prints every column the listing declares.
- Domain listings print each tool's short name; pass it straight to a call.
  Traits (`readOnly`, `destructive`, `idempotent`) that are absent mean
  unknown, not `false`.
- Tool-specific metadata the tool declares (for example `totalCount` or
  `roots`) is printed next to the rows.

## Paging

- `--limit <n>` and `--cursor <token>` page every listing, whether the CLI
  or the tool does the paging. The default page is 20 rows, the maximum 100.
- The last page has no `next`. Any other page has `next`: the same command
  with `--cursor` set. Run it to get the following page.
- Treat a cursor as opaque unless a domain doc says otherwise. The
  `console` domain's cursor is the row's `seq`, so `--cursor 120` resumes
  after message 120.
- A stale cursor (for example after an app relaunch) answers
  `{"page":{"reset":true},"items":[]}`. That means "start this listing
  again without `--cursor`", not "no more rows".

## Flow

1. Run Rozenite commands one at a time.
2. Run `npx rozenite skills list` to find a matching domain doc, then
   `npx rozenite skills show <id>` to read it, if one exists.
3. If the doc names the tool and its arguments, call it:
   `npx rozenite agent <domain> <tool> --<arg> <value>`.
4. Otherwise, or if the call fails, run `npx rozenite agent domains`,
   `npx rozenite agent <domain>` or `npx rozenite agent <domain> <tool> --help`.
   If the expected plugin domain is missing, tell the user to install and
   register the plugin in the app.
5. Fall back to source-code exploration only if no relevant domain exists or
   the task is about implementation or setup.
6. When no further Rozenite calls are needed, run
   `npx rozenite agent session stop`.
