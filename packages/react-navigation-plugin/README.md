![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that provides comprehensive React Navigation debugging and inspection for React Native applications.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite React Navigation Plugin provides real-time navigation state monitoring, action timeline inspection, and deep linking testing within your React Native DevTools environment. It offers comprehensive navigation debugging capabilities for React Navigation v7.

![React Navigation Plugin](https://rozenite.dev/react-navigation-plugin.png)

## Features

- **Action Timeline**: Track all navigation actions in real-time with detailed history
- **State Inspection**: View and analyze navigation state at any point in time
- **Time Travel Debugging**: Jump back to any previous navigation state
- **Deep Link Testing**: Test and validate deep links directly from DevTools
- **Real-time Updates**: See navigation changes as they happen in your app
- **Production Safety**: Automatically disabled in production builds

## Installation

Install the React Navigation plugin as a dependency:

```bash
npm install @rozenite/react-navigation-plugin
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @rozenite/react-navigation-plugin
```

### 2. Integrate with Your App

Add the DevTools hook to your React Native app with a reference to your NavigationContainer:

```typescript
// App.tsx
import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';

function App() {
  const navigationRef = useRef(null);

  // Enable React Navigation DevTools in development
  useReactNavigationDevTools({ ref: navigationRef });

  return (
    <NavigationContainer ref={navigationRef}>
      <YourAppNavigator />
    </NavigationContainer>
  );
}
```

### 3. Access DevTools

Start your development server and open React Native DevTools. You'll find the "React Navigation" panel in the DevTools interface.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/react-navigation-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
