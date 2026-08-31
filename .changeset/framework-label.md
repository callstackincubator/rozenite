---
'rozenite': minor
---

Name the framework being debugged in the UI, now that a Rozenite window can be showing React Native, Lynx or a web app. The standalone app names it in its status footer next to the connection status, and in its own window title ("Lynx · Pixel 8 - Rozenite") — in a browser tab and in the Electron shell alike, so several open Rozenite windows are tellable apart at a glance. React Native DevTools keeps the title it sets itself; Rozenite does not touch it. Each target reports its own framework over the metadata event React Native already sends during the handshake: `@rozenite/lynx-dev` now answers `ReactNativeApplication.enable` with the `metadataUpdated` event a device implementing that domain would send, naming Lynx in `integrationName` while `platform` keeps meaning the device OS.
