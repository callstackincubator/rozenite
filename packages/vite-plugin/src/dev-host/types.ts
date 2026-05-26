import type { DevFlowEntry } from '../load-config.js';

export type DevHostPanelEntry = {
  label: string;
  source: string;
};

export type DevHostPresetEntry = {
  name: string;
  displayName: string;
  type: string;
  payload: unknown;
};

export type DevHostFlowEntry = {
  name: string;
  displayName: string;
  autoRun: boolean;
  run: DevFlowEntry['run'];
};

export type DevHostState = {
  packageName: string;
  packageDescription: string;
  panels: DevHostPanelEntry[];
};

export type MessageEntry = {
  id: string;
  direction: 'in' | 'out';
  date: string;
  type: string;
  payload: unknown;
};

export type DevHostFlowRunStatus = 'running' | 'succeeded' | 'failed' | 'aborted';

export type DevHostFlowRunState = {
  id: string;
  flowName: string;
  flowDisplayName: string;
  status: DevHostFlowRunStatus;
  result: unknown;
  error: string | null;
  autoRun: boolean;
};

export type PluginMessage = {
  pluginId: string;
  type: string;
  payload: unknown;
};

export type ResizeHandleId = 'devtools-height' | 'command-width' | 'details-width';

export type ResizeSession = {
  handleId: ResizeHandleId;
  pointerId: number;
  element: HTMLElement;
  onMove: (event: PointerEvent) => void;
};
