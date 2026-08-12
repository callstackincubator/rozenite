---
'@rozenite/middleware': patch
'@rozenite/metro': patch
'@rozenite/repack': patch
---

Fix Metro/Re.Pack dev server startup stalling on slow or network-backed
filesystems. Plugin auto-discovery now resolves dependencies concurrently
instead of scanning them one at a time, and resolves hoisted packages
directly instead of always paying for full module resolution.
