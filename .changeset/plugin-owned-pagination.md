---
"@rozenite/agent-sdk": major
"rozenite": major
---

Remove SDK and CLI auto-pagination so every tool invocation performs exactly
one call and preserves plugin-owned page results and cursors unchanged. Fetch
additional pages by passing the returned cursor explicitly.
