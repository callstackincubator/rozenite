export type DevHostPanelEntry = {
  label: string;
  source: string;
};

export type DevHostTemplateEntry = {
  name: string;
  displayName: string;
  type: string;
  payload: unknown;
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
