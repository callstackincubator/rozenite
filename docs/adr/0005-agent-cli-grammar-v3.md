# 0005 — Agent CLI grammar v3

**Status:** Accepted — not yet implemented

**Related:** [ADR 0004](./0004-one-agent-list-contract.md)

## Context

`rozenite agent` is driven by coding agents, and an agent pays for every
token it emits and reads. The grammar it has to emit today, for the simplest
useful call, is:

```
npx rozenite agent console call --tool getMessages --args '{"levels":["error"]}' --session 2ce2ba5f071e81a9efad6f66a9e029fd6aa11ccd-1
```

Roughly fifty tokens, half of them a 40-hex device id with a page suffix that
the agent first has to obtain from `session create` and then copy into every
command. The dispatcher in `packages/cli/src/commands/agent/register-agent-command.ts`
contains hand-written recovery for the ways agents get this wrong, which is
the clearest record of where the grammar fights them:

| Guard in the code | Mistake it catches |
|---|---|
| `Missing domain before action "tools"` | `rozenite agent tools` |
| `Unknown domain action "getMessages"` | `rozenite agent console getMessages`, the natural guess |
| `The rozenite agent rozenite ... path was removed` | an older grammar still in agents' memory |
| `Missing required --session <id>` | the session id was not threaded through |
| "`--cursor` is only for CLI-owned listings; pass the tool cursor inside `--args`" (docs) | two cursor channels for one concept |
| the legacy slug alias `at-rozenite__storage-plugin` | a third way to spell a domain |
| `-j, --json` kept as a no-op | agents still pass it |

The bundled `cli` doc spends a paragraph telling agents what not to type
("Do not pass domain tool names as direct CLI subcommands"). Docs that warn
against the intuitive spelling are a grammar defect.

Sibling commands also disagree on what a short flag means: `-t` is `--tool`
under a domain and `--type` under `tap`; `-a` is `--args` and `--payload`;
`-v` is "all fields" under `agent` and "stream build output" under `build`;
`--json` is a deprecated no-op under `agent` and "NDJSON on" under `tap`;
`--deviceId` is the only camel-cased flag in the CLI. Built-in tools are
camelCase (`getMessages`) and every plugin tool is kebab-case
(`list-entries`), and lookup is exact-match, so an agent that learned one
convention guesses wrong on the other.

Every listing prints a runnable `next` command on a non-terminal page. It
is 45–60 tokens today because it repeats the connection options, the session
id and the JSON `--args` blob.

Rozenite stays on `2.x`, so the old grammar has to keep working. The aim is
that the new grammar is what the docs teach and what an agent would have
guessed anyway, and that the old one simply continues to be accepted until a
major removes it.

## Decision

1. **A call is `rozenite agent <domain> <tool> [--<arg> <value>…]`.** Flags
   for a tool are derived from its `inputSchema`, which the CLI already
   fetches before every call to read `pagination`:
   - a `string`, `number`, `integer` or `boolean` property is a flag of the
     same name taking one value (`--id @c12`, `--limit 10`, `--noHost`);
   - an `array` property repeats or takes a comma-separated value
     (`--levels error,warning`);
   - an `object` property, and anything else, takes a JSON string
     (`--action '{"type":"counter/increment"}'`).

   `--args '<json>'` remains as the escape hatch and merges under explicit
   flags. An unknown flag fails with the tool's argument names, never
   silently drops. The domain command runs with `allowUnknownOption` and
   parses tool flags itself after the schema is known.

2. **Discovery drops its verbs.** `rozenite agent <domain>` lists the
   domain's tools; `rozenite agent <domain> <tool> --schema` prints one
   tool's schema; `rozenite agent domains` lists domains. The tokens
   `list-tools`, `tools`, `get-tool-schema`, `schema`, `call-tool`, `call`,
   `list-domains` and the `--tool` option stop being documented.

3. **The session is implicit.** `--session <id>` becomes optional on every
   agent command. When absent, the CLI resolves a session in this order:
   `--device <id>` → the only connected target → an error that lists the
   targets. Resolution uses the server's existing create-or-reuse semantics
   (`POST /rozenite/agent/sessions`), so the first command on a device pays
   the same startup `session create` paid, and every later command reuses
   it. `rozenite agent session stop` with no argument stops the session that
   would have been resolved. `session create`, `list`, `show <id>` and
   `stop <id>` remain for scripts and for the multi-device case.
   `ROZENITE_DEVICE` and `ROZENITE_SESSION` environment variables are read
   as defaults for `--device` and `--session`, so a flag the user typed
   always wins over either: `--session` → `--device` → `ROZENITE_SESSION`
   → `ROZENITE_DEVICE` → the only connected target.

