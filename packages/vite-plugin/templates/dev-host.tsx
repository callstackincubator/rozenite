import { FormEvent, StrictMode, forwardRef, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { JSONTree } from 'react-json-tree';

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
  date: string;
  type: string;
  payload: unknown;
};

type PluginMessage = {
  pluginId: string;
  type: string;
  payload: unknown;
};

type ResizeHandleId = 'devtools-height' | 'command-width' | 'details-width';

type ResizeSession = {
  handleId: ResizeHandleId;
  pointerId: number;
  element: HTMLElement;
  onMove: (event: PointerEvent) => void;
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
    min-height: 36px;
    padding: 4px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
    background: #0a0a0a;
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
    grid-template-columns: minmax(0, 1fr) var(--rz-command-splitter-width, 6px) minmax(260px, var(--rz-command-width, 320px));
  }

  .rz-log-workspace {
    display: grid;
    min-height: 0;
    grid-template-columns: minmax(0, 1fr) var(--rz-details-splitter-width, 0px) var(--rz-details-width, 0px);
  }

  .rz-resize-handle {
    position: relative;
    cursor: row-resize;
    background: #0a0a0a;
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

  .rz-column-resize-handle {
    position: relative;
    width: 6px;
    min-width: 6px;
    cursor: col-resize;
    background: transparent;
    user-select: none;
    touch-action: none;
  }

  .rz-column-resize-handle::after {
    content: '';
    position: absolute;
    inset: 0;
    border-left: 1px solid transparent;
  }

  .rz-column-resize-handle[data-dragging='true']::after,
  .rz-column-resize-handle:hover::after {
    border-left-color: rgba(255, 255, 255, 0.22);
  }

  .rz-pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .rz-pane + .rz-pane {
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  .rz-pane[data-hidden='true'] {
    display: none;
  }

  .rz-tabs-root {
    width: 100%;
    min-width: 0;
  }

  .rz-tabs-list {
    display: inline-flex;
    min-height: 26px;
    max-width: 100%;
    align-items: center;
    gap: 2px;
    overflow: auto hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    padding: 2px;
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
    min-height: 22px;
    padding: 3px 9px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: 0;
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
  .rz-button:focus-visible,
  .rz-sidebar-close:focus-visible {
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
    min-width: 100%;
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .rz-log-pane {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    background: #050505;
  }

  .rz-message-list-header,
  .rz-message-row {
    display: grid;
    grid-template-columns: 40px 168px minmax(120px, 180px) minmax(0, 1fr);
    gap: 0;
    align-items: center;
  }

  .rz-message-list-header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #0a0a0a;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    line-height: 16px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .rz-message-header-cell,
  .rz-message-cell {
    min-width: 0;
    padding: 8px 12px;
  }

  .rz-message-header-cell:first-child,
  .rz-message-cell:first-child {
    text-align: center;
  }

  .rz-message-header-cell + .rz-message-header-cell,
  .rz-message-cell + .rz-message-cell {
    border-left: 1px solid rgba(255, 255, 255, 0.04);
  }

  .rz-message-row {
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    padding: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: background-color 120ms ease, box-shadow 120ms ease;
  }

  .rz-message-row:last-child {
    border-bottom: 0;
  }

  .rz-message-row:hover {
    background: rgba(255, 255, 255, 0.035);
  }

  .rz-message-row[data-selected='true'] {
    background: rgba(59, 130, 246, 0.14);
    box-shadow: inset 2px 0 0 #4da3ff;
  }

  .rz-message-direction {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    line-height: 18px;
  }

  .rz-message-arrow {
    display: inline-flex;
    width: 16px;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
  }

  .rz-message-dir-in .rz-message-arrow {
    color: #22c55e;
  }

  .rz-message-dir-out .rz-message-arrow {
    color: #f59e0b;
  }

  .rz-message-type {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.92);
    font-size: 12px;
    font-weight: 500;
    line-height: 18px;
  }

  .rz-message-date {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.52);
    font-size: 12px;
    line-height: 18px;
  }

  .rz-message-preview {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.52);
    font-size: 12px;
    line-height: 18px;
  }

  .rz-sidebar {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    background: #050505;
    flex-grow: 1;
  }

  .rz-message-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    min-height: 100%;
  }

  .rz-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 53px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .rz-sidebar-scroll {
    min-height: 0;
  }

  .rz-sidebar-scroll > .rz-scroll-viewport > * {
    min-height: 100%;
  }

  .rz-sidebar-title {
    color: rgba(255, 255, 255, 0.88);
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .rz-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rz-sidebar-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: rgba(255, 255, 255, 0.56);
    cursor: pointer;
  }

  .rz-sidebar-close:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .rz-sidebar-close:disabled {
    cursor: default;
    opacity: 0.4;
  }

  .rz-sidebar-close:disabled:hover {
    background: transparent;
    color: rgba(255, 255, 255, 0.56);
  }

  .rz-sidebar-action-primary {
    background: #ffffff;
    color: #000000;
  }

  .rz-sidebar-action-primary:hover {
    background: rgba(255, 255, 255, 0.88);
    color: #000000;
  }

  .rz-sidebar-action-primary:disabled:hover {
    background: #ffffff;
    color: #000000;
  }

  .rz-detail-section {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .rz-detail-section:last-child {
    flex: 1;
    min-height: 0;
  }

  .rz-detail-value {
    min-width: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.03);
    padding: 10px 12px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    line-height: 1.5;
    letter-spacing: -0.02em;
  }

  .rz-detail-mono {
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
  }

  .rz-detail-payload {
    display: flex;
    flex: 1;
    overflow: auto;
    min-height: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.03);
    padding: 12px;
  }

  .rz-detail-pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .rz-command-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    min-height: 100%;
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
      padding-left: 8px;
      padding-right: 8px;
    }

    .rz-workspace {
      grid-template-rows: minmax(0, 1fr) 12px minmax(180px, var(--rz-devtools-height, 272px));
    }

    .rz-devtools {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) var(--rz-command-splitter-width, 6px) minmax(240px, var(--rz-command-width, 320px));
    }

    .rz-log-workspace {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows:
        minmax(0, 1fr)
        var(--rz-details-splitter-width, 0px)
        var(--rz-details-width, 0px);
    }

    .rz-pane + .rz-pane {
      border-left: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .rz-pane[data-hidden='true'] {
      display: none;
    }

    .rz-column-resize-handle {
      width: 100%;
      min-width: 0;
      min-height: 6px;
      cursor: row-resize;
    }

    .rz-column-resize-handle::after {
      border-left: 0;
      border-top: 1px solid transparent;
    }

    .rz-column-resize-handle[data-dragging='true']::after,
    .rz-column-resize-handle:hover::after {
      border-top-color: rgba(255, 255, 255, 0.22);
    }
  }
