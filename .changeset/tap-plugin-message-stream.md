---
'@rozenite/middleware': minor
'@rozenite/agent-sdk': minor
'@rozenite/agent-shared': minor
'rozenite': minor
---

Add `rozenite tap`, a CLI command that streams a Rozenite Agent session's plugin messages to stdout in both directions, without opening a browser or React Native DevTools. `--plugin` filters the stream to one plugin; `--type` and `--payload` send one message before watching, so a plugin's native side can be poked and its response observed directly from the terminal. Pass `--json` for newline-delimited JSON output.

Because a device serves only one debugger connection at a time, a tap rides the same connection `rozenite agent` uses and replaces React Native DevTools if it is already attached, the same tradeoff `rozenite agent` already makes.
