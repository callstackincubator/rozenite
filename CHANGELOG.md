## 1.0.0-alpha.15 (2025-09-29)

### 🩹 Fixes

- The minimal Node.js version has been downgraded from 22 to 20. This change will allow more projects to benefit from Rozenite without sacrificing any existing features. ([#114](https://github.com/callstackincubator/rozenite/pull/114))
- **@rozenite/metro:** Metro 0.83.2 no longer supports configs as Promises, so Rozenite must provide a workaround by returning an async function instead of a Promise. This change restores the ability to bundle JavaScript when using React Native 0.81. ([#113](https://github.com/callstackincubator/rozenite/pull/113))

### ❤️ Thank You

- Szymon Chmal

## 1.0.0-alpha.14 (2025-09-15)

### 🩹 Fixes

- **@rozenite/repack:** Re.Pack now also includes the 'enabled' property, just like Metro. ([#107](https://github.com/callstackincubator/rozenite/pull/107))
- **rozenite:** The 'init' command will now generate code with the 'enabled' property bound to the WITH_ROZENITE environment variable. ([#108](https://github.com/callstackincubator/rozenite/pull/108))

### ❤️ Thank You

- Szymon Chmal

## 1.0.0-alpha.13 (2025-09-15)

### 🩹 Fixes

- **@rozenite/metro:** Rozenite will no longer apply plugins during app bundling initiated by Xcode. ([#92](https://github.com/callstackincubator/rozenite/pull/92))
- **@rozenite/metro:** Unfortunately, the React Native ecosystem is so diverse that it's difficult to keep up with all the ways Metro is invoked by the React Native CLI and Expo. Instead of constantly chasing edge cases and adding new scripts to the "probably bundling" list, users will now be able to conditionally enable Rozenite in development by providing the enabled option. This option can be set via an environment variable - for example, if ROZENITE_ENABLED is set, the option will be true. This change will significantly reduce maintenance overhead and make Rozenite even more versatile. ([#100](https://github.com/callstackincubator/rozenite/pull/100))
- **@rozenite/mmkv-plugin:** The table is now vertically scrollable when it's needed. ([#94](https://github.com/callstackincubator/rozenite/pull/94))
- **@rozenite/network-activity-plugin:** Added "copy as fetch" functionality to the network activity plugin with a unified dropdown interface for copying HTTP requests as both fetch() calls and cURL commands. ([#75](https://github.com/callstackincubator/rozenite/pull/75))
- **@rozenite/network-activity-plugin:** Add explicit UI handling for multipart FormData and binary request bodies. ([#103](https://github.com/callstackincubator/rozenite/pull/103))
- **@rozenite/network-activity-plugin:** SSE will no longer throw errors when EventSource is initialized before the plugin. ([#104](https://github.com/callstackincubator/rozenite/pull/104))
- **@rozenite/react-navigation-plugin:** A new plugin that allows you to inspect the React Navigation state and view navigation actions in real time. ([#98](https://github.com/callstackincubator/rozenite/pull/98))
- **@rozenite/repack:** Rozenite will now check if a compatible version of Re.Pack is present. ([#95](https://github.com/callstackincubator/rozenite/pull/95))
- **rozenite:** Rozenite will now modify both Metro and Re.Pack configurations if they are present. ([#91](https://github.com/callstackincubator/rozenite/pull/91))

### ❤️ Thank You

- Jayson Martinez @Jheysoon
- Matteo Pietro Dazzi
- Nepein Andrey @NepeinAV
- Szymon Chmal

## 1.0.0-alpha.12 (2025-08-25)

### 🩹 Fixes

- **@rozenite/metro:** It's now possible to set the log level of the internal Rozenite logger, which will propagate to all official plugins and be applied whenever it is possible to set the logging level for third-party libraries. ([#77](https://github.com/callstackincubator/rozenite/pull/77))
- **@rozenite/middleware:** It's now possible to set the log level of the internal Rozenite logger, which will propagate to all official plugins and be applied whenever it is possible to set the logging level for third-party libraries. ([#77](https://github.com/callstackincubator/rozenite/pull/77))
- **@rozenite/mmkv-plugin:** MMKV plugin is now ready to be publicly available. It was updated to support all types of data, including binary blobs. You can also blacklist certain properties, if they for example, contain sensitive data or are huge and may harm performance. ([#80](https://github.com/callstackincubator/rozenite/pull/80))
- **@rozenite/network-activity-plugin:** Enhanced request inspection in Network Activity Plugin by displaying query parameters in a section within the Request tab. ([#58](https://github.com/callstackincubator/rozenite/pull/58))
- **@rozenite/network-activity-plugin:** Rewrites the cookie parser to properly handle React Native specific header logic and adds support for displaying multiple header values when they are arrays. The cookie parser now correctly parses Set-Cookie headers according to React Native's networking behavior, while the Headers tab can now display multiple values for headers that contain array data, improving the debugging experience for network requests with complex header structures. ([#61](https://github.com/callstackincubator/rozenite/pull/61))
- **@rozenite/network-activity-plugin:** Enhanced network activity plugin to properly handle JSON response types for both size calculation and body extraction. Added accurate UTF-8 byte measurements for all text-based responses. ([#69](https://github.com/callstackincubator/rozenite/pull/69))
- **@rozenite/network-activity-plugin:** You can now disable specific types of inspectors to ignore certain traffic. For example, if you don't want to monitor WebSockets, you can simply turn off the WebSocket inspector. ([#73](https://github.com/callstackincubator/rozenite/pull/73))
- **@rozenite/network-activity-plugin:** You can now view the full request path by hovering over the 'Name' cell. ([#80](https://github.com/callstackincubator/rozenite/pull/80))
- **@rozenite/network-activity-plugin:** This change addresses an issue where network responses with malformed or complex Content-Type headers (e.g., "application/json,text/plain,_/_" or "application/json; charset=utf-8") were not correctly identified as JSON. Previously, the system relied on an exact match for "application/json", leading to these responses being incorrectly displayed as binary content. ([#72](https://github.com/callstackincubator/rozenite/pull/72))

  By updating the content type checks to use `.startsWith('application/json')` and similar for other types, the plugin can now correctly parse and display JSON content. This change improves the debugging experience for real-world applications that may send non-standard Content-Type headers, bringing the behavior in line with other robust network logging tools like Chrome's network inspector.
- **@rozenite/plugin-bridge:** The useRozeniteDevToolsClient hook is reinitialized during the hot reload of the host component, and a new client should be created at that point. However, due to the persistent client cache, the previous client was reused instead. The issue arose because the useEffect cleanup function disposes of the client. When the same client was reused, no messages were received. ([#73](https://github.com/callstackincubator/rozenite/pull/73))
- **@rozenite/redux-devtools-plugin:** It's now possible to set the log level of the internal Rozenite logger, which will propagate to all official plugins and be applied whenever it is possible to set the logging level for third-party libraries. ([#77](https://github.com/callstackincubator/rozenite/pull/77))
- **@rozenite/repack:** It's now possible to set the log level of the internal Rozenite logger, which will propagate to all official plugins and be applied whenever it is possible to set the logging level for third-party libraries. ([#77](https://github.com/callstackincubator/rozenite/pull/77))
- **@rozenite/runtime:** Implements saving the currently selected panel in DevTools to automatically switch to the panel when opening DevTools again. ([#60](https://github.com/callstackincubator/rozenite/pull/60))
- **rozenite:** The new 'init' command can now be used to bootstrap an existing project by installing the correct package according to the bundler used and making the necessary modifications to the configuration. ([#76](https://github.com/callstackincubator/rozenite/pull/76))

### ❤️ Thank You

- Aliff Azfar @aliffazfar
- Nepein Andrey @NepeinAV
- Szymon Chmal

## 1.0.0-alpha.11 (2025-08-14)

### 🩹 Fixes

- **@rozenite/metro:** Introduces the 'enhanceMetroConfig 'configuration property, designed to apply Metro config plugins like Expo Atlas and Redux DevTools. Unlike the previous method, the function passed to this property won’t run during bundling, which helps prevent the Metro process from hanging indefinitely with certain plugins (such as Redux DevTools). ([#51](https://github.com/callstackincubator/rozenite/pull/51))
- **@rozenite/metro:** We are going to prevent any logic from being executed on both 'web' and 'server' environments. Additionally, there was a change needed in Metro to resolve missing WebSocketInterceptor in react-native-web environment. ([#54](https://github.com/callstackincubator/rozenite/pull/54))
- **@rozenite/metro:** Rozenite won't be initialized when a bin alias is used to bundle/export. ([#56](https://github.com/callstackincubator/rozenite/pull/56))
- **@rozenite/middleware:** React Native 0.81 introduced changes to the HTML structure of the main entry point for the React Native DevTools. The Rozenite injection pattern was updated to inject itself even when the structure of the file changes. ([#63](https://github.com/callstackincubator/rozenite/pull/63))
- **@rozenite/mmkv-plugin:** We are going to prevent any logic from being executed on both 'web' and 'server' environments. Additionally, there was a change needed in Metro to resolve missing WebSocketInterceptor in react-native-web environment. ([#54](https://github.com/callstackincubator/rozenite/pull/54))
- **@rozenite/network-activity-plugin:** Custom events emitted by EventSource connections will now be properly recognized and shown in the DevTools UI. ([#52](https://github.com/callstackincubator/rozenite/pull/52))
- **@rozenite/network-activity-plugin:** You can now filter network requests by URL, method, or status, as well as by type (XHR, WS, SSR). ([#53](https://github.com/callstackincubator/rozenite/pull/53), [#46](https://github.com/callstackincubator/rozenite/issues/46))
- **@rozenite/network-activity-plugin:** Introduce "Copy as cURL" feature to the Network Activity Plugin, enabling developers to easily copy any HTTP request as a cURL command for debugging purposes in terminal. The implementation includes comprehensive support for different request body types (JSON, FormData, binary data) with proper shell escaping, React Native-specific handling for FormData and Blob objects, and content-type inference. ([#24](https://github.com/callstackincubator/rozenite/pull/24))
- **@rozenite/network-activity-plugin:** We are going to prevent any logic from being executed on both 'web' and 'server' environments. Additionally, there was a change needed in Metro to resolve missing WebSocketInterceptor in react-native-web environment. ([#54](https://github.com/callstackincubator/rozenite/pull/54))
- **@rozenite/network-activity-plugin:** Resolved an issue in the Network Activity Plugin (204 requests). The issue was caused by receiving a response with status code 204 and no content. The original code attempted to check the .size property on a null object. ([#48](https://github.com/callstackincubator/rozenite/pull/48))
- **@rozenite/network-activity-plugin:** Fixes content overflow issues in the Headers tab by implementing a proper grid layout with responsive columns and text wrapping. The Headers tab now uses reusable KeyValueGrid and Section components that prevent long URLs and header values from overflowing the container boundaries, ensuring better readability and UI consistency. ([#44](https://github.com/callstackincubator/rozenite/pull/44))
- **@rozenite/performance-monitor-plugin:** This brand-new plugin can capture react-native-performance data (marks, metrics, and measures) and display them in a tabular format in your React Native DevTools. You can also export the data when needed for further analysis. ([#64](https://github.com/callstackincubator/rozenite/pull/64))
- **@rozenite/plugin-bridge:** The communication layer provided by React Native DevTools is not available on the web; therefore, we should not attempt to create a client when the 'web' platform is detected. Instead, a warning will be printed indicating that the platform is unsupported. ([#50](https://github.com/callstackincubator/rozenite/pull/50), [#21](https://github.com/callstackincubator/rozenite/issues/21))
- **@rozenite/redux-devtools-plugin:** We are going to prevent any logic from being executed on both 'web' and 'server' environments. Additionally, there was a change needed in Metro to resolve missing WebSocketInterceptor in react-native-web environment. ([#54](https://github.com/callstackincubator/rozenite/pull/54))
- **@rozenite/tanstack-query-plugin:** We are going to prevent any logic from being executed on both 'web' and 'server' environments. Additionally, there was a change needed in Metro to resolve missing WebSocketInterceptor in react-native-web environment. ([#54](https://github.com/callstackincubator/rozenite/pull/54))

### ❤️ Thank You

- Nepein Andrey @NepeinAV
- Szymon Chmal
- zmtmaster @zmtmaster

## 1.0.0-alpha.10 (2025-08-08)

### 🩹 Fixes

- **@rozenite/middleware:** Enhanced project type detection heuristics for React Native CLI vs Expo projects. For cases where automatic detection fails, you can now explicitly specify the project type using the 'projectType' option to override Rozenite's detection. ([d7131ec](https://github.com/callstackincubator/rozenite/commit/d7131ec))

### ❤️ Thank You

- Szymon Chmal @V3RON

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