import { ReactNode } from 'react';
import { Sidebar, Split } from '@rozenite/ui';

export type Tab = {
  id: string;
  label: string;
  content: ReactNode;
};

export type TabsProps = {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
};

export const Tabs = ({ tabs, activeTabId, onTabChange }: TabsProps) => {
  return (
    <Split direction="horizontal" autoSaveId="react-navigation-views">
      <Split.Pane defaultSize={18} minSize={14} maxSize={28}>
        <Sidebar className="w-full border-r-0">
          <Sidebar.Group>
            {tabs.map((tab) => (
              <Sidebar.Item
                key={tab.id}
                selected={tab.id === activeTabId}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </Sidebar.Item>
            ))}
          </Sidebar.Group>
        </Sidebar>
      </Split.Pane>
      <Split.Handle />
      <Split.Pane>
        <div className="h-full min-w-0">
          {tabs.find((tab) => tab.id === activeTabId)?.content}
        </div>
      </Split.Pane>
    </Split>
  );
};
