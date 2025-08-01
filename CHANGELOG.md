## 1.0.0-alpha.7 (2025-07-31)

### 🩹 Fixes

- ### @rozenite/repack ([#12](https://github.com/callstackincubator/rozenite/pull/12))

  - Added support for Re.Pack, bringing full compatibility, including all capabilities available in Metro.
  ### @rozenite/middleware
  - Introduced the Rozenite Middleware, the core runtime for integrating custom DevTools plugins in React Native environments.
  - Enables automatic plugin discovery, seamless development server integration, and robust infrastructure for plugin communication and UI rendering.
  ### @rozenite/metro
  - Refactored to use @rozenite/middleware as the foundational layer for improved modularity and plugin support.
- ### @rozenite/redux-devtools-plugin ([#13](https://github.com/callstackincubator/rozenite/pull/13))

  - Fixed compatibility issue with @redux-devtools/cli when running in CommonJS environments
- ### @rozenite/expo-atlas-plugin ([#14](https://github.com/callstackincubator/rozenite/pull/14))

  - Fixes an issue where Metro would crash due to a corrupted Expo Atlas file

### ❤️ Thank You

- Szymon Chmal

## 1.0.0-alpha.6 (2025-07-30)

### 🩹 Fixes

- ## Packages ([#5](https://github.com/callstackincubator/rozenite/pull/5))

  ### @rozenite/redux-devtools-plugin
  The Rozenite Redux DevTools Plugin provides Redux state inspection and debugging capabilities within your React Native DevTools environment. It offers a partial Redux DevTools experience, including state inspection and action history (time travel and action dispatch are currently unavailable in remote mode).
  ### @rozenite/vite-plugin
  - Bring back support for 'metro.ts' entry files
  - Improved chunk splitting for 'react-native.ts' entry files
  - Types should be now generated for all entry points
  - Improved support for CJS/ESM packages
  ### @rozenite/network-activity-plugin
  - An all-new UI designed to improve the developer experience
  ### rozenite
  - Bring back support for 'metro.ts' entry files
  ### @rozenite/tanstack-query-plugin
  - Improved performance by limiting the amount of data serialized for each cache event
  ### @rozenite/plugin-bridge
  - Improved module resolution compatibility for environments without package.json exports support, including Metro bundler configurations that don't enable unstable_enablePackageExports
  ## Migration Guide
  - No migration required for existing packages
  - New Redux DevTools functionality is opt-in through the new plugin

### ❤️ Thank You

- Szymon Chmal

## 1.0.0-alpha.5 (2025-07-28)

This was a version bump only, there were no code changes.

## 1.0.0-alpha.4 (2025-07-28)

This was a version bump only, there were no code changes.

## 1.0.0-alpha.3 (2025-07-25)

This was a version bump only, there were no code changes.