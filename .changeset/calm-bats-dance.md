---
"@rozenite/redux-devtools-plugin": minor
---

Redux DevTools now uses Rozenite CDP/bridge messaging instead of the previous relay-based flow.

User-facing improvements:
- Better reliability for Redux DevTools controls in the plugin panel.
- Works with Rozenite for Web by enabling the plugin runtime on web targets.
- Supports naming store instances via `rozeniteDevToolsEnhancer({ name })`, making multi-store apps easier to debug.
- Playground now demonstrates two independent Redux stores and counters for easier validation.
