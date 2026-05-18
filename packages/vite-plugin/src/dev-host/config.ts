import rozeniteConfig from 'virtual:rozenite-dev-config';
import type { DevTemplateEntry } from '../load-config.js';
import type { DevHostTemplateEntry } from './types.js';

type DevHostTemplateSource = Omit<DevTemplateEntry, 'name'> & {
  name?: string;
};

const getTemplateDisplayName = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return 'Untitled template';
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

const toDevHostTemplateEntry = (value: unknown): DevHostTemplateEntry | null => {
  if (!isDevHostTemplateSource(value)) {
    return null;
  }

  const displayName = getTemplateDisplayName(value.name);

  return {
    name: displayName,
    displayName,
    type: value.type,
    payload: value.payload,
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
