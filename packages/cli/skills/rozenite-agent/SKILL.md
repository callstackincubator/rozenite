---
name: rozenite-agent
description: Use Rozenite for Agents through CLI-driven `rozenite agent` commands to inspect React Native DevTools data and Rozenite plugins on a live app target. Trigger this skill for shell-based debugging and live session work. For Node.js or TypeScript scripts, wrappers, automations, or other programmatic SDK usage, use `rozenite-agent-sdk` instead.
---

## CLI

- Use `npx rozenite` for Rozenite commands.
- Run `npx rozenite` from the app root where Metro is started for the target app. In monorepos, this is usually the app package root, not the repository root.

## Listing output contract

`agent domains`, `agent <domain> tools`, and tools that declare the shared
pagination contract always write compact JSON by default. This includes
built-in and third-party plugin tools. Pass `--pretty` for indented JSON. The
`--json` / `-j` option is retained as a compatibility no-op and never changes
the output shape.

- With two or more rows, row-shaped results use the stable columnar contract:
  `{"cols":["id","kind"],"rows":[["console","static"],["react","static"]]}`.
  `cols` is exactly the requested field order; an absent optional value is
  represented by `null` in its row, since a positional array cell can't
  simply be omitted without shifting the columns after it.
- With zero or one row, row-shaped results remain row-keyed:
  `{"items":[{"id":"console","kind":"static"}]}`. Here an absent optional
  value is omitted from the object entirely (not `null`), so these payloads
  never grow past their pre-columnar shape — the reason 0/1-row results stay
  row-keyed in the first place.
- Tool listings default to `name`, `description`, `readOnly`, `destructive`,
  and `idempotent`. `name` is the globally qualified identifier to pass to a
  later `call` or `schema` command. Traits are optional; `null` in a columnar
  row or an omitted key in a row-keyed result means unknown, not `false`.
- Terminal pages omit pagination metadata. When more rows exist, `next` is a
  shell-escaped, runnable `npx rozenite agent ...` command that preserves the
  connection, session, projection, and limit options. CLI-owned domain and
  tool listings pass their cursor with `--cursor`; paginated tool calls pass
  the producer cursor inside `--args`.
- A `--cursor` from an earlier page can go stale if the underlying data was
  invalidated (for example, an app relaunch resets the network domain's
  capture buffer). Re-running a stale cursor returns
  `{"page":{"reset":true},"items":[]}` instead of a normal empty page — treat
  that as "restart this listing from scratch," not "no more rows."

Declared paginated calls include console messages, React
tree/search/inspection rows, render data, network request listings, and any
plugin tool registered with pagination metadata. Tool-specific metadata (for
example `roots`, `totalCount`, or `recording`) remains alongside the row shape.
Undeclared tool results, SDK responses, and genuinely non-row command results
retain their existing shapes.

- Paginated calls return a **trimmed default projection**, not every declared
  field. For example, `console getMessages` omits `argsPreview` and `context`
  by default. Pass `-f, --fields <csv>` to pick specific columns, or
  `-v, --verbose` to include every field the tool declares.

## Handoff

- Keep this skill for shell-driven `rozenite agent ...` workflows.
- If the user wants code instead of shell commands, or asks for a Node.js or TypeScript script, wrapper, benchmark, automation, or agent runtime built on top of Rozenite, switch to `rozenite-agent-sdk`.

## Rules

