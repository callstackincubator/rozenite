---
'@rozenite/middleware': patch
---

Fix Rozenite for Agents failing every tool call on Lynx targets. A capability-filtered domain answered for tools it did not own, which aborted the dispatch walk on its first step and reported the React domain's reason whatever domain was asked for.
