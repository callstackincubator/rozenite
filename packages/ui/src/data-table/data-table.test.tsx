// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './data-table';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type TestRow = { name: string; detail: string };

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'name', header: 'Name', size: 200 },
  { accessorKey: 'detail', header: 'Detail', size: 120, enableResizing: false },
];

const data: TestRow[] = [{ name: 'a', detail: 'b' }];

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

const renderTable = (props: Partial<ComponentProps<typeof DataTable<TestRow>>> = {}) => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(<DataTable columns={columns} data={data} {...props} />);
  });

  return container;
};

const pressKey = (target: Element | null | undefined, key: string) =>
  act(() => target?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })));

describe('DataTable column resizing', () => {
  it('changes nothing for callers that do not opt in', () => {
    const view = renderTable();

    expect(view.querySelector('[role="separator"]')).toBeNull();
    expect(view.querySelector('table')?.style.tableLayout).toBe('');
    expect(view.querySelector('th')?.style.width).toBe('');
    expect(view.querySelector('td')?.className).toBe('px-3 py-1.5 text-foreground');
  });

  it('renders a handle only for columns that can be resized', () => {
    const view = renderTable({ columnResizing: true });
    const separators = view.querySelectorAll('[role="separator"]');

    expect(view.querySelector('table')?.style.tableLayout).toBe('fixed');
    expect(view.querySelector('table')?.style.width).toBe('320px');
    expect(separators).toHaveLength(1);
    expect(separators[0]?.getAttribute('aria-label')).toBe('Resize Name column');
    expect(view.querySelector('th')?.style.width).toBe('200px');
  });

  it('resizes with the arrow keys, clamps to min and max, and resets on double click', () => {
    const view = renderTable({ columnResizing: { minSize: 190, maxSize: 210 } });
    const separator = () => view.querySelector('[role="separator"]');
    const width = () => view.querySelector('th')?.style.width;

    pressKey(separator(), 'ArrowRight');
    expect(width()).toBe('210px');
    pressKey(separator(), 'ArrowLeft');
    pressKey(separator(), 'ArrowLeft');
    expect(width()).toBe('190px');

    act(() => separator()?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(width()).toBe('200px');
  });

  it('uses the default size for columns without one and reports controlled sizing changes', () => {
    const changes: unknown[] = [];
    const view = renderTable({
      columns: [{ accessorKey: 'name', header: 'Name' }],
      columnResizing: {
        defaultSize: 260,
        sizing: {},
        onSizingChange: (updater) => changes.push(updater),
      },
    });

    expect(view.querySelector('th')?.style.width).toBe('260px');
    pressKey(view.querySelector('[role="separator"]'), 'ArrowRight');
    expect(changes).toHaveLength(1);
  });
});
