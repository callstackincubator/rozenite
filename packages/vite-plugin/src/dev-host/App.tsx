import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PluginHeader, PluginShell, Split, Tabs } from '@rozenite/ui';
import type {
  DevHostFlowEntry,
  DevHostPanelEntry,
  DevHostPresetEntry,
  DevHostState,
  MessageEntry,
} from './types.js';
import { useFlowRunner } from './flow-runtime.js';
import {
  createMessageEntry,
  formatPayloadForCommandInput,
  getInitialPanel,
  isPluginMessage,
} from './utils.js';
import { DispatchForm } from './components/DispatchForm.js';
import {
  MessageDetailsPane,
  getDispatcherValuesFromMessage,
} from './components/MessageDetailsPane.js';
import { MessageLogPane } from './components/MessageLogPane.js';
import { PanelTabs } from './components/PanelTabs.js';
import './styles.css';

type AppProps = DevHostState & {
  flows: DevHostFlowEntry[];
  presets: DevHostPresetEntry[];
};

type MobileDevtoolsTab = 'log' | 'actions';

const useNarrowViewport = () => {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 960px)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 960px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsNarrow(event.matches);
    };

    setIsNarrow(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isNarrow;
};

export const App = ({ packageName, packageDescription, panels, flows, presets }: AppProps) => {
  const [activePanel, setActivePanel] = useState<DevHostPanelEntry | null>(() =>
    getInitialPanel(panels),
  );
  const [commandType, setCommandType] = useState('');
  const [commandPayload, setCommandPayload] = useState('');
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileDevtoolsTab>('log');
  const [iframeLoadNonce, setIframeLoadNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastAutoRunLoadRef = useRef(0);
  const isNarrowViewport = useNarrowViewport();
  const { flowRuns, runFlow, stopFlow, hasRunningFlow, registerMessage, resetMessages } =
    useFlowRunner({
      sendMessage: (type, payload) => {
        iframeRef.current?.contentWindow?.postMessage(
          { pluginId: packageName, type, payload },
          '*',
        );
        appendMessage({ direction: 'in', type, payload });
      },
    });

  const activeSource = activePanel?.source ?? '';
  const activeLabel = activePanel?.label ?? '';
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? null;
  const panelDescription = packageDescription.trim();
  const trimmedCommandType = commandType.trim();
  const trimmedCommandPayload = commandPayload.trim();
  const canDispatch = (() => {
    if (!trimmedCommandType || !trimmedCommandPayload) {
      return false;
    }

    try {
      JSON.parse(trimmedCommandPayload);
      return true;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    document.title = `${packageName} Dev Host`;
  }, [packageName]);

  useEffect(() => {
    if (iframeLoadNonce === 0) {
      return;
    }

    if (lastAutoRunLoadRef.current === iframeLoadNonce) {
      return;
    }

    lastAutoRunLoadRef.current = iframeLoadNonce;

    flows.forEach((flow) => {
      if (flow.autoRun) {
        runFlow(flow, { autoRun: true });
      }
    });
  }, [flows, iframeLoadNonce, runFlow]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (
        typeof event.data !== 'object' ||
        event.data === null ||
        event.data.type !== 'rozenite-message' ||
        !('payload' in event.data) ||
        !isPluginMessage(event.data.payload)
      ) {
        return;
      }

      const payload = event.data.payload;
      appendMessage({
        direction: 'out',
        type: payload.type,
        payload: payload.payload,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const appendMessage = (input: Omit<MessageEntry, 'id' | 'date'>) => {
    const nextEntry = createMessageEntry(input);
    registerMessage(nextEntry);
    setMessages((current) => [nextEntry, ...current]);
  };

  const selectPanel = (value: string) => {
    const nextPanel = panels.find((panel) => panel.source === value);
    if (!nextPanel) {
      return;
    }

    setActivePanel(nextPanel);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('panel', nextPanel.label);
    window.history.replaceState(null, '', nextUrl);
  };

  const clearMessages = () => {
    resetMessages();
    setMessages([]);
    setSelectedMessageId(null);
    setIsDetailsOpen(false);
    setActiveMobileTab('log');
  };

  const resetForm = () => {
    setCommandType('');
    setCommandPayload('');
  };

  const applyPreset = (preset: DevHostPresetEntry) => {
    setCommandType(preset.type);
    setCommandPayload(formatPayloadForCommandInput(preset.payload));
  };

  const handleDispatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canDispatch) {
      return;
    }

    const payload = JSON.parse(trimmedCommandPayload) as unknown;
    iframeRef.current?.contentWindow?.postMessage(
      { pluginId: packageName, type: trimmedCommandType, payload },
      '*',
    );
    appendMessage({
      direction: 'in',
      type: trimmedCommandType,
      payload,
    });
    resetForm();
  };

  const handleMessageSelect = (messageId: string) => {
    setSelectedMessageId(messageId);
    setIsDetailsOpen(true);
    if (isNarrowViewport) {
      setActiveMobileTab('log');
    }
  };

  const useMessage = (message: MessageEntry) => {
    const nextValues = getDispatcherValuesFromMessage(message);
    setCommandType(nextValues.commandType);
    setCommandPayload(nextValues.commandPayload);
    setIsDetailsOpen(false);
    if (isNarrowViewport) {
      setActiveMobileTab('actions');
    }
  };

  const messageLog = (
    <MessageLogPane
      messages={messages}
      onSelectMessage={handleMessageSelect}
      onClearMessages={clearMessages}
    />
  );

  const actions = (
    <DispatchForm
      commandType={commandType}
      commandPayload={commandPayload}
      flows={flows}
      flowRuns={flowRuns}
      hasRunningFlow={hasRunningFlow}
      presets={presets}
      canDispatch={canDispatch}
      onRunFlow={runFlow}
      onStopFlow={stopFlow}
      onCommandTypeChange={setCommandType}
      onCommandPayloadChange={setCommandPayload}
      onApplyPreset={applyPreset}
      onReset={resetForm}
      onSubmit={handleDispatch}
    />
  );

  const devtools = isNarrowViewport ? (
    <Tabs
      className="dev-host-mobile-tabs"
      value={activeMobileTab}
      onValueChange={(value) => setActiveMobileTab(value as MobileDevtoolsTab)}
    >
      <Tabs.List className="dev-host-mobile-tab-list" aria-label="DevTools sections">
        <Tabs.Tab value="log">Log</Tabs.Tab>
        <Tabs.Tab value="actions">Actions</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="log" className="dev-host-mobile-tab-panel">
        {isDetailsOpen && selectedMessage ? (
          <MessageDetailsPane
            selectedMessage={selectedMessage}
            onClose={() => setIsDetailsOpen(false)}
            onUseMessage={useMessage}
          />
        ) : (
          messageLog
        )}
      </Tabs.Panel>
      <Tabs.Panel value="actions" className="dev-host-mobile-tab-panel">
        {actions}
      </Tabs.Panel>
    </Tabs>
  ) : (
    <Split direction="horizontal" className="dev-host-devtools">
      <Split.Pane minSize={35}>
        {isDetailsOpen && selectedMessage ? (
          <Split direction="horizontal">
            <Split.Pane minSize={55}>{messageLog}</Split.Pane>
            <Split.Handle />
            <Split.Pane defaultSize={30} minSize={20}>
              <MessageDetailsPane
                selectedMessage={selectedMessage}
                onClose={() => setIsDetailsOpen(false)}
                onUseMessage={useMessage}
              />
            </Split.Pane>
          </Split>
        ) : (
          messageLog
        )}
      </Split.Pane>
      <Split.Handle />
      <Split.Pane defaultSize={28} minSize={20}>
        {actions}
      </Split.Pane>
    </Split>
  );

  return (
    <PluginShell className="dev-host">
      <PluginHeader className="dev-host-header">
        <div className="dev-host-header-title">
          <PluginHeader.Title>Rozenite Dev Host</PluginHeader.Title>
          <PluginHeader.Subtitle className="dev-host-header-subtitle" title={panelDescription}>
            {packageName}
          </PluginHeader.Subtitle>
        </div>
        <PluginHeader.Actions>
          <PluginHeader.ThemeSwitcher />
          <PanelTabs panels={panels} activeSource={activeSource} onValueChange={selectPanel} />
        </PluginHeader.Actions>
      </PluginHeader>

      <PluginShell.Body className="dev-host-body">
        <Split direction="vertical" className="dev-host-main-split" autoSaveId="dev-host">
          <Split.Pane defaultSize={64} minSize={30} className="dev-host-preview">
            {panels.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                No panels were defined in rozenite.config.ts.
              </div>
            ) : (
              <iframe
                key={activeSource}
                ref={iframeRef}
                title={activeLabel || 'Rozenite panel preview'}
                src={activeSource}
                className="dev-host-iframe"
                onLoad={() => setIframeLoadNonce((value) => value + 1)}
              />
            )}
          </Split.Pane>
          <Split.Handle />
          <Split.Pane defaultSize={36} minSize={25}>
            {devtools}
          </Split.Pane>
        </Split>
      </PluginShell.Body>
    </PluginShell>
  );
};
