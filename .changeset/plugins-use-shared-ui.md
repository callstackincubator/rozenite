---
"@rozenite/controls-plugin": minor
"@rozenite/expo-atlas-plugin": minor
"@rozenite/file-system-plugin": minor
"@rozenite/mmkv-plugin": minor
"@rozenite/network-activity-plugin": minor
"@rozenite/overlay-plugin": minor
"@rozenite/performance-monitor-plugin": minor
"@rozenite/react-navigation-plugin": minor
"@rozenite/require-profiler-plugin": minor
"@rozenite/rhf-plugin": minor
"@rozenite/sqlite-plugin": minor
"@rozenite/storage-plugin": minor
---

Migrate all plugins to use `@rozenite/ui` for a unified visual design across the DevTools interface. Replaces per-plugin Tailwind configs, custom CSS, and one-off component implementations with shared HeroUI-based components from `@rozenite/ui`.
