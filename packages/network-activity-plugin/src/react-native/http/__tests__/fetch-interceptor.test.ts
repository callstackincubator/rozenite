// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

let captureResponseBodySpy: ReturnType<typeof vi.fn> | null = null;

const loadFetchInterceptor = async (
  expoFetchModule: { fetch: typeof fetch } | null = null,
) => {
  vi.resetModules();
  vi.doMock('../http-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../http-utils')>();

    return {
      ...actual,
      getInitiatorFromStack: () => ({ type: 'other' }),
    };
  });
  vi.doMock('../fetch-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../fetch-utils')>();
    captureResponseBodySpy = vi.fn(actual.captureFetchResponseBodyFromBytes);

    return {
      ...actual,
      BINARY_CAPTURE_SIZE_CAP: 10,
      captureFetchResponseBodyFromBytes: captureResponseBodySpy,
    };
  });
  vi.doMock('../get-expo-fetch-module', () => ({
    getExpoFetchModule: () => expoFetchModule,
  }));

  return import('../fetch-interceptor');
};

const createExpoResponse = (
  bodyChunks: string[],
  headers: Record<string, string>,
) => {
  const encodedChunks = bodyChunks.map((chunk) => new TextEncoder().encode(chunk));
  const totalSize = encodedChunks.reduce(
    (sum, chunk) => sum + chunk.byteLength,
    0,
  );

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
  vi.restoreAllMocks();
  vi.unmock('../http-utils');
  vi.unmock('../fetch-utils');
  vi.unmock('../get-expo-fetch-module');
  captureResponseBodySpy = null;
});

describe('FetchInterceptor', () => {
  it('patches expo/fetch directly and preserves the original export', async () => {
    const fetchMock = vi.fn(async () =>
      createExpoResponse(['{"ok":', 'true}'], {
        'x-request-id': 'expo-1',
      }),
    );
    const expoFetchModule = { fetch: fetchMock as typeof fetch };

    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    const events: Array<{ type: string; event: unknown }> = [];
    const originalModuleFetch = expoFetchModule.fetch;

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

    expect(FetchInterceptor.isInterceptorEnabled()).toBe(true);
    expect(expoFetchModule.fetch).not.toBe(originalModuleFetch);

    const response = await expoFetchModule.fetch('https://example.com/api', {
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

    expect(FetchInterceptor.isInterceptorEnabled()).toBe(false);
    expect(expoFetchModule.fetch).toBe(originalModuleFetch);
  });

  it('does not start when expo/fetch is unavailable', async () => {
    const { FetchInterceptor } = await loadFetchInterceptor(null);

    FetchInterceptor.enableInterception();

    expect(FetchInterceptor.isInterceptorEnabled()).toBe(false);
  });

  it('emits a canceled failure when expo/fetch rejects with an AbortError', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    const fetchMock = vi.fn(async () => {
      throw abortError;
    });
    const expoFetchModule = { fetch: fetchMock as typeof fetch };

    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    const onRequestFailed = vi.fn();

    FetchInterceptor.setCallbacks({
      onRequestFailed,
    });
    FetchInterceptor.enableInterception();

    await expect(
      expoFetchModule.fetch('https://example.com/api'),
    ).rejects.toThrow('Aborted');

    expect(onRequestFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Fetch',
        canceled: true,
        source: 'expo',
      }),
    );

    FetchInterceptor.disableInterception();
  });

  it('emits request metadata before a failed expo/fetch rejection', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('Network down');
    });
    const expoFetchModule = { fetch: fetchMock as typeof fetch };

    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    const events: Array<{ type: string; event: unknown }> = [];

    FetchInterceptor.setCallbacks({
      onRequestSent: (event) => events.push({ type: 'request-sent', event }),
      onRequestFailed: (event) =>
        events.push({ type: 'request-failed', event }),
    });
    FetchInterceptor.enableInterception();

    await expect(
      expoFetchModule.fetch('https://example.com/api'),
    ).rejects.toThrow('Network down');

    expect(events.map((entry) => entry.type)).toEqual([
      'request-sent',
      'request-failed',
    ]);
    expect(events[0]?.event).toMatchObject({
      request: {
        url: 'https://example.com/api',
        method: 'GET',
      },
      type: 'Fetch',
      source: 'expo',
    });
    expect(events[1]?.event).toMatchObject({
      type: 'Fetch',
      canceled: false,
      source: 'expo',
    });

    FetchInterceptor.disableInterception();
  });

  it('avoids buffering binary bodies past the capture cap', async () => {
    const size = 11;
    const fetchMock = vi.fn(async () => {
      const bytes = new Uint8Array(size);
      bytes.fill(7);

      const createBody = () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

      const createResponse = (): Response =>
        ({
          url: 'https://example.com/file',
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'content-type': 'application/octet-stream',
            'content-length': String(size),
          }),
          body: createBody(),
          clone: () => createResponse(),
        }) as unknown as Response;

      return createResponse();
    });
    const expoFetchModule = { fetch: fetchMock as typeof fetch };

    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    const sentEvents: Array<unknown> = [];

    FetchInterceptor.setCallbacks({
      onRequestSent: (event) => sentEvents.push(event),
    });
    FetchInterceptor.enableInterception();

    await expoFetchModule.fetch('https://example.com/file');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sentEvents).toHaveLength(1);
    expect(captureResponseBodySpy).not.toHaveBeenCalled();

    FetchInterceptor.disableInterception();
  });
});
