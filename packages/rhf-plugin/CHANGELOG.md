# @rozenite/rhf-plugin

## 2.2.0

### Minor Changes

- [#425](https://github.com/callstackincubator/rozenite/pull/425) [`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba) Thanks [@V3RON](https://github.com/V3RON)! - Add `useConfirmDialog()` to `@rozenite/ui`: an imperative alternative to `ConfirmDialog` that resolves a promise with the user's choice instead of driving `open` from local state. `PluginShell` now mounts `Toast` and `ConfirmDialog.Provider` automatically, so plugin panels no longer need to wrap themselves in `<Toast.Provider>` to use `useToast()`.

  Migrate the feature-flags, storage, and React Hook Form DevTools panels to `useConfirmDialog()`, replacing their declarative confirm/alert dialogs.

- [#409](https://github.com/callstackincubator/rozenite/pull/409) [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe) Thanks [@V3RON](https://github.com/V3RON)! - Rebuild the React Hook Form DevTools panel on `@rozenite/ui`: a sidebar lists connected forms, fields render as a flat, indented table (Field/Type/Value/State/Error) with a fixed toolbar and footer summarizing form state, and clicking a field opens a detail dialog with its value, dirty/touched state, and error.

  Add remote form reset: pass `reset` from `useForm()` to `useRozeniteRHFPlugin({ control, reset })` to let the DevTools panel revert the form to its default values via a "Reset form" toolbar button.

### Patch Changes

- Updated dependencies [[`8b373d9`](https://github.com/callstackincubator/rozenite/commit/8b373d929f7bb64438bc63e516e8ad31966f61ba), [`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744), [`db0a792`](https://github.com/callstackincubator/rozenite/commit/db0a79283562dfd889e8e0f478b384ba21cfe5bf), [`b409250`](https://github.com/callstackincubator/rozenite/commit/b409250480260b793c504d536755a5ba933de4fe), [`850e455`](https://github.com/callstackincubator/rozenite/commit/850e45576c41d52e24d6c239ff2947a612406fae), [`0565227`](https://github.com/callstackincubator/rozenite/commit/0565227761c0f52df0f7fbf30d0ac5833ccc4039), [`15f31f0`](https://github.com/callstackincubator/rozenite/commit/15f31f0091c0bf3bbf48a192925f57c20efd8951), [`9f7581e`](https://github.com/callstackincubator/rozenite/commit/9f7581e8a1e4d506a93c30876231fbe21147c0de)]:
  - @rozenite/ui@2.2.0
  - @rozenite/plugin-bridge@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@2.1.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`476a27f`](https://github.com/callstackincubator/rozenite/commit/476a27f5532f4e35ad66feb5c9481b9396592d14)]:
  - @rozenite/plugin-bridge@2.0.0

## 1.13.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.13.0

## 1.12.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.12.0

## 1.11.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.10.0

## 1.9.0

### Minor Changes

- [#258](https://github.com/callstackincubator/rozenite/pull/258) [`cbdc776`](https://github.com/callstackincubator/rozenite/commit/cbdc776d239e92f66110040a9b7e11f5923b19ca) Thanks [@V3RON](https://github.com/V3RON)! - Add React Hook Form plugin. Inspect form state, field values, errors, dirty/touched fields, and validation status in real time from React Native DevTools.

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.9.0
