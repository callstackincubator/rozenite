import { describe, expect, it } from 'vitest';
import { applyBodyRange, DEFAULT_BODY_MAX_BYTES, sliceUtf8 } from '../body-range';
import { createNetworkActivityAgentState } from '../state';

describe('network activity body ranges', () => {
  it('returns 16384 bytes by default and reports the total', () => {
    const body = 'a'.repeat(DEFAULT_BODY_MAX_BYTES + 10);
    const result = applyBodyRange({ requestId: 'r', available: true, body });

    expect(result.body).toHaveLength(DEFAULT_BODY_MAX_BYTES);
    expect(result).toMatchObject({
      offset: 0,
      totalBytes: DEFAULT_BODY_MAX_BYTES + 10,
      truncated: true,
    });
  });

  it('reads the rest of a body from an offset', () => {
    const result = applyBodyRange(
      { requestId: 'r', available: true, body: 'abcdef' },
      { offset: 4, maxBytes: 10 },
    );

    expect(result).toMatchObject({ body: 'ef', offset: 4, totalBytes: 6, truncated: false });
  });

  it('counts UTF-8 bytes and never splits or repeats a character across ranges', () => {
    const text = 'aé€😀b';
    expect(sliceUtf8(text, 0, 1000).totalBytes).toBe(1 + 2 + 3 + 4 + 1);

    const pieces: string[] = [];
    for (let offset = 0; offset < 11; offset += 3) {
      pieces.push(sliceUtf8(text, offset, 3).text);
    }
    expect(pieces.join('')).toBe(text);
  });

  it('leaves unavailable bodies untouched and rejects invalid ranges', () => {
    const unavailable = { requestId: 'r', available: false, reason: 'none' };
    expect(applyBodyRange(unavailable)).toEqual(unavailable);
    expect(() => applyBodyRange(unavailable, { maxBytes: 0 })).toThrow('"maxBytes"');
    expect(() => applyBodyRange(unavailable, { offset: -1 })).toThrow('"offset"');
  });

  it('bounds getRequestBody', () => {
    const state = createNetworkActivityAgentState();
    state.startRecording();
    state.onRequestSent({
      requestId: 'req-1',
      timestamp: 1,
      request: {
        url: 'https://example.com',
        method: 'POST',
        headers: {},
        postData: { type: 'text', value: '0123456789' },
      },
      type: 'XHR',
      initiator: { type: 'other' },
    });

    expect(state.getRequestBody('req-1', { offset: 2, maxBytes: 3 })).toEqual({
      requestId: 'req-1',
      available: true,
      body: '234',
      base64Encoded: false,
      offset: 2,
      totalBytes: 10,
      truncated: true,
    });
  });
});
