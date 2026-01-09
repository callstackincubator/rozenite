![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that provides customizable grid and image overlays for React Native applications.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Overlay Plugin provides customizable grid overlays and image comparison tools within your React Native DevTools environment. Perfect for design implementation, layout debugging, and visual comparison during development.

This plugin was inspired by [RocketSim](https://www.rocketsim.app/) - an enhanced iOS simulator.

![Overlay Plugin](https://rozenite.dev/overlay-plugin.png)

## Features

- **Grid Overlay**: Display customizable grid patterns over your app for precise layout alignment
- **Image Overlay**: Overlay reference images or designs for visual comparison
- **Slider Comparison**: Side-by-side image comparison with interactive slider control
- **Real-time Configuration**: Adjust grid size, color, opacity, and image settings in real-time
- **Multiple Resize Modes**: Support for contain, cover, stretch, and center image positioning
- **Clipboard Integration**: Paste images directly from clipboard for quick reference
- **Production Safety**: Automatically disabled in production builds

## Installation

Install the Overlay plugin and its peer dependency `react-native-svg`:

```bash
npm install @rozenite/overlay-plugin react-native-svg
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @rozenite/overlay-plugin react-native-svg
```

### 2. Integrate with Your App

Add the `RozeniteOverlay` component to your React Native app:

```typescript
// App.tsx
import { RozeniteOverlay } from '@rozenite/overlay-plugin';

function App() {
  return (
    <>
      <YourApp />
      <RozeniteOverlay />
    </>
  );
}
```

### 3. Access DevTools

Start your development server and open React Native DevTools. You'll find the "Overlay" panel in the DevTools interface.

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/overlay-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
