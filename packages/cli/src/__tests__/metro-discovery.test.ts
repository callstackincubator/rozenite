import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMetroTargets } from '../commands/metro-discovery.js';

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: async () => body,
  }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getMetroTargets', () => {
  it('groups pages by logicalDeviceId, skipping pages without one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'page-1',
          title: 'Page 1',
          description: '',
          appId: 'com.example.app',
          deviceName: 'iPhone 15',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
          reactNative: { logicalDeviceId: 'device-1' },
        },
        {
          id: 'page-no-device',
          title: 'No device',
          description: '',
          appId: 'com.example.orphan',
          deviceName: 'Orphan',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=orphan&page=1',
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const targets = await getMetroTargets('127.0.0.1', 8081);

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8081/json/list');
    expect(targets).toEqual([
      {
        id: 'page-1',
        deviceId: 'device-1',
        name: 'iPhone 15',
        appId: 'com.example.app',
        pageId: 'page-1',
        title: 'Page 1',
        description: '',
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
      },
    ]);
  });

  it('keeps every page of a device that hosts several runtimes', async () => {
    // Two Lynx cards in one app, both Fusebox-capable. Neither is a
    // duplicate of the other, so collapsing them to one would leave the
    // second unreachable -- which is exactly what happened in
    // LynxExplorer, where page 1 is its own home screen.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'device-1-2',
          title: 'http://localhost:3000/main.lynx.bundle',
          description: '',
          appId: 'LynxExplorer',
          deviceName: 'iPhone',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=2',
          reactNative: {
            logicalDeviceId: 'device-1',
            capabilities: { prefersFuseboxFrontend: true },
          },
        },
        {
          id: 'device-1-1',
          title: '/Applications/LynxExplorer.app/Resource/homepage.lynx.bundle',
          description: '',
          appId: 'LynxExplorer',
          deviceName: 'iPhone',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=1',
          reactNative: {
            logicalDeviceId: 'device-1',
            capabilities: { prefersFuseboxFrontend: true },
          },
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const targets = await getMetroTargets('127.0.0.1', 8081);

    expect(targets.map((target) => target.id)).toEqual(['device-1-1', 'device-1-2']);
    // One device, so they must agree on it -- that is what still lets
    // `--deviceId` name the pair.
    expect(new Set(targets.map((target) => target.deviceId))).toEqual(new Set(['device-1']));
  });

  it('prefers the page with prefersFuseboxFrontend, tie-broken by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'page-b',
          title: 'Legacy',
          description: '',
          appId: 'com.example.app',
          deviceName: 'Pixel 8',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=b',
          reactNative: { logicalDeviceId: 'device-1' },
        },
        {
          id: 'page-a',
          title: 'Fusebox',
          description: '',
          appId: 'com.example.app',
          deviceName: 'Pixel 8',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=device-1&page=a',
          reactNative: {
            logicalDeviceId: 'device-1',
            capabilities: { prefersFuseboxFrontend: true },
          },
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const targets = await getMetroTargets('127.0.0.1', 8081);

    expect(targets).toHaveLength(1);
    expect(targets[0].pageId).toBe('page-a');
  });

  it('sorts devices by name then id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'page-z',
          title: 'Z',
          description: '',
          appId: 'com.example.z',
          deviceName: 'Zebra',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=z&page=1',
          reactNative: { logicalDeviceId: 'z' },
        },
        {
          id: 'page-a',
          title: 'A',
          description: '',
          appId: 'com.example.a',
          deviceName: 'Apple',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=a&page=1',
          reactNative: { logicalDeviceId: 'a' },
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const targets = await getMetroTargets('127.0.0.1', 8081);

    expect(targets.map((target) => target.name)).toEqual(['Apple', 'Zebra']);
  });

  it('fails with a message naming the URL tried when Metro cannot be reached', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8081'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMetroTargets('127.0.0.1', 8081)).rejects.toThrow(
      'Unable to reach Metro at http://127.0.0.1:8081/json/list',
    );
  });

  it('fails with a helpful message when Metro responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([], false, 500)));

    await expect(getMetroTargets('127.0.0.1', 8081)).rejects.toThrow(
      /Unable to reach Metro at http:\/\/127\.0\.0\.1:8081\/json\/list.*status 500/,
    );
  });
});
