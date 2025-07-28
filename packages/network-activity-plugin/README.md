![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that provides comprehensive network activity monitoring for React Native applications.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Network Activity Plugin provides real-time network request monitoring, detailed request/response inspection within your React Native DevTools environment. It offers comprehensive network debugging capabilities similar to browser DevTools Network panel.

## Features

- **Real-time Network Monitoring**: Track all HTTP/HTTPS requests in real-time
- **Request Details**: View request headers, method, URL, and timing information
- **Response Inspection**: Examine response headers, status codes, and timing data
- **Performance Analysis**: Analyze request duration, connection timing, and performance metrics
- **Request History**: Maintain a searchable history of network activity
- **Chrome DevTools Protocol**: Built on CDP for accurate network event capture
- **Production Safety**: Automatically disabled in production builds

## Installation

Install the Network Activity plugin as a dependency:

```bash
npm install @rozenite/network-activity-plugin
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @rozenite/network-activity-plugin
```

### 2. Integrate with Your App

Add the DevTools hook to your React Native app:

```typescript
// App.tsx
import { useNetworkActivityDevTools } from '@rozenite/network-activity-plugin';

function App() {
  // Enable Network Activity DevTools in development
  useNetworkActivityDevTools();

  return <YourApp />;
}
```

### 3. Access DevTools

Start your development server and open React Native DevTools. You'll find the "Network Activity" panel in the DevTools interface.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/network-activity-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
