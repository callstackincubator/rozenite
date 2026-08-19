# @rozenite/app

## 2.2.0

### Minor Changes

- [#422](https://github.com/callstackincubator/rozenite/pull/422) [`2d9ad00`](https://github.com/callstackincubator/rozenite/commit/2d9ad00a225663d300bddc7cd4236f3665443bcb) Thanks [@V3RON](https://github.com/V3RON)! - Add a standalone Rozenite app that runs the DevTools panel UI in its own browser window instead of inside React Native DevTools. Run `rozenite open` to pick a connected device and open it. Because panels live outside the DevTools frontend, they stay mounted across a JS-VM reload instead of being torn down and recreated — the app reconnects to the device in the background while your panels keep their state.

  The standalone app is opt-in and connects directly to the device, so it competes with React Native DevTools and `rozenite agent` for the same debugger connection; only one can be attached at a time.

### Patch Changes

- Updated dependencies [[`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba), [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744), [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf), [`2d9ad00`](https://github.com/callstackincubator/rozenite/commit/2d9ad00a225663d300bddc7cd4236f3665443bcb), [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe), [`850e455`](https://github.com/callstackincubator/rozenite/commit/850e45576c41d52e24d6c239ff2947a612406fae), [`0565227`](https://github.com/callstackincubator/rozenite/commit/0565227761c0f52df0f7fbf30d0ac5833ccc4039), [`15f31f0`](https://github.com/callstackincubator/rozenite/commit/15f31f0091c0bf3bbf48a192925f57c20efd8951), [`9f7581e`](https://github.com/callstackincubator/rozenite/commit/9f7581e8a1e4d506a93c30876231fbe21147c0de)]:
  - @rozenite/ui@2.2.0
  - @rozenite/shell@2.2.0
  - @rozenite/plugin-bridge@2.2.0
