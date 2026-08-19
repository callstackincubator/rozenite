# @rozenite/feature-flags-plugin

## 2.2.0

### Minor Changes

- [#425](https://github.com/callstackincubator/rozenite/pull/425) [`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba) Thanks [@V3RON](https://github.com/V3RON)! - Add `useConfirmDialog()` to `@rozenite/ui`: an imperative alternative to `ConfirmDialog` that resolves a promise with the user's choice instead of driving `open` from local state. `PluginShell` now mounts `Toast` and `ConfirmDialog.Provider` automatically, so plugin panels no longer need to wrap themselves in `<Toast.Provider>` to use `useToast()`.

  Migrate the feature-flags, storage, and React Hook Form DevTools panels to `useConfirmDialog()`, replacing their declarative confirm/alert dialogs.

### Patch Changes

- Updated dependencies [[`dffeda5`](https://github.com/callstackincubator/rozenite/commit/dffeda53c57f491a303108937d4b4ce68054226f), [`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba), [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744), [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf), [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe), [`850e455`](https://github.com/callstackincubator/rozenite/commit/850e45576c41d52e24d6c239ff2947a612406fae), [`0565227`](https://github.com/callstackincubator/rozenite/commit/0565227761c0f52df0f7fbf30d0ac5833ccc4039), [`15f31f0`](https://github.com/callstackincubator/rozenite/commit/15f31f0091c0bf3bbf48a192925f57c20efd8951), [`9f7581e`](https://github.com/callstackincubator/rozenite/commit/9f7581e8a1e4d506a93c30876231fbe21147c0de)]:
  - @rozenite/agent-bridge@2.2.0
  - @rozenite/ui@2.2.0
  - @rozenite/plugin-bridge@2.2.0
  - @rozenite/agent-shared@2.2.0

## 2.1.0

### Minor Changes

- [#387](https://github.com/callstackincubator/rozenite/pull/387) [`f5da7e0`](https://github.com/callstackincubator/rozenite/commit/f5da7e08e49e7f797ec986e515fe61fce40615d1) Thanks [@V3RON](https://github.com/V3RON)! - Add `@rozenite/feature-flags-plugin` — list, inspect, and force-override feature flags from React Native DevTools, with a custom/local adapter and adapters for LaunchDarkly and Statsig, plus agent tools (`list-flags`, `get-flag`, `override-flag`, `clear-overrides`) for driving flags from a coding agent.

### Patch Changes

- Updated dependencies [[`3ec6730`](https://github.com/callstackincubator/rozenite/commit/3ec673095da118cd0ac52c33cae0d8b03b0e162a), [`629df05`](https://github.com/callstackincubator/rozenite/commit/629df051e4ef08775a9a4e1a008aba819d7be05d)]:
  - @rozenite/ui@2.1.0
  - @rozenite/agent-bridge@2.1.0
  - @rozenite/agent-shared@2.1.0
  - @rozenite/plugin-bridge@2.1.0
