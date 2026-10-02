---
'@rozenite/middleware': minor
'@rozenite/metro': patch
'@rozenite/repack': patch
'@rozenite/lynx': patch
---

Metro, Re.Pack and Lynx now pass options to Rozenite through one shared helper,
`toRozeniteConfig`, newly exported from `@rozenite/middleware`. Only the options
Rozenite reads are forwarded, so bundler-only options such as `enabled` no
longer leak through. For Metro and Re.Pack, a `projectRoot` passed through the
Rozenite options is now ignored in favour of the bundler's own project root.
