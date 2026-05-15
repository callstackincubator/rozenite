import * as React from 'react';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});

// `react-virtuoso` doesn't render rows in jsdom — the underlying
// element-resize observation never fires without a real browser
// layout. Replace it with a non-virtualized passthrough so RTL tests
// can assert on the actual row content. Production code is unaffected.
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    totalCount,
    itemContent,
  }: {
    totalCount: number;
    itemContent: (index: number) => React.ReactNode;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'virtuoso-mock' },
      ...Array.from({ length: totalCount }, (_, i) =>
        React.createElement('div', { key: i }, itemContent(i)),
      ),
    ),
}));
