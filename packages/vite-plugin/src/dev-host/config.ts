import type { DevFlowEntry, DevPresetEntry } from '../load-config.js';
import { DEV_HOST_CONFIG_GLOBAL_KEY } from './constants.js';
import type { DevHostFlowEntry, DevHostPresetEntry } from './types.js';

type DevHostPresetSource = Omit<DevPresetEntry, 'name'> & {
  name?: string;
};

type DevHostFlowSource = Omit<DevFlowEntry, 'name'> & {
  name?: string;
};

const getEntryDisplayName = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
};

const getDevHostConfig = () => {
  const value = (window as unknown as Record<string, unknown>)[DEV_HOST_CONFIG_GLOBAL_KEY];

  if (typeof value !== 'object' || value === null) {
    return {} as { presets?: unknown; flows?: unknown };
  }

  return value as { presets?: unknown; flows?: unknown };
};

const isDevHostPresetSource = (value: unknown): value is DevHostPresetSource => {
  return (
    typeof value === 'object' &&
    value !== null &&
    (!('name' in value) || typeof value.name === 'string') &&
    'type' in value &&
    typeof value.type === 'string' &&
    'payload' in value
  );
};

const isDevHostFlowSource = (value: unknown): value is DevHostFlowSource => {
  return (
    typeof value === 'object' &&
    value !== null &&
    (!('name' in value) || typeof value.name === 'string') &&
    (!('autoRun' in value) || typeof value.autoRun === 'boolean') &&
    'run' in value &&
    typeof value.run === 'function'
  );
};

const toDevHostPresetEntry = (value: unknown): DevHostPresetEntry | null => {
  if (!isDevHostPresetSource(value)) {
    return null;
  }

  const displayName = getEntryDisplayName(value.name, 'Untitled preset');

  return {
    name: displayName,
    displayName,
    type: value.type,
    payload: value.payload,
  };
};

const toDevHostFlowEntry = (value: unknown): DevHostFlowEntry | null => {
  if (!isDevHostFlowSource(value)) {
    return null;
  }

  const displayName = getEntryDisplayName(value.name, 'Untitled flow');

  return {
    name: displayName,
    displayName,
    autoRun: value.autoRun ?? false,
    run: value.run,
  };
};

export const getDevHostPresets = (): DevHostPresetEntry[] => {
  const presets = getDevHostConfig().presets;

  if (!Array.isArray(presets)) {
    return [];
  }

  return presets.flatMap((preset) => {
    const entry = toDevHostPresetEntry(preset);
    return entry ? [entry] : [];
  });
};

export const getDevHostFlows = (): DevHostFlowEntry[] => {
  const flows = getDevHostConfig().flows;

  if (!Array.isArray(flows)) {
    return [];
  }

  return flows.flatMap((flow) => {
    const entry = toDevHostFlowEntry(flow);
    return entry ? [entry] : [];
  });
};
