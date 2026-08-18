// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmDialog, useConfirmDialog } from './confirm-dialog';
import { PluginPortalContainerContext } from '../theme/theme-context';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.body.replaceChildren();
  root = undefined;
  container = undefined;
});

function render(children: React.ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const portalContainer = container;
  return act(async () => {
    root?.render(
      <PluginPortalContainerContext.Provider value={portalContainer}>
        {children}
      </PluginPortalContainerContext.Provider>,
    );
    await Promise.resolve();
  });
}

function clickByText(text: string) {
  const button = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) throw new Error(`No button with text "${text}"`);
  return act(async () => {
    button.click();
    await Promise.resolve();
  });
}

function Asker({ label, title }: { label: string; title: string }) {
  const confirm = useConfirmDialog();
  return (
    <button
      onClick={() => {
        void confirm({ title }).then((result) => {
          document.title = `${label}:${result}`;
        });
      }}
    >
      {label}
    </button>
  );
}

describe('useConfirmDialog', () => {
  it('throws when used outside ConfirmDialog.Provider', () => {
    function Consumer() {
      useConfirmDialog();
      return null;
    }
    expect(() => {
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
      act(() => root?.render(<Consumer />));
    }).toThrow('useConfirmDialog must be used within a ConfirmDialog.Provider');
  });

  it('resolves true when the user confirms', async () => {
    await render(
      <ConfirmDialog.Provider>
        <Asker label="ask" title="Delete project?" />
      </ConfirmDialog.Provider>,
    );

    await clickByText('ask');
    expect(document.body.textContent).toContain('Delete project?');

    await clickByText('Confirm');
    expect(document.title).toBe('ask:true');
  });

  it('resolves false when the user cancels', async () => {
    await render(
      <ConfirmDialog.Provider>
        <Asker label="ask" title="Delete project?" />
      </ConfirmDialog.Provider>,
    );

    await clickByText('ask');
    await clickByText('Cancel');
    expect(document.title).toBe('ask:false');
  });

  it('queues a second confirmation until the first is settled', async () => {
    await render(
      <ConfirmDialog.Provider>
        <Asker label="first" title="First?" />
        <Asker label="second" title="Second?" />
      </ConfirmDialog.Provider>,
    );

    await clickByText('first');
    await clickByText('second');
    expect(document.body.textContent).toContain('First?');
    expect(document.body.textContent).not.toContain('Second?');

    await clickByText('Confirm');
    expect(document.title).toBe('first:true');
    expect(document.body.textContent).toContain('Second?');

    await clickByText('Confirm');
    expect(document.title).toBe('second:true');
  });
});
