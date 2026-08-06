// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  TEXT_CHUNK_SIZE,
  VIRTUALIZED_TEXT_THRESHOLD,
} from '../large-value-viewer-state';

vi.mock('react-virtuoso', async () => {
  const React = await import('react');
  return {
    Virtuoso: ({ totalCount, itemContent, ...props }: any) =>
      React.createElement(
        'div',
        { ...props, 'data-testid': 'virtuoso' },
        Array.from({ length: Math.min(totalCount, 4) }, (_, index) =>
          React.createElement('div', { key: index }, itemContent(index)),
        ),
      ),
  };
});

import { HexdumpValueViewer, TextValueViewer } from '../large-value-viewer';

describe('large value viewers', () => {
  afterEach(cleanup);

  it('renders only virtualized chunks for a large single-line string', () => {
    const value = 'x'.repeat(VIRTUALIZED_TEXT_THRESHOLD + TEXT_CHUNK_SIZE);
    const { container } = render(<TextValueViewer value={value} />);

    expect(screen.getByTestId('virtuoso')).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-testid="virtuoso"] > div'),
    ).toHaveLength(4);
    expect(container.textContent).toHaveLength(TEXT_CHUNK_SIZE * 4 + 1);
    expect(container.textContent).not.toBe(value);
  });

  it('formats only visible hexdump rows for a large buffer', () => {
    const bytes = new Array(16 * 1_000).fill(0x41);
    const { container } = render(<HexdumpValueViewer bytes={bytes} />);

    expect(screen.getByTestId('virtuoso')).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-testid="virtuoso"] > div'),
    ).toHaveLength(4);
    expect(container.textContent).toContain('00000000');
    expect(container.textContent).not.toContain('00003e70');
  });

  it('drops virtualized value markup when its detail interaction closes', () => {
    const { container, unmount } = render(
      <TextValueViewer
        value={'x'.repeat(VIRTUALIZED_TEXT_THRESHOLD + TEXT_CHUNK_SIZE)}
      />,
    );

    unmount();
    expect(container.textContent).toBe('');
  });
});
