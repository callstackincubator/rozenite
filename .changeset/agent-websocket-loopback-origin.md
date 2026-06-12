---
'@rozenite/agent-shared': patch
'@rozenite/agent-sdk': patch
'@rozenite/middleware': patch
'rozenite': patch
---

Derive the Agent debugger WebSocket `Origin` from the selected inspector URL and default local Agent connections to `127.0.0.1` so React Native origin checks accept Rozenite for Agents sessions.
