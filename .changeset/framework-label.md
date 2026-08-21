---
'rozenite': minor
---

Name the framework being debugged in the UI, now that a Rozenite window can be showing React Native, Lynx or a web app. React Native DevTools puts it in front of the window title ("Web · MyApp (Chrome) - React Native DevTools"), so several open DevTools windows are tellable apart at a glance, and the standalone app names it in its status footer next to the connection status. The DevTools label comes from the target's own application metadata; the standalone app's comes from the dev server, which now reports its platform in `/rozenite/app/config`.
