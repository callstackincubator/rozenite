---
'rozenite': minor
---

Restructure Rozenite for Agents skills so the CLI bundles all content and the installable skill becomes a thin router. Add `rozenite skills list` and `rozenite skills show <id>` to list and read the bundled docs (ground truths, CLI workflow, SDK workflow, SDK code patterns, and one doc per agent-enabled domain). The `rozenite-agent` and `rozenite-agent-sdk` skills are replaced by a single `rozenite` skill that discovers docs through `rozenite skills` instead of hardcoding them, so the skill can no longer go stale.
