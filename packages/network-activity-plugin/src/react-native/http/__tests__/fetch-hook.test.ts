// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { wrapFetch, markActiveFetchCallSentXhr } from '../fetch-hook';
import type { Recorder, RecorderHandle } from '../recorder';

// `enableFetchHook`/`disableFetchHook` decide *whether* to wrap Expo's
// module and the global by reading real `require('expo/...')` and
// `require('react-native-nitro-fetch')` calls — a real Node `require`, which
// Vitest's module mocking cannot intercept (there is no injectable seam left
// after inlining `get-expo-fetch-module.ts`/`get-nitro-module.ts`, per the
// size-reduction pass). That install logic is exercised on-device instead,
// by the network-activity e2e harness's `expo-get-json`, `expo-abort` and
// `global-fetch-get-json` scenarios. This file covers `wrapFetch` itself —
// the dedupe, labeling and response-observation logic — directly.

const createFakeRecorder = () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const recorder: Recorder = {
    begin: (meta) => {
      calls.push({ method: 'begin', args: [meta] });
      const handle: RecorderHandle = {
        requestId: 'fake-request-id',
        markHeadersReceived: vi.fn(),
        headers: (m) => calls.push({ method: 'headers', args: [m] }),
        progress: (...args) => calls.push({ method: 'progress', args }),
        end: (m) => calls.push({ method: 'end', args: [m] }),
        fail: (...args) => calls.push({ method: 'fail', args }),
      };
      return handle;
    },
    getResponseBody: vi.fn(async () => null),
    on: vi.fn(() => () => undefined),
    clear: vi.fn(),
  };
  return { recorder, calls };
};

const jsonResponse = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/json', ...headers } });

