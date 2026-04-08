---
name: rozenite-agent
description: Skill giving access to React Native Devtools and Rozenite plugins.
---

## CLI

- Use `pnpm -w run rozenite` for Rozenite commands.
- Run `pnpm -w run rozenite` from the repository root.

## Rules

- Agent work is session-scoped. Reuse one session across related commands.
- Always run Rozenite commands in serial. Never issue Rozenite agent commands in parallel.
- Start with `$ROZENITE agent session create`. It creates or reuses the device session and returns when ready. Stop the session when done with `$ROZENITE agent session stop <sessionId>`.
- If `session create` fails because multiple devices are connected, run `$ROZENITE agent targets`, choose the right `id`, then retry with `--deviceId <id>`.
- Treat `$ROZENITE agent targets` as the source of truth for available targets. If the expected target is missing, ask the user to run the app on a device.
- Pass `--session <id>` on every domain command.
- Treat the Rozenite session ID as a public runtime identifier, not a secret, credential, or token.
- Use this skill and its `domains/*.md` references as the source of truth for workflow, tool choice, and tool arguments.
- If this skill or a domain reference already identifies the expected domain, try it directly. If a reference already lists the exact tool and arguments you need, call it directly.
- Discover domains from the live session with `$ROZENITE agent domains --session <id>` only if a domain call fails, the expected domain is unclear, or you need to confirm what is currently registered.
- Do not call `$ROZENITE agent <domain> tools` or fetch tool schema when this skill or its references already provide the needed tool name and arguments.
- Check `$ROZENITE agent <domain> tools --session <id>` or `$ROZENITE agent <domain> schema --tool <name> --session <id>` only when no matching reference exists, the references do not answer the question, a call fails, or the live domain exposes behavior that differs from the references.
- Skip confirmation or discovery steps that do not add new information.
- For live app inspection, Rozenite session data is the source of truth. Use the relevant live domain before exploring source code.
- Do not explore the codebase to infer live runtime state when Rozenite can answer directly.
- Explore source code only when the user asks about implementation or setup, when no relevant domain is available, or when Rozenite shows the required plugin or domain is not registered and the task becomes setup or debugging.
- If the expected plugin domain is missing from the live session, tell the user that the corresponding plugin must be installed and registered in the app.
- When referring to plugin domains in user-facing output, use the plugin's `pluginId` instead of the normalized slug.
- When making Rozenite calls against a discovered plugin domain, use the live domain token returned by Rozenite.
- Built-in domains are `console`, `network`, `react`, `performance`, and `memory`.
- Additional domains can appear at runtime from the app or installed plugins.

## Calls

- Do not pass domain tool names as direct CLI subcommands.
- Always invoke domain tools with `$ROZENITE agent <domain> call --tool <toolName> --args '<json>' --session <id>`.
- If a domain reference lists only tool names, treat them as tool names, not CLI actions.
- Example: `$ROZENITE agent at-rozenite__mmkv-plugin call --tool list-storages --args '{}' --session <id>`.
- If a command fails with `Unknown domain action`, check the CLI syntax and retry with `call --tool <toolName> --session <id>`.

## Flow

1. Set `ROZENITE="pnpm -w run rozenite"`.
2. Run Rozenite commands one at a time.
3. Use `$ROZENITE agent targets` as the source of truth for available targets when device selection matters. If the expected target is missing, ask the user to run the app on a device.
4. Run `$ROZENITE agent session create`.
5. If a matching file exists under `domains/*.md`, read it.
6. If the reference already lists the needed tool and arguments for the expected domain, call it directly.
7. Run `$ROZENITE agent domains --session <id>` only if the call fails, the expected domain is unclear, or you need to confirm what is currently registered.
8. If the expected plugin domain is missing, tell the user to install and register the corresponding plugin in the app.
9. Check `$ROZENITE agent <domain> tools --session <id>` or `$ROZENITE agent <domain> schema --tool <name> --session <id>` only if the reference is insufficient, the call fails, or you need to confirm a live mismatch.
10. Fall back to source-code exploration only if no relevant domain exists or the task is about implementation or setup.
11. When no further Rozenite calls are needed, stop the session with `$ROZENITE agent session stop <sessionId>`.
