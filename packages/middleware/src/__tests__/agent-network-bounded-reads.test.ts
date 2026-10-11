import { describe, expect, it } from 'vitest';
import { createNetworkDomainService } from '../agent/local-domains.js';

type Listener = (params: Record<string, unknown>) => void | Promise<void>;

const createHarness = (commands: Record<string, Record<string, unknown>> = {}) => {
  const listeners = new Map<string, Set<Listener>>();
  const service = createNetworkDomainService({
    getSessionInfo: () => ({ sessionId: 'device-1', pageId: 'page-1', deviceId: 'device-1' }),
    sendCommand: async (method) => commands[method] ?? {},
    subscribeToCDPEvent: (method, listener) => {
      const entries = listeners.get(method) || new Set();
      entries.add(listener);
      listeners.set(method, entries);
      return () => entries.delete(listener);
    },
  });
  const emit = (method: string, params: Record<string, unknown>) => {
    for (const listener of listeners.get(method) || []) {
      void listener(params);
    }
  };

  return { service, emit };
};

const recordFinishedRequest = async (
  harness: ReturnType<typeof createHarness>,
  overrides: Record<string, unknown> = {},
) => {
  await harness.service.callTool('startRecording', {});
  harness.emit('Network.requestWillBeSent', {
    requestId: 'req-1',
    timestamp: 1,
    request: {
      url: 'https://example.com/api',
      method: 'POST',
      headers: { accept: 'application/json' },
      hasPostData: true,
    },
    initiator: { type: 'script', stack: { callFrames: [{ functionName: 'load' }] } },
    ...overrides,
  });
  harness.emit('Network.requestWillBeSentExtraInfo', {
    requestId: 'req-1',
    headers: { cookie: 'a=1' },
    associatedCookies: [{ name: 'a' }],
  });
  harness.emit('Network.responseReceived', {
    requestId: 'req-1',
    response: {
      url: 'https://example.com/api',
      status: 200,
      mimeType: 'application/json',
      headers: { 'content-type': 'application/json' },
      timing: { requestTime: 1 },
    },
  });
  harness.emit('Network.loadingFinished', { requestId: 'req-1', timestamp: 2 });
};

type Details = { request: Record<string, unknown> & { response?: Record<string, unknown> } };

describe('network getRequestDetails', () => {
  it('returns headers and the initiator type by default, omitting empty keys', async () => {
    const harness = createHarness();
    await recordFinishedRequest(harness);

    const { request } = (await harness.service.callTool('getRequestDetails', {
      requestId: 'req-1',
    })) as Details;

    expect(request.initiator).toEqual({ type: 'script' });
    expect(request.requestHeadersExtra).toEqual({ cookie: 'a=1' });
    expect(request.response?.headers).toEqual({ 'content-type': 'application/json' });
    expect(request.response).not.toHaveProperty('timing');
    expect(request).not.toHaveProperty('requestAssociatedCookies');
    expect(request).not.toHaveProperty('redirectChain');
    expect(request).not.toHaveProperty('failureText');
    expect(Object.values(request)).not.toContain(null);
    expect(request.loadingFinished).toBe(true);
  });

  it('adds the opt-in sections named by include and drops headers when not named', async () => {
    const harness = createHarness();
    await recordFinishedRequest(harness);

    const { request } = (await harness.service.callTool('getRequestDetails', {
      requestId: 'req-1',
      include: ['timing', 'initiator', 'cookies', 'redirectChain'],
    })) as Details;

    expect(request.initiator).toMatchObject({ type: 'script', stack: expect.any(Object) });
    expect(request.response?.timing).toEqual({ requestTime: 1 });
    expect(request.requestAssociatedCookies).toEqual([{ name: 'a' }]);
    expect(request.redirectChain).toEqual([]);
    expect(request.response).not.toHaveProperty('headers');
    expect(request).not.toHaveProperty('requestHeadersExtra');
  });

  it('rejects an unknown include value', async () => {
    const harness = createHarness();
    await recordFinishedRequest(harness);

    await expect(
      harness.service.callTool('getRequestDetails', { requestId: 'req-1', include: ['body'] }),
    ).rejects.toThrow(/Unknown "include" value/);
  });
});

