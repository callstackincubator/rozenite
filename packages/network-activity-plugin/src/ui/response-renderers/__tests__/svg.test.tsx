// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { svgRenderer } from '../svg';
import type { RenderCtx } from '../types';

const ctx: RenderCtx = {
  contentType: 'image/svg+xml',
  url: 'https://example.com/icon.svg',
};

const SVG_SOURCE =
  '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';

const renderSvg = (view: 'preview' | 'raw', body = SVG_SOURCE) =>
  render(svgRenderer.render({ view, body, ctx }) as ReactElement);

describe('svgRenderer', () => {
  it('declares both preview and raw views with preview as default', () => {
    expect(svgRenderer.views).toEqual(['preview', 'raw']);
    expect(svgRenderer.defaultView).toBe('preview');
  });

  it('does not support override (keeps parity with binary image semantics)', () => {
    expect(svgRenderer.supportsOverride).toBe(false);
  });

  it('renders an <img> with a utf8 data URL in preview — never base64', () => {
    renderSvg('preview');
    const img = screen.getByRole('img');
    const src = img.getAttribute('src') ?? '';
    expect(src.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    // The encoded payload must round-trip back to the original source —
    // proves we URL-encoded the SVG text rather than dropping it.
    const encoded = src.slice('data:image/svg+xml;utf8,'.length);
    expect(decodeURIComponent(encoded)).toBe(SVG_SOURCE);
  });

  it('renders the SVG source verbatim (not base64) in raw view', () => {
    renderSvg('raw');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(SVG_SOURCE)).toBeInTheDocument();
  });
});
