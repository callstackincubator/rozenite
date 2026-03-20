![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A React hook API for registering Rozenite Agent tools from React Native code.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Agent Bridge provides React hooks for exposing app-owned or plugin-owned tools to Rozenite for Agents. It builds on top of the Rozenite plugin bridge so React Native code can register tools, receive tool calls, and return structured results back to coding agents.

## Features

- **React Hooks**: Register Agent tools with hooks that fit naturally into React Native code
- **Plugin and App Domains**: Expose tools under a plugin domain or an app-owned custom domain
- **Structured Inputs**: Describe tool inputs with JSON-schema-like metadata
- **Automatic Lifecycle**: Register tools on mount and unregister them on cleanup
- **Type-Safe Messages**: Reuse shared Agent message and tool types across packages

## Installation

Install the agent bridge as a dependency:

```bash
npm install @rozenite/agent-bridge
```

## Quick Start

### Register a Plugin Tool

```typescript
import { useRozenitePluginAgentTool } from '@rozenite/agent-bridge';

function ExamplePlugin() {
  useRozenitePluginAgentTool({
    pluginId: '@example/plugin',
    tool: {
      name: 'echo',
      description: 'Return the provided value.',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
        required: ['value'],
      },
    },
    handler: ({ value }: { value: string }) => ({ value }),
  });

  return null;
}
```

### Register an In-App Custom Tool

```typescript
import { useRozeniteInAppAgentTool } from '@rozenite/agent-bridge';

function AppAgentTools() {
  useRozeniteInAppAgentTool({
    domain: 'app',
    tool: {
      name: 'get-build-info',
      description: 'Return app build metadata.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: () => ({
      version: '1.0.0',
      environment: 'development',
    }),
  });

  return null;
}
```

## Exports

- `useRozenitePluginAgentTool`
- `useRozeniteInAppAgentTool`
- Agent tool and message types re-exported from `@rozenite/agent-shared`

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/@rozenite/agent-bridge?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/agent-bridge?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/agent-bridge
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
