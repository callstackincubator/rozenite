import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useState } from 'react';
import {
  NavigationAction,
  NavigationState,
  ReactNavigationPluginEventMap,
} from '../shared';
import { ActionSidebar } from './components/ActionSidebar';
import { ActionDetailPanel } from './components/ActionDetailPanel';
import { ActionWithState } from './components/ActionList';

import './globals.css';

export default function ReactNavigationPanel() {
  const [actionHistory, setActionHistory] = useState<ActionWithState[]>([]);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(
    null
  );

  const client = useRozeniteDevToolsClient<ReactNavigationPluginEventMap>({
    pluginId: '@rozenite/react-navigation-plugin',
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions = [
      client.onMessage('initial-state', () => {
        setActionHistory([]);
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

  const selectedEntry =
    selectedActionIndex !== null ? actionHistory[selectedActionIndex] : null;

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex">
      <ActionSidebar
        actionHistory={actionHistory}
        selectedActionIndex={selectedActionIndex}
        onActionSelect={setSelectedActionIndex}
        onGoToAction={onGoToAction}
      />

      {selectedEntry ? (
        <ActionDetailPanel
          action={selectedEntry.action}
          state={selectedEntry.state}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-900">
          Select an action from the timeline to view its details
        </div>
      )}
    </div>
  );
}
