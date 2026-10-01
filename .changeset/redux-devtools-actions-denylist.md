---
'@rozenite/redux-devtools-plugin': minor
---

The Redux DevTools enhancer accepts `actionsDenylist` and `actionsAllowlist`,
matching `@redux-devtools/remote`. Filtered actions still update the state but
are not sent to the panel, so high-frequency actions no longer push everything
else out of the `maxAge` window.
