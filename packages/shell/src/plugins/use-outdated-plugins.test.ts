// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellPlugin } from '../types';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.resetModules();
});

const makePlugin = (id: string, version: string): ShellPlugin => ({
  id,
  name: id,
  description: '',
  version,
  panels: [],
});

describe('useOutdatedPlugins', () => {
  it('reports only plugins with a strictly newer published version', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const latest = url.includes('storage') ? '2.0.0' : '1.0.0';

      return {
        ok: true,
        json: async () => ({ 'dist-tags': { latest } }),
      } as Response;
    });

    const { useOutdatedPlugins } = await import('./use-outdated-plugins');
    const plugins = [makePlugin('storage', '1.0.0'), makePlugin('network', '1.0.0')];

    const { result } = renderHook(() => useOutdatedPlugins(plugins));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.outdated).toEqual(new Map([['storage', '2.0.0']]));
  });

  it('caches across mounts, fetching each package only once', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '2.0.0' } }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { useOutdatedPlugins } = await import('./use-outdated-plugins');
    const plugins = [makePlugin('storage', '1.0.0')];

    const first = renderHook(() => useOutdatedPlugins(plugins));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();

    const second = renderHook(() => useOutdatedPlugins(plugins));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.result.current.outdated).toEqual(new Map([['storage', '2.0.0']]));
  });

  it('reports unavailable, with no outdated entries, when every registry lookup fails', async () => {
    // `getLatestVersions` never rejects on its own contract: every request
    // failing for real (fetch itself rejecting) is what drives the
    // `unavailable` status here, not a mocked violation of that contract.
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const { useOutdatedPlugins } = await import('./use-outdated-plugins');
    const plugins = [makePlugin('storage', '1.0.0'), makePlugin('network', '1.0.0')];

    const { result } = renderHook(() => useOutdatedPlugins(plugins));

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.outdated.size).toBe(0);
  });

  it('is ready, not unavailable, when only some packages fail to resolve', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('storage')) {
        return { ok: true, json: async () => ({ 'dist-tags': { latest: '2.0.0' } }) } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    const { useOutdatedPlugins } = await import('./use-outdated-plugins');
    const plugins = [makePlugin('storage', '1.0.0'), makePlugin('network', '1.0.0')];

    const { result } = renderHook(() => useOutdatedPlugins(plugins));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.outdated).toEqual(new Map([['storage', '2.0.0']]));
  });

  it('is ready with no outdated entries when there are no plugins', async () => {
    const { useOutdatedPlugins } = await import('./use-outdated-plugins');

    const { result } = renderHook(() => useOutdatedPlugins([]));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.outdated.size).toBe(0);
  });
});
