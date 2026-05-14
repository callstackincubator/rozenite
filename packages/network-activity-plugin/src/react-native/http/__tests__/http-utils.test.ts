// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BINARY_CAPTURE_SIZE_CAP, getResponseBody } from '../http-utils';

type XHRStubOptions = {
  responseType?: XMLHttpRequestResponseType;
  responseText?: string;
  response?: unknown;
  contentType?: string;
};

const makeXHRStub = ({
  responseType = '',
  responseText = '',
  response = null,
  contentType = '',
}: XHRStubOptions): XMLHttpRequest =>
  ({
    responseType,
    responseText,
    response,
    getResponseHeader: (name: string) =>
      name.toLowerCase() === 'content-type' ? contentType : null,
  }) as unknown as XMLHttpRequest;

describe('getResponseBody', () => {
  it('returns plain text when responseType is empty', async () => {
    const xhr = makeXHRStub({
      responseType: '',
      responseText: 'hello world',
    });
    expect(await getResponseBody(xhr)).toBe('hello world');
  });

  it('returns plain text when responseType is "text"', async () => {
    const xhr = makeXHRStub({
      responseType: 'text',
      responseText: 'hello world',
    });
    expect(await getResponseBody(xhr)).toBe('hello world');
  });

  it('stringifies the JSON response when responseType is "json"', async () => {
    const xhr = makeXHRStub({
      responseType: 'json',
      response: { ok: true, n: 1 },
    });
    expect(await getResponseBody(xhr)).toBe('{"ok":true,"n":1}');
  });

  it('reads a text blob as text', async () => {
    const blob = new Blob(['<p>hello</p>'], { type: 'text/html' });
    const xhr = makeXHRStub({
      responseType: 'blob',
      response: blob,
      contentType: 'text/html; charset=utf-8',
    });
    expect(await getResponseBody(xhr)).toBe('<p>hello</p>');
  });

  it('reads a JSON blob as text', async () => {
    const blob = new Blob(['{"ok":true}'], { type: 'application/json' });
    const xhr = makeXHRStub({
      responseType: 'blob',
      response: blob,
      contentType: 'application/json',
    });
    expect(await getResponseBody(xhr)).toBe('{"ok":true}');
  });

  it('routes image/svg+xml through the text path so the source is preserved', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const xhr = makeXHRStub({
      responseType: 'blob',
      response: blob,
      contentType: 'image/svg+xml',
    });
    expect(await getResponseBody(xhr)).toBe(svg);
  });

  it('returns a binary union variant with base64 for an image blob under the cap', async () => {
    // Three bytes (0x01 0x02 0x03) base64-encodes to "AQID".
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const xhr = makeXHRStub({
      responseType: 'blob',
      response: blob,
      contentType: 'image/png',
    });
    const result = await getResponseBody(xhr);
    expect(result).toEqual({ kind: 'binary', base64: 'AQID' });
  });

  it('returns a binary-too-large variant without shipping bytes when the blob exceeds the cap', async () => {
    // Stub a blob whose .size lies — we only care about the size-check
    // path here, no FileReader.readAsDataURL should be invoked.
    const oversizedBlob = {
      size: BINARY_CAPTURE_SIZE_CAP + 1,
      type: 'image/jpeg',
    } as unknown as Blob;
    const xhr = makeXHRStub({
      responseType: 'blob',
      response: oversizedBlob,
      contentType: 'image/jpeg',
    });
    expect(await getResponseBody(xhr)).toEqual({
      kind: 'binary-too-large',
      size: BINARY_CAPTURE_SIZE_CAP + 1,
    });
  });

  it('returns null for non-image, non-text blob content-types (PR2 widens this)', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: 'application/pdf',
    });
    const xhr = makeXHRStub({
      responseType: 'blob',
      response: blob,
      contentType: 'application/pdf',
    });
    expect(await getResponseBody(xhr)).toBeNull();
  });

  it('returns null when no branch matches', async () => {
    const xhr = makeXHRStub({ responseType: 'arraybuffer' });
    expect(await getResponseBody(xhr)).toBeNull();
  });
});
