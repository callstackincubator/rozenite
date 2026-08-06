// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog } from './dialog';
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

describe('Dialog', () => {
  it('keeps its previous contents while closing', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const portalContainer = container;

    await act(async () => {
      root?.render(
        <PluginPortalContainerContext.Provider value={portalContainer}>
          <Dialog open>
            <Dialog.Content>
              <div>dialog contents</div>
            </Dialog.Content>
          </Dialog>
        </PluginPortalContainerContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(document.body.innerHTML).toContain('dialog contents');

    const popup = document.querySelector('[data-slot="dialog-content"]');
    expect(popup).not.toBeNull();
    Object.defineProperty(popup, 'getAnimations', {
      configurable: true,
      value: () => [
        {
          finished: new Promise<void>(() => {}),
          pending: true,
          playState: 'running',
        },
      ],
    });

    await act(async () => {
      root?.render(
        <PluginPortalContainerContext.Provider value={portalContainer}>
          <Dialog open={false}>
            <Dialog.Content>
              <div>dialog contents replaced</div>
            </Dialog.Content>
          </Dialog>
        </PluginPortalContainerContext.Provider>,
      );
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('dialog contents');
    expect(document.body.textContent).not.toContain('dialog contents replaced');
  });
});
