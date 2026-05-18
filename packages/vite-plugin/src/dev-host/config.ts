import rozeniteConfig from 'virtual:rozenite-dev-config';
import type { DevFlowEntry, DevTemplateEntry } from '../load-config.js';
import type { DevHostFlowEntry, DevHostTemplateEntry } from './types.js';

type DevHostTemplateSource = Omit<DevTemplateEntry, 'name'> & {
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

const isDevHostTemplateSource = (value: unknown): value is DevHostTemplateSource => {
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

const toDevHostTemplateEntry = (value: unknown): DevHostTemplateEntry | null => {
  if (!isDevHostTemplateSource(value)) {
    return null;
  }

  const displayName = getEntryDisplayName(value.name, 'Untitled template');

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

export const getDevHostTemplates = (): DevHostTemplateEntry[] => {
  const templates = rozeniteConfig.dev?.templates;

  if (!Array.isArray(templates)) {
    return [];
  }

  return templates.flatMap((template) => {
    const entry = toDevHostTemplateEntry(template);
    return entry ? [entry] : [];
  });
};

export const getDevHostFlows = (): DevHostFlowEntry[] => {
  const flows = rozeniteConfig.dev?.flows;

  if (!Array.isArray(flows)) {
    return [];
  }

  return flows.flatMap((flow) => {
    const entry = toDevHostFlowEntry(flow);
    return entry ? [entry] : [];
  });
};
