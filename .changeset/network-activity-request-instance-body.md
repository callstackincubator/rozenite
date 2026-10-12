---
'@rozenite/network-activity-plugin': patch
---

Show the request body in Network Activity when `fetch` is called with a
`Request` instance. `ky` v2 does this for every request, so its POST and PUT
bodies sent through `expo/fetch` were missing from the panel.
