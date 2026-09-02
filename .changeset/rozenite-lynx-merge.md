---
'@rozenite/lynx': minor
'@rozenite/lynx-dev': minor
---

Rozenite for Lynx is now one package. `@rozenite/lynx` now exports both the
device runtime (`.`, unchanged) and the rspeedy/Rsbuild dev-server plugin
(`./rspeedy`, previously `@rozenite/lynx-dev`). Install just `@rozenite/lynx`
and add `rozeniteLynxPlugin` from `@rozenite/lynx/rspeedy` to your
`lynx.config.ts` — the plugin now injects the device runtime for you, only
in development, so there is nothing left to import by hand in your app's own
source (and no way to accidentally ship it to production).

`@rozenite/lynx-dev` is deprecated and now re-exports `@rozenite/lynx/rspeedy`
for backwards compatibility; existing `import { rozeniteLynxPlugin } from
'@rozenite/lynx-dev'` code keeps working but should migrate to
`@rozenite/lynx/rspeedy`.
