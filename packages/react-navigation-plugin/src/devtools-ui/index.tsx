import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useState } from 'react';
import { ReactNavigationPluginEventMap } from '../shared';
import { ActionWithState } from './components/ActionList';
import { Tabs, Tab } from './components/Tabs';
import { ActionTimeline } from './components/ActionTimeline';
import { LinkingTester } from './components/LinkingTester';

import './globals.css';

export default function ReactNavigationPanel() {
  const [actionHistory, setActionHistory] = useState<ActionWithState[]>([]);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(
    null
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

  const tabs: Tab[] = [
    {
      id: 'timeline',
      label: 'Action Timeline',
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
      label: 'Link Tester',
      content: <LinkingTester onLinkOpen={onLinkOpen} />,
    },
  ];

  return (
    <div className="h-screen bg-gray-900 text-gray-100">
      <Tabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
      />
    </div>
  );
}
