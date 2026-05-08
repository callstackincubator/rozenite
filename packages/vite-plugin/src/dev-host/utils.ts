import { DEV_HOST_STATE_ELEMENT_ID } from './constants.js';
import type { DevHostPanelEntry, DevHostState, MessageEntry, PluginMessage } from './types.js';

export const cn = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ');
};

export const formatPayloadPreview = (payload: unknown) => {
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

export const isJsonTreeData = (value: unknown): value is Record<string, unknown> | unknown[] => {
  return Array.isArray(value) || (typeof value === 'object' && value !== null);
};

export const formatMessageDate = (date: string) => {
  return new Date(date).toLocaleString();
};

export const formatMessageTableDate = (date: string) => {
  return new Date(date).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export const formatPayloadForCommandInput = (payload: unknown) => {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

export const isPluginMessage = (value: unknown): value is PluginMessage => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pluginId' in value &&
    'type' in value &&
    'payload' in value
  );
};

export const getInitialPanel = (panels: DevHostPanelEntry[]) => {
  const requestedPanel = new URLSearchParams(window.location.search).get('panel');

  if (requestedPanel) {
    const matchedPanel = panels.find((panel) => panel.label === requestedPanel);
    if (matchedPanel) {
      return matchedPanel;
    }
  }

  return panels[0] ?? null;
};

export const createMessageEntry = (
  input: Omit<MessageEntry, 'id' | 'date'>,
  index: number,
): MessageEntry => {
  return {
    id: `${Date.now()}-${index}`,
    date: new Date().toISOString(),
    ...input,
  };
};

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const readDevHostState = (): DevHostState => {
  const stateElement = document.getElementById(DEV_HOST_STATE_ELEMENT_ID);

  if (!stateElement?.textContent) {
    throw new Error('Rozenite dev host failed to initialize.');
  }

  return JSON.parse(stateElement.textContent) as DevHostState;
};
