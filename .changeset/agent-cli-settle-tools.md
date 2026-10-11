---
"rozenite": patch
---

The first command on an implicitly created agent session no longer runs before the device has registered its plugin and app tools. The CLI now waits, for up to three seconds, until the session's tool count stops changing, so `rozenite agent domains` on a fresh session lists plugin domains on the first call instead of only the built-ins.
