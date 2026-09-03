# @rozenite/lynx-dev

## 2.4.0

### Minor Changes

- [#489](https://github.com/callstackincubator/rozenite/pull/489) [`c9c8787`](https://github.com/callstackincubator/rozenite/commit/c9c87874e9d3d6780a40557af12e9146f5c451af) Thanks [@V3RON](https://github.com/V3RON)! - Rozenite for Lynx is now one package. `@rozenite/lynx` now exports both the
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

### Patch Changes

- Updated dependencies [[`c9c8787`](https://github.com/callstackincubator/rozenite/commit/c9c87874e9d3d6780a40557af12e9146f5c451af), [`3c4905f`](https://github.com/callstackincubator/rozenite/commit/3c4905f9e6a46f456b8ddd1dee209353b9e96c34)]:
  - @rozenite/lynx@2.4.0

## 2.3.0

### Patch Changes

- Updated dependencies [[`81227b3`](https://github.com/callstackincubator/rozenite/commit/81227b335ee32a1f16ebb9e35c39c46b7a470a72), [`907ba2f`](https://github.com/callstackincubator/rozenite/commit/907ba2ff79125b52577db0ef1bd683e2f8c5ca4d), [`1c95b0f`](https://github.com/callstackincubator/rozenite/commit/1c95b0f90f9cacf1ca061a8809fc68073e0c3792), [`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08), [`a1f5280`](https://github.com/callstackincubator/rozenite/commit/a1f5280e785e3db34b23b0877d52ad19c831dc88), [`5b033db`](https://github.com/callstackincubator/rozenite/commit/5b033dbae60572c442e370246d18ffae8dd78e14), [`312fd97`](https://github.com/callstackincubator/rozenite/commit/312fd9769daa6f357a0027efe825b55cd956145c), [`c5a3cfc`](https://github.com/callstackincubator/rozenite/commit/c5a3cfc90abd6347ab0321590f7ca262896a1465), [`f74f1be`](https://github.com/callstackincubator/rozenite/commit/f74f1be7920c93c64b2e5561048a33d7c3a66dc9)]:
  - @rozenite/middleware@2.3.0
  - @rozenite/tools@2.3.0
