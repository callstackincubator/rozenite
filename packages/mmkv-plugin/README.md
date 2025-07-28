![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that provides comprehensive MMKV storage inspection for React Native applications.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite MMKV Plugin provides real-time storage inspection, data visualization, and management capabilities for MMKV instances within your React Native DevTools environment.

## Features

- **Real-time Storage Inspection**: View all MMKV instances and their contents in real-time
- **Multi-Instance Support**: Manage and inspect multiple MMKV instances simultaneously
- **Data Type Detection**: Automatically detects and displays different data types (string, number, boolean, buffer)
- **Search & Filter**: Quickly find specific keys with real-time search functionality
- **Visual Data Representation**: Color-coded type indicators and formatted value display

## Installation

Install the MMKV plugin as a dependency:

```bash
npm install @rozenite/mmkv-plugin
```

**Note**: This plugin requires `react-native-mmkv` as a peer dependency. Make sure you have it installed:

```bash
npm install react-native-mmkv
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @rozenite/mmkv-plugin react-native-mmkv
```

### 2. Integrate with Your App

Add the DevTools hook to your React Native app:

```typescript
// App.tsx
import { useMMKVDevTools } from '@rozenite/mmkv-plugin';

function App() {
  // Enable MMKV DevTools in development
  useMMKVDevTools();

  return <YourApp />;
}
```

### 3. Access DevTools

Start your development server and open React Native DevTools. You'll find the "MMKV Storage" panel in the DevTools interface.

## Usage

The MMKV plugin automatically detects all MMKV instances in your app and provides:

- **Instance Selection**: Choose which MMKV instance to inspect from a dropdown
- **Key-Value Display**: View all stored keys with their types and values
- **Search Functionality**: Filter entries by key name
- **Type Indicators**: Visual indicators for different data types (string, number, boolean, buffer)
- **Real-time Updates**: See changes to your MMKV storage as they happen

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/mmkv-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
