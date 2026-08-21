---
'rozenite': patch
---

Keep looking for Lynx devices after the dev server starts. Device discovery ran once, with a three-second budget, and the connector only watches clients on devices it already knows — so a device missed in that window stayed invisible, with an empty target list and nothing logged, until the dev server was restarted. It now retries on a timer, which also covers plugging a device in or booting an emulator while the dev server is already running.