4. **One paging channel.** `--limit <n>` and `--cursor <token>` mean "page
   this listing" on every command: for a tool that declares `pagination`
   they map onto its `limit` and `cursor` arguments; for `domains`, a domain
   listing, `targets` and `session list` they drive the CLI's own pager,
   which uses `paginateArray` from ADR 0004. The `next` command on a page is
   the command that produced the page, as the user typed it, with `--cursor`
   replaced or appended. It repeats the flags the user typed (`--session`,
   `--device`, `--host`, `--port`, `--pretty`, `--fields`) and nothing the
   CLI would otherwise inject: no default connection options, no session id
   from the environment, no JSON.

5. **Projection is `--fields`.** `--fields <csv>` selects columns,
   `--fields all` selects every declared one. `-v, --verbose` is no longer
   documented under `agent`. Sparse-column elision and `rows` metadata from
   ADR 0004 apply to every listing the CLI prints, including `targets` and
   `session list`.

6. **Tool names resolve forgivingly.** Lookup ignores case and the
   characters `-` and `_`, so `getmessages`, `get-messages`, `list_entries`
   and `listEntries` all resolve, and the qualified name still wins when both
   match. No tool is renamed; descriptor names in `./sdk` exports are public.
   Domain listings print each tool's short name; the qualified name is one
   `--schema` away.

7. **`tap` takes the plugin as a positional.** `rozenite agent tap <plugin>
   [--send <type> [--payload <json>]]`. `-t`/`-a` are freed; `-p/--plugin`
   and `-t/--type` keep working undocumented until the next major.

8. **Output format follows the stream.** JSON is compact when stdout is not
   a terminal and indented when it is; `--pretty` forces indentation.
   `tap` writes NDJSON to a pipe and the arrow lines to a terminal; its
   `--json` keeps working undocumented. `-j, --json` is removed from `agent`
   and `session` help but still accepted.

9. **Flags are one word.** `--deviceId` becomes `--device`, accepted on
   every agent command; `--deviceId` keeps working undocumented.

10. **Reserved names.** `session`, `targets`, `domains` and `tap` join
    `RESERVED_DOMAIN_NAMES`, so a plugin cannot derive a domain token that
    shadows a CLI command. (`sessions` and `help` are not commands, and
    reserving them would make an unscoped plugin of that name break every
    domain call; `rozenite agent help` alone prints the agent help.) The CLI-owned flags
    `--session`, `--device`, `--host`, `--port`, `--pretty`, `--fields`,
    `--limit`, `--cursor`, `--args`, `--schema` are never derived from a
    tool's schema; a tool argument with one of those names is reachable
    through `--args`.

11. **The old grammar keeps working, silently, for the rest of `2.x`.**
    `<domain> call|call-tool --tool … --args …`, `<domain> tools|list-tools`,
    `<domain> schema|get-tool-schema --tool …`, `list-domains`, `--verbose`,
    `--json`, `--deviceId`, `tap --plugin/--type/--payload` and the legacy
    domain slug all continue to be parsed exactly as today. They disappear
    from `--help`, from the bundled docs and from the website; their removal
    is a major. `-v`/`--verbose` stays a no-op for a tool that declares no
    columns, and `--limit`/`--cursor` stay ignored for a tool that does not
    page (with a one-line note on stderr); only the new `--fields` fails
    there. The `next` command is always emitted in the new grammar.

12. **Docs teach only the new grammar.** `packages/cli/docs/*.md`,
    `packages/cli/skills/rozenite/SKILL.md`, the package READMEs and
    `website/src/docs/agent/*.mdx` are rewritten to the new spelling, and
    the "what not to type" guidance is removed. The documented flow drops
    `session create` and `targets` from the happy path.

## Consequences

- The simplest call drops from about fifty tokens to about sixteen; a `next`
  command from 45–60 to about twenty; the documented flow from ten steps to
  six.
- The six error classes in the table above stop occurring, because the
  spelling they guard against is the correct one.
- Every agent command performs one extra request (`POST /sessions`) when
  `--session` is absent. It is local, idempotent on the server, and cheaper
  than the turn an agent spends copying an id.
- An open session still holds the device's only debugger connection. The
  docs keep "stop the session when done" as the last step, and the first
  implicit creation in a process prints one line on stderr saying which
  device it attached to and how to detach.
- The CLI parses tool flags after fetching the schema, so an unknown domain
  or tool is still reported before any flag is interpreted, and
  `--help` for a tool (`rozenite agent <domain> <tool> --help`) can be
  generated from the schema.
- `register-agent-command.ts` is rewritten around the new grammar with the
  old spellings as aliases layered on top, rather than the other way round.
  Tests that assert exact `next` strings, the required `--session` error, or
  the help text are updated with it.
- Plugin authors see no change to how tools are declared; the CLI's new
  flags come from the `inputSchema` they already write.
