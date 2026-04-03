---
name: rozenite-agent
description: Skill giving access to React Native Devtools and Rozenite plugins.
---

# Rozenite Skill

## CLI Execution
- Use the locally installed `rozenite` CLI. Never rely on a global install.
- Run commands from the user project root that contains the local `rozenite` dependency.
- In monorepos, use the workspace root if `rozenite` is installed there. If it is installed in a specific package, run from that package root instead.
- Resolve a reusable `ROZENITE` command in this order:
  1. `./node_modules/.bin/rozenite`
  2. `pnpm exec rozenite`
  3. `npm exec -- rozenite`
  4. `yarn exec rozenite`
- If no local `rozenite` installation can be found, stop and ask the user instead of falling back to a global CLI.

## Ground Truths
- Agent work is session-scoped. Reuse one session across related commands.
- Start with `$ROZENITE agent session create`. It creates or reuses the device session and returns when the session is ready.
- If `session create` fails because multiple devices are connected, run `$ROZENITE agent targets`, choose the right `id`, then retry with `--deviceId <id>`.
- Pass `--session <id>` on every domain command.
- Always discover domains from the live session: `$ROZENITE agent domains --session <id>`.
- Built-in domains are `console`, `network`, `react`, `performance`, and `memory`.
- Additional domains can appear at runtime from the app or installed plugins. Match them by `id`, `slug`, or `pluginId`.

## Workflow
1. Resolve `ROZENITE` using the CLI Execution rules.
2. Run `$ROZENITE agent session create`.
3. Run `$ROZENITE agent domains --session <id>`.
4. If a matching file exists under `domains/*.md`, read it.
5. Use:
   - `$ROZENITE agent <domain> tools --session <id>`
   - `$ROZENITE agent <domain> schema --tool <name> --session <id>`
   - `$ROZENITE agent <domain> call --tool <name> --args '<json>' --session <id>`
