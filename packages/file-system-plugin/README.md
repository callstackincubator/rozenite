![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin for browsing app files and previewing file contents in React Native DevTools.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite File System Plugin provides an in-app file explorer for React Native DevTools. It lets you inspect common app directories, browse nested folders, and preview text and image files using either Expo FileSystem or an RNFS-compatible filesystem module.

## Features

- **Directory Browsing**: Inspect app document, cache, temporary, library, and bundle directories from DevTools
- **Provider Support**: Works with both Expo FileSystem and RNFS-compatible libraries
- **Text Preview**: Open text files directly in DevTools for quick inspection
- **Image Preview**: Preview image files inline without leaving the DevTools panel
- **Binary Fallback Preview**: Non-text files fall back to a hex-style preview for debugging
- **Large Directory Handling**: Expo directory reads are capped to keep very large folders responsive

## Installation

Install the file system plugin as a dependency:

```bash
npm install @rozenite/file-system-plugin
```

Install one supported filesystem provider in your app:

```bash
# Expo
npm install expo-file-system

# React Native
npm install @dr.pogodin/react-native-fs
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @rozenite/file-system-plugin
```

### 2. Integrate with Your App

#### With the adapter API

```typescript
import * as FileSystem from 'expo-file-system';
import {
  createExpoFileSystemAdapter,
  useFileSystemDevTools,
} from '@rozenite/file-system-plugin';

function App() {
  useFileSystemDevTools({
    adapter: createExpoFileSystemAdapter(FileSystem),
  });

  return <YourApp />;
}
```

#### With Expo FileSystem

```typescript
import * as FileSystem from 'expo-file-system';
import { useFileSystemDevTools } from '@rozenite/file-system-plugin';

function App() {
  useFileSystemDevTools({
    expoFileSystem: FileSystem,
  });

  return <YourApp />;
}
```

#### With RNFS

```typescript
import RNFS from '@dr.pogodin/react-native-fs';
import {
  createRNFSAdapter,
  useFileSystemDevTools,
} from '@rozenite/file-system-plugin';

function App() {
  useFileSystemDevTools({
    adapter: createRNFSAdapter(RNFS),
  });

  return <YourApp />;
}
```

#### Legacy shorthand still works

```typescript
import * as FileSystemLegacy from 'expo-file-system/legacy';

useFileSystemDevTools({ expoFileSystem: FileSystemLegacy });
useFileSystemDevTools({ rnfs: RNFS });
```

### 3. Access DevTools

Start your development server and open React Native DevTools. You’ll find the "File System" panel in the DevTools interface.

## Notes

- Pass exactly one filesystem source to `useFileSystemDevTools`.
- `adapter` takes precedence over the legacy `expoFileSystem` and `rnfs` options.
- `createExpoFileSystemAdapter` supports both the modern `expo-file-system` API and `expo-file-system/legacy`.
- Expo roots are discovered from `documentDirectory`, `cacheDirectory`, and `bundleDirectory` when available.
- RNFS roots include document, caches, temporary, library, and bundle paths when available.
- File previews are limited to avoid loading very large files into DevTools.
- Binary files are shown as a hex-style dump when text decoding is not possible.

## Agent Tools (LLM Integration)

When this plugin is active, it registers agent tools under the `@rozenite/file-system-plugin` domain. This lets coding agents inspect the app-accessible filesystem through Rozenite for Agents.

Available tools:

- `list-roots`: returns the active provider and the available root directories.
- `list-entries`: lists directory entries with pagination, without returning file contents.
- `read-entry`: returns metadata for a file or directory path.
- `read-text-file`: returns a text preview for a file, with binary fallback when decoding fails.
- `read-image-file`: returns an image preview as a data URI.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/file-system-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
