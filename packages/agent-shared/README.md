![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### Shared Agent types and message contracts for Rozenite packages.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/agent-shared` contains the shared type definitions used by Rozenite Agent packages. It defines the Agent tool shape, the message protocol for registering and calling tools, and the shared `AGENT_PLUGIN_ID` constant used by the bridge packages.

## Features

- **Shared Tool Types**: Common `AgentTool` and JSON-schema-like input types
- **Message Contracts**: Typed payloads for register, unregister, call, and result messages
- **Single Protocol Constant**: Shared `AGENT_PLUGIN_ID` for the Agent transport
- **Package Reuse**: Intended for bridge and runtime packages that implement Agent support

## Installation

Install the shared package as a dependency:

```bash
npm install @rozenite/agent-shared
```

## Exports

This package exports:

- `AGENT_PLUGIN_ID`
- `AgentTool`
- `JSONSchema7`
- `DevToolsPluginMessage`
- `RegisterToolPayload`
- `UnregisterToolPayload`
- `ToolCallPayload`
- `ToolResultPayload`
- `RegisterToolMessage`
- `UnregisterToolMessage`
- `ToolCallMessage`
- `ToolResultMessage`
- `AgentMessage`

## Usage

```typescript
import {
  AGENT_PLUGIN_ID,
  type AgentTool,
  type ToolCallMessage,
} from '@rozenite/agent-shared';

const tool: AgentTool = {
  name: 'example.echo',
  description: 'Echo a value back to the caller.',
  inputSchema: {
    type: 'object',
    properties: {
      value: { type: 'string' },
    },
    required: ['value'],
  },
};

console.log(AGENT_PLUGIN_ID);
```

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/@rozenite/agent-shared?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/agent-shared?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/agent-shared
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
