# @rozenite/expo-atlas-plugin

## 2.3.0

### Minor Changes

- [#457](https://github.com/callstackincubator/rozenite/pull/457) [`3a29044`](https://github.com/callstackincubator/rozenite/commit/3a29044d0b72354ff80cb2e044afe7d51b800348) Thanks [@V3RON](https://github.com/V3RON)! - Every official plugin now declares the integrations it supports, so a plugin that cannot work in the environment you are debugging can say so instead of loading and failing.

  Controls, Feature Flags, React Hook Form and TanStack Query import nothing from `react-native` on the device and declare every integration, Lynx included. Plugins built on native modules — SQLite, Storage, File System and Performance Monitor — declare React Native only, and so do Network Activity and Require Profiler: `react-native-web` provides no `TurboModuleRegistry` or `DevSettings`, which their device code calls. The rest use React Native APIs that do have web equivalents, and also declare Rozenite for Web.

### Patch Changes

- Updated dependencies [[`158f4e5`](https://github.com/callstackincubator/rozenite/commit/158f4e5406d6428e24164bdde82d459030fa7309)]:
  - @rozenite/plugin-bridge@2.3.0

## 2.2.0

### Patch Changes

- Updated dependencies [[`4f5fe74`](https://github.com/callstackincubator/rozenite/commit/4f5fe747ca0c6e93d0bf05076c7e2e2ad25fd744)]:
  - @rozenite/plugin-bridge@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@2.1.0

## 2.0.0

### Patch Changes

- [#316](https://github.com/callstackincubator/rozenite/pull/316) [`4e1c3bd`](https://github.com/callstackincubator/rozenite/commit/4e1c3bd8854b01c0d775287362d222307a7c8ffc) Thanks [@V3RON](https://github.com/V3RON)! - Support Metro's private serializer module paths through Metro 0.84.

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

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [[`404244b`](https://github.com/callstackincubator/rozenite/commit/404244bab0600761ed82e5a7e8072b933c46f80a)]:
  - @rozenite/plugin-bridge@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.5.0

## 1.4.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies []:
  - @rozenite/plugin-bridge@1.3.0
