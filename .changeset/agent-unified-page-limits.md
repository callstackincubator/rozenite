---
'@rozenite/middleware': patch
'@rozenite/redux-devtools-plugin': patch
---

Align agent pagination limits. The console `getMessages` tool now defaults to 20 items (was 50) and caps at 100 (was 200), so SDK calls without a limit return 20 items and larger requests are capped. The Redux DevTools `list-actions` tool now defaults to 20 items (was 50) and is capped at 100 where it previously had no maximum.
