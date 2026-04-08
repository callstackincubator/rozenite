---
'@rozenite/agent-bridge': minor
'@rozenite/agent-shared': minor
'@rozenite/middleware': minor
'rozenite': minor
---

Refactor the agent workflow to use Metro-backed session routes and shared transport types instead of the old daemon-oriented CLI flow.

The agent bridge now re-registers in-app tools after session bootstrap, middleware waits for session bootstrap before exposing created sessions, and the packaged CLI skill/docs were updated to match the new session and artifact behavior.
