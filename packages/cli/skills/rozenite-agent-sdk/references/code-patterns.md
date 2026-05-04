# Code Patterns

Use these patterns as starting points for SDK-based Rozenite agent work.

## Default Session Lifecycle

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();

const result = await client.withSession(async (session) => {
  const domains = await session.domains.list();

  return {
    sessionId: session.id,
    domains: domains.map((domain) => domain.id),
  };
});
```

Use this for most scripts. `withSession(...)` opens the session, runs your work, and closes the session automatically.

## Typed Plugin Call

```ts
import { createAgentClient } from '@rozenite/agent-sdk';
import { storageTools } from '@rozenite/storage-plugin/sdk';

const client = createAgentClient();

const result = await client.withSession(async (session) => {
  return await session.tools.call(storageTools.readEntry, {
    adapterId: 'mmkv',
    storageId: 'user-storage',
    key: 'username',
  });
});
```

Prefer typed descriptors like this when an official plugin exports them from `./sdk` and the current package can actually resolve that dependency.

Official agent-enabled plugin SDK entrypoints include:

- `@rozenite/controls-plugin/sdk`
- `@rozenite/file-system-plugin/sdk`
- `@rozenite/mmkv-plugin/sdk`
- `@rozenite/network-activity-plugin/sdk`
- `@rozenite/react-navigation-plugin/sdk`
- `@rozenite/redux-devtools-plugin/sdk`
- `@rozenite/storage-plugin/sdk`
- `@rozenite/tanstack-query-plugin/sdk`

## Inspecting Domains And Tools

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();

const result = await client.withSession(async (session) => {
  const tools = await session.tools.list({
    domain: 'network',
  });
  const schema = await session.tools.getSchema({
    domain: 'network',
    tool: 'listRequests',
  });

  return {
    toolNames: tools.map((tool) => tool.shortName),
    listRequestsInput: schema.inputSchema,
  };
});
```

Use this when you need to see what a domain exposes before you decide which tool to call.

## Call by Name Fallback

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();

const requests = await client.withSession(async (session) => {
  return await session.tools.call<
    { limit: number },
    { items: Array<{ id: string }> }
  >({
    domain: 'network',
    tool: 'listRequests',
    args: { limit: 20 },
  });
});
```

Use this when the package does not expose a matching descriptor, or when you already know the domain and tool name.

## Discover Then Call by Name

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();

const storages = await client.withSession(async (session) => {
  const tools = await session.tools.list({
    domain: '@rozenite/storage-plugin',
  });
  const listStorages = tools.find((tool) => tool.shortName === 'list-storages');

  if (!listStorages) {
    throw new Error('Storage plugin did not expose list-storages.');
  }

  return await session.tools.call({
    domain: '@rozenite/storage-plugin',
    tool: listStorages.shortName,
    args: {},
  });
});
```

When you discover tools at runtime, use the returned `shortName` exactly as-is. Do not guess camelCase or other aliases.

## Pagination

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();

const requests = await client.withSession(async (session) => {
  return await session.tools.call<
    { limit: number },
    { items: Array<{ id: string }> }
  >({
    domain: 'network',
    tool: 'listRequests',
    args: { limit: 50 },
    autoPaginate: { pagesLimit: 3, maxItems: 100 },
  });
});
```

Use this when a tool returns paged results and you want the SDK to follow cursors and merge pages for you.

## Typed Plugin Fallback Network Call

```ts
import { createAgentClient } from '@rozenite/agent-sdk';
import { networkActivityTools } from '@rozenite/network-activity-plugin/sdk';

const client = createAgentClient();

const requests = await client.withSession(async (session) => {
  return await session.tools.call(networkActivityTools.listRequests, {
    limit: 20,
  });
});
```

Use this when the built-in `network` domain is unavailable and the app exposes the network activity plugin instead.

## Target Handoff

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();
const deviceId = 'device-id-from-rozenite-agent';

const result = await client.withSession(
  { deviceId },
  async (session) => {
    return {
      sessionId: session.id,
      deviceId: session.info.deviceId,
    };
  },
);
```

When more than one simulator, emulator, or device may be connected, use the `rozenite-agent` skill to enumerate and choose the live target first. Then pass the chosen `deviceId` into the SDK flow instead of duplicating target-discovery logic here.

## Advanced: Manual Session Lifecycle

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();
const session = await client.openSession();

try {
  const domains = await session.domains.list();
  console.log(domains.map((domain) => domain.id));
} finally {
  await session.stop();
}
```

Use this only when the session must survive across separate steps or function boundaries. Prefer `withSession(...)` for everything else.

## Advanced: Attach Existing Session

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();
const session = await client.attachSession('session-1');

const result = await session.domains.list();
```

Use this when another step already created a session and you need to reconnect to it by `sessionId`. Prefer `withSession(...)` when you can keep the whole task in one callback.

## Lazy Plugin Refresh

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();

const storageDomain = await client.withSession(async (session) => {
  await session.tools.call({
    domain: '@rozenite/react-navigation-plugin',
    tool: 'navigate',
    args: { name: 'StoragePlugin' },
  });

  const domains = await session.domains.list();
  return domains.find(
    (domain) => domain.pluginId === '@rozenite/storage-plugin',
  );
});
```

Navigate first when a plugin only mounts on a specific screen, then refresh the live domain list before using the newly mounted plugin.
