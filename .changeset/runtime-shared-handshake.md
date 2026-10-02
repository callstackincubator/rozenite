---
'@rozenite/runtime': patch
---

Rozenite in React Native DevTools now uses the same connection setup as the Rozenite app and `rozenite agent`, and repeats it when the app reloads. After a reload, plugin panels reappear about half a second later than before. When the app does not include Rozenite, the panel now shows the same message as the Rozenite app instead of a generic timeout.
