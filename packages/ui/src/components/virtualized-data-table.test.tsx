// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { VirtualizedDataTable } from './virtualized-data-table';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-virtuoso', async () => {
  const React = await import('react');

  return {
    TableVirtuoso: ({
      components,
      context,
      data = [],
      fixedHeaderContent,
      itemContent,
      startReached,
      endReached,
    }: Record<string, any>) => {
      const Table = components.Table;
      const TableRow = components.TableRow;
      const EmptyPlaceholder = components.EmptyPlaceholder;
      // Mimic virtualization: only a small viewport window reaches the DOM.
      const visibleRows = data.slice(0, 8);

      return React.createElement(
        'div',
        { 'data-testid': 'virtuoso-mock' },
        React.createElement(
          'button',
          { onClick: () => startReached?.(0), type: 'button' },
          'reach start',
        ),
        React.createElement(
          'button',
          { onClick: () => endReached?.(data.length - 1), type: 'button' },
          'reach end',
        ),
        React.createElement(
          Table,
          { context },
          React.createElement('thead', null, fixedHeaderContent()),
          React.createElement(
            'tbody',
            null,
            visibleRows.length === 0
              ? React.createElement(EmptyPlaceholder, { context })
              : visibleRows.map((item: unknown, index: number) =>
                  React.createElement(
                    TableRow,
                    {
                      context,
                      item,
                      key: (item as { id: string }).id,
                      'data-index': index,
                      'data-item-index': index,
                      'data-known-size': 20,
                    },
                    itemContent(index, item),
                  ),
                ),
          ),
        ),
      );
    },
  };
});

type TestRow = { id: string; name: string; detail: string };

const columns: ColumnDef<TestRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    enableSorting: true,
  },
  {
    accessorKey: 'detail',
    header: 'Detail',
    cell: ({ getValue }) => <div>{String(getValue())}</div>,
  },
];

const data = Array.from({ length: 30 }, (_, index) => ({
  detail: `detail-${index}`,
  id: `row-${index}`,
  name: `name-${index}`,
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

const renderTable = (
  props: Partial<ComponentProps<typeof VirtualizedDataTable<TestRow>>> = {},
) => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <VirtualizedDataTable
        ariaLabel="Entries"
        columns={columns}
        data={data}
        getRowId={(row) => row.id}
        {...props}
      />,
    );
  });

  return container;
};

describe('VirtualizedDataTable', () => {
  it('keeps body rows bounded and uses stable row ids', () => {
    const view = renderTable();
    const rows = view.querySelectorAll('tbody tr');

    expect(rows).toHaveLength(8);
    expect(rows[0]?.getAttribute('data-index')).toBe('0');
    expect(rows[0]?.getAttribute('aria-label')).toBe('row-0');
    expect(view.querySelector('table')?.getAttribute('aria-label')).toBe(
      'Entries',
    );
  });

  it('forwards both edge callbacks', () => {
    const onStartReached = vi.fn();
    const onEndReached = vi.fn();
    const view = renderTable({ onEndReached, onStartReached });
    const buttons = view.querySelectorAll('button');

    act(() => buttons[0].click());
    act(() => buttons[1].click());

    expect(onStartReached).toHaveBeenCalledExactlyOnceWith(0);
    expect(onEndReached).toHaveBeenCalledExactlyOnceWith(29);
  });

  it('supports sortable headers, accessible keyboard row activation, and dynamic cell content', () => {
    const onRowClick = vi.fn();
    const onSortingChange = vi.fn();
    const view = renderTable({ onRowClick, onSortingChange });
    const sortButton = Array.from(view.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Name'),
    );
    const firstRow = view.querySelector('tbody tr');

    expect(sortButton).toBeDefined();
    act(() => sortButton?.click());
    expect(onSortingChange).toHaveBeenCalledWith([{ desc: false, id: 'name' }]);

    expect(firstRow?.getAttribute('tabindex')).toBe('0');
    act(() =>
      firstRow?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
      ),
    );
    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(data[0]);
    expect(view.textContent).toContain('detail-0');
  });

  it('renders an accessible loading and empty state in semantic table markup', () => {
    const loadingView = renderTable({ data: [], loading: true });

    expect(loadingView.querySelector('tbody td')?.getAttribute('colspan')).toBe(
      '2',
    );
    expect(loadingView.textContent).toContain('Loading…');
  });
});
