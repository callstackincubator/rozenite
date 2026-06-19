import { describe, expect, it } from 'vitest';
import { findRenderer, renderers } from '../index';
import type { ResponseBody } from '../../../shared/client';

describe('findRenderer', () => {
  it('routes null body to the empty renderer', () => {
    expect(findRenderer('text/plain', null).id).toBe('empty');
  });

  it('routes binary-too-large bodies to the binary-too-large renderer', () => {
    const body: ResponseBody = { kind: 'binary-too-large', size: 9_999_999 };
    expect(findRenderer('image/png', body).id).toBe('binary-too-large');
  });

  it('routes image/svg+xml strings to the svg renderer (not the image renderer)', () => {
    expect(findRenderer('image/svg+xml', '<svg/>').id).toBe('svg');
  });

  it('routes image/png binary bodies to the image renderer', () => {
    const body: ResponseBody = { kind: 'binary', base64: 'AQID' };
    expect(findRenderer('image/png', body).id).toBe('image');
  });

  it('routes image/jpeg binary bodies to the image renderer', () => {
    const body: ResponseBody = { kind: 'binary', base64: 'AQID' };
    expect(findRenderer('image/jpeg', body).id).toBe('image');
  });

  it('routes non-image binary bodies to the binary renderer', () => {
    const body: ResponseBody = { kind: 'binary', base64: 'AQID' };
    expect(findRenderer('application/pdf', body).id).toBe('binary');
    expect(findRenderer('application/octet-stream', body).id).toBe('binary');
    expect(findRenderer('font/woff2', body).id).toBe('binary');
    expect(findRenderer('audio/mpeg', body).id).toBe('binary');
    expect(findRenderer('video/mp4', body).id).toBe('binary');
    expect(findRenderer('application/zip', body).id).toBe('binary');
  });

  it('routes JSON content-types to the json renderer', () => {
    expect(findRenderer('application/json', '{}').id).toBe('json');
    expect(findRenderer('application/json; charset=utf-8', '{}').id).toBe(
      'json',
    );
    expect(findRenderer('application/ld+json', '{}').id).toBe('json');
  });

  it('routes text/html (and its charset/case variants) to the html renderer', () => {
    expect(findRenderer('text/html', '<p/>').id).toBe('html');
    expect(findRenderer('text/html; charset=utf-8', '<p/>').id).toBe('html');
    // Case-insensitive — proves we use normalizeContentType, not startsWith.
    expect(findRenderer('text/HTML', '<p/>').id).toBe('html');
    // Empty-string HTML body is still claimed by html (matcher is
    // content-type-driven; the renderer happily produces a blank iframe).
    expect(findRenderer('text/html', '').id).toBe('html');
  });

  it('routes XML content-types (and RFC 7303 +xml variants) to the xml renderer', () => {
    expect(findRenderer('application/xml', '<x/>').id).toBe('xml');
    expect(findRenderer('text/xml', '<x/>').id).toBe('xml');
    expect(findRenderer('application/atom+xml', '<feed/>').id).toBe('xml');
    expect(findRenderer('application/rss+xml', '<rss/>').id).toBe('xml');
    expect(findRenderer('application/soap+xml; charset=utf-8', '<e/>').id).toBe(
      'xml',
    );
    expect(findRenderer('application/xhtml+xml', '<html/>').id).toBe('xml');
  });

  it('keeps image/svg+xml routed to svg even though it would match the +xml suffix', () => {
    // SVG matches isXmlContentType (it ends with +xml), but the registry
    // order places svgRenderer earlier — first hit wins.
    expect(findRenderer('image/svg+xml', '<svg/>').id).toBe('svg');
  });

  it('routes text/plain, application/javascript to the text fallback', () => {
    expect(findRenderer('text/plain', 'hi').id).toBe('text-fallback');
    expect(findRenderer('application/javascript', 'var a;').id).toBe(
      'text-fallback',
    );
  });

  it('routes string bodies with unknown content-types to the text fallback', () => {
    expect(findRenderer('application/x-weird', 'hello').id).toBe(
      'text-fallback',
    );
    expect(findRenderer('', 'hello').id).toBe('text-fallback');
  });

  it('falls through to the unknown renderer for unhandled non-null object bodies', () => {
    // Build an off-union body shape to confirm the defensive last
    // resort fires — should never happen in practice.
    const offUnion = { kind: 'something-else' } as unknown as ResponseBody;
    expect(findRenderer('application/octet-stream', offUnion).id).toBe(
      'unknown',
    );
  });

  it('places more specific matchers ahead of more general ones in the array', () => {
    const ids = renderers.map((r) => r.id);
    // svg must precede image; binary-too-large must precede image;
    // image must precede binary (both claim body.kind === 'binary');
    // empty must precede everything; unknown is the last entry.
    expect(ids.indexOf('svg')).toBeLessThan(ids.indexOf('image'));
    expect(ids.indexOf('binary-too-large')).toBeLessThan(ids.indexOf('image'));
    expect(ids.indexOf('image')).toBeLessThan(ids.indexOf('binary'));
    // html must precede text-fallback, otherwise text-fallback would
    // claim every text/html body before html ever ran.
    expect(ids.indexOf('html')).toBeLessThan(ids.indexOf('text-fallback'));
    // svg must precede xml because image/svg+xml matches both
    // predicates — registry order is the tiebreaker.
    expect(ids.indexOf('svg')).toBeLessThan(ids.indexOf('xml'));
    // xml must precede text-fallback, otherwise text-fallback would
    // claim every XML-ish body before xml ever ran.
    expect(ids.indexOf('xml')).toBeLessThan(ids.indexOf('text-fallback'));
    expect(ids.indexOf('empty')).toBe(0);
    expect(ids.indexOf('unknown')).toBe(ids.length - 1);
  });

  it('every renderer advertises a defaultView that appears in its views (or has empty views)', () => {
    for (const renderer of renderers) {
      if (renderer.views.length === 0) continue;
      expect(renderer.views).toContain(renderer.defaultView);
    }
  });
});
