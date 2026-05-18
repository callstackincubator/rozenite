import rozeniteConfig from 'virtual:rozenite-dev-config';
import type { DevHostTemplateEntry } from './types.js';

const isDevHostTemplateEntry = (value: unknown): value is DevHostTemplateEntry => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'label' in value &&
    typeof value.label === 'string' &&
    'type' in value &&
    typeof value.type === 'string' &&
    'payload' in value
  );
};

export const getDevHostTemplates = (): DevHostTemplateEntry[] => {
  const templates = rozeniteConfig.dev?.templates;

  if (!Array.isArray(templates)) {
    return [];
  }

  return templates.filter(isDevHostTemplateEntry);
};
