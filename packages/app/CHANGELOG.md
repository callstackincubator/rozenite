# @rozenite/app

## 2.3.0

### Minor Changes

- [#456](https://github.com/callstackincubator/rozenite/pull/456) [`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08) Thanks [@V3RON](https://github.com/V3RON)! - Lay the groundwork for refusing a plugin on an integration it doesn't support, instead of loading it and breaking. Plugins can now declare which environments they work in — `react-native`, `react-native-web`, `lynx`, or `lynx-web` — via `integrations` in `rozenite.config.ts`; omitting it defaults to `['react-native']`, and the resolved list is always reported in the plugin manifest. Nothing enforces compatibility yet — that's a follow-up.

  Resolving which integration a connected target actually is takes two halves. The dev server supplies the host it serves (`react-native` or `lynx`), which follows from the installed integration and so cannot be wrong. The other half — whether the target is a browser — is answered by the device itself: both DevTools hosts evaluate a small self-contained expression in the connected runtime during bootstrap, and `resolveIntegration` combines the two. Asking the device is what makes the answer immediate and certain; the alternative was reading React Native's `ReactNativeApplication.metadataUpdated`, an event Rozenite neither emits nor can order, so a host that asked early would report a browser target as native with no way to tell that answer from a real one. A probe that fails leaves the target unknown rather than guessing.

  `@rozenite/middleware`'s `platform` config option, unreleased until now, is renamed to `integration` to avoid colliding with the device-OS meaning `platform` carries everywhere else in the system.

### Patch Changes

- [#451](https://github.com/callstackincubator/rozenite/pull/451) [`b758637`](https://github.com/callstackincubator/rozenite/commit/b758637fd6af638d9b214849d390163ce4efda19) Thanks [@V3RON](https://github.com/V3RON)! - Show a startup splash with the Rozenite loader while the standalone app
  connects to a device, fading it out once the handshake completes.
- Updated dependencies [[`4afc448`](https://github.com/callstackincubator/rozenite/commit/4afc448f9e7dae4736155f173b7d726e31458d08), [`05939d7`](https://github.com/callstackincubator/rozenite/commit/05939d7b1737a2a9ab483c2df786fa84680c8945), [`b758637`](https://github.com/callstackincubator/rozenite/commit/b758637fd6af638d9b214849d390163ce4efda19), [`40a8ccd`](https://github.com/callstackincubator/rozenite/commit/40a8ccd5a186912ea3dd69564e7efd2c016f611c), [`158f4e5`](https://github.com/callstackincubator/rozenite/commit/158f4e5406d6428e24164bdde82d459030fa7309), [`f788719`](https://github.com/callstackincubator/rozenite/commit/f7887194dd15ff6e165f46d215677899c4e4a1ee)]:
  - @rozenite/tools@2.3.0
  - @rozenite/ui@2.3.0
  - @rozenite/plugin-bridge@2.3.0
  - @rozenite/shell@2.3.0

## 2.2.0

### Minor Changes

- [#422](https://github.com/callstackincubator/rozenite/pull/422) [`2d9ad00`](https://github.com/callstackincubator/rozenite/commit/2d9ad00a225663d300bddc7cd4236f3665443bcb) Thanks [@V3RON](https://github.com/V3RON)! - Add a standalone Rozenite app that runs the DevTools panel UI in its own browser window instead of inside React Native DevTools. Run `rozenite open` to pick a connected device and open it. Because panels live outside the DevTools frontend, they stay mounted across a JS-VM reload instead of being torn down and recreated — the app reconnects to the device in the background while your panels keep their state.

  The standalone app is opt-in and connects directly to the device, so it competes with React Native DevTools and `rozenite agent` for the same debugger connection; only one can be attached at a time.

### Patch Changes

- Updated dependencies [[`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba), [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744), [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf), [`2d9ad00`](https://github.com/callstackincubator/rozenite/commit/2d9ad00a225663d300bddc7cd4236f3665443bcb), [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe), [`850e455`](https://github.com/callstackincubator/rozenite/commit/850e45576c41d52e24d6c239ff2947a612406fae), [`0565227`](https://github.com/callstackincubator/rozenite/commit/0565227761c0f52df0f7fbf30d0ac5833ccc4039), [`15f31f0`](https://github.com/callstackincubator/rozenite/commit/15f31f0091c0bf3bbf48a192925f57c20efd8951), [`9f7581e`](https://github.com/callstackincubator/rozenite/commit/9f7581e8a1e4d506a93c30876231fbe21147c0de)]:
  - @rozenite/ui@2.2.0
  - @rozenite/shell@2.2.0
  - @rozenite/plugin-bridge@2.2.0
