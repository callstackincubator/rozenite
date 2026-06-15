// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

const loadFetchInterceptor = async () => {
  vi.resetModules();
  vi.doMock('../http-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../http-utils')>();

    return {
      ...actual,
      getInitiatorFromStack: () => ({ type: 'other' }),
    };
  });

  return import('../fetch-interceptor');
};

const createExpoResponse = (
  bodyChunks: string[],
  headers: Record<string, string>,
) => {
  const encodedChunks = bodyChunks.map((chunk) => new TextEncoder().encode(chunk));
  const totalSize = encodedChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

  const createBody = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        encodedChunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    });

  const createResponse = (): Response =>
    ({
      url: 'https://example.com/api',
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': String(totalSize),
        ...headers,
      }),
      body: createBody(),
      clone: () => createResponse(),
    }) as unknown as Response;

  return createResponse();
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unmock('../http-utils');
});

describe('FetchInterceptor', () => {
  it('emits lifecycle events for Expo fetch responses and preserves the original response', async () => {
    const fetchMock = vi.fn(async () =>
      createExpoResponse(['{"ok":', 'true}'], {
        'x-request-id': 'expo-1',
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const { FetchInterceptor } = await loadFetchInterceptor();
    const events: Array<{ type: string; event: unknown }> = [];

    FetchInterceptor.setCallbacks({
      onRequestSent: (event) => events.push({ type: 'request-sent', event }),
      onResponseReceived: (event) =>
        events.push({ type: 'response-received', event }),
      onRequestProgress: (event) =>
        events.push({ type: 'request-progress', event }),
      onRequestCompleted: (event) =>
        events.push({ type: 'request-completed', event }),
      onRequestFailed: (event) =>
        events.push({ type: 'request-failed', event }),
      onResponseBody: (requestId, body) =>
        events.push({
          type: 'response-body',
          event: { requestId, body },
        }),
    });

    FetchInterceptor.enableInterception();

    const response = await fetch('https://example.com/api', {
      method: 'post',
      headers: {
        'x-request-id': 'expo-1',
      },
      body: JSON.stringify({ ok: true }),
    });

    expect(response).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const requestSent = events.find((entry) => entry.type === 'request-sent');
    const responseReceived = events.find(
      (entry) => entry.type === 'response-received',
    );
    const progressEvents = events.filter(
      (entry) => entry.type === 'request-progress',
    );
    const completed = events.find(
      (entry) => entry.type === 'request-completed',
    );
    const bodyEvent = events.find((entry) => entry.type === 'response-body');

    expect(requestSent?.event).toMatchObject({
      request: {
        url: 'https://example.com/api',
        method: 'POST',
        headers: {
          'x-request-id': 'expo-1',
        },
        postData: {
          type: 'text',
          value: '{"ok":true}',
        },
      },
      type: 'Fetch',
      source: 'expo',
    });

    expect(responseReceived?.event).toMatchObject({
      type: 'Fetch',
      source: 'expo',
      response: {
        url: 'https://example.com/api',
        status: 200,
        statusText: 'OK',
        contentType: 'application/json',
        size: 11,
      },
    });

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents.at(-1)?.event).toMatchObject({
      loaded: 11,
      total: 11,
      lengthComputable: true,
      source: 'expo',
    });

    expect(bodyEvent?.event).toEqual({
      requestId: expect.any(String),
      body: '{"ok":true}',
    });

    expect(completed?.event).toMatchObject({
      duration: expect.any(Number),
      size: 11,
      ttfb: expect.any(Number),
      source: 'expo',
    });

    FetchInterceptor.disableInterception();
  });

  it('does not emit fetch-owned events for non-streaming RN responses', async () => {
    const fetchMock = vi.fn(async () =>
      ({
        url: 'https://example.com/api',
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: undefined,
        clone: () => null,
      }) as unknown as Response,
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const { FetchInterceptor } = await loadFetchInterceptor();
    const onRequestSent = vi.fn();
    const onResponseReceived = vi.fn();

    FetchInterceptor.setCallbacks({
      onRequestSent,
      onResponseReceived,
    });
    FetchInterceptor.enableInterception();

    const response = await fetch('https://example.com/api');

    expect(response).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onRequestSent).not.toHaveBeenCalled();
    expect(onResponseReceived).not.toHaveBeenCalled();
    FetchInterceptor.disableInterception();
  });

  it('emits a canceled failure when the original fetch rejects with an AbortError', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    const fetchMock = vi.fn(async () => {
      throw abortError;
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const { FetchInterceptor } = await loadFetchInterceptor();
    const onRequestFailed = vi.fn();

    FetchInterceptor.setCallbacks({
      onRequestFailed,
    });
    FetchInterceptor.enableInterception();

    await expect(fetch('https://example.com/api')).rejects.toThrow(
      'Aborted',
    );

    expect(onRequestFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Fetch',
        canceled: true,
        source: 'expo',
      }),
    );

    FetchInterceptor.disableInterception();
  });

  it('restores the original fetch implementation when disabled', async () => {
    const fetchMock = vi.fn(async () =>
      ({
        url: 'https://example.com/api',
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
        body: undefined,
        clone: () => null,
      }) as unknown as Response,
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const { FetchInterceptor } = await loadFetchInterceptor();

    FetchInterceptor.enableInterception();
    expect(FetchInterceptor.isInterceptorEnabled()).toBe(true);
    expect(globalThis.fetch).not.toBe(fetchMock);

    FetchInterceptor.disableInterception();
    expect(FetchInterceptor.isInterceptorEnabled()).toBe(false);
    expect(globalThis.fetch).toBe(fetchMock);
  });
});
