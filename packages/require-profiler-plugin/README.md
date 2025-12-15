![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that instruments require() calls to profile module initialization times in React Native applications.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Require Profiler Plugin instruments `require()` calls in your React Native app to track module initialization times. It helps you identify which modules take the longest to initialize and which are great candidates for lazy evaluation later in the app lifetime.

## Features

- **Module Initialization Profiling**: Automatically instruments all `require()` calls to track initialization times
- **Flame Graph Visualization**: Interactive flame graph showing the module dependency tree with timing information
- **Performance Insights**: Identify slow-loading modules that impact app startup time
- **Lazy Loading Candidates**: Discover modules that are good candidates for lazy evaluation
- **Dependency Analysis**: Visualize the complete module dependency graph with timing data
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

### Identifying Slow Modules

The flame graph makes it easy to spot modules that take a long time to initialize. Look for:
- **Red modules** (>70% of max time) - These are your slowest modules
- **Wide modules** - Modules that take up a lot of horizontal space in the graph
- **Deep dependency chains** - Modules that load many dependencies

### Finding Lazy Loading Candidates

Modules that are good candidates for lazy loading typically:
- Take significant time to initialize (>100ms)
- Are not needed immediately at app startup
- Have many dependencies that could be deferred

Use the profiler to identify these modules and consider converting them to lazy-loaded imports:

```typescript
// Instead of:
import HeavyModule from './HeavyModule';

// Consider:
const HeavyModule = lazy(() => import('./HeavyModule'));
```

### Optimizing App Startup

By identifying and optimizing slow-loading modules, you can:
- Reduce initial bundle size
- Improve Time to Interactive (TTI)
- Defer non-critical module initialization
- Optimize dependency chains

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
