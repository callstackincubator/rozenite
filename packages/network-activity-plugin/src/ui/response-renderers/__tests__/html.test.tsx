// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { htmlRenderer } from '../html';
import type { RenderCtx } from '../types';

const baseCtx: RenderCtx = {
  contentType: 'text/html',
  url: 'https://example.com/page.html',
};

const HTML_BODY = '<!DOCTYPE html><html><body><h1>Hello</h1></body></html>';

const renderHtml = (
  view: 'preview' | 'raw',
  body = HTML_BODY,
  ctxOverride: Partial<RenderCtx> = {},
) =>
  render(
    htmlRenderer.render({
      view,
      body,
      ctx: { ...baseCtx, ...ctxOverride },
    }) as ReactElement,
  );

const getIframe = (container: HTMLElement): HTMLIFrameElement => {
  const iframe = container.querySelector('iframe');
  if (!iframe) throw new Error('expected an <iframe> in the rendered output');
  return iframe;
};

describe('htmlRenderer', () => {
  it('declares both preview and raw views with preview as default', () => {
    expect(htmlRenderer.views).toEqual(['preview', 'raw']);
    expect(htmlRenderer.defaultView).toBe('preview');
  });

  it('supports override (HTML bodies are strings — the editor works on them)', () => {
    expect(htmlRenderer.supportsOverride).toBe(true);
  });

  describe('preview view', () => {
    it('renders a sandboxed iframe', () => {
      const { container } = renderHtml('preview');
      const iframe = getIframe(container);
      // `sandbox=""` (empty value = all restrictions applied) is the
      // primary defense. Loosening this would let scripts run in the
      // captured response — never do it.
      expect(iframe.getAttribute('sandbox')).toBe('');
    });

    it('prepends the CSP meta tag to the srcdoc before the body', () => {
      const { container } = renderHtml('preview');
      const srcdoc = getIframe(container).getAttribute('srcdoc') ?? '';
      expect(
        srcdoc.startsWith('<meta http-equiv="Content-Security-Policy"'),
      ).toBe(true);
      expect(srcdoc).toContain("default-src 'none'");
      expect(srcdoc).toContain("style-src 'unsafe-inline'");
      expect(srcdoc).toContain('img-src data:');
      expect(srcdoc.endsWith(HTML_BODY)).toBe(true);
    });

    it('preserves the body verbatim — no stripping, no escaping', () => {
      const body = '<p>1 &lt; 2</p><!-- comment --><span attr="x">y</span>';
      const { container } = renderHtml('preview', body);
      const srcdoc = getIframe(container).getAttribute('srcdoc') ?? '';
      expect(srcdoc).toContain(body);
    });

    it('does not render a status banner when status is missing', () => {
      renderHtml('preview', HTML_BODY, { status: undefined });
      expect(screen.queryByText(/Server returned/)).toBeNull();
    });

    it('does not render a status banner for 2xx responses', () => {
      renderHtml('preview', HTML_BODY, { status: 200, statusText: 'OK' });
      expect(screen.queryByText(/Server returned/)).toBeNull();
    });

    it('does not render a status banner just below the 400 boundary', () => {
      renderHtml('preview', HTML_BODY, { status: 399 });
      expect(screen.queryByText(/Server returned/)).toBeNull();
    });

    it('renders a status banner at exactly 400', () => {
      renderHtml('preview', HTML_BODY, {
        status: 400,
        statusText: 'Bad Request',
      });
      expect(screen.getByText(/Server returned/)).toBeInTheDocument();
      expect(screen.getByText('400')).toBeInTheDocument();
      expect(screen.getByText(/Bad Request/)).toBeInTheDocument();
    });

    it('renders a status banner for 404', () => {
      renderHtml('preview', HTML_BODY, {
        status: 404,
        statusText: 'Not Found',
      });
      expect(screen.getByText(/Server returned/)).toBeInTheDocument();
      expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('renders a status banner for 5xx', () => {
      renderHtml('preview', HTML_BODY, {
        status: 500,
        statusText: 'Internal Server Error',
      });
      expect(screen.getByText(/Server returned/)).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
    });
  });

  describe('raw view', () => {
    it('renders the HTML source as text and does not render an iframe', () => {
      const { container } = renderHtml('raw');
      expect(container.querySelector('iframe')).toBeNull();
      expect(screen.getByText(HTML_BODY)).toBeInTheDocument();
    });

    it('never renders the status banner in raw view, even on error responses', () => {
      renderHtml('raw', HTML_BODY, { status: 500, statusText: 'Server Error' });
      expect(screen.queryByText(/Server returned/)).toBeNull();
    });
  });

  describe('xss attempt regression', () => {
    // jsdom does not execute iframe srcdoc, so we can't assert "the
    // script did not run." Instead we lock the *attributes* that prevent
    // execution: `sandbox=""` stays empty, the CSP meta is present, and
    // the script tag survives unmodified in srcdoc (we don't pre-strip —
    // sandbox blocks execution at the iframe boundary). A future change
    // that loosens `sandbox` or drops the CSP prefix will fail this test.
    const XSS_BODY =
      '<html><body><script>window.__xssFired = true; alert(1)</script><p>after</p></body></html>';

    it('keeps sandbox empty even for HTML containing <script>', () => {
      const { container } = renderHtml('preview', XSS_BODY);
      expect(getIframe(container).getAttribute('sandbox')).toBe('');
    });

    it('keeps the CSP meta in srcdoc even for HTML containing <script>', () => {
      const { container } = renderHtml('preview', XSS_BODY);
      const srcdoc = getIframe(container).getAttribute('srcdoc') ?? '';
      expect(srcdoc).toContain('Content-Security-Policy');
    });

    it('does not strip script tags from the body — sandbox is the boundary', () => {
      const { container } = renderHtml('preview', XSS_BODY);
      const srcdoc = getIframe(container).getAttribute('srcdoc') ?? '';
      expect(srcdoc).toContain('<script>');
      expect(srcdoc).toContain('window.__xssFired');
    });
  });
});
