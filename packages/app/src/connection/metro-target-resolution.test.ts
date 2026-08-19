// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetroUnreachableError, resolveMetroTarget } from './metro-target-resolution';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

describe('resolveMetroTarget', () => {
  it('picks the page matching the requested device id', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'page-1',
          deviceName: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
          reactNative: { logicalDeviceId: 'abc' },
        },
        {
          id: 'page-2',
          deviceName: 'Pixel 9',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=xyz&page=2',
          reactNative: { logicalDeviceId: 'xyz' },
        },
      ]),
    );

    await expect(resolveMetroTarget('xyz')).resolves.toEqual({
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=xyz&page=2',
      name: 'Pixel 9',
    });
  });

  it('prefers the page that advertises the Fusebox frontend when a device has several', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'page-legacy',
          deviceName: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
          reactNative: { logicalDeviceId: 'abc', capabilities: { prefersFuseboxFrontend: false } },
        },
        {
          id: 'page-fusebox',
          deviceName: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=3',
          reactNative: { logicalDeviceId: 'abc', capabilities: { prefersFuseboxFrontend: true } },
        },
      ]),
    );

    await expect(resolveMetroTarget('abc')).resolves.toEqual({
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=3',
      name: 'iPhone 16',
    });
  });

  it('falls back to the device id when Metro reports no device name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'page-1',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
          reactNative: { logicalDeviceId: 'abc' },
        },
      ]),
    );

    await expect(resolveMetroTarget('abc')).resolves.toEqual({
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
      name: 'abc',
    });
  });

  it('rejects with a plain error when no page matches the device', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse([]));

    await expect(resolveMetroTarget('missing')).rejects.toThrow(/missing/);
    await expect(resolveMetroTarget('missing')).rejects.not.toBeInstanceOf(MetroUnreachableError);
  });

  it('rejects with MetroUnreachableError when the request itself fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(resolveMetroTarget('abc')).rejects.toBeInstanceOf(MetroUnreachableError);
  });

  it('rejects with MetroUnreachableError on a non-OK response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse([], false, 500));

    await expect(resolveMetroTarget('abc')).rejects.toBeInstanceOf(MetroUnreachableError);
  });
});
