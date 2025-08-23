![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that provides comprehensive AsyncStorage inspection for React Native applications.

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md)
[![MIT License](https://img.shields.io/npm/l/rozenite?style=for-the-badge)](https://github.com/callstackincubator/rozenite/blob/main/LICENSE)

The Rozenite AsyncStorage Plugin provides real-time storage inspection, data visualization, and management capabilities for AsyncStorage within your React Native DevTools environment.

## Features

- **Real-time Storage Inspection**: View all AsyncStorage entries and their contents in real-time
- **Data Type Detection**: Automatically detects and displays different data types (string, number, boolean, object, array)
- **Search & Filter**: Quickly find specific keys or values with real-time search functionality
- **Data Management**: Add, edit, and delete entries directly from the DevTools interface
- **Visual Data Representation**: Color-coded type indicators and formatted value display

## Installation

Install the AsyncStorage plugin as a dependency:

```bash
npm install @rozenite/async-storage-plugin
```

**Note**: This plugin requires `@react-native-async-storage/async-storage` as a peer dependency. Make sure you have it installed:

```bash
npm install @react-native-async-storage/async-storage
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @rozenite/async-storage-plugin @react-native-async-storage/async-storage
```

### 2. Integrate with Your App

Add the DevTools hook to your React Native app:

```typescript
// App.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAsyncStorageDevTools } from '@rozenite/async-storage-plugin';

function App() {
  // Enable AsyncStorage DevTools in development
  useAsyncStorageDevTools(AsyncStorage);

  return <YourApp />;
}
```

### 3. Access DevTools

Start your development server and open React Native DevTools. You'll find the "AsyncStorage" panel in the DevTools interface.

## Usage

The AsyncStorage plugin automatically connects to your app's AsyncStorage instance and provides:

- **Storage Inspection**: View all stored keys with their types and values
- **Search Functionality**: Filter entries by key or value
- **Type Indicators**: Visual indicators for different data types (string, number, boolean, object, array)
- **Real-time Updates**: See changes to your AsyncStorage as they happen
- **Data Management**: Add, edit, and delete entries directly from the DevTools interface

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack](https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love) is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!
