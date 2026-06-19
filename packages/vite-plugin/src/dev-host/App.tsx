import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DEFAULT_COMMAND_WIDTH,
  DEFAULT_DEVTOOLS_HEIGHT,
  DETAILS_PANEL_WIDTH,
  MIN_COMMAND_WIDTH,
  MIN_DETAILS_WIDTH,
  MIN_DEVTOOLS_HEIGHT,
  MIN_IFRAME_HEIGHT,
  MIN_NARROW_IFRAME_HEIGHT,
  SPLITTER_SIZE,
} from './constants.js';
import type {
  DevHostFlowEntry,
  DevHostPanelEntry,
  DevHostPresetEntry,
  DevHostState,
  MessageEntry,
  ResizeHandleId,
  ResizeSession,
} from './types.js';
import { useFlowRunner } from './flow-runtime.js';
import {
  clamp,
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
import { ResizeHandle } from './components/ResizeHandle.js';
import { ToggleGroup } from './components/ui/ToggleGroup.js';
import { RozeniteLogo } from './components/icons.js';

type CSSVariables = CSSProperties & Record<`--${string}`, string>;

type AppProps = DevHostState & {
  flows: DevHostFlowEntry[];
  presets: DevHostPresetEntry[];
};

type MobileDevtoolsTab = 'log' | 'actions';

const getViewportMatch = () => {
  return window.matchMedia('(max-width: 960px)').matches;
};

export const App = ({ packageName, packageDescription, panels, flows, presets }: AppProps) => {
  const [activePanel, setActivePanel] = useState<DevHostPanelEntry | null>(() => {
    return getInitialPanel(panels);
  });
  const [commandType, setCommandType] = useState('');
  const [commandPayload, setCommandPayload] = useState('');
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [devToolsHeight, setDevToolsHeight] = useState(DEFAULT_DEVTOOLS_HEIGHT);
  const [commandWidth, setCommandWidth] = useState(DEFAULT_COMMAND_WIDTH);
  const [detailsWidth, setDetailsWidth] = useState(DETAILS_PANEL_WIDTH);
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleId | null>(null);
  const [isNarrowViewport, setIsNarrowViewport] = useState(getViewportMatch);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileDevtoolsTab>('log');
  const [iframeLoadNonce, setIframeLoadNonce] = useState(0);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const logWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const devtoolsRef = useRef<HTMLElement | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastAutoRunLoadRef = useRef(0);
  const { flowRuns, runFlow, stopFlow, hasRunningFlow, registerMessage, resetMessages } = useFlowRunner({
    sendMessage: (type, payload) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          pluginId: packageName,
          type,
          payload,
        },
        '*',
      );

      appendMessage({
        direction: 'in',
        type,
        payload,
      });
    },
  });

  const activeSource = activePanel?.source ?? '';
  const activeLabel = activePanel?.label ?? '';
  const emptyState = panels.length === 0;
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? null;
  const trimmedCommandType = commandType.trim();
  const trimmedCommandPayload = commandPayload.trim();
  const hasCommandType = trimmedCommandType.length > 0;
  const hasValidCommandPayload = (() => {
    if (!trimmedCommandPayload) {
      return false;
    }

    try {
      JSON.parse(commandPayload);
      return true;
    } catch {
      return false;
    }
  })();
  const canDispatch = hasCommandType && hasValidCommandPayload;
  const panelDescription = packageDescription.trim();
  const isDetailsVisible = isDetailsOpen && selectedMessage !== null;
  const iframeMinHeight = isNarrowViewport ? MIN_NARROW_IFRAME_HEIGHT : MIN_IFRAME_HEIGHT;

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
    const mediaQuery = window.matchMedia('(max-width: 960px)');

    const handleChange = (event: MediaQueryListEvent) => {
      setIsNarrowViewport(event.matches);
    };

    setIsNarrowViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    const bounds = workspace.getBoundingClientRect();
    const maxHeight = Math.max(MIN_DEVTOOLS_HEIGHT, bounds.height - iframeMinHeight - 12);

    setDevToolsHeight((current) => clamp(current, MIN_DEVTOOLS_HEIGHT, maxHeight));
  }, [iframeMinHeight]);

  useEffect(() => {
    if (!isNarrowViewport) {
      return;
    }

    setActiveMobileTab('log');
  }, [isNarrowViewport]);

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

  const appendMessage = (input: Omit<MessageEntry, 'id' | 'date'>) => {
    const nextEntry = createMessageEntry(input);

    registerMessage(nextEntry);
    setMessages((current) => [nextEntry, ...current]);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      resizeSessionRef.current?.onMove(event);
    };

    const stopDragging = () => {
      const session = resizeSessionRef.current;
      if (!session) {
        return;
      }

      if (session.element.hasPointerCapture(session.pointerId)) {
        session.element.releasePointerCapture(session.pointerId);
      }

      resizeSessionRef.current = null;
      setActiveResizeHandle(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, []);

  const startResize = (
    handleId: ResizeHandleId,
    event: ReactPointerEvent<HTMLDivElement>,
    onMove: (event: PointerEvent) => void,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeSessionRef.current = {
      handleId,
      pointerId: event.pointerId,
      element: event.currentTarget,
      onMove,
    };
    setActiveResizeHandle(handleId);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (
        typeof event.data !== 'object' ||
        event.data === null ||
        !('type' in event.data) ||
        event.data.type !== 'rozenite-message' ||
        !('payload' in event.data)
      ) {
        return;
      }

      const payload = event.data.payload;

      if (!isPluginMessage(payload)) {
        return;
      }

      appendMessage({
        direction: 'out',
        type: payload.type,
        payload: payload.payload,
      });
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const resetForm = () => {
    setCommandType('');
    setCommandPayload('');
  };

  const applyPreset = (preset: DevHostPresetEntry) => {
    setCommandType(preset.type);
    setCommandPayload(formatPayloadForCommandInput(preset.payload));
  };

  const clearMessages = () => {
    resetMessages();
    setMessages([]);
    setSelectedMessageId(null);
    setIsDetailsOpen(false);
    setActiveMobileTab('log');
  };

  const resizeDevtoolsHeight = (event: PointerEvent) => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    const bounds = workspace.getBoundingClientRect();
    const nextHeight = bounds.bottom - event.clientY;
    const maxHeight = Math.max(MIN_DEVTOOLS_HEIGHT, bounds.height - iframeMinHeight - 12);

    setDevToolsHeight(clamp(nextHeight, MIN_DEVTOOLS_HEIGHT, maxHeight));
  };

  const resizeCommandPane = (event: PointerEvent) => {
    const devtools = devtoolsRef.current;
    if (!devtools) {
      return;
    }

    const bounds = devtools.getBoundingClientRect();
    const nextWidth = bounds.right - event.clientX;
    const maxWidth = Math.max(MIN_COMMAND_WIDTH, bounds.width - 280);

    setCommandWidth(clamp(nextWidth, MIN_COMMAND_WIDTH, maxWidth));
  };

  const resizeDetailsPane = (event: PointerEvent) => {
    const logWorkspace = logWorkspaceRef.current;
    if (!logWorkspace || !isDetailsVisible || isNarrowViewport) {
      return;
    }

    const bounds = logWorkspace.getBoundingClientRect();
    const nextWidth = bounds.right - event.clientX;
    const maxWidth = Math.max(MIN_DETAILS_WIDTH, bounds.width - 280 - SPLITTER_SIZE);

    setDetailsWidth(clamp(nextWidth, MIN_DETAILS_WIDTH, maxWidth));
  };

  const handleMessageSelect = (messageId: string) => {
    setSelectedMessageId(messageId);
    setIsDetailsOpen(true);

    if (isNarrowViewport) {
      setActiveMobileTab('log');
    }
  };

  const handleDetailsClose = () => {
    setIsDetailsOpen(false);

    if (isNarrowViewport) {
      setActiveMobileTab('log');
    }
  };

  const handleMobileTabChange = (value: string) => {
    const nextTab = value as MobileDevtoolsTab;
    setActiveMobileTab(nextTab);
  };

  const handleDispatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canDispatch) {
      return;
    }

    const type = trimmedCommandType;

    let payload: unknown;

    try {
      payload = JSON.parse(commandPayload);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `Payload must be valid JSON. ${error.message}`
          : 'Payload must be valid JSON.',
      );
      return;
    }

    iframeRef.current?.contentWindow?.postMessage({ pluginId: packageName, type, payload }, '*');

    appendMessage({ direction: 'in', type, payload });

    resetForm();
  };

  return (
    <div className="rz-shell">
      <header className="rz-topbar">
        <div className="rz-topbar-brand" aria-label="Rozenite">
          <RozeniteLogo />
        </div>

        <div className="rz-topbar-panel-picker" title={panelDescription || undefined}>
          <PanelTabs panels={panels} activeSource={activeSource} onValueChange={selectPanel} />
        </div>
      </header>

      <main
        ref={workspaceRef}
        className="rz-workspace"
        style={{ '--rz-devtools-height': `${devToolsHeight}px` } as CSSVariables}
      >
        <section className="rz-card">
          {emptyState ? (
            <div className="rz-empty-state">No panels were defined in rozenite.config.ts.</div>
          ) : (
              <iframe
                key={activeSource}
                ref={iframeRef}
                title={activeLabel || 'Rozenite panel preview'}
                src={activeSource}
                className="rz-iframe"
                data-resizing={activeResizeHandle === 'devtools-height'}
                onLoad={() => setIframeLoadNonce((value) => value + 1)}
              />
          )}
        </section>

        <ResizeHandle
          className="rz-resize-handle"
          isDragging={activeResizeHandle === 'devtools-height'}
          orientation="horizontal"
          label="Resize DevTools"
          onPointerDown={(event) => startResize('devtools-height', event, resizeDevtoolsHeight)}
        />

        {isNarrowViewport ? (
          <section ref={devtoolsRef} className="rz-devtools-mobile">
            <div className="rz-devtools-mobile-tabs">
              <div className="rz-devtools-mobile-toggle">
                <ToggleGroup
                  aria-label="DevTools sections"
                  value={activeMobileTab}
                  onChange={handleMobileTabChange}
                  options={[
                    { key: 'log', label: 'Log' },
                    { key: 'actions', label: 'Actions' },
                  ]}
                />
              </div>

              <div className="rz-devtools-mobile-panel">
                {activeMobileTab === 'log' ? (
                  isDetailsVisible ? (
                    <MessageDetailsPane
                      selectedMessage={selectedMessage}
                      isOpen={true}
                      isNarrowViewport={true}
                      activeResizeHandle={activeResizeHandle}
                      onClose={handleDetailsClose}
                      onUseMessage={(message) => {
                        const nextValues = getDispatcherValuesFromMessage(message);
                        setCommandType(nextValues.commandType);
                        setCommandPayload(nextValues.commandPayload);
                        setIsDetailsOpen(false);
                        setActiveMobileTab('actions');
                      }}
                      onResizeStart={(event) => startResize('details-width', event, resizeDetailsPane)}
                    />
                  ) : (
                    <MessageLogPane
                      messages={messages}
                      selectedMessageId={selectedMessageId}
                      onSelectMessage={handleMessageSelect}
                      onClearMessages={clearMessages}
                    />
                  )
                ) : (
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
                )}
              </div>
            </div>
          </section>
        ) : (
          <section
            ref={devtoolsRef}
            className="rz-devtools"
            style={
              {
                '--rz-command-width': `${commandWidth}px`,
                '--rz-command-splitter-width': `${SPLITTER_SIZE}px`,
              } as CSSVariables
            }
          >
            <div
              ref={logWorkspaceRef}
              className="rz-log-workspace"
              style={
                {
                  '--rz-details-width': isDetailsVisible ? `${detailsWidth}px` : '0px',
                  '--rz-details-splitter-width': isDetailsVisible ? `${SPLITTER_SIZE}px` : '0px',
                } as CSSVariables
              }
            >
              <MessageLogPane
                messages={messages}
                selectedMessageId={selectedMessageId}
                onSelectMessage={handleMessageSelect}
                onClearMessages={clearMessages}
              />

              <MessageDetailsPane
                selectedMessage={selectedMessage}
                isOpen={isDetailsOpen}
                isNarrowViewport={false}
                activeResizeHandle={activeResizeHandle}
                onClose={handleDetailsClose}
                onUseMessage={(message) => {
                  const nextValues = getDispatcherValuesFromMessage(message);
                  setCommandType(nextValues.commandType);
                  setCommandPayload(nextValues.commandPayload);
                }}
                onResizeStart={(event) => startResize('details-width', event, resizeDetailsPane)}
              />
            </div>

            <ResizeHandle
              className="rz-column-resize-handle"
              isDragging={activeResizeHandle === 'command-width'}
              orientation="vertical"
              label="Resize command dispatcher"
              onPointerDown={(event) => startResize('command-width', event, resizeCommandPane)}
            />

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
          </section>
        )}
      </main>
    </div>
  );
};
