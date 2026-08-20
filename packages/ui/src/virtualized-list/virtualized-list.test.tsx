// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VirtualizedList } from './virtualized-list';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-virtuoso', async () => {
  const React = await import('react');

  return {
    Virtuoso: ({
      components,
      context,
      data = [],
      itemContent,
      startReached,
      endReached,
      computeItemKey,
    }: Record<string, any>) => {
      const List = components.List;
      const Item = components.Item;
      const EmptyPlaceholder = components.EmptyPlaceholder;
      // Mimic virtualization: only a small viewport window reaches the DOM.
      const visibleItems = data.slice(0, 8);

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
          List,
          { context },
          visibleItems.length === 0
            ? React.createElement(EmptyPlaceholder, { context })
            : visibleItems.map((item: unknown, index: number) =>
                React.createElement(
                  Item,
                  {
                    context,
                    item,
                    key: computeItemKey ? computeItemKey(index, item) : index,
                    'data-index': index,
                    'data-item-index': index,
                    'data-known-size': 20,
                  },
                  itemContent(index, item),
                ),
              ),
        ),
      );
    },
  };
});

type TestItem = { id: string; message: string };

const data = Array.from({ length: 30 }, (_, index) => ({
  id: `item-${index}`,
  message: `message-${index}`,
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

const renderList = (props: Partial<ComponentProps<typeof VirtualizedList<TestItem>>> = {}) => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <VirtualizedList
        ariaLabel="Log entries"
        data={data}
        getItemKey={(item) => item.id}
        renderItem={(item) => <div>{item.message}</div>}
        {...props}
      />,
    );
  });

  return container;
};

describe('VirtualizedList', () => {
  it('keeps rows bounded and renders content through renderItem with stable keys', () => {
    const view = renderList();
    const rows = view.querySelectorAll('[role="listitem"]');

    expect(rows).toHaveLength(8);
    expect(rows[0]?.getAttribute('data-index')).toBe('0');
    expect(rows[0]?.getAttribute('aria-label')).toBe('item-0');
    expect(rows[0]?.textContent).toBe('message-0');
    expect(view.querySelector('[role="list"]')?.getAttribute('aria-label')).toBe('Log entries');
    expect(rows[0]?.className).toContain('border-b border-border');
  });

  it('uses getItemTextValue for the accessible label when provided', () => {
    const view = renderList({ getItemTextValue: (item) => `Row for ${item.message}` });
    const firstRow = view.querySelector('[role="listitem"]');

    expect(firstRow?.getAttribute('aria-label')).toBe('Row for message-0');
  });

  it('forwards both edge callbacks', () => {
    const onStartReached = vi.fn();
    const onEndReached = vi.fn();
    const view = renderList({ onEndReached, onStartReached });
    const buttons = view.querySelectorAll('button');

    act(() => buttons[0].click());
    act(() => buttons[1].click());

    expect(onStartReached).toHaveBeenCalledExactlyOnceWith(0);
    expect(onEndReached).toHaveBeenCalledExactlyOnceWith(29);
  });

  it('activates a row on click and on Enter/Space, and marks it keyboard-focusable', () => {
    const onItemClick = vi.fn();
    const view = renderList({ onItemClick });
    const firstRow = view.querySelector('[role="listitem"]');

    expect(firstRow?.getAttribute('tabindex')).toBe('0');
    expect(firstRow?.className).toContain('cursor-pointer');

    act(() => (firstRow as HTMLElement | null)?.click());
    expect(onItemClick).toHaveBeenNthCalledWith(1, data[0]);

    act(() =>
      firstRow?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })),
    );
    expect(onItemClick).toHaveBeenNthCalledWith(2, data[0]);

    act(() => firstRow?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' })));
    expect(onItemClick).toHaveBeenNthCalledWith(3, data[0]);
    expect(onItemClick).toHaveBeenCalledTimes(3);
  });

  it('is not clickable or keyboard-focusable without onItemClick', () => {
    const view = renderList();
    const firstRow = view.querySelector('[role="listitem"]');

    expect(firstRow?.getAttribute('tabindex')).toBeNull();
    expect(firstRow?.className).not.toContain('cursor-pointer');
  });

  it('renders an accessible loading state', () => {
    const view = renderList({ data: [], loading: true });

    expect(view.textContent).toContain('Loading…');
  });

  it('renders the default empty state message when not loading', () => {
    const view = renderList({ data: [], emptyMessage: 'Nothing to show.' });

    expect(view.textContent).toContain('Nothing to show.');
  });

  it('prefers a custom renderEmptyState over the default empty/loading message', () => {
    const view = renderList({
      data: [],
      loading: true,
      renderEmptyState: () => <div>Custom empty state</div>,
    });

    expect(view.textContent).toContain('Custom empty state');
    expect(view.textContent).not.toContain('Loading…');
  });
});
