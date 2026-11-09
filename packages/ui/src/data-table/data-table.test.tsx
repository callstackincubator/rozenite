// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const touchAt = (type: string, clientX: number) =>
  Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    touches: type === 'touchend' ? [] : [{ clientX }],
  });

const dragWithMouse = (handle: Element | null, from: number, ...moves: number[]) => {
  act(() => handle?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: from })));
  for (const clientX of moves) {
    act(() => document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX })));
  }
  act(() =>
    document.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, clientX: moves.at(-1) ?? from }),
    ),
  );
};

const dragWithTouch = (handle: Element | null, from: number, ...moves: number[]) => {
  act(() => handle?.dispatchEvent(touchAt('touchstart', from)));
  for (const clientX of moves) {
    act(() => document.dispatchEvent(touchAt('touchmove', clientX)));
  }
  act(() => document.dispatchEvent(touchAt('touchend', 0)));
};

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
    expect(view.querySelector('table')?.style.width).toBe('100%');
    expect(view.querySelector('table')?.style.minWidth).toBe('320px');
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

  it('follows a mouse drag on the handle, first move included', () => {
    const view = renderTable({ columnResizing: { minSize: 100, maxSize: 400 } });
    const handle = () => view.querySelector('[role="separator"]');
    const width = () => view.querySelector('th')?.style.width;

    dragWithMouse(handle(), 300, 340, 380);
    expect(width()).toBe('280px');
    expect(view.querySelector('table')?.style.minWidth).toBe('400px');

    // Every move is applied relative to where the drag began, and min and max still bound it.
    dragWithMouse(handle(), 300, 100);
    expect(width()).toBe('100px');
    dragWithMouse(handle(), 300, 900);
    expect(width()).toBe('400px');
  });

  it('follows a touch drag on the handle, first move included', () => {
    const view = renderTable({ columnResizing: true });
    const width = () => view.querySelector('th')?.style.width;

    // The library applies the very first touchmove, so a drop of the first move on a device
    // comes from the browser's touch slop, not from the handle.
    dragWithTouch(view.querySelector('[role="separator"]'), 300, 380);
    expect(width()).toBe('280px');

    // And the last move before the finger lifts is kept, since a touchend carries no position.
    dragWithTouch(view.querySelector('[role="separator"]'), 300, 330, 360, 390);
    expect(width()).toBe('370px');
  });

  it('reports a drag through onSizingChange while it is still in progress', () => {
    const onSizingChange = vi.fn();
    const view = renderTable({ columnResizing: { onSizingChange } });

    act(() =>
      view
        .querySelector('[role="separator"]')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300 })),
    );
    act(() => document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 330 })));

    expect(onSizingChange).toHaveBeenCalled();
    act(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  });

  it('warns in development when sizing is controlled without onSizingChange', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderTable({ columnResizing: { sizing: { name: 250 } } });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('onSizingChange');

    warn.mockClear();
    act(() => root?.unmount());
    container?.remove();
    renderTable({ columnResizing: { sizing: { name: 250 }, onSizingChange: () => undefined } });
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
