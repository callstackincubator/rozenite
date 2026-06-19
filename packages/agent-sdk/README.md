![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A TypeScript SDK for driving Rozenite Agent sessions and tools programmatically.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

`@rozenite/agent-sdk` provides a programmatic interface for the same agent workflow exposed by the `rozenite agent` CLI. The default API is automation-first: open or scope a session, inspect domains from the session handle, and call tools from the session handle.

## Features

- **Automation-First Client**: Use `withSession(...)` for the default lifecycle
- **Explicit Session Handles**: Use `openSession()` / `attachSession()` when you need manual control
- **Domain Resolution**: Discover static and runtime plugin domains from session tools
- **Tool Resolution**: Call tools by name or via typed descriptors
- **Auto Pagination**: Merge paged tool responses when requested

## Installation

Install the SDK as a dependency:

```bash
npm install @rozenite/agent-sdk
```

## Usage

```typescript
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();
const result = await client.withSession(async (session) => {
  const domains = await session.domains.list();
  const tools = await session.tools.list({
    domain: 'network',
  });

  const requests = await session.tools.call({
    domain: 'network',
    tool: 'listRequests',
    args: { limit: 20 },
    autoPaginate: { pagesLimit: 2 },
  });

  return { domains, tools, requests };
});

console.log(result);
```

## Made with ❤️ at Callstack

`rozenite` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=rozenite&utm_term=readme-with-love
[license-badge]: https://img.shields.io/npm/l/@rozenite/agent-sdk?style=for-the-badge
[license]: https://github.com/callstackincubator/rozenite/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@rozenite/agent-sdk?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@rozenite/agent-sdk
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
