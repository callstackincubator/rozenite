import { describe, expect, it } from 'vitest';
import {
  closePluginsScreen,
  getInitialSelection,
  getInitialSelectionState,
  openPluginsScreen,
  reconcileSelection,
  selectPanel,
  type SelectionState,
} from './selection';
import type { ShellPlugin } from './types';

const emptyPlugin: ShellPlugin = {
  id: 'empty',
  name: 'Empty',
  description: '',
  version: '1.0.0',
  panels: [],
};

const storagePlugin: ShellPlugin = {
  id: 'storage',
  name: 'Storage',
  description: '',
  version: '1.0.0',
  panels: [{ id: 'storage:table', name: 'Table', source: '/table' }],
};

const networkPlugin: ShellPlugin = {
  id: 'network',
  name: 'Network',
  description: '',
  version: '1.0.0',
  panels: [{ id: 'network:list', name: 'List', source: '/list' }],
};

describe('getInitialSelection', () => {
  it('selects the first plugin that exposes a panel', () => {
    expect(getInitialSelection([emptyPlugin, storagePlugin])).toEqual({
      kind: 'panel',
      pluginId: 'storage',
      panelId: 'storage:table',
    });
  });

  it('returns null when no plugin has a panel', () => {
    expect(getInitialSelection([])).toBeNull();
  });
});

describe('openPluginsScreen / closePluginsScreen', () => {
  it('selects the plugins screen and deselects any panel', () => {
    const initial = getInitialSelectionState([storagePlugin]);
    const opened = openPluginsScreen(initial);

    expect(opened.selection).toEqual({ kind: 'plugins' });
  });

  it('panel selection survives a visit to the screen', () => {
    const withPanelSelected = selectPanel('network', 'network:list');
    const opened = openPluginsScreen(withPanelSelected);
    const closed = closePluginsScreen(opened, [storagePlugin, networkPlugin]);

    expect(closed.selection).toEqual({
      kind: 'panel',
      pluginId: 'network',
      panelId: 'network:list',
    });
  });

  it('falls back to the first available panel if the remembered one no longer exists', () => {
    const withPanelSelected = selectPanel('network', 'network:list');
    const opened = openPluginsScreen(withPanelSelected);
    // The network plugin is gone by the time the screen is closed.
    const closed = closePluginsScreen(opened, [storagePlugin]);

    expect(closed.selection).toEqual({
      kind: 'panel',
      pluginId: 'storage',
      panelId: 'storage:table',
    });
  });
});

describe('reconcileSelection', () => {
  it('keeps a panel selection unchanged when it is still valid', () => {
    const state: SelectionState = selectPanel('storage', 'storage:table');
    expect(reconcileSelection(state, [storagePlugin, networkPlugin])).toBe(state);
  });

  it('falls back to the initial selection when the selected panel disappears', () => {
    const state: SelectionState = selectPanel('network', 'network:list');
    expect(reconcileSelection(state, [storagePlugin])).toEqual(
      getInitialSelectionState([storagePlugin]),
    );
  });

  it('keeps the Plugins screen selected even if the plugin list changes', () => {
    const state = openPluginsScreen(selectPanel('storage', 'storage:table'));
    const reconciled = reconcileSelection(state, [networkPlugin]);

    expect(reconciled.selection).toEqual({ kind: 'plugins' });
  });

  it('drops a remembered panel from the screen state once it no longer exists', () => {
    const state = openPluginsScreen(selectPanel('storage', 'storage:table'));
    const reconciled = reconcileSelection(state, [networkPlugin]);

    expect(reconciled.lastPanel).toBeNull();
    // Closing the screen now falls back to the first available panel.
    expect(closePluginsScreen(reconciled, [networkPlugin]).selection).toEqual({
      kind: 'panel',
      pluginId: 'network',
      panelId: 'network:list',
    });
  });
});
