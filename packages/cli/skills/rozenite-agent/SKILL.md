---
name: rozenite-agent
description: Skill giving access to React Native Devtools and Rozenite plugins.
---

# Rozenite Skill

## CLI Execution

- Use the locally installed `rozenite` CLI. Never rely on a global install.
- Run `rozenite` from the app root where Metro is started for the target app.
- In monorepos, this is usually the app package root, not the repository root.
- Verify that `rozenite` is installed for that app root before running commands there.
- Resolve a reusable `ROZENITE` command using the package manager for the current project:
  1. `pnpm exec rozenite`
  2. `npm exec -- rozenite`
  3. `yarn exec rozenite`
- If the app root does not provide a local `rozenite` installation, stop and ask the user instead of falling back to a global CLI.

## Ground Truths

- Agent work is session-scoped. Reuse one session across related commands.
- Start with `$ROZENITE agent session create`. It creates or reuses the device session and returns when the session is ready.
- When you are done with the session, stop it with `$ROZENITE agent session stop <sessionId>`.
- If `session create` fails because multiple devices are connected, run `$ROZENITE agent targets`, choose the right `id`, then retry with `--deviceId <id>`.
- Pass `--session <id>` on every domain command.
- Try the expected domain directly when this skill or a domain reference already identifies it.
- Discover domains from the live session with `$ROZENITE agent domains --session <id>` only if a domain call fails, the expected domain is unclear, or you need to confirm what is currently registered.
- For live app inspection, Rozenite session data is the source of truth.
- If the expected plugin domain is missing from the live session, tell the user that the corresponding plugin must be installed and registered in the app.
- When referring to plugin domains in user-facing output, use the plugin's `pluginId` instead of the normalized slug.
- When making Rozenite calls against a discovered plugin domain, use the live domain token returned by Rozenite.
- Use the relevant live domain before exploring source code.
- Use this skill and its `domains/*.md` references as the source of truth for workflow, tool choice, and tool arguments.
- If the reference already lists the exact tool and arguments you need, call it directly.
- Do not call `$ROZENITE agent <domain> tools` or fetch tool schema when this skill or its references already provide the needed tool name and arguments.
- Check `$ROZENITE agent <domain> tools --session <id>` or `$ROZENITE agent <domain> schema --tool <name> --session <id>` only when no matching reference exists, the references do not answer the question, a call fails, or the live domain exposes behavior that differs from the references.
- Skip confirmation or discovery steps that do not add new information.
- Do not explore the codebase to infer live runtime state when Rozenite can answer directly.
- Explore source code only when the user asks about implementation or setup, when no relevant domain is available, or when Rozenite shows the required plugin or domain is not registered and the task becomes setup or debugging.
- Built-in domains are `console`, `network`, `react`, `performance`, and `memory`.
- Additional domains can appear at runtime from the app or installed plugins.

## Tool Invocation Rule

- Do not pass domain tool names as direct CLI subcommands.
- Always invoke domain tools with `$ROZENITE agent <domain> call --tool <toolName> --args '<json>' --session <id>`.
- If a domain reference lists only tool names, treat them as tool names, not CLI actions.
- Example: `$ROZENITE agent at-rozenite__mmkv-plugin call --tool list-storages --args '{}' --session <id>`.
- If a command fails with `Unknown domain action`, check the CLI syntax and retry with `call --tool <toolName> --session <id>`.

## Workflow

1. Resolve `ROZENITE` using the CLI Execution rules.
2. Run `$ROZENITE agent session create`.
3. If a matching file exists under `domains/*.md`, read it.
4. If the reference already lists the needed tool and arguments for the expected domain, call it directly.
5. Run `$ROZENITE agent domains --session <id>` only if the call fails, the expected domain is unclear, or you need to confirm what is currently registered.
6. If the expected plugin domain is missing, tell the user to install and register the corresponding plugin in the app.
7. Check `$ROZENITE agent <domain> tools --session <id>` or `$ROZENITE agent <domain> schema --tool <name> --session <id>` only if the reference is insufficient, the call fails, or you need to confirm a live mismatch.
8. Fall back to source-code exploration only if no relevant domain exists or the task is about implementation or setup.
9. When no further Rozenite calls are needed, stop the session with `$ROZENITE agent session stop <sessionId>`.
