![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that integrates Expo Atlas into React Native DevTools for enhanced development experience.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Expo Atlas Plugin seamlessly integrates Expo Atlas into your React Native DevTools environment. It provides a dedicated panel for accessing Expo Atlas features, including asset management, dependency analysis, and project insights, all within the familiar DevTools interface.

## Features

- **Expo Atlas Integration**: Direct access to Expo Atlas features within DevTools
- **Asset Management**: Visual asset browser and management tools
- **Dependency Analysis**: Comprehensive dependency tree visualization
- **Project Insights**: Detailed project structure and configuration analysis

## Installation

Install the Expo Atlas plugin as a dependency:

```bash
npm install @rozenite/expo-atlas-plugin
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @rozenite/expo-atlas-plugin
```

### 2. Configure Metro

Add the Expo Atlas plugin to your Metro configuration:

```javascript
// metro.config.js
import { withRozenite } from '@rozenite/metro';
import { withRozeniteExpoAtlasPlugin } from '@rozenite/expo-atlas-plugin';

export default withRozenite(
  withRozeniteExpoAtlasPlugin({
    // Your existing Metro configuration
  })
);
```

### 3. Access Expo Atlas

Start your development server and open React Native DevTools. You'll find the "Expo Atlas" panel in the DevTools interface.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/expo-atlas-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
