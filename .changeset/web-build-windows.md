---
'@rozenite/web': patch
---

Fix `@rozenite/web` failing to build on Windows. The build no longer relies on
POSIX-only shell features (`&`, `wait`, `cp`), so it works in `cmd.exe`.
