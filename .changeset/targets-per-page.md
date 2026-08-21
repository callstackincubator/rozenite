---
'rozenite': minor
---

Offer every debuggable page of a device, not just one. A device can host several runtimes — every Lynx card is one, and a React Native app gains a page per extra VM — but target discovery collapsed each device to a single page, so the rest were unreachable. In LynxExplorer the surviving page was always its own home screen, which contains no Rozenite, so a developer's card could not be opened at all. Each page is now its own target with its own id, `--deviceId` still accepts a device id (asking which card when that device has more than one), and reconnecting returns to the page being debugged instead of drifting to another one.
