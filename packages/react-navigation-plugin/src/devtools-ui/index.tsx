import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useState } from 'react';
import { PluginHeader, PluginTheme, Tabs } from '@rozenite/ui';
import { ReactNavigationPluginEventMap } from '../shared';
import type { ActionWithState } from './components/ActionList';
import { ActionTimeline } from './components/ActionTimeline';
import { LinkingTester } from './components/LinkingTester';
import { NavigationTree } from './components/NavigationTree/NavigationTree';
import './globals.css';

export default function ReactNavigationPanel() {
  const [actionHistory, setActionHistory] = useState<ActionWithState[]>([]);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(
    null,
  );
  const [activeTabId, setActiveTabId] = useState('timeline');

  const client = useRozeniteDevToolsClient<ReactNavigationPluginEventMap>({
    pluginId: '@rozenite/react-navigation-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions = [
      client.onMessage('initial-state', ({ state }) => {
        setActionHistory([{ action: { type: 'SNAPSHOT' }, state }]);
        setSelectedActionIndex(null);
      }),
      client.onMessage('action', ({ action, state }) => {
        setActionHistory((prev) => [{ action, state }, ...prev]);
      }),
    ];

    client.send('init', {
      type: 'init',
    });

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [client]);

  const onGoToAction = (actionIndex: number) => {
    const targetEntry = actionHistory[actionIndex];
    if (targetEntry && targetEntry.state) {
      // Keep only the actions up to and including the target action
      const actionsToKeep = actionHistory.slice(actionIndex);
      setActionHistory(actionsToKeep);

      // Reset to the target action (now at index 0)
      setSelectedActionIndex(0);

      // Reset the navigation state to the state after this action
      client?.send('reset-root', {
        type: 'reset-root',
        state: targetEntry.state,
      });
    }
  };

  const onClearActions = () => {
    // Clear the action history
    setActionHistory([]);
    setSelectedActionIndex(null);

    // Request initial state again
    client?.send('init', {
      type: 'init',
    });
  };

  const onLinkOpen = (url: string) => {
    client?.send('open-link', {
      type: 'open-link',
      href: url,
    });
  };

  const tabs = [
    {
      id: 'timeline',
      label: 'Timeline',
      content: (
        <ActionTimeline
          actionHistory={actionHistory}
          selectedActionIndex={selectedActionIndex}
          onActionSelect={setSelectedActionIndex}
          onGoToAction={onGoToAction}
          onClearActions={onClearActions}
        />
      ),
    },
    {
      id: 'linking',
      label: 'Deep Links',
      content: <LinkingTester onLinkOpen={onLinkOpen} />,
    },
    {
      id: 'tree',
      label: 'Tree',
      content: <NavigationTree actionHistory={actionHistory} />,
    },
  ];

  return (
    <PluginTheme
      defaultTheme="dark"
      storageKey="@rozenite/react-navigation-plugin.theme"
      className="flex h-screen flex-col bg-background text-foreground"
    >
      <PluginHeader title="React Navigation" />

      <Tabs.Root
        className="flex min-h-0 flex-1 flex-col"
        selectedKey={activeTabId}
        onSelectionChange={(key) => setActiveTabId(String(key))}
      >
        <Tabs.ListContainer className="overflow-x-auto px-3">
          <Tabs.List
            aria-label="React Navigation views"
            className="w-fit min-w-max justify-start"
          >
            {tabs.map((tab) => (
              <Tabs.Tab
                key={tab.id}
                className="w-auto shrink-0 whitespace-nowrap"
                id={tab.id}
              >
                {tab.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        {tabs.map((tab) => (
          <Tabs.Panel
            key={tab.id}
            className="flex min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-3"
            id={tab.id}
          >
            {tab.content}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </PluginTheme>
  );
}
