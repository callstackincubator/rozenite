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
          // Like the real component, the empty placeholder sits straight inside the table.
          visibleRows.length === 0
            ? React.createElement(EmptyPlaceholder, { context })
            : React.createElement(
                'tbody',
                null,
                visibleRows.map((item: unknown, index: number) =>
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

const renderTable = (props: Partial<ComponentProps<typeof VirtualizedDataTable<TestRow>>> = {}) => {
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
    expect(view.querySelector('table')?.getAttribute('aria-label')).toBe('Entries');
    expect(view.querySelector('thead tr')?.className).toContain('border-b border-border');
    expect(view.querySelector('th')?.className).toContain('text-faint');
    expect(rows[0]?.className).toContain('border-b border-border');
    expect(rows[0]?.querySelector('td')?.className).toContain('px-3 py-1.5 text-foreground');
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
    const sortButton = Array.from(view.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Name'),
    );
    const firstRow = view.querySelector('tbody tr');

    expect(sortButton).toBeDefined();
    act(() => sortButton?.click());
    expect(onSortingChange).toHaveBeenCalledWith([{ desc: false, id: 'name' }]);

    expect(firstRow?.getAttribute('tabindex')).toBe('0');
    act(() =>
      firstRow?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })),
    );
    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(data[0]);
    expect(view.textContent).toContain('detail-0');
  });

  it('renders an accessible loading and empty state in semantic table markup', () => {
    const loadingView = renderTable({ data: [], loading: true });

    expect(loadingView.querySelector('tbody td')?.getAttribute('colspan')).toBe('2');
    expect(loadingView.textContent).toContain('Loading…');
  });

  it('wraps the empty placeholder in its own tbody so no row sits directly in the table', () => {
    const view = renderTable({ data: [], emptyMessage: 'Nothing here' });
    const table = view.querySelector('table');

    expect(Array.from(table?.children ?? []).every((child) => child.tagName !== 'TR')).toBe(true);
    expect(view.querySelector('table > tbody > tr > td')?.textContent).toBe('Nothing here');
  });

  it('leaves keys to controls inside an actionable row', () => {
    const onRowClick = vi.fn();
    const view = renderTable({
      columns: [{ id: 'action', cell: () => <button type="button">Edit</button> }],
      onRowClick,
    });
    const innerButton = view.querySelector<HTMLButtonElement>('tbody tr button');

    act(() =>
      innerButton?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })),
    );
    act(() =>
      innerButton?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' })),
    );
    expect(onRowClick).not.toHaveBeenCalled();

    act(() =>
      view
        .querySelector('tbody tr')
        ?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' })),
    );
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  describe('column resizing', () => {
    const resizableColumns: ColumnDef<TestRow>[] = [
      { accessorKey: 'name', header: 'Name', size: 200 },
      { accessorKey: 'detail', header: 'Detail', size: 120, enableResizing: false },
    ];
    const pressKey = (target: Element | null | undefined, key: string) =>
      act(() => target?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })));

    it('renders no handles and no widths unless it is opted in', () => {
      const view = renderTable();

      expect(view.querySelector('[role="separator"]')).toBeNull();
      expect(view.querySelector('table')?.style.tableLayout).toBe('');
      expect(view.querySelector('th')?.style.width).toBe('');
      expect(view.querySelector('td')?.className).toBe('px-3 py-1.5 text-foreground');
    });

    it('lays the table out at its columns width and renders a handle per resizable column', () => {
      const view = renderTable({ columns: resizableColumns, columnResizing: true });
      const table = view.querySelector('table');
      const headers = view.querySelectorAll('th');
      const separators = view.querySelectorAll('[role="separator"]');

      expect(table?.style.tableLayout).toBe('fixed');
      expect(table?.style.width).toBe('320px');
      expect(table?.style.minWidth).toBe('320px');
      expect(headers[0]?.style.width).toBe('200px');
      expect(headers[1]?.style.width).toBe('120px');
      expect(separators).toHaveLength(1);
      expect(separators[0]?.getAttribute('aria-label')).toBe('Resize Name column');
      expect(separators[0]?.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('resizes with the arrow keys within min and max and resets on double click', () => {
      const view = renderTable({
        columns: resizableColumns,
        columnResizing: { minSize: 190, maxSize: 210 },
      });
      const separator = () => view.querySelector('[role="separator"]');
      const width = () => view.querySelector('th')?.style.width;

      const tableWidth = () => view.querySelector('table')?.style.width;

      pressKey(separator(), 'ArrowRight');
      expect(width()).toBe('210px');
      expect(tableWidth()).toBe('400px');
      pressKey(separator(), 'ArrowLeft');
      pressKey(separator(), 'ArrowLeft');
      expect(width()).toBe('190px');
      // The table follows its columns, so shrinking one does not stretch the others.
      expect(tableWidth()).toBe('380px');

      act(() => separator()?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
      expect(width()).toBe('200px');
    });

    it('applies controlled sizing', () => {
      const view = renderTable({
        columns: resizableColumns,
        columnResizing: { sizing: { name: 333 }, onSizingChange: () => undefined },
      });

      expect(view.querySelector('th')?.style.width).toBe('333px');
    });

    it('follows a mouse drag on the handle', () => {
      const view = renderTable({
        columns: resizableColumns,
        columnResizing: { minSize: 100, maxSize: 400 },
      });

      act(() =>
        view
          .querySelector('[role="separator"]')
          ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300 })),
      );
      act(() =>
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 350 })),
      );
      act(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 350 })));

      expect(view.querySelector('th')?.style.width).toBe('250px');
      expect(view.querySelector('table')?.style.width).toBe('370px');
    });

    it('clips body cells to the column width', () => {
      const view = renderTable({ columns: resizableColumns, columnResizing: true });

      expect(view.querySelector('tbody td')?.className).toContain('overflow-hidden');
    });
  });
});
