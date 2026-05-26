import { describe, expect, it } from 'vitest';
import {
  getContentTypeMime,
  isJsonContentType,
  isXmlContentType,
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

  it('recognizes application/xml and text/xml with parameters', () => {
    expect(isXmlContentType('application/xml')).toBe(true);
    expect(isXmlContentType('application/xml; charset=utf-8')).toBe(true);
    expect(isXmlContentType('text/xml')).toBe(true);
    expect(isXmlContentType('text/xml; charset=utf-8')).toBe(true);
  });

  it('recognizes RFC 7303 +xml content types (Atom, RSS, SOAP, XHTML, SVG, ...)', () => {
    expect(isXmlContentType('application/atom+xml')).toBe(true);
    expect(isXmlContentType('application/rss+xml')).toBe(true);
    expect(isXmlContentType('application/soap+xml; charset=utf-8')).toBe(true);
    expect(isXmlContentType('application/xhtml+xml')).toBe(true);
    // SVG is XML by structure — the predicate matches it. The registry
    // gives svgRenderer an earlier slot so it claims SVG first; that
    // ordering is verified separately in dispatch.test.ts.
    expect(isXmlContentType('image/svg+xml')).toBe(true);
  });

  it('is case-insensitive (normalizeContentType lowercases)', () => {
    expect(isXmlContentType('Application/XML')).toBe(true);
    expect(isXmlContentType('Application/Atom+XML')).toBe(true);
  });

  it('rejects non-xml content types', () => {
    expect(isXmlContentType('text/plain')).toBe(false);
    expect(isXmlContentType('text/html')).toBe(false);
    expect(isXmlContentType('application/json')).toBe(false);
    expect(isXmlContentType('application/xmlfoo')).toBe(false);
    expect(isXmlContentType(undefined)).toBe(false);
    expect(isXmlContentType(null)).toBe(false);
    expect(isXmlContentType('')).toBe(false);
  });
});
