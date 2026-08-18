// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PluginShell } from '../plugin-shell/plugin-shell';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Listener = () => void;

/** A `matchMedia` whose result can be flipped after mount, standing in for
 * the OS switching appearance — or, the case this exists for, a frame that
 * reported light only because it wasn't being rendered yet. */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const query = {
    matches: initialMatches,
    addEventListener: (_: string, listener: Listener) => void listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => void listeners.delete(listener),
  };

  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;

  return {
    flip(matches: boolean) {
      query.matches = matches;
      for (const listener of listeners) {
        listener();
      }
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

let container: HTMLDivElement;
let root: Root;

const isDark = () =>
  container.querySelector('[data-slot="plugin-shell"]')!.classList.contains('dark');

const renderShell = () => {
  root = createRoot(container);
  act(() => root.render(<PluginShell>content</PluginShell>));
};

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

describe('PluginThemeProvider', () => {
  it('follows the color-scheme preference when it changes after mount', () => {
    const media = installMatchMedia(false);
    renderShell();
    expect(isDark()).toBe(false);

    act(() => media.flip(true));

    expect(isDark()).toBe(true);
  });

  it('keeps an explicitly stored preference over the OS', () => {
    localStorage.setItem('@rozenite/ui:theme', 'light');
    const media = installMatchMedia(false);
    renderShell();

    act(() => media.flip(true));

    expect(isDark()).toBe(false);
    // Nothing to listen for: the stored choice already decided it.
    expect(media.listenerCount).toBe(0);
  });

  it('stops listening once unmounted', () => {
    const media = installMatchMedia(false);
    renderShell();
    expect(media.listenerCount).toBe(1);

    act(() => root.unmount());

    expect(media.listenerCount).toBe(0);
    root = createRoot(container);
  });
});
