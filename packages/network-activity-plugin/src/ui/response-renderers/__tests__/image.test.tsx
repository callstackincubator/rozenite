// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { imageRenderer } from '../image';
import type { RenderCtx } from '../types';

const ctx: RenderCtx = {
  contentType: 'image/png',
  url: 'https://example.com/cat.png',
};

const renderImage = (
  view: 'preview' | 'raw',
  base64 = 'AQID',
  override: Partial<RenderCtx> = {},
) =>
  render(
    imageRenderer.render({
      view,
      body: { kind: 'binary', base64 },
      ctx: { ...ctx, ...override },
    }) as ReactElement,
  );

describe('imageRenderer', () => {
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

  it('declares both preview and raw views with preview as default', () => {
    expect(imageRenderer.views).toEqual(['preview', 'raw']);
    expect(imageRenderer.defaultView).toBe('preview');
  });

  it('does not support override (binary bodies cannot round-trip through the override editor)', () => {
    expect(imageRenderer.supportsOverride).toBe(false);
  });

  it('renders an <img> with the correct base64 data URL in preview', () => {
    renderImage('preview', 'iVBORw0K');
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,iVBORw0K');
  });

  it('uses the ctx content-type in the data URL prefix, not a hard-coded one', () => {
    renderImage('preview', 'AQID', { contentType: 'image/jpeg' });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,AQID');
  });

  it('renders metadata card + hex view (no <img>) in raw view', () => {
    renderImage('raw', 'AQID');
    expect(screen.queryByRole('img')).toBeNull();
    // Metadata card: size + filename derived from URL.
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('3 bytes')).toBeInTheDocument();
    expect(screen.getByText('cat.png')).toBeInTheDocument();
    // HexView surfaces the bytes.
    expect(screen.getByText('00000000')).toBeInTheDocument();
    expect(screen.getByText('01 02 03')).toBeInTheDocument();
  });
});
