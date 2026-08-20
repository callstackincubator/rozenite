import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RozeniteDevToolsRequestAbortedError,
  RozeniteDevToolsRequestClientClosedError,
  RozeniteDevToolsRequestResponseError,
  RozeniteDevToolsRequestTimeoutError,
  getRozeniteDevToolsClient,
} from './client.js';

type EventMap = {
  request: { requestId: string; value: string };
  response: { requestId: string; value: string };
  failure: { requestId: string; message: string };
};

// Built directly on the `channel` injection seam (`RozeniteDevToolsClientOptions`)
// instead of `vi.mock('./channel/factory.js', ...)` — the seam makes mocking
// the module unnecessary, since a fake `Channel` can just be passed in.
const mocks = (() => {
  const listeners = new Set<(message: unknown) => void>();
  const send = vi.fn();
  const close = vi.fn();

  const channel = {
    send,
    onMessage: (listener: (message: unknown) => void) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    close,
  };

  return {
    channel,
    emit: (type: string, payload: unknown) => {
      listeners.forEach((listener) => {
        listener({ pluginId: 'test-plugin', type, payload });
      });
    },
    reset: () => {
      listeners.clear();
      send.mockReset();
      close.mockReset();
    },
  };
})();

const createClient = () =>
  getRozeniteDevToolsClient<EventMap>('test-plugin', { channel: mocks.channel });

describe('RozeniteDevToolsClient request', () => {
  afterEach(() => {
    mocks.reset();
    vi.useRealTimers();
  });

  it('correlates concurrent requests by request ID', async () => {
    const client = await createClient();
    const first = client.request({
      requestType: 'request',
      responseType: 'response',
      payload: { value: 'first' },
      requestId: 'first',
    });
    const second = client.request({
      requestType: 'request',
      responseType: 'response',
      payload: { value: 'second' },
      requestId: 'second',
    });

    mocks.emit('response', { requestId: 'second', value: 'second result' });
    mocks.emit('response', { requestId: 'first', value: 'first result' });

    await expect(first).resolves.toEqual({
      requestId: 'first',
      value: 'first result',
    });
    await expect(second).resolves.toEqual({
      requestId: 'second',
      value: 'second result',
    });
    expect(mocks.channel.send).toHaveBeenNthCalledWith(1, {
      pluginId: 'test-plugin',
      type: 'request',
      payload: { requestId: 'first', value: 'first' },
    });
    expect(mocks.channel.send).toHaveBeenNthCalledWith(2, {
      pluginId: 'test-plugin',
      type: 'request',
      payload: { requestId: 'second', value: 'second' },
    });
    client.close();
  });

  it('generates a request ID when one is not supplied', async () => {
    const client = await createClient();
    const request = client.request({
      requestType: 'request',
      responseType: 'response',
      payload: { value: 'generated' },
    });
    const [{ payload }] = mocks.channel.send.mock.calls.map(
      ([message]) => message as { payload: EventMap['request'] },
    );

    expect(payload.requestId).toEqual(expect.any(String));
    expect(payload.requestId).not.toHaveLength(0);

    mocks.emit('response', { requestId: payload.requestId, value: 'result' });
    await expect(request).resolves.toEqual({
      requestId: payload.requestId,
      value: 'result',
    });
    client.close();
  });

  it('rejects matching error responses and ignores late responses after abort', async () => {
    const client = await createClient();
    const controller = new AbortController();
    const aborted = client.request({
      requestType: 'request',
      responseType: 'response',
      payload: { value: 'abort' },
      requestId: 'aborted',
      signal: controller.signal,
    });

    controller.abort();
    mocks.emit('response', { requestId: 'aborted', value: 'too late' });
    await expect(aborted).rejects.toBeInstanceOf(RozeniteDevToolsRequestAbortedError);

    const failed = client.request({
      requestType: 'request',
      responseType: 'response',
      errorType: 'failure',
      payload: { value: 'fail' },
      requestId: 'failed',
    });
    mocks.emit('failure', { requestId: 'failed', message: 'nope' });

    await expect(failed).rejects.toMatchObject({
      name: RozeniteDevToolsRequestResponseError.name,
      payload: { requestId: 'failed', message: 'nope' },
    });
    client.close();
  });

  it('rejects timed-out requests and removes their response listener', async () => {
    vi.useFakeTimers();
    const client = await createClient();
    const request = client.request({
      requestType: 'request',
      responseType: 'response',
      payload: { value: 'slow' },
      requestId: 'timeout',
      timeoutMs: 10,
    });
    const assertion = expect(request).rejects.toBeInstanceOf(RozeniteDevToolsRequestTimeoutError);

    await vi.advanceTimersByTimeAsync(10);
    mocks.emit('response', { requestId: 'timeout', value: 'too late' });

    await assertion;
    client.close();
  });

  it('rejects pending requests when the client closes', async () => {
    const client = await createClient();
    const request = client.request({
      requestType: 'request',
      responseType: 'response',
      payload: { value: 'pending' },
      requestId: 'closed',
    });
    const assertion = expect(request).rejects.toBeInstanceOf(
      RozeniteDevToolsRequestClientClosedError,
    );

    client.close();
    mocks.emit('response', { requestId: 'closed', value: 'too late' });

    await assertion;
    expect(mocks.channel.close).toHaveBeenCalledOnce();
  });
});
