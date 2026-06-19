// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  base64ToBlob,
  base64ToBytes,
  deriveFilename,
  readHeader,
} from '../download';

describe('base64ToBytes', () => {
  it('decodes "AQID" to the 3-byte sequence [1, 2, 3]', () => {
    expect(Array.from(base64ToBytes('AQID'))).toEqual([1, 2, 3]);
  });

  it('returns an empty array for the empty string', () => {
    expect(base64ToBytes('').byteLength).toBe(0);
  });
});

describe('base64ToBlob', () => {
  it('produces a Blob with the right content-type and byte length', () => {
    const blob = base64ToBlob('AQID', 'image/png');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(3);
  });

  it('falls back to application/octet-stream when no content-type is given', () => {
    const blob = base64ToBlob('AQID', '');
    expect(blob.type).toBe('application/octet-stream');
  });
});

describe('readHeader', () => {
  it('returns the value for a case-insensitive lookup', () => {
    expect(readHeader({ 'Content-Length': '42' }, 'content-length')).toBe('42');
    expect(readHeader({ 'content-type': 'text/html' }, 'Content-Type')).toBe(
      'text/html',
    );
  });

  it('returns the first value when the header carries an array', () => {
    expect(readHeader({ 'Set-Cookie': ['a=1', 'b=2'] }, 'Set-Cookie')).toBe(
      'a=1',
    );
  });

  it('returns undefined for missing headers or missing headers map', () => {
    expect(readHeader(undefined, 'Content-Type')).toBeUndefined();
    expect(readHeader({}, 'Content-Type')).toBeUndefined();
  });
});

describe('deriveFilename', () => {
  it('prefers Content-Disposition filename when present', () => {
    expect(
      deriveFilename({
        headers: {
          'Content-Disposition': 'attachment; filename="report.pdf"',
        },
        url: 'https://example.com/api/download?id=42',
        contentType: 'application/pdf',
      }),
    ).toBe('report.pdf');
  });

  it('prefers RFC 5987 filename* when both forms are present', () => {
    expect(
      deriveFilename({
        headers: {
          'Content-Disposition':
            'attachment; filename="fallback.bin"; filename*=UTF-8\'\'spaced%20name.bin',
        },
        url: 'https://example.com/api/x',
        contentType: 'application/octet-stream',
      }),
    ).toBe('spaced name.bin');
  });

  it('falls back to the URL last path segment when no Content-Disposition', () => {
    expect(
      deriveFilename({
        url: 'https://cdn.example.com/files/sub/document.pdf?ver=2',
        contentType: 'application/pdf',
      }),
    ).toBe('document.pdf');
  });

  it('uses the .bin fallback for unrecognised content-types when nothing else matches', () => {
    // No headers, opaque URL (no usable path segments), unknown content-type.
    expect(
      deriveFilename({
        url: 'https://api.example.com/',
        contentType: 'application/x-protobuf',
      }),
    ).toBe('response.bin');
  });

  it('uses a known extension from the content-type map when no name elsewhere', () => {
    expect(
      deriveFilename({
        url: 'https://api.example.com/',
        contentType: 'image/png',
      }),
    ).toBe('response.png');
  });

  it('strips parameters off the content-type before lookup', () => {
    expect(
      deriveFilename({
        url: 'https://api.example.com/',
        contentType: 'application/json; charset=utf-8',
      }),
    ).toBe('response.json');
  });
});
