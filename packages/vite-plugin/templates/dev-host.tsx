import { FormEvent, StrictMode, forwardRef, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import * as TabsPrimitive from '@radix-ui/react-tabs';

type DevHostPanelEntry = {
  label: string;
  source: string;
};

type DevHostState = {
  packageName: string;
  packageDescription: string;
  panels: DevHostPanelEntry[];
};

type MessageEntry = {
  id: string;
  direction: 'in' | 'out';
  type: string;
  payload: string;
};

type PluginMessage = {
  pluginId: string;
  type: string;
  payload: unknown;
};

declare global {
  interface Window {
    __ROZENITE_DEV_HOST__?: DevHostState;
  }
}

const styles = `
  :root {
    color-scheme: dark;
    font-family: "Switzer Variable", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #000000;
    color: #ffffff;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
    margin: 0;
  }

  body {
    overflow: hidden;
    background: #000000;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  .rz-shell {
    display: flex;
    height: 100dvh;
    flex-direction: column;
    overflow: hidden;
    background: #000000;
  }

  .rz-topbar {
    display: flex;
    align-items: center;
    min-height: 61px;
    padding: 12px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .rz-workspace {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr) 12px minmax(180px, var(--rz-devtools-height, 288px));
    overflow: hidden;
  }

  .rz-card {
    min-height: 0;
    overflow: hidden;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .rz-card:first-child {
    border-top: 0;
  }

  .rz-iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: #ffffff;
  }

  .rz-iframe[data-resizing='true'] {
    pointer-events: none;
  }

  .rz-devtools {
    display: grid;
    min-height: 0;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .rz-resize-handle {
    position: relative;
    cursor: row-resize;
    background: #000000;
    user-select: none;
    touch-action: none;
  }

  .rz-resize-handle::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 72px;
    height: 2px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.2);
    transform: translate(-50%, -50%);
  }

  .rz-resize-handle::after {
    content: '';
    position: absolute;
    inset: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .rz-resize-handle[data-dragging='true']::before,
  .rz-resize-handle:hover::before {
    background: #ffffff;
  }

  .rz-pane {
    min-height: 0;
    overflow: hidden;
  }

  .rz-pane + .rz-pane {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  .rz-tabs-root {
    width: 100%;
    min-width: 0;
  }

  .rz-tabs-list {
    display: inline-flex;
    min-height: 44px;
    max-width: 100%;
    align-items: center;
    gap: 4px;
    overflow: auto hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    padding: 4px;
    scrollbar-width: none;
  }

  .rz-tabs-list::-webkit-scrollbar {
    display: none;
  }

  .rz-tabs-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    border: 0;
    border-radius: 2px;
    background: transparent;
    padding: 10px 14px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: -0.02em;
    transition: background-color 120ms ease, color 120ms ease;
  }

  .rz-tabs-trigger:hover {
    color: #ffffff;
  }

  .rz-tabs-trigger[data-state='active'] {
    background: #ffffff;
    color: #000000;
  }

  .rz-tabs-trigger:focus-visible,
  .rz-input:focus-visible,
  .rz-textarea:focus-visible,
  .rz-select:focus-visible,
  .rz-button:focus-visible {
    outline: 2px solid rgba(130, 50, 255, 0.95);
    outline-offset: -2px;
  }

  .rz-scroll-area {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .rz-scroll-viewport {
    height: 100%;
    width: 100%;
  }

  .rz-scrollbar {
    display: flex;
    user-select: none;
    touch-action: none;
    padding: 3px;
  }

  .rz-scrollbar[data-orientation='vertical'] {
    width: 12px;
  }

  .rz-scrollbar-thumb {
    position: relative;
    flex: 1;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
  }

  .rz-message-list {
    display: grid;
    gap: 0;
  }

  .rz-message-item {
    display: grid;
    gap: 8px;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .rz-message-item:last-child {
    border-bottom: 0;
  }

  .rz-message-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    line-height: 20px;
    letter-spacing: -0.04em;
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .rz-message-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #8232ff;
  }

  .rz-message-type {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: -0.02em;
  }

  .rz-message-payload {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: rgba(255, 255, 255, 0.72);
    font-size: 13px;
    line-height: 1.5;
    letter-spacing: -0.02em;
  }

  .rz-command-form {
    display: grid;
    gap: 12px;
    padding: 16px;
  }

  .rz-field {
    display: grid;
    gap: 6px;
  }

  .rz-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    line-height: 20px;
    letter-spacing: -0.04em;
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .rz-input,
  .rz-textarea,
  .rz-select {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    color: #ffffff;
    padding: 10px 12px;
    font-size: 14px;
    line-height: 1.5;
    letter-spacing: -0.02em;
  }

  .rz-textarea {
    min-height: 112px;
    resize: none;
  }

  .rz-button-row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: auto;
  }

  .rz-button {
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 4px;
    background: transparent;
    color: #ffffff;
    padding: 10px 14px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: -0.02em;
  }

  .rz-button-primary {
    border-color: #ffffff;
    background: #ffffff;
    color: #000000;
  }

  .rz-empty-state {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.7);
    padding: 24px;
    text-align: center;
    font-size: 16px;
    line-height: 1.5;
    letter-spacing: -0.02em;
  }

  @media (max-width: 960px) {
    .rz-topbar {
      padding-left: 12px;
      padding-right: 12px;
    }

    .rz-workspace {
      grid-template-rows: minmax(0, 1fr) 12px minmax(180px, var(--rz-devtools-height, 272px));
    }

    .rz-devtools {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    }

    .rz-pane + .rz-pane {
      border-left: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
  }
`;

const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const formatPayload = (payload: unknown) => {
  if (payload == null) {
    return 'null';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

const isPluginMessage = (value: unknown): value is PluginMessage => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pluginId' in value &&
    'type' in value &&
    'payload' in value
  );
};

const Tabs = TabsPrimitive.Root;

const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('rz-tabs-list', className)} {...props} />
));

TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn('rz-tabs-trigger', className)}
    {...props}
  />
));

TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const ScrollArea = forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn('rz-scroll-area', className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="rz-scroll-viewport">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar orientation="vertical" />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));

ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    className={cn('rz-scrollbar', className)}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="rz-scrollbar-thumb" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));

ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

type SharedTabBarProps = {
  items: Array<{ value: string; label: string }>;
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
};

const SharedTabBar = ({ items, value, onValueChange, ariaLabel }: SharedTabBarProps) => {
  return (
    <Tabs className="rz-tabs-root" value={value} onValueChange={onValueChange}>
      <TabsList aria-label={ariaLabel}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

const getInitialPanel = (panels: DevHostPanelEntry[]) => {
  const requestedPanel = new URLSearchParams(window.location.search).get('panel');

  if (requestedPanel) {
    const matchedPanel = panels.find((panel) => panel.label === requestedPanel);
    if (matchedPanel) {
      return matchedPanel;
    }
  }

  return panels[0] ?? null;
};

const DEFAULT_DEVTOOLS_HEIGHT = 288;
const MIN_DEVTOOLS_HEIGHT = 180;
const MIN_IFRAME_HEIGHT = 220;

const HostApp = ({ packageName, panels }: DevHostState) => {
  const [activePanel, setActivePanel] = useState<DevHostPanelEntry | null>(() =>
    getInitialPanel(panels),
  );
  const [commandType, setCommandType] = useState('');
  const [commandPayload, setCommandPayload] = useState('');
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [devToolsHeight, setDevToolsHeight] = useState(DEFAULT_DEVTOOLS_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const resizePointerIdRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const activeSource = activePanel?.source ?? '';
  const activeLabel = activePanel?.label ?? '';
  const emptyState = panels.length === 0;

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

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging) {
        return;
      }

      const workspace = workspaceRef.current;

      if (!workspace) {
        return;
      }

      const bounds = workspace.getBoundingClientRect();
      const nextHeight = bounds.bottom - event.clientY;
      const maxHeight = Math.max(
        MIN_DEVTOOLS_HEIGHT,
        bounds.height - MIN_IFRAME_HEIGHT - 12,
      );

      setDevToolsHeight(Math.min(Math.max(nextHeight, MIN_DEVTOOLS_HEIGHT), maxHeight));
    };

    const stopDragging = () => {
      setIsDragging(false);
      resizePointerIdRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [isDragging]);

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

      setMessages((current) => [
        {
          id: `${Date.now()}-${current.length}`,
          direction: 'out',
          type: payload.type,
          payload: formatPayload(payload.payload),
        },
        ...current,
      ]);
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

  const handleDispatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const type = commandType.trim();

    if (!type) {
      return;
    }

    let payload: unknown = null;

    if (commandPayload.trim()) {
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
    }

    const message = {
      pluginId: packageName,
      type,
      payload,
    };

    iframeRef.current?.contentWindow?.postMessage(message, '*');

    setMessages((current) => [
      {
        id: `${Date.now()}-${current.length}`,
        direction: 'in',
        type,
        payload: formatPayload(payload),
      },
      ...current,
    ]);

    resetForm();
  };

  return (
    <>
      <style>{styles}</style>
      <div className="rz-shell">
        <header className="rz-topbar">
          <SharedTabBar
            items={panels.map((panel) => ({ value: panel.source, label: panel.label }))}
            value={activeSource}
            onValueChange={selectPanel}
            ariaLabel="Plugin panels"
          />
        </header>

        <main
          ref={workspaceRef}
          className="rz-workspace"
          style={{ ['--rz-devtools-height' as const]: `${devToolsHeight}px` }}
        >
          <section className="rz-card">
            {emptyState ? (
              <div className="rz-empty-state">
                No panels were defined in rozenite.config.ts.
              </div>
            ) : (
              <iframe
                key={activeSource}
                ref={iframeRef}
                title={activeLabel || 'Rozenite panel preview'}
                src={activeSource}
                className="rz-iframe"
                data-resizing={isDragging}
              />
            )}
          </section>

          <div
            className="rz-resize-handle"
            data-dragging={isDragging}
            onPointerDown={(event) => {
              event.preventDefault();
              resizePointerIdRef.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              setIsDragging(true);
            }}
            onPointerUp={(event) => {
              if (resizePointerIdRef.current === event.pointerId) {
                resizePointerIdRef.current = null;
              }

              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }

              setIsDragging(false);
            }}
            onPointerCancel={(event) => {
              if (resizePointerIdRef.current === event.pointerId) {
                resizePointerIdRef.current = null;
              }

              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }

              setIsDragging(false);
            }}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize DevTools"
          />

          <section className="rz-devtools">
            <div className="rz-pane">
              <ScrollArea>
                <div className="rz-message-list">
                  {messages.map((message) => (
                    <article key={message.id} className="rz-message-item">
                      <div className="rz-message-meta">
                        <span className="rz-message-dot" />
                        <span>{message.direction === 'in' ? 'incoming' : 'outgoing'}</span>
                      </div>
                      <div className="rz-message-type">{message.type}</div>
                      <pre className="rz-message-payload">{message.payload}</pre>
                    </article>
                  ))}
                  {messages.length === 0 ? (
                    <div className="rz-empty-state">No messages yet.</div>
                  ) : null}
                </div>
              </ScrollArea>
            </div>

            <div className="rz-pane">
              <form className="rz-command-form" onSubmit={handleDispatch}>
                <div className="rz-field">
                  <label className="rz-label" htmlFor="command-type">
                    Command
                  </label>
                  <input
                    id="command-type"
                    className="rz-input"
                    value={commandType}
                    onChange={(event) => setCommandType(event.target.value)}
                    placeholder="get-snapshot"
                    spellCheck={false}
                  />
                </div>

                <div className="rz-field">
                  <label className="rz-label" htmlFor="command-payload">
                    Payload
                  </label>
                  <textarea
                    id="command-payload"
                    className="rz-textarea"
                    value={commandPayload}
                    onChange={(event) => setCommandPayload(event.target.value)}
                    spellCheck={false}
                  />
                </div>

                <div className="rz-button-row">
                  <button type="button" className="rz-button" onClick={resetForm}>
                    Reset
                  </button>
                  <button type="submit" className="rz-button rz-button-primary">
                    Dispatch
                  </button>
                </div>
              </form>
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

const state = window.__ROZENITE_DEV_HOST__;
const rootElement = document.getElementById('root');

if (!state || !rootElement) {
  throw new Error('Rozenite dev host failed to initialize.');
}

createRoot(rootElement).render(
  <StrictMode>
    <HostApp {...state} />
  </StrictMode>,
);
