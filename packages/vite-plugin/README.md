![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Vite plugin for developing React Native DevTools plugins with hot reload and development tools.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Vite Plugin provides a complete development environment for React Native DevTools plugins. It handles multiple build targets (client panels and React Native entry points), provides hot reload during development, and generates optimized production builds with proper manifest files.

## Features

- **Multi-Target Building**: Build for client panels and React Native
- **Hot Reload Development**: Instant updates during plugin development
- **React Native Web Support**: Seamless React Native component development
- **Automatic Manifest Generation**: Creates `rozenite.json` manifest files
- **Panel HTML Generation**: Automatically generates HTML for plugin panels
- **TypeScript Support**: Full TypeScript support with type generation
- **Development Server**: Built-in development server with CORS support
- **Production Optimization**: Optimized builds for production deployment

## Installation

Install the Vite plugin as a development dependency:

```bash
npm install --save-dev @rozenite/vite-plugin
```

## Quick Start

### Basic Configuration

Add the Rozenite plugin to your Vite configuration:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';

export default defineConfig({
  plugins: rozenitePlugin(),
});
```

## Build Targets

The Vite plugin automatically handles different build targets based on environment variables:

### Client Panels (Default)

For plugin panels that run in the browser:

```bash
# Build panels
npm run build
```

### React Native Entry Points

For React Native integration:

```bash
# Build React Native target
VITE_ROZENITE_TARGET=react-native npm run build
```

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/vite-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
