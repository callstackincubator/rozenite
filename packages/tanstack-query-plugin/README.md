![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A Rozenite plugin that integrates TanStack Query DevTools into React Native DevTools for enhanced query debugging and management.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite TanStack Query Plugin provides a seamless integration of TanStack Query DevTools into your React Native DevTools environment. It offers real-time query monitoring, cache management, and debugging capabilities, all within the familiar DevTools interface.

![TanStack Query Plugin](https://rozenite.dev/tanstack-query-plugin.png)

## Features

- **Query Monitoring**: Real-time monitoring of all queries and mutations
- **Cache Management**: Visual cache inspection and management tools
- **Query Actions**: Refetch, invalidate, reset, and remove queries
- **State Manipulation**: Trigger loading states and error conditions for testing
- **Mutation Tracking**: Monitor mutation states and progress
- **Bidirectional Communication**: Real-time sync between device and DevTools
- **Production Safety**: Automatically disabled in production builds

## Installation

Install the TanStack Query plugin as a dependency:

```bash
npm install @rozenite/tanstack-query-plugin
```

## Quick Start

### 1. Install the Plugin

```bash
npm install @rozenite/tanstack-query-plugin
```

### 2. Integrate with Your Query Client

Add the DevTools hook to your React Native app:

```typescript
// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin';

const queryClient = new QueryClient();

function App() {
  // Enable DevTools in development
  useTanStackQueryDevTools(queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app components */}
    </QueryClientProvider>
  );
}
```

### 3. Access DevTools

Start your development server and open React Native DevTools. You'll find the "TanStack Query" panel in the DevTools interface.

## Usage

### Basic Integration

The plugin automatically integrates with your existing TanStack Query setup:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  // DevTools are automatically enabled in development
  useTanStackQueryDevTools(queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/rozenite?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/rozenite?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/tanstack-query-plugin
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
