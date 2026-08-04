// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  BINARY_CAPTURE_SIZE_CAP,
  captureFetchResponseBodyFromBytes,
  createProgressThrottler,
  getFetchContentLength,
  getFetchContentType,
  normalizeFetchRequest,
  normalizeHeaders,
} from '../fetch-utils';

describe('normalizeHeaders', () => {
  it('normalizes plain object headers', () => {
    expect(
      normalizeHeaders({
        Accept: 'application/json',
        'x-token': 'abc',
      }),
    ).toEqual({
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
    ).toEqual({
      'set-cookie': ['a=1', 'b=2'],
    });
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
      headers: {
        Accept: 'application/json',
      },
      body: JSON.stringify({ ok: true }),
    });

    expect(result).toEqual({
      url: 'https://example.com/api',
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      postData: {
        type: 'text',
        value: '{"ok":true}',
      },
    });
  });

  it('normalizes Request input and replaces inherited headers with init headers', () => {
    const request = new Request('https://example.com/items', {
      method: 'put',
      headers: {
        'x-original': 'one',
      },
    });

    expect(
      normalizeFetchRequest(request, {
        headers: {
          'x-original': 'two',
          'x-extra': 'three',
        },
      }),
    ).toMatchObject({
      url: 'https://example.com/items',
      method: 'PUT',
      headers: {
        'x-original': 'two',
        'x-extra': 'three',
      },
      postData: undefined,
      signal: expect.any(AbortSignal),
    });
  });

  it('normalizes Expo request-like inputs and gives init precedence', () => {
    const requestLike = {
      url: 'https://example.com/expo',
      method: 'patch',
      headers: { 'x-inherited': 'yes', 'x-replaced': 'old' },
      body: 'inherited body',
      signal: new AbortController().signal,
    };

    expect(
      normalizeFetchRequest(requestLike, {
        method: 'post',
        headers: { 'x-replaced': 'new' },
        body: 'init body',
      }),
    ).toMatchObject({
      url: 'https://example.com/expo',
      method: 'POST',
      headers: { 'x-replaced': 'new' },
      postData: { type: 'text', value: 'init body' },
    });
  });

  it('serializes URLSearchParams request bodies as text', () => {
    const result = normalizeFetchRequest('https://example.com/search', {
      body: new URLSearchParams({ q: 'expo fetch' }),
    });

    expect(result.postData).toEqual({
      type: 'text',
      value: 'q=expo+fetch',
    });
  });
});

describe('captureFetchResponseBodyFromBytes', () => {
  it('returns text for JSON, XML, and text content types', async () => {
    const json = new TextEncoder().encode('{"ok":true}');
    expect(
      await captureFetchResponseBodyFromBytes(json, 'application/json'),
    ).toBe('{"ok":true}');

    const xml = new TextEncoder().encode('<root />');
    expect(
      await captureFetchResponseBodyFromBytes(xml, 'application/xml'),
    ).toBe('<root />');

    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" />',
    );
    expect(await captureFetchResponseBodyFromBytes(svg, 'image/svg+xml')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" />',
    );
  });

  it('returns a binary union for non-text bytes under the cap', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(
      await captureFetchResponseBodyFromBytes(bytes, 'application/pdf'),
    ).toEqual({ kind: 'binary', base64: 'AQID' });
  });

  it('short-circuits binary capture above the cap', async () => {
    const bytes = new Uint8Array(BINARY_CAPTURE_SIZE_CAP + 1);
    expect(
      await captureFetchResponseBodyFromBytes(
        bytes,
        'application/octet-stream',
      ),
    ).toEqual({
      kind: 'binary-too-large',
      size: BINARY_CAPTURE_SIZE_CAP + 1,
    });
  });
});

describe('progress throttling and response metadata helpers', () => {
  it('throttles progress emissions and allows forced updates', () => {
    const shouldEmit = createProgressThrottler(100);

    expect(shouldEmit(1_000)).toBe(true);
    expect(shouldEmit(1_050)).toBe(false);
    expect(shouldEmit(1_100)).toBe(true);
    expect(shouldEmit(1_120, true)).toBe(true);
  });

  it('reads fetch response metadata from headers', () => {
    const response = new Response('hello', {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-length': '12',
      },
    });

    expect(getFetchContentType(response)).toBe('application/json');
    expect(getFetchContentLength(response)).toBe(12);
  });
});
