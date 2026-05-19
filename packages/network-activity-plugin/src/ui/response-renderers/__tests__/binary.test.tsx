// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { binaryRenderer } from '../binary';
import type { RenderCtx } from '../types';

const ctx: RenderCtx = {
  contentType: 'application/pdf',
  url: 'https://example.com/files/report.pdf',
};

const renderBinary = (base64 = 'AQID', override: Partial<RenderCtx> = {}) =>
  render(
    binaryRenderer.render({
      view: 'raw',
      body: { kind: 'binary', base64 },
      ctx: { ...ctx, ...override },
    }) as ReactElement,
  );

describe('binaryRenderer', () => {
  beforeEach(() => {
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

  it('declares only a raw view — no toggle should appear', () => {
    expect(binaryRenderer.views).toEqual(['raw']);
    expect(binaryRenderer.defaultView).toBe('raw');
  });

  it('does not support override', () => {
    expect(binaryRenderer.supportsOverride).toBe(false);
  });

  it('matches binary bodies whose content-type is not an image', () => {
    expect(
      binaryRenderer.matches('application/pdf', {
        kind: 'binary',
        base64: 'AQID',
      }),
    ).toBe(true);
    expect(
      binaryRenderer.matches('application/octet-stream', {
        kind: 'binary',
        base64: 'AQID',
      }),
    ).toBe(true);
    expect(
      binaryRenderer.matches('audio/mpeg', {
        kind: 'binary',
        base64: 'AQID',
      }),
    ).toBe(true);
  });

  it('declines image binary bodies (those belong to imageRenderer)', () => {
    expect(
      binaryRenderer.matches('image/png', {
        kind: 'binary',
        base64: 'AQID',
      }),
    ).toBe(false);
    expect(
      binaryRenderer.matches('image/jpeg', {
        kind: 'binary',
        base64: 'AQID',
      }),
    ).toBe(false);
  });

  it('declines text bodies', () => {
    expect(binaryRenderer.matches('text/plain', 'hello')).toBe(false);
  });

  it('renders the metadata card + hex view together', () => {
    renderBinary('AQID');
    // Metadata card: size + filename from URL.
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('3 bytes')).toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    // Hex view: offset, hex pair, ASCII column.
    expect(screen.getByText('00000000')).toBeInTheDocument();
    expect(screen.getByText('01 02 03')).toBeInTheDocument();
    expect(screen.getByText('|...|')).toBeInTheDocument();
  });
});
