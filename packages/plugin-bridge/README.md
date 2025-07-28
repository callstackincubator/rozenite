![rozenite-banner](https://www.rozenite.dev/rozenite-banner.jpg)

### A communication layer for React Native DevTools plugins across React Native and web environments.

[![mit licence][license-badge]][license] [![npm downloads][npm-downloads-badge]][npm-downloads] [![Chat][chat-badge]][chat] [![PRs Welcome][prs-welcome-badge]][prs-welcome]

The Rozenite Plugin Bridge provides an isomorphic communication layer that enables seamless message passing between React Native DevTools plugins running in different environments. It abstracts the complexity of Chrome DevTools Protocol (CDP) and browser messaging, providing a unified API for plugin communication.

## Features

- **Isomorphic Communication**: Works seamlessly across React Native and web environments
- **Type-Safe Messaging**: Full TypeScript support with generic event maps
- **React Integration**: React hooks for easy integration with React components
- **Message Routing**: Plugin-specific message routing and filtering
- **Connection Management**: Automatic connection handling and cleanup

## Installation

Install the plugin bridge as a dependency:

```bash
npm install @rozenite/plugin-bridge
```

## Quick Start

### Using the React Hook

```typescript
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';

// Define your event types
type MyEventMap = {
  'data-updated': { value: number };
  'status-changed': { status: 'connected' | 'disconnected' };
};

function MyPlugin() {
  const client = useRozeniteDevToolsClient<MyEventMap>({
    pluginId: 'my-plugin',
  });

  useEffect(() => {
    if (!client) return;

    // Listen for messages
    const subscription = client.onMessage('data-updated', (payload) => {
      console.log('Data updated:', payload.value);
    });

    // Send messages
    client.send('status-changed', { status: 'connected' });

    return () => subscription.remove();
  }, [client]);

  return <div>My Plugin</div>;
}
```

### Using the Client Directly

```typescript
import { getRozeniteDevToolsClient } from '@rozenite/plugin-bridge';

type MyEventMap = {
  'custom-event': { message: string };
};

async function setupClient() {
  const client = await getRozeniteDevToolsClient<MyEventMap>('my-plugin');

  // Send a message
  client.send('custom-event', { message: 'Hello from plugin!' });

  // Listen for messages
  const subscription = client.onMessage('custom-event', (payload) => {
    console.log('Received:', payload.message);
  });

  // Clean up when done
  subscription.remove();
  client.close();
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
[npm-downloads]: https://www.npmjs.com/package/@rozenite/plugin-bridge
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/callstackincubator/rozenite/blob/main/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/426714625279524876.svg?style=for-the-badge
[chat]: https://discord.gg/xgGt7KAjxv
