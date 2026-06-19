import type { DevHostPanelEntry } from '../types.js';
import { ToggleGroup } from './ui/ToggleGroup.js';

type PanelTabsProps = {
  panels: DevHostPanelEntry[];
  activeSource: string;
  onValueChange: (value: string) => void;
};

export const PanelTabs = ({ panels, activeSource, onValueChange }: PanelTabsProps) => {
  return (
    <ToggleGroup
      aria-label="Plugin panels"
      value={activeSource}
      onChange={onValueChange}
      options={panels.map((panel) => ({
        key: panel.source,
        label: panel.label,
      }))}
    />
  );
};
