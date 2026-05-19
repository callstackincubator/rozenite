// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetadataCard } from '../MetadataCard';
import type { RenderCtx } from '../../response-renderers/types';

const baseCtx: RenderCtx = {
  contentType: 'application/pdf',
  url: 'https://example.com/api/files/report.pdf',
};

describe('MetadataCard', () => {
  beforeEach(() => {
    // jsdom doesn't implement URL.createObjectURL — stub it for the
    // download click test.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:fake-url'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it('shows the decoded byte size for a binary body', () => {
    // "AQID" decodes to 3 bytes.
    render(
      <MetadataCard body={{ kind: 'binary', base64: 'AQID' }} ctx={baseCtx} />,
    );
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('3 bytes')).toBeInTheDocument();
  });

  it('surfaces the Content-Length header when present', () => {
    render(
      <MetadataCard
        body={{ kind: 'binary', base64: 'AQID' }}
        ctx={{ ...baseCtx, headers: { 'Content-Length': '8192' } }}
      />,
    );
    expect(screen.getByText('Content-Length')).toBeInTheDocument();
    expect(screen.getByText('8192')).toBeInTheDocument();
  });

  it('uses the Content-Disposition filename when available', () => {
    render(
      <MetadataCard
        body={{ kind: 'binary', base64: 'AQID' }}
        ctx={{
          ...baseCtx,
          headers: {
            'Content-Disposition': 'attachment; filename="custom.pdf"',
          },
        }}
      />,
    );
    expect(screen.getByText('Filename')).toBeInTheDocument();
    expect(screen.getByText('custom.pdf')).toBeInTheDocument();
  });

  it('falls back to the URL last path segment for the filename', () => {
    render(
      <MetadataCard body={{ kind: 'binary', base64: 'AQID' }} ctx={baseCtx} />,
    );
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('shows an enabled Download button for a binary body', () => {
    render(
      <MetadataCard body={{ kind: 'binary', base64: 'AQID' }} ctx={baseCtx} />,
    );
    const button = screen.getByRole('button', { name: /download/i });
    expect(button).not.toBeDisabled();
  });

  it('fires the download flow when the button is clicked', () => {
    render(
      <MetadataCard body={{ kind: 'binary', base64: 'AQID' }} ctx={baseCtx} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('disables Download for the binary-too-large variant', () => {
    render(
      <MetadataCard
        body={{ kind: 'binary-too-large', size: 9_999_999 }}
        ctx={baseCtx}
      />,
    );
    const button = screen.getByRole('button', { name: /download/i });
    expect(button).toBeDisabled();
  });

  it('renders the body.size for binary-too-large entries', () => {
    render(
      <MetadataCard
        body={{ kind: 'binary-too-large', size: 8 * 1024 * 1024 }}
        ctx={baseCtx}
      />,
    );
    expect(screen.getByText('8.0 MB')).toBeInTheDocument();
  });
});
