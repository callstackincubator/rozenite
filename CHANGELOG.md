## 1.0.0-alpha.9 (2025-08-07)

### 🩹 Fixes

- **@rozenite/metro:** When packages are linked outside a workspace, Metro fails to resolve them, even if their paths are included in watchFolders. These packages must be handled in a specific way to ensure their inclusion in the bundle. ([#40](https://github.com/callstackincubator/rozenite/pull/40))
- **@rozenite/middleware:** Added React Native version verification to prevent Rozenite from starting on unsupported versions, improving user experience by providing clear feedback when the tool doesn't load in older React Native DevTools. Enhanced logging capabilities through the introduction of ROZENITE_DEBUG environment variable, enabling additional logging for dependency resolution processes. ([#31](https://github.com/callstackincubator/rozenite/pull/31))
- **@rozenite/network-activity-plugin:** Introduced WebSocket debugging capabilities with message interception. Supports real-time inspection of text, JSON, and binary WebSocket messages with a detailed message log for step-by-step debugging and analysis. ([#35](https://github.com/callstackincubator/rozenite/pull/35))
- **@rozenite/network-activity-plugin:** The response body should now be correctly displayed for Axios clients. For unknown reasons, the responseType property is empty when the request is made with Axios. It is now handled as type 'text'. ([#39](https://github.com/callstackincubator/rozenite/pull/39))
- **@rozenite/network-activity-plugin:** Server-side events are now supported in the Network Activity plugin. As long as you have react-native-sse installed in your project, the plugin will detect the connection and intercept all events, displaying them in the DevTools UI. A small change has been made to the @rozenite/vite-plugin, allowing the use of the manualChunks property when building the React Native bundle. ([#45](https://github.com/callstackincubator/rozenite/pull/45))
- **@rozenite/network-activity-plugin:** The port is now displayed after the hostname in the URLs. This clarifies the addresses of services running on non-standard ports and eliminates ambiguities when analyzing network activity. ([#43](https://github.com/callstackincubator/rozenite/pull/43))
- **@rozenite/network-activity-plugin:** This pull request adds the ability to copy subtrees and primitive values in JsonTree component. ([#42](https://github.com/callstackincubator/rozenite/pull/42))
- **@rozenite/plugin-bridge:** This pull request fixes an issue where promises started in message handlers were significantly delayed, sometimes by nearly 10 seconds. The exact cause is unknown, but I suspect it’s related to them originating from the 'execute code' action on the DevTools side. A similar issue was previously observed during domain initialization. The same fix has been applied, and it appears to be working correctly now. ([#38](https://github.com/callstackincubator/rozenite/pull/38))
- **@rozenite/runtime:** Introduce a welcome screen as the default view for users. This enhancement provides clear visual confirmation that Rozenite has loaded successfully. ([#30](https://github.com/callstackincubator/rozenite/pull/30))
- **@rozenite/vite-plugin:** Server-side events are now supported in the Network Activity plugin. As long as you have react-native-sse installed in your project, the plugin will detect the connection and intercept all events, displaying them in the DevTools UI. A small change has been made to the @rozenite/vite-plugin, allowing the use of the manualChunks property when building the React Native bundle. ([#45](https://github.com/callstackincubator/rozenite/pull/45))

### ❤️ Thank You

- Nepein Andrey @NepeinAV
- Szymon Chmal

## 1.0.0-alpha.8 (2025-08-05)

### 🩹 Fixes

- **@rozenite/network-activity-plugin:** # fix(network-activity-plugin): properly extract response content type ([](https://github.com/callstackincubator/rozenite/commit/))

  Fixed the extraction of the response content type from headers. The issue was that headers are case-insensitive, and servers can send them in any format.
- **@rozenite/network-activity-plugin:** # fix(network-activity-plugin): make scrolling work in response tab ([](https://github.com/callstackincubator/rozenite/commit/))

  This pull request fixes the issue of scrolling not working in the response tab.
- **@rozenite/redux-devtools-plugin:** # feat(redux-devtools-plugin): support remote connections ([](https://github.com/callstackincubator/rozenite/commit/))

  This pull request enables Rozenite's Redux DevTools plugin to work with remote devices. Until now, it could only connect to local emulators, as the hostname was hardcoded to the loopback interface. From now on, the plugin will inherit the hostname of the dev server, making it possible to connect to Redux DevTools from remote devices.
- **@rozenite/runtime:** # feat(runtime): persist panel state on detach ([](https://github.com/callstackincubator/rozenite/commit/))

  Custom panels are now persisted, so the user can switch tools without losing progress in the previous one. In case of any performance issues, the user can opt out of this mechanism, forcing the plugin to close on blur.

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