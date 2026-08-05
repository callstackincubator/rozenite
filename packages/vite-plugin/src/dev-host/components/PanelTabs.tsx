import { Select } from '@rozenite/ui';
import type { DevHostPanelEntry } from '../types.js';

type PanelTabsProps = {
  panels: DevHostPanelEntry[];
  activeSource: string;
  onValueChange: (value: string) => void;
};

export const PanelTabs = ({
  panels,
  activeSource,
  onValueChange,
}: PanelTabsProps) => {
  if (panels.length === 0) {
    return null;
  }

  const activePanel = panels.find((panel) => panel.source === activeSource);

  return (
    <Select
      value={activeSource}
      onValueChange={(value) => onValueChange(String(value))}
    >
      <Select.Trigger
        className="dev-host-panel-select"
        aria-label="Plugin panel"
      >
        <Select.Value>{activePanel?.label}</Select.Value>
      </Select.Trigger>
      <Select.Content align="end">
        {panels.map((panel) => (
          <Select.Item key={panel.source} value={panel.source}>
            {panel.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  );
};
