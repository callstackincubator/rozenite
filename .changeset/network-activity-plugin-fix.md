---
"@rozenite/network-activity-plugin": patch
---

Converted FormData entries iterator to an array before reduce to avoid 'reduce is not a function' and keep request body parsing stable.