`;

const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const jsonTreeTheme = {
  base00: 'transparent',
  base01: '#374151',
  base02: '#4b5563',
  base03: '#6b7280',
  base04: '#9ca3af',
  base05: '#d1d5db',
  base06: '#e5e7eb',
  base07: '#f9fafb',
  base08: '#ef4444',
  base09: '#f59e0b',
  base0A: '#10b981',
  base0B: '#3b82f6',
  base0C: '#06b6d4',
  base0D: '#8b5cf6',
  base0E: '#ec4899',
  base0F: '#f97316',
};

const formatPayloadPreview = (payload: unknown) => {
  if (payload == null) {
    return 'null';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const isJsonTreeData = (value: unknown): value is Record<string, unknown> | unknown[] => {
  return Array.isArray(value) || (typeof value === 'object' && value !== null);
};

const formatMessageDate = (date: string) => {
  return new Date(date).toLocaleString();
};

const formatMessageTableDate = (date: string) => {
  return new Date(date).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatPayloadForCommandInput = (payload: unknown) => {
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

const MessagePayloadDetail = ({ payload }: { payload: unknown }) => {
  if (typeof payload === 'string') {
    return <pre className="rz-detail-pre rz-detail-mono">{payload}</pre>;
  }

  if (typeof payload === 'number' || typeof payload === 'boolean' || payload == null) {
    return <pre className="rz-detail-pre rz-detail-mono">{String(payload)}</pre>;
  }

  if (isJsonTreeData(payload)) {
    return (
      <JSONTree
        data={payload}
        theme={jsonTreeTheme}
        invertTheme={false}
        shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
      />
    );
  }

  return <pre className="rz-detail-pre rz-detail-mono">{String(payload)}</pre>;
};

const ClearIcon = () => {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.5H11.5M5.5 1.75H8.5M4 3.5V10.5C4 10.9641 4.18437 11.4092 4.51256 11.7374C4.84075 12.0656 5.28587 12.25 5.75 12.25H8.25C8.71413 12.25 9.15925 12.0656 9.48744 11.7374C9.81563 11.4092 10 10.9641 10 10.5V3.5M5.75 5.5V9.625M8.25 5.5V9.625"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const SendIcon = () => {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M12.25 1.75L6.75 7.25M12.25 1.75L8.75 12.25L6.75 7.25M12.25 1.75L1.75 5.25L6.75 7.25"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const ResetIcon = () => {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.33325 3.5V6.41667H5.24992M11.6666 10.5V7.58333H8.74992M10.4407 5.25C10.1655 4.47113 9.62691 3.81301 8.91813 3.38936C8.20936 2.96571 7.37395 2.80313 6.55683 2.93026C5.7397 3.0574 4.99314 3.46628 4.4467 4.08504L2.33325 6.41667M3.55914 8.75C3.83437 9.52887 4.37294 10.187 5.08171 10.6106C5.79049 11.0343 6.6259 11.1969 7.44303 11.0697C8.26015 10.9426 9.0067 10.5337 9.55314 9.91496L11.6666 7.58333"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
const DETAILS_PANEL_WIDTH = 360;
const MIN_DETAILS_WIDTH = 280;
const DEFAULT_COMMAND_WIDTH = 320;
const MIN_COMMAND_WIDTH = 260;
const SPLITTER_SIZE = 6;

const createMessageEntry = (input: Omit<MessageEntry, 'id' | 'date'>, index: number): MessageEntry => ({
  id: `${Date.now()}-${index}`,
  date: new Date().toISOString(),
  ...input,
});

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const HostApp = ({ packageName, panels }: DevHostState) => {
  const [activePanel, setActivePanel] = useState<DevHostPanelEntry | null>(() =>
    getInitialPanel(panels),
  );
  const [commandType, setCommandType] = useState('');
  const [commandPayload, setCommandPayload] = useState('');
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [devToolsHeight, setDevToolsHeight] = useState(DEFAULT_DEVTOOLS_HEIGHT);
  const [commandWidth, setCommandWidth] = useState(DEFAULT_COMMAND_WIDTH);
  const [detailsWidth, setDetailsWidth] = useState(DETAILS_PANEL_WIDTH);
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleId | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const logWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const devtoolsRef = useRef<HTMLElement | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

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
    let nextEntry: MessageEntry | null = null;

    setMessages((current) => {
      nextEntry = createMessageEntry(input, current.length);
      return [nextEntry, ...current];
    });

    if (nextEntry) {
      setSelectedMessageId(nextEntry.id);
      setIsDetailsOpen(true);
    }
  };

  const handleSelectMessage = (messageId: string) => {
    setSelectedMessageId(messageId);
    setIsDetailsOpen(true);
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
    event: React.PointerEvent<HTMLElement>,
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

  const clearMessages = () => {
    setMessages([]);
    setSelectedMessageId(null);
    setIsDetailsOpen(false);
  };

  const fillDispatcherFromMessage = (message: MessageEntry) => {
    setCommandType(message.type);
    setCommandPayload(formatPayloadForCommandInput(message.payload));
  };

  const resizeDevtoolsHeight = (event: PointerEvent) => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    const bounds = workspace.getBoundingClientRect();
    const nextHeight = bounds.bottom - event.clientY;
    const maxHeight = Math.max(MIN_DEVTOOLS_HEIGHT, bounds.height - MIN_IFRAME_HEIGHT - 12);

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
    if (!logWorkspace || !isDetailsOpen || !selectedMessage) {
      return;
    }

    const bounds = logWorkspace.getBoundingClientRect();
    const nextWidth = bounds.right - event.clientX;
    const maxWidth = Math.max(MIN_DETAILS_WIDTH, bounds.width - 280 - SPLITTER_SIZE);

    setDetailsWidth(clamp(nextWidth, MIN_DETAILS_WIDTH, maxWidth));
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

    const message = {
      pluginId: packageName,
      type,
      payload,
    };

    iframeRef.current?.contentWindow?.postMessage(message, '*');

    appendMessage({
      direction: 'in',
      type,
      payload,
    });

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
                data-resizing={activeResizeHandle === 'devtools-height'}
              />
            )}
          </section>

          <div
            className="rz-resize-handle"
            data-dragging={activeResizeHandle === 'devtools-height'}
            onPointerDown={(event) => startResize('devtools-height', event, resizeDevtoolsHeight)}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize DevTools"
          />

          <section
            ref={devtoolsRef}
            className="rz-devtools"
            style={{
              ['--rz-command-width' as const]: `${commandWidth}px`,
              ['--rz-command-splitter-width' as const]: `${SPLITTER_SIZE}px`,
            }}
          >
            <div
              ref={logWorkspaceRef}
              className="rz-log-workspace"
              style={{
                ['--rz-details-width' as const]:
                  isDetailsOpen && selectedMessage ? `${detailsWidth}px` : '0px',
                ['--rz-details-splitter-width' as const]:
                  isDetailsOpen && selectedMessage ? `${SPLITTER_SIZE}px` : '0px',
              }}
            >
              <div className="rz-pane">
                <div className="rz-log-pane">
                  <div className="rz-sidebar-header">
                    <div className="rz-sidebar-title">Message Log</div>
                    <div className="rz-header-actions">
                      <button
                        type="button"
                        className="rz-sidebar-close"
                        onClick={clearMessages}
                        disabled={messages.length === 0}
                        aria-label="Clear message log"
                        title="Clear message log"
                      >
                        <ClearIcon />
                      </button>
                    </div>
                  </div>
                  <ScrollArea className="rz-sidebar-scroll">
                    <div className="rz-message-list">
                      <div className="rz-message-list-header">
                        <div className="rz-message-header-cell">Dir</div>
                        <div className="rz-message-header-cell">Date</div>
                        <div className="rz-message-header-cell">Type</div>
                        <div className="rz-message-header-cell">Payload</div>
                      </div>
                      {messages.map((message) => (
                        <button
                          key={message.id}
                          type="button"
                          className="rz-message-row"
                          data-selected={message.id === selectedMessageId}
                          onClick={() => handleSelectMessage(message.id)}
                        >
                          <div
                            className={cn(
                              'rz-message-cell rz-message-direction',
                              message.direction === 'in' ? 'rz-message-dir-in' : 'rz-message-dir-out',
                            )}
                            aria-label={message.direction === 'in' ? 'Sent message' : 'Received message'}
                            title={message.direction === 'in' ? 'Sent message' : 'Received message'}
                          >
                            <span className="rz-message-arrow" aria-hidden="true">
                              {message.direction === 'in' ? '↑' : '↓'}
                            </span>
                          </div>
                          <div className="rz-message-cell rz-message-date">
                            {formatMessageTableDate(message.date)}
                          </div>
                          <div className="rz-message-cell rz-message-type">{message.type}</div>
                          <pre className="rz-message-cell rz-message-preview">
                            {formatPayloadPreview(message.payload)}
                          </pre>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <div
                className="rz-column-resize-handle"
                data-dragging={activeResizeHandle === 'details-width'}
                data-hidden={!isDetailsOpen || !selectedMessage}
                aria-hidden={!isDetailsOpen || !selectedMessage}
                onPointerDown={(event) => startResize('details-width', event, resizeDetailsPane)}
                role="separator"
                aria-orientation={window.innerWidth <= 960 ? 'horizontal' : 'vertical'}
                aria-label="Resize message details"
              />

              <div
                className="rz-pane"
                data-hidden={!isDetailsOpen || !selectedMessage}
                aria-hidden={!isDetailsOpen || !selectedMessage}
              >
                <div className="rz-sidebar">
                  <div className="rz-sidebar-header">
                    <div className="rz-sidebar-title">Message Details</div>
                    <div className="rz-header-actions">
                      <button
                        type="button"
                        className="rz-sidebar-close"
                        aria-label="Use message in dispatcher"
                        title="Use message in dispatcher"
                        onClick={() => {
                          if (selectedMessage) {
                            fillDispatcherFromMessage(selectedMessage);
                          }
                        }}
                      >
                        <SendIcon />
                      </button>
                      <button
                        type="button"
                        className="rz-sidebar-close"
                        aria-label="Close message details"
                        onClick={() => setIsDetailsOpen(false)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <ScrollArea className="rz-sidebar-scroll">
                    {selectedMessage ? (
                      <div className="rz-message-detail">
                        <div className="rz-detail-section">
                          <div className="rz-label">Date</div>
                          <div className="rz-detail-value rz-detail-mono">
                            {formatMessageDate(selectedMessage.date)}
                          </div>
                        </div>

                        <div className="rz-detail-section">
                          <div className="rz-label">Type</div>
                          <div className="rz-detail-value rz-detail-mono">{selectedMessage.type}</div>
                        </div>

                        <div className="rz-detail-section">
                          <div className="rz-label">Payload</div>
                          <div className="rz-detail-payload">
                            <MessagePayloadDetail payload={selectedMessage.payload} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rz-empty-state">Select a message to inspect its details.</div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </div>

            <div
              className="rz-column-resize-handle"
              data-dragging={activeResizeHandle === 'command-width'}
              onPointerDown={(event) => startResize('command-width', event, resizeCommandPane)}
              role="separator"
              aria-orientation={window.innerWidth <= 960 ? 'horizontal' : 'vertical'}
              aria-label="Resize command dispatcher"
            />

            <div className="rz-pane">
              <div className="rz-sidebar">
                <div className="rz-sidebar-header">
                  <div className="rz-sidebar-title">Dispatch Message</div>
                </div>
                <ScrollArea className="rz-sidebar-scroll">
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
                        placeholder='{"example": true}'
                        spellCheck={false}
                      />
                    </div>

                    <div className="rz-button-row">
                      <button
                        type="button"
                        className="rz-sidebar-close"
                        aria-label="Reset dispatcher"
                        title="Reset dispatcher"
                        onClick={resetForm}
                      >
                        <ClearIcon />
                      </button>
                      <button
                        type="submit"
                        className="rz-sidebar-close rz-sidebar-action-primary"
                        aria-label="Dispatch message"
                        title="Dispatch message"
                        disabled={!canDispatch}
                      >
                        <SendIcon />
                      </button>
                    </div>
                  </form>
                </ScrollArea>
              </div>
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
