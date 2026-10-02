---
"@rozenite/middleware": patch
"@rozenite/metro": patch
"@rozenite/repack": patch
"@rozenite/lynx": patch
---

Metro, Re.Pack and Lynx now pass options to Rozenite through one shared path, so
every Rozenite option (`include`, `exclude`, `destroyOnDetachPlugins`,
`projectType`, `logLevel`, `pluginDisplay`) is handled the same way in all
three. Lynx now honours every Rozenite option. A `projectRoot` passed through
bundler options is ignored in favour of the bundler's own project root.
