---
'@rozenite/agent-shared': patch
---

Expose `getErrorDetails`, `parseAgentTargetsResponse`, `AGENT_MESSAGE_TYPES`, the `AgentEventMap` type, and the built-in domain tool name tables (`BUILT_IN_DOMAIN_TOOL_NAMES` and the per-domain `*_TOOL_NAMES` maps) so Rozenite packages share one definition instead of keeping copies.
