// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Shell } from './Shell';
import type { ShellPlugin } from './types';

const originalFetch = globalThis.fetch;

const pluginA: ShellPlugin = {
  id: 'plugin-a',
  name: 'Plugin A',
  description: '',
  version: '1.0.0',
  panels: [{ id: 'plugin-a:panel-1', name: 'Panel 1', source: 'about:blank' }],
};

// Two panels sharing one plugin id, to prove both get routed messages.
const pluginB: ShellPlugin = {
  id: 'plugin-b',
  name: 'Plugin B',
  description: '',
  version: '1.0.0',
  panels: [
    { id: 'plugin-b:panel-1', name: 'Panel 1', source: 'about:blank' },
    { id: 'plugin-b:panel-2', name: 'Panel 2', source: 'about:blank' },
  ],
};

beforeEach(() => {
  // The plugin list drives an outdated-version check that hits the npm
  // registry; stub it out so tests stay hermetic and don't depend on the
  // network (its failure path is already exercised by
  // `use-outdated-plugins.test.ts`).
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

  // jsdom doesn't implement ResizeObserver, which `@rozenite/ui`'s `Split`
  // (react-resizable-panels) needs to mount.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** Renders Shell with both fixture plugins and returns a postMessage spy for
 *  every mounted panel iframe, keyed by panel id. */
const renderShellWithFrames = async () => {
  render(
    <Shell plugins={[pluginA, pluginB]} destroyOnDetachPlugins={[]} runtimeVersion={undefined} />,
  );

  const frameSpies = new Map<string, ReturnType<typeof vi.fn>>();
  const pairs = [
    ...pluginA.panels.map((panel) => ({ plugin: pluginA, panel })),
    ...pluginB.panels.map((panel) => ({ plugin: pluginB, panel })),
  ];

  for (const { plugin, panel } of pairs) {
    const title = `${plugin.name}: ${panel.name}`;
    const iframe = await waitFor(() => {
      const el = document.querySelector<HTMLIFrameElement>(`iframe[title="${title}"]`);
      if (!el) {
        throw new Error(`iframe for panel ${panel.id} not mounted`);
      }
      return el;
    });

    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });
    frameSpies.set(panel.id, postMessage);
  }

  return frameSpies;
};

const dispatchFromHost = (data: unknown) => {
  window.dispatchEvent(new MessageEvent('message', { data, source: window.parent }));
};

describe('Shell message forwarding', () => {
  it("routes a message with a pluginId only to that plugin's frame", async () => {
    const frameSpies = await renderShellWithFrames();
    const message = {
      pluginId: 'plugin-a',
      type: 'ping',
      payload: { hello: 'world' },
    };

    dispatchFromHost(message);

    expect(frameSpies.get('plugin-a:panel-1')).toHaveBeenCalledWith(message, '*');
    expect(frameSpies.get('plugin-b:panel-1')).not.toHaveBeenCalled();
    expect(frameSpies.get('plugin-b:panel-2')).not.toHaveBeenCalled();
  });

  it('delivers to every panel of a multi-panel plugin', async () => {
    const frameSpies = await renderShellWithFrames();
    const message = { pluginId: 'plugin-b', type: 'ping', payload: null };

    dispatchFromHost(message);

    expect(frameSpies.get('plugin-b:panel-1')).toHaveBeenCalledWith(message, '*');
    expect(frameSpies.get('plugin-b:panel-2')).toHaveBeenCalledWith(message, '*');
    expect(frameSpies.get('plugin-a:panel-1')).not.toHaveBeenCalled();
  });

  it('still broadcasts a message without a pluginId (e.g. shell configuration) to every frame', async () => {
    const frameSpies = await renderShellWithFrames();
    const message = { type: 'rozenite-shell-configuration', payload: {} };

    dispatchFromHost(message);

    for (const spy of frameSpies.values()) {
      expect(spy).toHaveBeenCalledWith(message, '*');
    }
  });

  it('drops a message whose pluginId matches no mounted frame, without throwing', async () => {
    const frameSpies = await renderShellWithFrames();
    const message = { pluginId: 'unknown-plugin', type: 'ping', payload: null };

    expect(() => dispatchFromHost(message)).not.toThrow();

    for (const spy of frameSpies.values()) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('leaves the panel-to-host direction unchanged', async () => {
    await renderShellWithFrames();
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
    const iframe = document.querySelector<HTMLIFrameElement>(
      `iframe[title="${pluginA.name}: ${pluginA.panels[0].name}"]`,
    );
    const message = { pluginId: 'plugin-a', type: 'pong', payload: null };

    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        source: iframe?.contentWindow as Window,
      }),
    );

    expect(postMessageSpy).toHaveBeenCalledWith(message, '*');
  });
});
