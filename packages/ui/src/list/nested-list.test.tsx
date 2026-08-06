// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NestedList } from './nested-list';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function render(element: ReactElement) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(element));
  return container;
}

describe('NestedList', () => {
  it('toggles children visibility when uncontrolled', () => {
    const view = render(
      <NestedList>
        <NestedList.Item label="src">
          <NestedList.Item label="index.ts" />
        </NestedList.Item>
      </NestedList>,
    );

    expect(view.textContent).not.toContain('index.ts');

    const row = view.querySelector('[data-slot="nested-list-item-row"]');
    act(() => (row as HTMLButtonElement)?.click());

    expect(view.textContent).toContain('index.ts');

    act(() => (row as HTMLButtonElement)?.click());
    expect(view.textContent).not.toContain('index.ts');
  });

  it('indents nested items further at each depth', () => {
    const view = render(
      <NestedList>
        <NestedList.Item label="src" defaultExpanded>
          <NestedList.Item label="components" defaultExpanded>
            <NestedList.Item label="Button.tsx" />
          </NestedList.Item>
        </NestedList.Item>
      </NestedList>,
    );

    const rows = Array.from(
      view.querySelectorAll<HTMLButtonElement>(
        '[data-slot="nested-list-item-row"]',
      ),
    );

    expect(rows.map((row) => row.style.paddingLeft)).toEqual([
      '8px',
      '24px',
      '40px',
    ]);
  });

  it('defers to the controlled expanded prop instead of toggling itself', () => {
    const onExpandedChange = vi.fn();
    const view = render(
      <NestedList>
        <NestedList.Item
          label="src"
          expanded={false}
          onExpandedChange={onExpandedChange}
        >
          <NestedList.Item label="index.ts" />
        </NestedList.Item>
      </NestedList>,
    );

    const row = view.querySelector('[data-slot="nested-list-item-row"]');
    act(() => (row as HTMLButtonElement)?.click());

    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(view.textContent).not.toContain('index.ts');
  });

  it('does not render a disclosure chevron for leaf items', () => {
    const view = render(
      <NestedList>
        <NestedList.Item label="index.ts" />
      </NestedList>,
    );

    expect(
      view.querySelector('[data-slot="nested-list-item-chevron"]'),
    ).toBeNull();
  });
});
