// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { xmlRenderer } from '../xml';
import type { RenderCtx } from '../types';

const baseCtx: RenderCtx = {
  contentType: 'application/xml',
  url: 'https://example.com/feed.xml',
};

const renderXml = (view: 'preview' | 'raw', body: string) =>
  render(xmlRenderer.render({ view, body, ctx: baseCtx }) as ReactElement);

const VALID_XML =
  '<feed xmlns="http://www.w3.org/2005/Atom"><title>Demo</title></feed>';

describe('xmlRenderer', () => {
  it('declares both preview and raw views with preview as default', () => {
    expect(xmlRenderer.views).toEqual(['preview', 'raw']);
    expect(xmlRenderer.defaultView).toBe('preview');
  });

  it('supports override (XML bodies are strings — the editor works on them)', () => {
    expect(xmlRenderer.supportsOverride).toBe(true);
  });

  describe('preview view', () => {
    it('renders the parsed XML tree (tag names visible)', () => {
      renderXml('preview', VALID_XML);
      // Each non-self-closing element renders both an open and a close
      // tag with the same name — two occurrences each is expected.
      expect(screen.getAllByText('feed').length).toBeGreaterThan(0);
      expect(screen.getAllByText('title').length).toBeGreaterThan(0);
      expect(screen.getByText('Demo')).toBeInTheDocument();
    });
  });

  describe('raw view', () => {
    it('renders the XML source as text and does not render a tree', () => {
      renderXml('raw', VALID_XML);
      // The full source should be present as a CodeBlock text node.
      expect(screen.getByText(VALID_XML)).toBeInTheDocument();
      // The tag-name span (used by the tree, with the standalone text
      // "feed" inside a styled span) should not appear when raw — the
      // raw source contains "feed" only inside the larger XML literal.
      const standaloneFeed = screen
        .queryAllByText('feed')
        .filter((el) => el.tagName.toLowerCase() === 'span');
      expect(standaloneFeed).toHaveLength(0);
    });
  });

  describe('malformed XML', () => {
    it('falls back to source + warning when parser produces a parsererror element', () => {
      // Forces the Chrome-style failure where DOMParser returns a
      // Document whose documentElement IS the parsererror element.
      const MALFORMED = '<feed><unclosed></feed>';
      renderXml('preview', MALFORMED);
      expect(screen.getByText(MALFORMED)).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to parse as XML, showing as raw text/),
      ).toBeInTheDocument();
    });

    it('also flags Firefox-style nested parsererror (namespace-aware detection)', () => {
      // Build a Document by hand that mimics Firefox's failure shape:
      // a valid documentElement that nests a <parsererror> in the
      // Firefox XML-parser-error namespace. The hasParseError helper
      // must detect this via getElementsByTagNameNS, not just by
      // checking documentElement.nodeName.
      //
      // We can't easily force the Firefox parser path inside jsdom,
      // but we can verify the detector via a hand-crafted body that
      // includes the FF namespace as XML — when DOMParser parses it,
      // the resulting document will contain a parsererror in that NS.
      const FIREFOX_LIKE =
        '<root xmlns:px="http://www.mozilla.org/newlayout/xml/parsererror.xml"><px:parsererror>broken</px:parsererror></root>';
      renderXml('preview', FIREFOX_LIKE);
      expect(
        screen.getByText(/Failed to parse as XML, showing as raw text/),
      ).toBeInTheDocument();
    });
  });

  describe('content-type acceptance', () => {
    it('renders an application/xhtml+xml body as a tree', () => {
      const XHTML =
        '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Hi</p></body></html>';
      renderXml('preview', XHTML);
      // Each element renders open + close, so 2x per tag.
      expect(screen.getAllByText('html').length).toBeGreaterThan(0);
      expect(screen.getAllByText('body').length).toBeGreaterThan(0);
      expect(screen.getAllByText('p').length).toBeGreaterThan(0);
      expect(screen.getByText('Hi')).toBeInTheDocument();
    });
  });
});