- Agent work is session-scoped. Reuse one session across related commands.
- Always run Rozenite commands in serial. Never issue Rozenite agent commands in parallel.
- Start with `npx rozenite agent session create`. It creates or reuses the device session and returns when ready. Stop the session when done with `npx rozenite agent session stop <sessionId>`.
- If `session create` fails because multiple devices are connected, run `npx rozenite agent targets`, choose the right `id`, then retry with `--deviceId <id>`.
- Treat `npx rozenite agent targets` as the source of truth for available targets. If the expected target is missing, ask the user to run the app on a device.
- Pass `--session <id>` on every domain command.
- Treat the Rozenite session ID as a public runtime identifier, not a secret, credential, or token.
- Use this skill and its `domains/*.md` references as the source of truth for workflow, tool choice, and tool arguments.
- If this skill or a domain reference already identifies the expected domain, try it directly. If a reference already lists the exact tool and arguments you need, call it directly.
- Discover domains from the live session with `npx rozenite agent domains --session <id>` only if a domain call fails, the expected domain is unclear, or you need to confirm what is currently registered.
- Do not call `npx rozenite agent <domain> tools` or fetch tool schema when this skill or its references already provide the needed tool name and arguments.
- Check `npx rozenite agent <domain> tools --session <id>` or `npx rozenite agent <domain> schema --tool <name> --session <id>` only when no matching reference exists, the references do not answer the question, a call fails, or the live domain exposes behavior that differs from the references.
- Skip confirmation or discovery steps that do not add new information.
- For live app inspection, Rozenite session data is the source of truth. Use the relevant live domain before exploring source code.
- Trust that Rozenite is correctly installed. Do not explore the codebase for setup unless the Rozenite CLI fails.
- Do not explore the codebase to infer live runtime state when Rozenite can answer directly.
- Explore source code only when the user asks about implementation or setup, when no relevant domain is available, or when Rozenite shows the required plugin or domain is not registered and the task becomes setup or debugging.
- If the expected plugin domain is missing from the live session, tell the user that the corresponding plugin must be installed and registered in the app.
- When referring to plugin domains in user-facing output, use the plugin's `pluginId` instead of the domain token.
- When making Rozenite calls against a discovered plugin domain, use the live domain token returned by Rozenite.
- Built-in domains are `console`, `network`, `react`, `performance`, and `memory`.
- Additional domains can appear at runtime from the app or installed plugins. Plugin domain tokens are short, derived names, not the npm package name: `@rozenite/mmkv-plugin` becomes `mmkv`, `@avasapp/rozenite-plugin-ably` becomes `avasapp/ably`.
- Domain token shape tells you provenance: a bare word (`mmkv`) is a built-in or an official `@rozenite/*` plugin; `scope/name` (`avasapp/ably`) is a third-party scoped plugin; a verbatim `rozenite-*` name is a third-party unscoped plugin. `evil/mmkv` and `mmkv` are never the same plugin.

## Calls

- Do not pass domain tool names as direct CLI subcommands.
- Always invoke domain tools with `npx rozenite agent <domain> call --tool <toolName> --args '<json>' --session <id>`.
- Continue a paginated domain tool call by passing its returned cursor inside `--args`; `--cursor` is only for CLI-owned domain and tool listings.
- If a domain reference lists only tool names, treat them as tool names, not CLI actions.
- Example: `npx rozenite agent mmkv call --tool list-storages --args '{}' --session <id>`.
- If a command fails with `Unknown domain action`, check the CLI syntax and retry with `call --tool <toolName> --session <id>`.

## Flow

1. Run Rozenite commands one at a time.
2. Use `npx rozenite agent targets` as the source of truth for available targets when device selection matters. If the expected target is missing, ask the user to run the app on a device.
3. Run `npx rozenite agent session create`.
4. If a matching file exists under `domains/*.md`, read it.
5. If the reference already lists the needed tool and arguments for the expected domain, call it directly.
6. Run `npx rozenite agent domains --session <id>` only if the call fails, the expected domain is unclear, or you need to confirm what is currently registered.
7. If the expected plugin domain is missing, tell the user to install and register the corresponding plugin in the app.
8. Check `npx rozenite agent <domain> tools --session <id>` or `npx rozenite agent <domain> schema --tool <name> --session <id>` only if the reference is insufficient, the call fails, or you need to confirm a live mismatch.
9. Fall back to source-code exploration only if no relevant domain exists or the task is about implementation or setup.
10. When no further Rozenite calls are needed, stop the session with `npx rozenite agent session stop <sessionId>`.
