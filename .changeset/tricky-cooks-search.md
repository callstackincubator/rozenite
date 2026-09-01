---
'@rozenite/middleware': patch
---

Fix React DevTools agent tools silently losing their outbound channel after the app restarts. The session now re-binds the React domain to the device when it reconnects, so `getProps`, `getComponent` and profiling keep working instead of failing with an unavailable-channel error or hanging on `isProcessingData`.
