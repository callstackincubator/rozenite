// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { binaryTooLargeRenderer } from '../binary-too-large';

const ctx = {
  contentType: 'image/jpeg',
  url: 'https://example.com/huge.jpg',
};

describe('binaryTooLargeRenderer', () => {
  it('declares only the raw view — no toggle should appear', () => {
    expect(binaryTooLargeRenderer.views).toEqual(['raw']);
  });

  it('does not support override', () => {
    expect(binaryTooLargeRenderer.supportsOverride).toBe(false);
  });

  it('formats sub-1MB sizes in KB', () => {
    render(
      binaryTooLargeRenderer.render({
        view: 'raw',
        body: { kind: 'binary-too-large', size: 800 * 1024 },
        ctx,
      }) as ReactElement,
    );
    expect(screen.getByText(/800\.0 KB/)).toBeInTheDocument();
  });

  it('formats multi-megabyte sizes in MB', () => {
    render(
      binaryTooLargeRenderer.render({
        view: 'raw',
        body: { kind: 'binary-too-large', size: 12_500_000 },
        ctx,
      }) as ReactElement,
    );
    expect(screen.getByText(/11\.9 MB/)).toBeInTheDocument();
  });

  it('surfaces the size inside the "Response too large for preview" message', () => {
    render(
      binaryTooLargeRenderer.render({
        view: 'raw',
        body: { kind: 'binary-too-large', size: 6_000_000 },
        ctx,
      }) as ReactElement,
    );
    expect(
      screen.getByText(/Response too large for preview/),
    ).toBeInTheDocument();
  });
});
