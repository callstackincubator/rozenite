import type { ShellPlugin } from './types';

export type ShellSelection = {
  pluginId: string;
  panelId: string;
} | null;

export function getInitialSelection(plugins: ShellPlugin[]): ShellSelection {
  const plugin = plugins.find((candidate) => candidate.panels.length > 0);
  const panel = plugin?.panels[0];

  return plugin && panel ? { pluginId: plugin.id, panelId: panel.id } : null;
}
