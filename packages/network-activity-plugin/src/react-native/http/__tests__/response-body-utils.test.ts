// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  BINARY_CAPTURE_SIZE_CAP,
  captureResponseBodyFromBytes,
  createProgressThrottler,
  getFetchContentLength,
  getFetchContentType,
  normalizeFetchRequest,
  normalizeHeaders,
} from '../response-body-utils';

describe('normalizeHeaders', () => {
  it('normalizes plain object headers', () => {
    expect(normalizeHeaders({ Accept: 'application/json', 'x-token': 'abc' })).toEqual({
      Accept: 'application/json',
      'x-token': 'abc',
    });
  });

  it('normalizes array headers and preserves repeated values', () => {
    expect(
      normalizeHeaders([
        ['set-cookie', 'a=1'],
        ['set-cookie', 'b=2'],
      ]),
    ).toEqual({ 'set-cookie': ['a=1', 'b=2'] });
  });

  it('normalizes Headers instances', () => {
    const headers = new Headers([
      ['content-type', 'application/json'],
      ['x-id', '123'],
    ]);
    expect(normalizeHeaders(headers)).toEqual({
      'content-type': 'application/json',
      'x-id': '123',
    });
  });
});

describe('normalizeFetchRequest', () => {
  it('normalizes string input and request init options', () => {
    const result = normalizeFetchRequest('https://example.com/api', {
      method: 'post',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({ ok: true }),
    });

    expect(result).toEqual({
      url: 'https://example.com/api',
      method: 'POST',
      headers: { Accept: 'application/json' },
      postData: { type: 'text', value: '{"ok":true}' },
    });
  });

  it('normalizes Request input and replaces inherited headers with init headers', () => {
    const request = new Request('https://example.com/items', {
      method: 'put',
      headers: { 'x-original': 'one' },
    });

    expect(
      normalizeFetchRequest(request, { headers: { 'x-original': 'two', 'x-extra': 'three' } }),
    ).toMatchObject({
      url: 'https://example.com/items',
      method: 'PUT',
      headers: { 'x-original': 'two', 'x-extra': 'three' },
      postData: undefined,
      signal: expect.any(AbortSignal),
    });
  });

  it('serializes URLSearchParams request bodies as text', () => {
    const result = normalizeFetchRequest('https://example.com/search', {
      body: new URLSearchParams({ q: 'expo fetch' }),
    });
    expect(result.postData).toEqual({ type: 'text', value: 'q=expo+fetch' });
  });
});

describe('captureResponseBodyFromBytes', () => {
  it('returns text for JSON, XML, and text content types', async () => {
    expect(
      captureResponseBodyFromBytes(new TextEncoder().encode('{"ok":true}'), 'application/json'),
    ).toBe('{"ok":true}');
    expect(
      captureResponseBodyFromBytes(new TextEncoder().encode('<root />'), 'application/xml'),
    ).toBe('<root />');
  });

  it('returns a binary union for non-text bytes under the cap', async () => {
    expect(captureResponseBodyFromBytes(new Uint8Array([1, 2, 3]), 'application/pdf')).toEqual({
      kind: 'binary',
      base64: 'AQID',
    });
  });

  it('short-circuits binary capture above the cap', async () => {
    const bytes = new Uint8Array(BINARY_CAPTURE_SIZE_CAP + 1);
    expect(captureResponseBodyFromBytes(bytes, 'application/octet-stream')).toEqual({
      kind: 'binary-too-large',
      size: BINARY_CAPTURE_SIZE_CAP + 1,
    });
  });
});

describe('progress throttling and fetch response metadata helpers', () => {
  it('throttles progress emissions', () => {
    const shouldEmit = createProgressThrottler(100);
    expect(shouldEmit(1_000)).toBe(true);
    expect(shouldEmit(1_050)).toBe(false);
    expect(shouldEmit(1_100)).toBe(true);
  });

  it('reads fetch response metadata from headers', () => {
    const response = new Response('hello', {
      headers: { 'content-type': 'application/json; charset=utf-8', 'content-length': '12' },
    });
    expect(getFetchContentType(response)).toBe('application/json');
    expect(getFetchContentLength(response)).toBe(12);
  });
});
