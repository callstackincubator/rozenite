import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecorder } from '../recorder';

describe('createRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits request-sent immediately with the given meta', () => {
    const recorder = createRecorder();
    const onRequestSent = vi.fn();
    recorder.on('request-sent', onRequestSent);

    const handle = recorder.begin({
      url: 'https://example.com',
      method: 'GET',
      headers: { accept: 'application/json' },
      type: 'XHR',
      source: 'builtin',
      initiator: { type: 'other' },
    });

    expect(onRequestSent).toHaveBeenCalledWith({
      requestId: handle.requestId,
      timestamp: 1_000,
      request: {
        url: 'https://example.com',
        method: 'GET',
        headers: { accept: 'application/json' },
        postData: undefined,
      },
      initiator: { type: 'other' },
      type: 'XHR',
      source: 'builtin',
    });
  });

  it('computes ttfb from markHeadersReceived, not from headers()', () => {
    const recorder = createRecorder();
    const onCompleted = vi.fn();
    recorder.on('request-completed', onCompleted);

    const handle = recorder.begin({
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      type: 'XHR',
      source: 'builtin',
      initiator: { type: 'other' },
    });

    vi.setSystemTime(1_040);
    handle.markHeadersReceived();

    vi.setSystemTime(1_100);
    handle.headers({
      status: 200,
      statusText: 'OK',
      headers: {},
      contentType: 'text/plain',
      size: 5,
    });

    vi.setSystemTime(1_200);
    handle.end({ size: 5 });

    expect(onCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 200, ttfb: 40, source: 'builtin' }),
    );
  });

  it('falls back to headers() for ttfb when markHeadersReceived was not called', () => {
    const recorder = createRecorder();
    const onCompleted = vi.fn();
    recorder.on('request-completed', onCompleted);

    const handle = recorder.begin({
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      type: 'Fetch',
      source: 'expo',
      initiator: { type: 'other' },
    });

    vi.setSystemTime(1_080);
    handle.headers({
      status: 200,
      statusText: 'OK',
      headers: {},
      contentType: 'application/json',
      size: 5,
    });

    vi.setSystemTime(1_150);
    handle.end({ size: 5 });

    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ ttfb: 80, duration: 150 }));
  });

  it('resolves a registered body thunk lazily, and null for an unknown request', async () => {
    const recorder = createRecorder();
    const handle = recorder.begin({
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      type: 'XHR',
      source: 'builtin',
      initiator: { type: 'other' },
    });

    const thunk = vi.fn(async () => 'lazy body');
    handle.setBodyThunk(thunk);

    expect(thunk).not.toHaveBeenCalled();
    await expect(recorder.getResponseBody(handle.requestId)).resolves.toBe('lazy body');
    expect(thunk).toHaveBeenCalledTimes(1);

    await expect(recorder.getResponseBody('unknown-request')).resolves.toBeNull();
  });

  it('registers an already-resolved body from end()', async () => {
    const recorder = createRecorder();
    const handle = recorder.begin({
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      type: 'Fetch',
      source: 'nitro',
      initiator: { type: 'other' },
    });

    handle.end({ size: 3, body: '{"ok":true}' });

    await expect(recorder.getResponseBody(handle.requestId)).resolves.toBe('{"ok":true}');
  });

  it('evicts a response body after the five-minute TTL', async () => {
    const recorder = createRecorder();
    const handle = recorder.begin({
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      type: 'XHR',
      source: 'builtin',
      initiator: { type: 'other' },
    });
    handle.setBodyThunk(() => 'hello');

    await expect(recorder.getResponseBody(handle.requestId)).resolves.toBe('hello');

    vi.setSystemTime(1_000 + 5 * 60 * 1000 + 1);

    await expect(recorder.getResponseBody(handle.requestId)).resolves.toBeNull();
  });

  it('emits request-failed without touching the body registry', async () => {
    const recorder = createRecorder();
    const onFailed = vi.fn();
    recorder.on('request-failed', onFailed);

    const handle = recorder.begin({
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      type: 'XHR',
      source: 'builtin',
      initiator: { type: 'other' },
    });

    handle.fail('Aborted', true);

    expect(onFailed).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Aborted', canceled: true, type: 'XHR', source: 'builtin' }),
    );
    await expect(recorder.getResponseBody(handle.requestId)).resolves.toBeNull();
  });
});
