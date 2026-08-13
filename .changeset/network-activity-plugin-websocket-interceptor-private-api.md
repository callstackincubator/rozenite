---
'@rozenite/network-activity-plugin': patch
---

Replace the private `react-native/Libraries/WebSocket/WebSocketInterceptor` import with a self-contained implementation built on the public `TurboModuleRegistry` and `NativeEventEmitter` APIs, so the plugin no longer depends on React Native's internal module paths (compatible with [Strict TypeScript API](https://reactnative.dev/docs/strict-typescript-api)).
