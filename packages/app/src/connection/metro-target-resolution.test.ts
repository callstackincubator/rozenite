// @vitest-environment jsdom
import type { MetroTarget } from '@rozenite/agent-shared';
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

const targetsResponse = (targets: MetroTarget[]): Response =>
  jsonResponse({ ok: true, result: { targets } });

const target = (overrides: {
  id: string;
  deviceId: string;
  webSocketDebuggerUrl: string;
  name?: string;
  pageId?: string;
}): MetroTarget => ({
  deviceId: overrides.deviceId,
  name: overrides.name ?? overrides.deviceId,
  appId: 'com.example.app',
  pageId: overrides.pageId ?? overrides.id,
  title: '',
  description: '',
  integration: 'react-native',
  id: overrides.id,
  webSocketDebuggerUrl: overrides.webSocketDebuggerUrl,
});

describe('resolveMetroTarget', () => {
  it('picks the target matching the requested device id', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      targetsResponse([
        target({
          id: 'page-1',
          deviceId: 'abc',
          name: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
        }),
        target({
          id: 'page-2',
          deviceId: 'xyz',
          name: 'Pixel 9',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=xyz&page=2',
        }),
      ]),
    );

    await expect(resolveMetroTarget('xyz')).resolves.toEqual({
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=xyz&page=2',
      name: 'Pixel 9',
    });
  });

  it('requests the response from the middleware targets endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(targetsResponse([]));

    await expect(resolveMetroTarget('abc')).rejects.toThrow(/abc/);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${window.location.origin}/rozenite/agent/targets`,
    );
  });

  it('takes the first target for a device when several are returned, trusting endpoint order', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      targetsResponse([
        target({
          id: 'page-legacy',
          deviceId: 'abc',
          name: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
        }),
        target({
          id: 'page-fusebox',
          deviceId: 'abc',
          name: 'iPhone 16',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=3',
        }),
      ]),
    );

    await expect(resolveMetroTarget('abc')).resolves.toEqual({
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
      name: 'iPhone 16',
    });
  });

  describe('reconnecting to a device that hosts several pages', () => {
    // Every Lynx card is its own page, and LynxExplorer's own home screen
    // is page 1. Re-resolving by device id alone therefore used to move a
    // live session off the card being debugged and onto the home screen,
    // which has no Rozenite in it -- surfacing as a "Rozenite isn't set up
    // in this app" that no amount of reloading could clear.
    // `pageId` is the device-local id -- the `page` query parameter of
    // `webSocketDebuggerUrl` -- not the globally unique `id` (which is the
    // `<deviceId>-<pageId>` composite the middleware also returns). A
    // `preferredPageId` of `'2'`, exactly what `ParsedTarget.pageId` holds,
    // must match the target whose `pageId` is `'2'`, not one whose `id`
    // happens to be `'abc-2'`.
    const twoCards = () =>
      targetsResponse([
        target({
          id: 'abc-1',
          deviceId: 'abc',
          name: 'iPhone',
          pageId: '1',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
        }),
        target({
          id: 'abc-2',
          deviceId: 'abc',
          name: 'iPhone',
          pageId: '2',
          webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=2',
        }),
      ]);

    it('returns to the page that was being debugged', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(twoCards());

      await expect(resolveMetroTarget('abc', '2')).resolves.toEqual({
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=2',
        name: 'iPhone',
      });
    });

    it('falls back to the first target when that page is gone', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(twoCards());

      await expect(resolveMetroTarget('abc', '7')).resolves.toEqual({
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
        name: 'iPhone',
      });
    });

    it('keeps the previous behaviour when no page is remembered', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(twoCards());

      await expect(resolveMetroTarget('abc', null)).resolves.toEqual({
        webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
        name: 'iPhone',
      });
    });
  });

  it('falls back to the device id when the target reports no name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      targetsResponse([
        {
          ...target({
            id: 'page-1',
            deviceId: 'abc',
            webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
          }),
          name: '',
        },
      ]),
    );

    await expect(resolveMetroTarget('abc')).resolves.toEqual({
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=abc&page=1',
      name: 'abc',
    });
  });

  it('rejects with a plain error when no target matches the device', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(targetsResponse([]));

    await expect(resolveMetroTarget('missing')).rejects.toThrow(/missing/);
    await expect(resolveMetroTarget('missing')).rejects.not.toBeInstanceOf(MetroUnreachableError);
  });

  it('rejects with MetroUnreachableError when the request itself fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(resolveMetroTarget('abc')).rejects.toBeInstanceOf(MetroUnreachableError);
  });

  it('rejects with the endpoint error message on a real ok:false envelope (HTTP 400)', async () => {
    // The middleware's `sendError` always pairs `ok:false` with an HTTP 400
    // or 404 (`packages/middleware/src/agent/routes.ts`), never 200 -- this
    // is the shape a real error response actually has.
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { ok: false, error: { message: 'No connected device is available.' } },
          false,
          400,
        ),
      );

    await expect(resolveMetroTarget('abc')).rejects.toBeInstanceOf(MetroUnreachableError);
    await expect(resolveMetroTarget('abc')).rejects.toThrow('No connected device is available.');
  });

  it('rejects naming the status when a non-JSON response cannot be parsed as an envelope', async () => {
    // A 404 with an HTML body -- an older middleware, or `/rozenite` not
    // mounted at all -- has no envelope to read a message from, so the
    // status line is all that is left to report.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
    } as unknown as Response);

    await expect(resolveMetroTarget('abc')).rejects.toBeInstanceOf(MetroUnreachableError);
    await expect(resolveMetroTarget('abc')).rejects.toThrow(/status 404/);
  });

  it('rejects with MetroUnreachableError on an unparsable response body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response);

    await expect(resolveMetroTarget('abc')).rejects.toBeInstanceOf(MetroUnreachableError);
  });

  it('rejects with MetroUnreachableError on a JSON body that is not an envelope', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ some: 'unrelated shape' }));

    await expect(resolveMetroTarget('abc')).rejects.toBeInstanceOf(MetroUnreachableError);
  });

  it('rejects with MetroUnreachableError when result.targets is missing or not an array', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true, result: {} }));

    await expect(resolveMetroTarget('abc')).rejects.toBeInstanceOf(MetroUnreachableError);
  });

  it('falls back to a generic message when an ok:false envelope has no error message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: {} }));

    await expect(resolveMetroTarget('abc')).rejects.toBeInstanceOf(MetroUnreachableError);
  });
});
