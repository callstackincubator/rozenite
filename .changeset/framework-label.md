---
'rozenite': minor
---

Name the framework being debugged in the UI, now that a Rozenite window can be showing React Native, Lynx or a web app. React Native DevTools puts it in front of the window title ("Web · MyApp (Chrome) - React Native DevTools"), so several open DevTools windows are tellable apart at a glance, and the standalone app names it in its status footer next to the connection status. Each target reports its own framework: `@rozenite/lynx-dev` now answers `ReactNativeApplication.enable` with the metadata event a device implementing that domain would send, naming Lynx in `integrationName` while `platform` keeps meaning the device OS. The dev server also reports its platform in `/rozenite/app/config`, which is what the footer shows before a device has connected.
