import { describe, expect, it } from 'vitest';
import {
  getContentTypeMime,
  isJsonContentType,
} from '../getContentTypeMimeType';

describe('getContentTypeMimeType', () => {
  it('recognizes application/json content types with parameters', () => {
    expect(isJsonContentType('application/json; charset=utf-8')).toBe(true);
  });

  it('recognizes RFC 6839 +json content types', () => {
    expect(isJsonContentType('application/vnd.geo+json; charset=utf-8')).toBe(
      true,
    );
    expect(isJsonContentType('Application/LD+JSON')).toBe(true);
  });

  it('rejects non-json content types', () => {
    expect(isJsonContentType('text/plain')).toBe(false);
    expect(isJsonContentType(undefined)).toBe(false);
  });

  it('keeps the extracted mime type display-friendly', () => {
    expect(
      getContentTypeMime({
        'content-type': 'Application/LD+JSON; charset=utf-8',
      }),
    ).toBe('Application/LD+JSON');
  });
});