describe('wrapFetch', () => {
  it('labels every recorded request "expo"', async () => {
    const { recorder, calls } = createFakeRecorder();
    const { fn } = wrapFetch(
      async () => jsonResponse('{"ok":true}'),
      () => recorder,
    );

    await fn('https://example.com/api');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const begin = calls.find((c) => c.method === 'begin');
    expect(begin?.args[0]).toMatchObject({ source: 'expo', type: 'Fetch' });
  });

  it('records nothing for a call whose synchronous phase sent an XHR', async () => {
    const { recorder, calls } = createFakeRecorder();
    const original = vi.fn(async () => {
      markActiveFetchCallSentXhr();
      return jsonResponse('{"ok":true}');
    });
    const { fn } = wrapFetch(original, () => recorder);

    await fn('https://example.com/api');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(original).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });

  it('stops recording once disabled, even if the wrapper is still called directly', async () => {
    const { recorder, calls } = createFakeRecorder();
    const original = vi.fn(async () => jsonResponse('{"ok":true}'));
    const { fn, disable } = wrapFetch(original, () => recorder);

    disable();
    const response = await fn('https://example.com/api');

    expect(response).toBeInstanceOf(Response);
    expect(original).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });

  it('completes the request when response metadata throws, without a body', async () => {
    const { recorder, calls } = createFakeRecorder();
    const response = {
      get headers(): never {
        throw new Error('headers unavailable');
      },
    } as unknown as Response;
    const { fn } = wrapFetch(
      async () => response,
      () => recorder,
    );

    expect(await fn('https://example.com/metadata')).toBe(response);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.map((c) => c.method)).toEqual(['begin', 'end']);
    expect(calls[1]?.args[0]).toMatchObject({ size: null, body: null });
  });

  describe('when clone() throws (Expo SDK 54-55)', () => {
    const cloneThrowingResponse = (body: string, headers: Record<string, string> = {}) => {
      const response = jsonResponse(body, headers);
      vi.spyOn(response, 'clone').mockImplementation(() => {
        throw new Error('Response.clone is not supported');
      });
      return response;
    };

    it('completes the request immediately, ahead of any body read', async () => {
      const { recorder, calls } = createFakeRecorder();
      const response = cloneThrowingResponse('{"ok":true}');
      const { fn } = wrapFetch(
        async () => response,
        () => recorder,
      );

      expect(await fn('https://example.com/fallback')).toBe(response);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(calls.map((c) => c.method)).toEqual(['begin', 'headers', 'end']);
      const end = calls[2]?.args[0] as { body: () => unknown };
      expect(typeof end.body).toBe('function');
    });

    it('captures the text body the application reads via text()', async () => {
      const { recorder, calls } = createFakeRecorder();
      const response = cloneThrowingResponse('{"ok":true}');
      const { fn } = wrapFetch(
        async () => response,
        () => recorder,
      );

      const fetched = (await fn('https://example.com/fallback')) as Response;
      expect(await fetched.text()).toBe('{"ok":true}');
      await new Promise((resolve) => setTimeout(resolve, 0));

      const end = calls.find((c) => c.method === 'end')?.args[0] as {
        body: () => unknown;
      };
      expect(end.body()).toBe('{"ok":true}');
    });

    it('captures the binary body the application reads via arrayBuffer()', async () => {
      const { recorder, calls } = createFakeRecorder();
      const response = cloneThrowingResponse('binary-payload', {
        'content-type': 'application/octet-stream',
      });
      const { fn } = wrapFetch(
        async () => response,
        () => recorder,
      );

      const fetched = (await fn('https://example.com/fallback')) as Response;
      await fetched.arrayBuffer();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const end = calls.find((c) => c.method === 'end')?.args[0] as {
        body: () => unknown;
      };
      expect(end.body()).toMatchObject({ kind: 'binary' });
    });

    it('yields null, without hanging, when the application never reads the body', async () => {
      const { recorder, calls } = createFakeRecorder();
      const response = cloneThrowingResponse('{"ok":true}');
      const { fn } = wrapFetch(
        async () => response,
        () => recorder,
      );

      await fn('https://example.com/fallback');
      await new Promise((resolve) => setTimeout(resolve, 0));

      const end = calls.find((c) => c.method === 'end')?.args[0] as {
        body: () => unknown;
      };
      expect(end.body()).toBeNull();
    });

    it('yields null, without an unhandled rejection, when text() rejects', async () => {
      const { recorder, calls } = createFakeRecorder();
      const response = cloneThrowingResponse('{"ok":true}');
      vi.spyOn(response, 'text').mockImplementation(() => Promise.reject(new Error('boom')));
      const { fn } = wrapFetch(
        async () => response,
        () => recorder,
      );

      const fetched = (await fn('https://example.com/fallback')) as Response;
      await expect(fetched.text()).rejects.toThrow('boom');
      await new Promise((resolve) => setTimeout(resolve, 0));

      const end = calls.find((c) => c.method === 'end')?.args[0] as {
        body: () => unknown;
      };
      expect(end.body()).toBeNull();
    });
  });

  it('sizes the response from loaded bytes when there is no Content-Length', async () => {
    const { recorder, calls } = createFakeRecorder();
    const bytes = new TextEncoder().encode('{"ok":true}');
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
    const { fn } = wrapFetch(
      async () => response,
      () => recorder,
    );

    await fn('https://example.com/no-length');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const end = calls.find((c) => c.method === 'end');
    expect(end?.args[0]).toMatchObject({ size: bytes.byteLength, body: '{"ok":true}' });
  });

  it('skips text/event-stream responses entirely, without reading the body', async () => {
    const { recorder, calls } = createFakeRecorder();
    let bodyAccessed = false;
    const response = {
      url: 'https://example.com/sse',
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      clone: () => response,
      get body(): never {
        bodyAccessed = true;
        throw new Error('should not be read');
      },
    } as unknown as Response;
    const { fn } = wrapFetch(
      async () => response,
      () => recorder,
    );

    await fn('https://example.com/sse');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(bodyAccessed).toBe(false);
    const end = calls.find((c) => c.method === 'end');
    expect(end?.args[0]).toMatchObject({ size: null });
  });
});
