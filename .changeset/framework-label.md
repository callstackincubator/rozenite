---
'rozenite': minor
---

Name the framework being debugged in the UI, now that a Rozenite window can be showing React Native, Lynx or a web app. React Native DevTools puts it in front of the window title when the target is not React Native ("Web · MyApp (Chrome) - React Native DevTools"), so a Rozenite for Web window is tellable from a native one at a glance; a React Native title is left exactly as the DevTools frontend built it. The standalone app names the framework in its status footer next to the connection status. Each target reports its own framework over the metadata event React Native already sends during the handshake: `@rozenite/lynx-dev` now answers `ReactNativeApplication.enable` with the `metadataUpdated` event a device implementing that domain would send, naming Lynx in `integrationName` while `platform` keeps meaning the device OS.
