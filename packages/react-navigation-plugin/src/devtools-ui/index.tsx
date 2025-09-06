import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect, useState } from 'react';
import { JSONTree } from 'react-json-tree';
import {
  NavigationAction,
  NavigationState,
  ReactNavigationPluginEventMap,
} from '../shared';

type ActionWithState = {
  action: NavigationAction;
  state: NavigationState | undefined;
};

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

  const getActionTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      NAVIGATE: '#4caf50',
      GO_BACK: '#ff9800',
      PUSH: '#2196f3',
      POP: '#f44336',
      REPLACE: '#9c27b0',
      RESET: '#795548',
      SET_PARAMS: '#00bcd4',
    };
    return colors[type] || '#666';
  };

  const selectedEntry =
    selectedActionIndex !== null ? actionHistory[selectedActionIndex] : null;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Action Timeline */}
      <div
        style={{
          width: '300px',
          borderRight: '1px solid #e0e0e0',
          overflowY: 'auto',
          backgroundColor: '#fafafa',
        }}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
            Action Timeline
          </h2>
        </div>

        <div style={{ padding: '8px' }}>
          {actionHistory.length === 0 ? (
            <div
              style={{ padding: '16px', textAlign: 'center', color: '#666' }}
            >
              No actions recorded yet
            </div>
          ) : (
            actionHistory.map((entry, index) => (
              <div
                key={index}
                style={{
                  margin: '4px 0',
                  padding: '12px',
                  backgroundColor:
                    selectedActionIndex === index ? '#e3f2fd' : '#fff',
                  border:
                    selectedActionIndex === index
                      ? '2px solid #2196f3'
                      : '1px solid #e0e0e0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setSelectedActionIndex(index)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 'bold',
                        color: getActionTypeColor(entry.action.type),
                        fontSize: '14px',
                      }}
                    >
                      {entry.action.type}
                    </span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      #{index}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGoToAction(index);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: '1px solid #2196f3',
                      backgroundColor: '#2196f3',
                      color: 'white',
                      cursor: 'pointer',
                      borderRadius: '3px',
                    }}
                  >
                    Go to
                  </button>
                </div>

                {entry.action.payload && 'name' in entry.action.payload && (
                  <div style={{ fontSize: '12px', color: '#333' }}>
                    → {(entry.action.payload as any).name}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedEntry ? (
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3
                style={{
                  marginBottom: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Action Payload
              </h3>
              <div
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  padding: '12px',
                  backgroundColor: '#fafafa',
                  fontSize: '12px',
                }}
              >
                <JSONTree
                  data={selectedEntry.action}
                  theme={{
                    base00: '#ffffff',
                    base01: '#f5f5f5',
                    base02: '#e0e0e0',
                    base03: '#9e9e9e',
                    base04: '#757575',
                    base05: '#424242',
                    base06: '#212121',
                    base07: '#000000',
                    base08: '#f44336',
                    base09: '#ff9800',
                    base0A: '#ffeb3b',
                    base0B: '#4caf50',
                    base0C: '#00bcd4',
                    base0D: '#2196f3',
                    base0E: '#9c27b0',
                    base0F: '#795548',
                  }}
                  invertTheme={false}
                  shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
                />
              </div>
            </div>

            <div>
              <h3
                style={{
                  marginBottom: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Navigation State
              </h3>
              <div
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  padding: '12px',
                  backgroundColor: '#fafafa',
                  fontSize: '12px',
                }}
              >
                {selectedEntry.state ? (
                  <JSONTree
                    data={selectedEntry.state}
                    theme={{
                      base00: '#ffffff',
                      base01: '#f5f5f5',
                      base02: '#e0e0e0',
                      base03: '#9e9e9e',
                      base04: '#757575',
                      base05: '#424242',
                      base06: '#212121',
                      base07: '#000000',
                      base08: '#f44336',
                      base09: '#ff9800',
                      base0A: '#ffeb3b',
                      base0B: '#4caf50',
                      base0C: '#00bcd4',
                      base0D: '#2196f3',
                      base0E: '#9c27b0',
                      base0F: '#795548',
                    }}
                    invertTheme={false}
                    shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
                  />
                ) : (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>
                    No state available
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            Select an action from the timeline to view its details
          </div>
        )}
      </div>
    </div>
  );
}
