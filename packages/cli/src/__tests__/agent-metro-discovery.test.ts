import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { getMetroTargets, resolveMetroTarget } from '../commands/agent/metro-discovery.js';

const createServer = (body: unknown) => {
  const server = http.createServer((req, res) => {
    if (req.url !== '/json/list') {
      res.statusCode = 404;
      res.end();
      return;
    }

    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  });

  return new Promise<{ server: http.Server; port: number }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to bind test server');
      }

      resolve({ server, port: address.port });
    });
  });
};

describe('agent metro discovery', () => {
  let activeServer: http.Server | null = null;

  afterEach(async () => {
    if (!activeServer) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      activeServer?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    activeServer = null;
  });

  it('collapses pages into one target per device and prefers fusebox pages', async () => {
    const { server, port } = await createServer([
      {
        id: 'page-2',
        title: 'Fallback',
        description: 'fallback',
        appId: 'com.test',
        deviceName: 'Simulator',
        webSocketDebuggerUrl: 'ws://localhost/second',
        reactNative: {
          logicalDeviceId: 'device-1',
          capabilities: {
            prefersFuseboxFrontend: false,
          },
        },
      },
      {
        id: 'page-1',
        title: 'Fusebox',
        description: 'preferred',
        appId: 'com.test',
        deviceName: 'Simulator',
        webSocketDebuggerUrl: 'ws://localhost/first',
        reactNative: {
          logicalDeviceId: 'device-1',
          capabilities: {
            prefersFuseboxFrontend: true,
          },
        },
      },
    ]);
    activeServer = server;

    const targets = await getMetroTargets('127.0.0.1', port);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      id: 'device-1',
      pageId: 'page-1',
      title: 'Fusebox',
      webSocketDebuggerUrl: 'ws://localhost/first',
    });
  });

  it('requires an explicit device when multiple targets are present', async () => {
    const { server, port } = await createServer([
      {
        id: 'page-1',
        title: 'App 1',
        description: 'first',
        appId: 'com.first',
        deviceName: 'One',
        webSocketDebuggerUrl: 'ws://localhost/one',
        reactNative: {
          logicalDeviceId: 'device-1',
        },
      },
      {
        id: 'page-2',
        title: 'App 2',
        description: 'second',
        appId: 'com.second',
        deviceName: 'Two',
        webSocketDebuggerUrl: 'ws://localhost/two',
        reactNative: {
          logicalDeviceId: 'device-2',
        },
      },
    ]);
    activeServer = server;

    await expect(resolveMetroTarget('127.0.0.1', port)).rejects.toThrow(
      'Multiple connected devices detected',
    );
    await expect(resolveMetroTarget('127.0.0.1', port, 'device-2')).resolves.toMatchObject({
      id: 'device-2',
      pageId: 'page-2',
    });
  });
});
