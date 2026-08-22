---
'@rozenite/controls-plugin': minor
'@rozenite/expo-atlas-plugin': minor
'@rozenite/feature-flags-plugin': minor
'@rozenite/file-system-plugin': minor
'@rozenite/network-activity-plugin': minor
'@rozenite/overlay-plugin': minor
'@rozenite/performance-monitor-plugin': minor
'@rozenite/react-navigation-plugin': minor
'@rozenite/redux-devtools-plugin': minor
'@rozenite/require-profiler-plugin': minor
'@rozenite/rhf-plugin': minor
'@rozenite/sqlite-plugin': minor
'@rozenite/storage-plugin': minor
'@rozenite/tanstack-query-plugin': minor
'rozenite': minor
---

Every official plugin now declares the integrations it supports, so a plugin that cannot work in the environment you are debugging can say so instead of loading and failing. Plugins built on native modules — SQLite, Storage, File System and Performance Monitor — declare React Native only. Plugins that use React Native APIs with web equivalents also declare Rozenite for Web. Controls, React Hook Form and TanStack Query are pure JavaScript on the device and declare every integration, Lynx included.