describe('network body reads', () => {
  const bigBody = 'x'.repeat(20_000);

  it('returns the first 16 KB of a response body by default and reports the rest', async () => {
    const harness = createHarness({
      'Network.getResponseBody': { body: bigBody, base64Encoded: false },
    });
    await recordFinishedRequest(harness);

    const result = (await harness.service.callTool('getResponseBody', {
      requestId: 'req-1',
    })) as Record<string, unknown>;

    expect((result.body as string).length).toBe(16_384);
    expect(result).toMatchObject({ totalBytes: 20_000, truncated: true, nextOffset: 16_384 });
  });

  it('reads the remainder with offset', async () => {
    const harness = createHarness({
      'Network.getResponseBody': { body: bigBody, base64Encoded: false },
    });
    await recordFinishedRequest(harness);

    const result = (await harness.service.callTool('getResponseBody', {
      requestId: 'req-1',
      offset: 16_384,
    })) as Record<string, unknown>;

    expect((result.body as string).length).toBe(20_000 - 16_384);
    expect(result).toMatchObject({ totalBytes: 20_000, truncated: false });
    expect(result).not.toHaveProperty('nextOffset');
  });

  it('counts bytes on the decoded text and never splits a character', async () => {
    const text = 'ą'.repeat(10); // 2 bytes each
    const harness = createHarness({
      'Network.getResponseBody': {
        body: Buffer.from(text, 'utf8').toString('base64'),
        base64Encoded: true,
      },
    });
    await recordFinishedRequest(harness);

    const first = (await harness.service.callTool('getResponseBody', {
      requestId: 'req-1',
      maxBytes: 5,
    })) as Record<string, unknown>;

    expect(first).toMatchObject({
      decoded: true,
      body: 'ąą',
      totalBytes: 20,
      truncated: true,
      nextOffset: 4,
    });

    const rest = (await harness.service.callTool('getResponseBody', {
      requestId: 'req-1',
      offset: first.nextOffset,
      maxBytes: 100,
    })) as Record<string, unknown>;
    expect(rest).toMatchObject({ body: 'ą'.repeat(8), truncated: false });
  });

  it('ends a window before an emoji that would cross maxBytes, like network-activity', async () => {
    const harness = createHarness({
      'Network.getResponseBody': { body: 'ab😀cd', base64Encoded: false },
    });
    await recordFinishedRequest(harness);

    const first = (await harness.service.callTool('getResponseBody', {
      requestId: 'req-1',
      maxBytes: 4,
    })) as Record<string, unknown>;
    expect(first).toMatchObject({ body: 'ab', totalBytes: 8, truncated: true, nextOffset: 2 });

    const second = (await harness.service.callTool('getResponseBody', {
      requestId: 'req-1',
      offset: 2,
      maxBytes: 4,
    })) as Record<string, unknown>;
    expect(second).toMatchObject({ body: '😀', truncated: true, nextOffset: 6 });
  });

  it('counts the raw string for a body left base64-encoded', async () => {
    const raw = Buffer.from(new Uint8Array(30)).toString('base64');
    const harness = createHarness({
      'Network.getResponseBody': { body: raw, base64Encoded: true },
    });
    await recordFinishedRequest(harness);
    harness.emit('Network.responseReceived', {
      requestId: 'req-1',
      response: { status: 200, mimeType: 'image/png' },
    });

    const result = (await harness.service.callTool('getResponseBody', {
      requestId: 'req-1',
      maxBytes: 8,
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      decoded: false,
      base64Encoded: true,
      body: raw.slice(0, 8),
      totalBytes: raw.length,
      truncated: true,
    });
  });

  it('bounds the request body the same way', async () => {
    const harness = createHarness({
      'Network.getRequestPostData': { postData: bigBody },
    });
    await recordFinishedRequest(harness);

    const result = (await harness.service.callTool('getRequestBody', {
      requestId: 'req-1',
      maxBytes: 100,
    })) as Record<string, unknown>;

    expect((result.body as string).length).toBe(100);
    expect(result).toMatchObject({ totalBytes: 20_000, truncated: true, nextOffset: 100 });
  });

  it('rejects an invalid window', async () => {
    const harness = createHarness();
    await recordFinishedRequest(harness);

    await expect(
      harness.service.callTool('getResponseBody', { requestId: 'req-1', maxBytes: 0 }),
    ).rejects.toThrow(/"maxBytes"/);
    await expect(
      harness.service.callTool('getRequestBody', { requestId: 'req-1', offset: -1 }),
    ).rejects.toThrow(/"offset"/);
  });
});
