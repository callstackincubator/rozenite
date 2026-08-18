// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPluginBaseUrl, loadDevModePlugin, loadPlugin, loadPlugins } from './plugins';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

const jsonResponse = (body: unknown, ok = true): Response =>
  ({
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? 'OK' : 'Not Found',
    json: async () => body,
  }) as Response;

describe('getPluginBaseUrl', () => {
  it('points at /rozenite/plugins/<id>, with "/" replaced by "_"', () => {
    const baseUrl = getPluginBaseUrl('@rozenite/network-activity-plugin');

    expect(new URL(baseUrl).pathname).toBe('/rozenite/plugins/@rozenite_network-activity-plugin');
  });
});

describe('loadPlugin', () => {
  it('maps a manifest to a ShellPlugin, prefixing panel ids and sources with the base URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        name: 'Example Plugin',
        version: '1.2.3',
        description: 'An example plugin.',
        panels: [{ name: 'Main', source: '/index.html' }],
      }),
    ) as unknown as typeof fetch;

    const plugin = await loadPlugin('@rozenite/example-plugin');
    const baseUrl = getPluginBaseUrl('@rozenite/example-plugin');

    expect(plugin).toEqual({
      id: '@rozenite/example-plugin',
      name: 'Example Plugin',
      description: 'An example plugin.',
      version: '1.2.3',
      panels: [
        {
          id: '@rozenite/example-plugin:Main',
          name: 'Main',
          source: `${baseUrl}/index.html`,
        },
      ],
    });
  });

  it('rejects when the manifest fetch responds with a non-2xx status', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(null, false)) as unknown as typeof fetch;

    await expect(loadPlugin('@rozenite/missing-plugin')).rejects.toThrow();
  });
});

describe('loadPlugins', () => {
  it('skips a plugin that fails to load, keeps the ones that succeed, and appends the dev-mode plugin when present', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes('/rozenite/plugins/good/')) {
        return jsonResponse({ name: 'Good Plugin', version: '1.0.0', description: '', panels: [] });
      }
      if (url.includes('/rozenite/plugins/bad/')) {
        return jsonResponse(null, false);
      }
      if (url.startsWith('http://localhost:8888/')) {
        return jsonResponse({ name: 'Dev Plugin', version: '0.0.1', description: '', panels: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const plugins = await loadPlugins(['good', 'bad']);

    expect(plugins.map((plugin) => plugin.name)).toEqual(['Good Plugin', 'Dev Plugin']);
    expect(consoleError).toHaveBeenCalled();
  });
});

describe('loadDevModePlugin', () => {
  it('resolves to null, without throwing, when the dev server is unreachable', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await expect(loadDevModePlugin()).resolves.toBeNull();
  });
});
