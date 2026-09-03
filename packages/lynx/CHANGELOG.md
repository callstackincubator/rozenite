# @rozenite/lynx

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

- [#490](https://github.com/callstackincubator/rozenite/pull/490) [`3c4905f`](https://github.com/callstackincubator/rozenite/commit/3c4905f9e6a46f456b8ddd1dee209353b9e96c34) Thanks [@V3RON](https://github.com/V3RON)! - Targets returned by `rozenite open` and the agent's targets endpoint now
  report which integration (React Native or Lynx) serves them, and target
  discovery goes through one Rozenite endpoint on both integrations.

  `MetroTarget.pageId` is now the page's id within its own device (the
  `page` query parameter of `webSocketDebuggerUrl`) instead of the globally
  unique `<deviceId>-<pageId>` composite, so reconnecting after a disconnect
  correctly lands back on the page that was being debugged.

  `rozenite agent targets` now includes each target's `integration` in its
  output.

  The Lynx dev server no longer drops and re-registers every connected Lynx
  client on each of its periodic device-discovery sweeps, which showed up in
  Rozenite as a reconnect every fifteen seconds.

### Patch Changes

- Updated dependencies [[`3c4905f`](https://github.com/callstackincubator/rozenite/commit/3c4905f9e6a46f456b8ddd1dee209353b9e96c34)]:
  - @rozenite/middleware@2.4.0
  - @rozenite/tools@2.4.0

## 2.3.0
