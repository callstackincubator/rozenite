![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that instruments require() calls to profile initial app loading performance in React Native applications.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Require Profiler Plugin instruments `require()` calls during your React Native app's initial loading to track module initialization times. It helps you identify which modules impact app startup performance and optimize your initial bundle loading.

![Require Profiler Plugin](https://rozenite.dev/require-profiler-plugin.png)

## Features

- **Initial App Loading Profiling**: Automatically instruments `require()` calls during app startup to track initialization times
- **Flame Graph Visualization**: Interactive flame graph showing the module dependency tree with timing information
- **Startup Performance Insights**: Identify slow-loading modules that impact Time to Interactive (TTI)
- **Bundle Optimization Candidates**: Discover modules that are good candidates for code splitting or lazy loading
- **Dependency Analysis**: Visualize the complete module dependency graph loaded during initial app startup
- **Real-time Metrics**: View total initialization time, module count, and per-module evaluation times

## Installation

Install the Require Profiler plugin as a dependency:

```bash
npm install @rozenite/require-profiler-plugin
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @rozenite/require-profiler-plugin
```

### 2. Configure Metro

Add the require profiler instrumentation to your Metro configuration using the `enhanceMetroConfig` option in `withRozenite`:

```javascript
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withRozenite } = require('@rozenite/metro');
const { withRozeniteRequireProfiler } = require('@rozenite/require-profiler-plugin/metro');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = withRozenite(
  mergeConfig(defaultConfig, {
    // Your existing Metro configuration
  }),
  {
    enabled: process.env.WITH_ROZENITE === 'true',
    enhanceMetroConfig: (config) => withRozeniteRequireProfiler(config),
  }
);
```

### 3. Integrate with Your App

Add the DevTools hook to your React Native app:

```typescript
// App.tsx
import { useRequireProfilerDevTools } from '@rozenite/require-profiler-plugin';

function App() {
  // Enable Require Profiler DevTools
  useRequireProfilerDevTools();

  return <YourApp />;
}
```

### 4. Access DevTools

Start your development server and open React Native DevTools. You'll find the "Metro Require Profiler" panel in the DevTools interface.

## Usage

Once configured, the plugin automatically instruments all `require()` calls in your app and provides:

- **Flame Graph**: Interactive visualization of your module dependency tree
  - Color-coded by initialization time (red = slow, blue = fast)
  - Click to zoom into specific modules
  - View module details in the sidebar
- **Module Details**: Click any module in the flame graph to see:
  - Evaluation time (how long the module took to initialize)
  - Module name and full path
  - Direct dependencies count
- **Performance Metrics**: 
  - Total initialization time across all modules
  - Total number of modules loaded
  - Entry point module information

## Use Cases

### Identifying Slow Startup Modules

The flame graph makes it easy to spot modules that take a long time to initialize during app startup. Look for:
- **Red modules** (>70% of max time) - These are your slowest modules impacting startup
- **Wide modules** - Modules that take up a lot of horizontal space in the graph
- **Deep dependency chains** - Modules that load many dependencies during initial load

### Finding Bundle Optimization Candidates

Modules that are good candidates for optimization typically:
- Take significant time to initialize (>100ms) during startup
- Are not needed immediately for the initial app experience
- Have many dependencies that could be deferred

Use the profiler to identify these modules and consider optimization strategies:

```typescript
// Instead of loading heavy modules at startup:
import HeavyModule from './HeavyModule';

// Consider lazy loading or code splitting:
const HeavyModule = lazy(() => import('./HeavyModule'));

// Or move to conditional/dynamic imports:
if (condition) {
  const HeavyModule = await import('./HeavyModule');
}
```

### Optimizing App Startup Performance

By identifying and optimizing slow-loading modules, you can:
- Reduce initial bundle size and loading time
- Improve Time to Interactive (TTI) metrics
- Prioritize critical modules for immediate loading
- Optimize dependency chains for faster startup

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/require-profiler-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
