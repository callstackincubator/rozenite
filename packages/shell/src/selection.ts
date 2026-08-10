import type { ShellPlugin } from './types';

export type PanelSelection = { kind: 'panel'; pluginId: string; panelId: string };

export type ShellSelection = PanelSelection | { kind: 'plugins' } | null;

export type SelectionState = {
  selection: ShellSelection;
  /** The most recent panel selection. Kept even while the Plugins screen is
   *  open so returning to it restores the panel, including its sidebar
   *  highlight. */
  lastPanel: PanelSelection | null;
};

function isPanelValid(panel: PanelSelection, plugins: ShellPlugin[]): boolean {
  return plugins.some(
    (plugin) => plugin.id === panel.pluginId && plugin.panels.some((p) => p.id === panel.panelId),
  );
}

export function getInitialSelection(plugins: ShellPlugin[]): ShellSelection {
  const plugin = plugins.find((candidate) => candidate.panels.length > 0);
  const panel = plugin?.panels[0];

  return plugin && panel ? { kind: 'panel', pluginId: plugin.id, panelId: panel.id } : null;
}

export function getInitialSelectionState(plugins: ShellPlugin[]): SelectionState {
  const selection = getInitialSelection(plugins);
  return { selection, lastPanel: selection?.kind === 'panel' ? selection : null };
}

export function selectPanel(pluginId: string, panelId: string): SelectionState {
  const panel: PanelSelection = { kind: 'panel', pluginId, panelId };
  return { selection: panel, lastPanel: panel };
}

export function openPluginsScreen(state: SelectionState): SelectionState {
  return { selection: { kind: 'plugins' }, lastPanel: state.lastPanel };
}

/** Returns from the Plugins screen to the panel that was selected before it
 *  opened, falling back to the first available panel if that plugin or
 *  panel no longer exists. */
export function closePluginsScreen(state: SelectionState, plugins: ShellPlugin[]): SelectionState {
  if (state.lastPanel && isPanelValid(state.lastPanel, plugins)) {
    return { selection: state.lastPanel, lastPanel: state.lastPanel };
  }

  return getInitialSelectionState(plugins);
}

/** Keeps the current selection valid as the plugin list changes. The Plugins
 *  screen is always valid and is never reconciled away; only its remembered
 *  panel is kept in sync so a later return doesn't restore a stale one. */
export function reconcileSelection(state: SelectionState, plugins: ShellPlugin[]): SelectionState {
  if (state.selection?.kind === 'plugins') {
    if (state.lastPanel && !isPanelValid(state.lastPanel, plugins)) {
      return { selection: state.selection, lastPanel: null };
    }
    return state;
  }

  if (state.selection?.kind === 'panel' && isPanelValid(state.selection, plugins)) {
    return state;
  }

  return getInitialSelectionState(plugins);
}
