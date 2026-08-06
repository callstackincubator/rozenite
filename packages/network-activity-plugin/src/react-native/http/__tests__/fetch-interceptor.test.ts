// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

let captureResponseBodySpy: ReturnType<typeof vi.fn> | null = null;

const loadFetchInterceptor = async (expoFetchModule: { fetch: typeof fetch } | null = null) => {
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

const createExpoResponse = (bodyChunks: string[], headers: Record<string, string>) => {
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
  vi.restoreAllMocks();
  vi.unmock('../http-utils');
  vi.unmock('../fetch-utils');
  vi.unmock('../get-expo-fetch-module');
  captureResponseBodySpy = null;
});

describe('FetchInterceptor', () => {
  it('patches the private export, its getter facade, and Expo global alias', async () => {
    const fetchMock = vi.fn(async () =>
      createExpoResponse(['{"ok":', 'true}'], {
        'x-request-id': 'expo-1',
      }),
    );
    const expoFetchModule = { fetch: fetchMock as typeof fetch };
    const expoFetchFacade = {
      get fetch() {
        return expoFetchModule.fetch;
      },
    };
    const originalGlobalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    const events: Array<{ type: string; event: unknown }> = [];
    const originalModuleFetch = expoFetchModule.fetch;

    FetchInterceptor.setCallbacks({
      onRequestSent: (event) => events.push({ type: 'request-sent', event }),
      onResponseReceived: (event) => events.push({ type: 'response-received', event }),
      onRequestProgress: (event) => events.push({ type: 'request-progress', event }),
      onRequestCompleted: (event) => events.push({ type: 'request-completed', event }),
      onRequestFailed: (event) => events.push({ type: 'request-failed', event }),
      onResponseBody: (requestId, body) =>
        events.push({
          type: 'response-body',
          event: { requestId, body },
        }),
    });

    FetchInterceptor.enableInterception();

    expect(FetchInterceptor.isInterceptorEnabled()).toBe(true);
    expect(expoFetchFacade.fetch).not.toBe(originalModuleFetch);
    expect(globalThis.fetch).toBe(expoFetchFacade.fetch);

    const response = await expoFetchFacade.fetch('https://example.com/api', {
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
    const responseReceived = events.find((entry) => entry.type === 'response-received');
    const progressEvents = events.filter((entry) => entry.type === 'request-progress');
    const completed = events.find((entry) => entry.type === 'request-completed');
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
    expect(
      events.filter(
        (entry) => entry.type === 'request-completed' || entry.type === 'request-failed',
      ),
    ).toHaveLength(1);

    FetchInterceptor.disableInterception();

    expect(FetchInterceptor.isInterceptorEnabled()).toBe(false);
    expect(expoFetchModule.fetch).toBe(originalModuleFetch);
    expect(globalThis.fetch).toBe(fetchMock);
    globalThis.fetch = originalGlobalFetch;
  });

  it('captures a consumed SDK 54–55 response without turning clone failure into a request failure', async () => {
    const response = {
      url: 'https://example.com/fallback',
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      clone: () => {
        throw new Error('Response.clone is not supported');
      },
      text: vi.fn(async () => '{"ok":true}'),
      json: function (this: { text: () => Promise<string> }) {
        return this.text().then(JSON.parse);
      },
    } as unknown as Response;
    const expoFetchModule = {
      fetch: vi.fn(async () => response) as typeof fetch,
    };
    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    const onResponseBody = vi.fn();
    const onRequestCompleted = vi.fn();
    const onRequestFailed = vi.fn();
    const terminalEvents: string[] = [];
    FetchInterceptor.setCallbacks({
      onResponseBody,
      onRequestCompleted: (event) => {
        terminalEvents.push('request-completed');
        onRequestCompleted(event);
      },
      onRequestFailed: (event) => {
        terminalEvents.push('request-failed');
        onRequestFailed(event);
      },
    });
    FetchInterceptor.enableInterception();

    const received = await expoFetchModule.fetch('https://example.com/fallback');
    await expect(received.json()).resolves.toEqual({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onRequestCompleted).toHaveBeenCalledTimes(1);
    expect(onRequestFailed).not.toHaveBeenCalled();
    expect(terminalEvents).toEqual(['request-completed']);
    expect(onResponseBody).toHaveBeenCalledWith(expect.any(String), '{"ok":true}');
    FetchInterceptor.disableInterception();
  });

  it('does not create a derived unhandled rejection when a consumed body rejects', async () => {
    const error = new Error('Body read failed');
    let rejectBody: (reason: unknown) => void = () => undefined;
    const bodyPromise = new Promise<string>((_resolve, reject) => {
      rejectBody = reject;
    });
    const response = {
      url: 'https://example.com/fallback-error',
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      clone: () => {
        throw new Error('Response.clone is not supported');
      },
      text: vi.fn(() => bodyPromise),
    } as unknown as Response;
    const expoFetchModule = {
      fetch: vi.fn(async () => response) as typeof fetch,
    };
    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    FetchInterceptor.enableInterception();

    const received = await expoFetchModule.fetch(response.url);
    const returnedPromise = received.text();
    expect(returnedPromise).toBe(bodyPromise);
    rejectBody(error);
    await expect(returnedPromise).rejects.toBe(error);
    await new Promise((resolve) => setTimeout(resolve, 0));

    FetchInterceptor.disableInterception();
  });

  it('uses one clone and reports captured bytes when Content-Length is unavailable', async () => {
    const bytes = new TextEncoder().encode('{"ok":true}');
    const clone = {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    } as Response;
    const response = {
      url: 'https://example.com/no-length',
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      clone: vi.fn(() => clone),
    } as unknown as Response;
    const expoFetchModule = {
      fetch: vi.fn(async () => response) as typeof fetch,
    };
    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    const events: string[] = [];
    const onRequestCompleted = vi.fn((event) => {
      events.push('request-completed');
      return event;
    });
    FetchInterceptor.setCallbacks({
      onRequestSent: () => events.push('request-sent'),
      onResponseReceived: () => events.push('response-received'),
      onResponseBody: () => events.push('response-body'),
      onRequestCompleted,
      onRequestFailed: () => events.push('request-failed'),
    });
    FetchInterceptor.enableInterception();

    expect(await expoFetchModule.fetch(response.url)).toBe(response);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.clone).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      'request-sent',
      'response-received',
      'response-body',
      'request-completed',
    ]);
    expect(onRequestCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ size: bytes.byteLength }),
    );
    FetchInterceptor.disableInterception();
  });

  it('completes successfully when response metadata throws', async () => {
    const response = {
      get headers() {
        throw new Error('headers unavailable');
      },
    } as unknown as Response;
    const expoFetchModule = {
      fetch: vi.fn(async () => response) as typeof fetch,
    };
    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    const onResponseBody = vi.fn();
    const onRequestCompleted = vi.fn();
    const onRequestFailed = vi.fn();
    const terminalEvents: string[] = [];
    FetchInterceptor.setCallbacks({
      onResponseBody,
      onRequestCompleted: (event) => {
        terminalEvents.push('request-completed');
        onRequestCompleted(event);
      },
      onRequestFailed: (event) => {
        terminalEvents.push('request-failed');
        onRequestFailed(event);
      },
    });
    FetchInterceptor.enableInterception();

    expect(await expoFetchModule.fetch('https://example.com/metadata')).toBe(response);
    expect(onResponseBody).toHaveBeenCalledWith(expect.any(String), null);
    expect(onRequestCompleted).toHaveBeenCalledTimes(1);
    expect(onRequestFailed).not.toHaveBeenCalled();
    expect(terminalEvents).toEqual(['request-completed']);
    FetchInterceptor.disableInterception();
  });

  it('leaves later wrappers intact and remains disabled without Expo', async () => {
    const original = vi.fn();
    const expoFetchModule = { fetch: original as typeof fetch };
    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    FetchInterceptor.enableInterception();
    const rozeniteWrapper = expoFetchModule.fetch;
    FetchInterceptor.enableInterception();
    expect(expoFetchModule.fetch).toBe(rozeniteWrapper);

    const laterWrapper = vi.fn();
    expoFetchModule.fetch = laterWrapper as typeof fetch;
    FetchInterceptor.disableInterception();
    expect(expoFetchModule.fetch).toBe(laterWrapper);

    const absent = await loadFetchInterceptor(null);
    absent.FetchInterceptor.enableInterception();
    expect(absent.FetchInterceptor.isInterceptorEnabled()).toBe(false);
  });

  it('restores a lazily materialized Expo global alias', async () => {
    const originalGlobalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const originalExpoFetch = vi.fn();
    const expoFetchModule = { fetch: originalExpoFetch as typeof fetch };
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      get: () => expoFetchModule.fetch,
      set: (value) => {
        Object.defineProperty(globalThis, 'fetch', {
          configurable: true,
          writable: true,
          value,
        });
      },
    });

    try {
      const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
      FetchInterceptor.enableInterception();
      expect(globalThis.fetch).toBe(expoFetchModule.fetch);

      FetchInterceptor.disableInterception();
      expect(globalThis.fetch).toBe(originalExpoFetch);
    } finally {
      if (originalGlobalDescriptor) {
        Object.defineProperty(globalThis, 'fetch', originalGlobalDescriptor);
      }
    }
  });

  it('restores Expo fetch when its lazy global is installed after enable', async () => {
    const originalGlobalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const reactNativeFetch = vi.fn();
    const originalExpoFetch = vi.fn();
    const expoFetchModule = { fetch: originalExpoFetch as typeof fetch };
    globalThis.fetch = reactNativeFetch as typeof fetch;

    try {
      const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
      FetchInterceptor.enableInterception();
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        get: () => expoFetchModule.fetch,
        set: (value) => {
          Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            writable: true,
            value,
          });
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(globalThis.fetch).toBe(expoFetchModule.fetch);
      FetchInterceptor.disableInterception();
      expect(globalThis.fetch).toBe(originalExpoFetch);
    } finally {
      if (originalGlobalDescriptor) {
        Object.defineProperty(globalThis, 'fetch', originalGlobalDescriptor);
      }
    }
  });

  it('emits a canceled failure when expo/fetch rejects with an AbortError', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    const fetchMock = vi.fn(async () => {
      throw abortError;
    });
    const expoFetchModule = { fetch: fetchMock as typeof fetch };

    const { FetchInterceptor } = await loadFetchInterceptor(expoFetchModule);
    const onRequestFailed = vi.fn();
    const onRequestCompleted = vi.fn();
    const terminalEvents: string[] = [];

    FetchInterceptor.setCallbacks({
      onRequestCompleted: (event) => {
        terminalEvents.push('request-completed');
        onRequestCompleted(event);
      },
      onRequestFailed: (event) => {
        terminalEvents.push('request-failed');
        onRequestFailed(event);
      },
    });
    FetchInterceptor.enableInterception();

    await expect(expoFetchModule.fetch('https://example.com/api')).rejects.toBe(abortError);

    expect(onRequestFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Fetch',
        canceled: true,
        source: 'expo',
      }),
    );
    expect(onRequestCompleted).not.toHaveBeenCalled();
    expect(terminalEvents).toEqual(['request-failed']);

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
      onRequestFailed: (event) => events.push({ type: 'request-failed', event }),
      onRequestCompleted: (event) => events.push({ type: 'request-completed', event }),
    });
    FetchInterceptor.enableInterception();

    await expect(expoFetchModule.fetch('https://example.com/api')).rejects.toThrow('Network down');

    expect(events.map((entry) => entry.type)).toEqual(['request-sent', 'request-failed']);
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
    expect(
      events.filter(
        (entry) => entry.type === 'request-completed' || entry.type === 'request-failed',
      ),
    ).toHaveLength(1);

    FetchInterceptor.disableInterception();
  });
});
