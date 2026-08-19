---
'@rozenite/shell': minor
'@rozenite/app': minor
'@rozenite/middleware': minor
'rozenite': minor
---

Add a standalone Rozenite app that runs the DevTools panel UI in its own browser window instead of inside React Native DevTools. Run `rozenite open` to pick a connected device and open it. Because panels live outside the DevTools frontend, they stay mounted across a JS-VM reload instead of being torn down and recreated — the app reconnects to the device in the background while your panels keep their state.

The standalone app is opt-in and connects directly to the device, so it competes with React Native DevTools and `rozenite agent` for the same debugger connection; only one can be attached at a time.
