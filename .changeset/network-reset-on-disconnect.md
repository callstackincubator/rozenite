---
"@rozenite/middleware": patch
---

Fix network agent domain not resetting the captured request buffer on disconnect, which allowed a rebind (e.g. after an app relaunch) to serve requests from the previous app run and resume pagination cursors into the wrong buffer.
