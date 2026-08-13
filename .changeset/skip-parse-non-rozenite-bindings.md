---
'@rozenite/runtime': patch
---

Reduce DevTools frontend overhead by skipping `JSON.parse` for binding
messages that cannot be for the `rozenite` domain. Rozenite shares its
binding with React Native's own React DevTools integration, so every React
DevTools bridge message (which can carry full component trees) was
previously parsed and discarded on every call.
