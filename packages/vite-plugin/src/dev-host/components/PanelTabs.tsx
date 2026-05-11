import type { DevHostPanelEntry } from '../types.js';
import { Tabs, TabsList, TabsTrigger } from './ui/Tabs.js';

type PanelTabsProps = {
  panels: DevHostPanelEntry[];
  activeSource: string;
  onValueChange: (value: string) => void;
};

export const PanelTabs = ({ panels, activeSource, onValueChange }: PanelTabsProps) => {
  return (
    <Tabs className="rz-tabs-root" value={activeSource} onValueChange={onValueChange}>
      <TabsList aria-label="Plugin panels">
        {panels.map((panel) => (
          <TabsTrigger key={panel.source} value={panel.source}>
            {panel.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
