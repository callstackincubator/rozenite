---
name: rozenite-agent
description: Skill giving access to React Native Devtools and Rozenite plugins.
---

# Rozenite Skill

## Ground Truths
- Agent work is session-scoped. Reuse one session across related commands.
- Start with `rozenite agent session create`. It creates or reuses the device session and returns when the session is ready.
- If `session create` fails because multiple devices are connected, run `rozenite agent targets`, choose the right `id`, then retry with `--deviceId <id>`.
- Pass `--session <id>` on every domain command.
- Always discover domains from the live session: `rozenite agent domains --session <id>`.
- Built-in domains are `console`, `network`, `react`, `performance`, and `memory`.
- Additional domains can appear at runtime from the app or installed plugins. Match them by `id`, `slug`, or `pluginId`.

## Workflow
1. Run `rozenite agent session create`.
2. Run `rozenite agent domains --session <id>`.
3. If a matching file exists under `domains/*.md`, read it.
4. Use:
   - `rozenite agent <domain> tools --session <id>`
   - `rozenite agent <domain> schema --tool <name> --session <id>`
   - `rozenite agent <domain> call --tool <name> --args '<json>' --session <id>`
