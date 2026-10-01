// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { disableXhrHook, enableXhrHook } from '../xhr-hook';
import type { Recorder, RecorderHandle } from '../recorder';

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

afterEach(() => {
  disableXhrHook();
});

describe('xhr-hook', () => {
  it('maps a timeout event to a "Timeout" failure', () => {
    const { recorder, calls } = createFakeRecorder();
    enableXhrHook(recorder);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://example.com/slow');
    xhr.send();
    // Synthesize the timeout the real network stack would fire, rather than
    // waiting on jsdom's actual (network-backed) request lifecycle.
    xhr.dispatchEvent(new Event('timeout'));

    expect(calls).toContainEqual({ method: 'fail', args: ['Timeout', false] });
    expect(calls.find((c) => c.method === 'begin')?.args[0]).toMatchObject({
      type: 'XHR',
      source: 'builtin',
    });
  });

  it('leaves a patch buried under a third-party patch inert after disable and re-enable', () => {
    const { recorder, calls } = createFakeRecorder();
    enableXhrHook(recorder);

    // Another library patches over us, so disable() must leave its patch in
    // place; our buried patch must then record nothing once re-enabled.
    const ours = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: [unknown?]) {
      return ours.apply(this, args as [Document | XMLHttpRequestBodyInit | null | undefined]);
    };
    disableXhrHook();
    enableXhrHook(recorder);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://example.com/');
    xhr.send();

    expect(calls.filter((c) => c.method === 'begin')).toHaveLength(1);
  });

  it('lowercases and stringifies request headers, last value wins', () => {
    const { recorder, calls } = createFakeRecorder();
    enableXhrHook(recorder);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://example.com/api');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-Count', 3 as unknown as string);
    xhr.setRequestHeader('accept', 'text/plain');
    xhr.send();

    const begin = calls.find((c) => c.method === 'begin');
    expect((begin?.args[0] as { headers: Record<string, string> }).headers).toEqual({
      accept: 'text/plain', // last value wins, not merged into an array
      'x-count': '3', // stringified
    });
  });
});
