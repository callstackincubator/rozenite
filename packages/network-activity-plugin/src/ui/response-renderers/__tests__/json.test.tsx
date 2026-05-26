// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { jsonRenderer } from '../json';
import type { RenderCtx } from '../types';

const baseCtx: RenderCtx = {
  contentType: 'application/json',
  url: 'https://example.com/data.json',
};

const renderJson = (view: 'preview' | 'raw', body: string) =>
  render(jsonRenderer.render({ view, body, ctx: baseCtx }) as ReactElement);

const MINIFIED = '{"name":"alice","tags":["a","b"],"meta":{"id":42}}';

describe('jsonRenderer', () => {
  it('declares both preview and raw views with preview as default', () => {
    expect(jsonRenderer.views).toEqual(['preview', 'raw']);
    expect(jsonRenderer.defaultView).toBe('preview');
  });

  it('supports override (JSON bodies are strings)', () => {
    expect(jsonRenderer.supportsOverride).toBe(true);
  });

  describe('preview view', () => {
    it('renders the parsed JSON as a tree with keys and values visible', () => {
      renderJson('preview', MINIFIED);
      // react-json-tree renders the keys; we just need to confirm
      // some tree-shaped content is present, not the raw source.
      expect(screen.queryByText(MINIFIED)).toBeNull();
      // The values appear somewhere in the tree.
      expect(screen.getAllByText(/alice/).length).toBeGreaterThan(0);
    });
  });

  describe('raw view', () => {
    it('renders the JSON pretty-printed with 2-space indent, not the literal body', () => {
      const { container } = render(
        jsonRenderer.render({
          view: 'raw',
          body: MINIFIED,
          ctx: baseCtx,
        }) as ReactElement,
      );
      const text = container.textContent ?? '';
      // The literal minified source should NOT appear verbatim — the
      // raw view re-serializes with indentation.
      expect(text).not.toContain(MINIFIED);
      // The re-serialized output must be multi-line (proves indent
      // happened) and must contain 2-space indented keys.
      expect(text).toMatch(/\n/);
      expect(text).toMatch(/^ {2}"name"/m);
      // Sanity: round-tripping back through JSON.parse yields the
      // same logical value.
      expect(JSON.parse(text)).toEqual(JSON.parse(MINIFIED));
    });

    it('uses exactly 2 spaces per indent level', () => {
      const { container } = render(
        jsonRenderer.render({
          view: 'raw',
          body: '{"a":{"b":1}}',
          ctx: baseCtx,
        }) as ReactElement,
      );
      const text = container.textContent ?? '';
      // Nested key 'b' should be indented 4 spaces (two levels × 2).
      expect(text).toMatch(/^ {4}"b"/m);
    });
  });

  describe('malformed JSON', () => {
    it('falls back to source + warning in preview view', () => {
      const MALFORMED = '{ not valid json ]';
      renderJson('preview', MALFORMED);
      expect(screen.getByText(MALFORMED)).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to parse as JSON, showing as raw text/),
      ).toBeInTheDocument();
    });

    it('falls back to source + warning in raw view too (ignores active view)', () => {
      const MALFORMED = '{ not valid json ]';
      renderJson('raw', MALFORMED);
      expect(screen.getByText(MALFORMED)).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to parse as JSON, showing as raw text/),
      ).toBeInTheDocument();
    });
  });
});
