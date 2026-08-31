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

Every official plugin now declares the integrations it supports, so a plugin that cannot work in the environment you are debugging can say so instead of loading and failing.

Controls, Feature Flags, React Hook Form and TanStack Query import nothing from `react-native` on the device and declare every integration, Lynx included. Plugins built on native modules — SQLite, Storage, File System and Performance Monitor — declare React Native only, and so do Network Activity and Require Profiler: `react-native-web` provides no `TurboModuleRegistry` or `DevSettings`, which their device code calls. The rest use React Native APIs that do have web equivalents, and also declare Rozenite for Web.
