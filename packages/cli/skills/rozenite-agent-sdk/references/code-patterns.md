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

## Call by Name

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

Use this when you already know the domain and tool name, or when you just discovered them with `session.tools.list(...)`.

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

Prefer typed descriptors like this when a plugin exports them from `./sdk` and the current package can actually resolve that dependency.

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

## Target Selection

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();
const targets = await client.targets.list();

const result = await client.withSession(
  { deviceId: targets[0].id },
  async (session) => {
    return {
      sessionId: session.id,
      deviceId: session.info.deviceId,
    };
  },
);
```

Use this when more than one simulator, emulator, or device may be connected.

## Manual Session Lifecycle

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

Use this only when the session must survive across separate steps or function boundaries.

## Attach Existing Session

```ts
import { createAgentClient } from '@rozenite/agent-sdk';

const client = createAgentClient();
const session = await client.attachSession('session-1');

const result = await session.domains.list();
```

Use this when another step already created a session and you need to reconnect to it by `sessionId`.

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
