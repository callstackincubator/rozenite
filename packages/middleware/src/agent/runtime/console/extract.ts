import type { ConsoleMessageInput, ConsoleLogLevel } from './types.js';

/**
 * Hermes sends console arguments as CDP `RemoteObject`s and applies no length
 * limit of its own outside the property preview, so a single `console.log` of a
 * large string arrives whole — megabytes over the wire. Everything rendered here
 * is retained for the lifetime of the ring buffer, so each layer is capped.
 */
const MAX_VALUE_LENGTH = 1024;
const MAX_ARG_LENGTH = 2048;
const MAX_TEXT_LENGTH = 8192;
/** Hermes already caps previews at 10 properties; this only guards other runtimes. */
const MAX_PREVIEW_PROPERTIES = 10;

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const truncate = (value: string, max: number): string => {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max)}…(+${value.length - max} chars)`;
};

const stringifyValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

const renderPreviewProperty = (property: unknown, isArray: boolean): string => {
  const record = getRecord(property) || {};
  const raw = truncate(getString(record.value) ?? '', MAX_VALUE_LENGTH);
  // Quoting keeps a string value distinguishable from a bare identifier or number.
  const rendered = record.type === 'string' ? JSON.stringify(raw) : raw;

  return isArray ? rendered : `${getString(record.name) ?? '?'}: ${rendered}`;
};

/**
 * Renders a CDP `ObjectPreview` as a flat one-level literal. Returns null when
 * the preview carries nothing, which is how Hermes reports Map and Set (both
 * arrive as `className: "Object"` with no properties and no `entries`), so the
 * caller falls back to the description rather than claiming the value is empty.
 */
const renderPreview = (preview: Record<string, unknown>): string | null => {
  const properties = Array.isArray(preview.properties) ? preview.properties : [];
  if (properties.length === 0) {
    return null;
  }

  const isArray = preview.subtype === 'array';
  const rendered = properties
    .slice(0, MAX_PREVIEW_PROPERTIES)
    .map((property) => renderPreviewProperty(property, isArray));

  if (preview.overflow === true || properties.length > MAX_PREVIEW_PROPERTIES) {
    rendered.push('…');
  }

  return isArray ? `[${rendered.join(', ')}]` : `{${rendered.join(', ')}}`;
};

const previewRemoteObject = (value: unknown): string => {
  const record = getRecord(value);
  if (!record) {
    if (value === null || value === undefined) {
      return String(value);
    }

    return truncate(stringifyValue(value), MAX_ARG_LENGTH);
  }

  // Primitives arrive inlined; objects never do, they carry an objectId instead.
  if (record.value !== undefined) {
    return truncate(stringifyValue(record.value), MAX_ARG_LENGTH);
  }

  // NaN, Infinity, -0 and BigInt arrive as `unserializableValue` with no
  // `value`, but always alongside a description that renders them correctly.
  const description = getString(record.description);

  // An Error's preview repeats the entire stack in its `stack` property, so the
  // description alone is both cheaper and more readable.
  if (record.subtype === 'error' && description) {
    return truncate(description, MAX_ARG_LENGTH);
  }

  const preview = getRecord(record.preview);
  if (preview) {
    const rendered = renderPreview(preview);
    if (rendered) {
      return truncate(rendered, MAX_ARG_LENGTH);
    }
  }

  if (description) {
    return truncate(description, MAX_ARG_LENGTH);
  }

  const className = getString(record.className);
  const subtype = getString(record.subtype);
  return [className, subtype].filter(Boolean).join(':') || '[Object]';
};

const mapLevelFromConsoleType = (type: string | undefined): ConsoleLogLevel => {
  if (!type) {
    return 'info';
  }

  if (type === 'error' || type === 'assert') {
    return 'error';
  }

  if (type === 'warning' || type === 'warn') {
    return 'warning';
  }

  if (type === 'debug' || type === 'trace') {
    return 'verbose';
  }

  return 'info';
};

export const extractConsoleMessage = (message: unknown): ConsoleMessageInput | null => {
  const record = getRecord(message);
  if (!record) {
    return null;
  }

  const method = getString(record.method);
  const params = getRecord(record.params);

  if (method === 'Runtime.consoleAPICalled' && params) {
    const type = getString(params.type);
    const args = Array.isArray(params.args) ? params.args : [];
    const rendered = args
      .map((arg) => previewRemoteObject(arg))
      .join(' ')
      .trim();
    const text = truncate(rendered, MAX_TEXT_LENGTH) || `[${type || 'log'}]`;

    return {
      timestamp: typeof params.timestamp === 'number' ? params.timestamp : Date.now(),
      level: mapLevelFromConsoleType(type),
      text,
      source: 'console',
      context: {
        ...(type ? { type } : {}),
      },
    };
  }

  if (method === 'Runtime.exceptionThrown' && params) {
    const details = getRecord(params.exceptionDetails);
    const text =
      getString(details?.text) ||
      getString(getRecord(details?.exception)?.description) ||
      'Unhandled exception';

    return {
      timestamp: typeof params.timestamp === 'number' ? params.timestamp : Date.now(),
      level: 'error',
      text: truncate(text, MAX_TEXT_LENGTH),
      source: 'exception',
    };
  }

  if (method === 'Log.entryAdded' && params) {
    const entry = getRecord(params.entry);
    if (!entry) {
      return null;
    }

    const text = getString(entry.text) || 'Log.entryAdded';
    const level = mapLevelFromConsoleType(getString(entry.level));

    return {
      timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
      level,
      text: truncate(text, MAX_TEXT_LENGTH),
      source: 'log',
      context: {
        ...(getString(entry.source) ? { source: getString(entry.source) } : {}),
        ...(getString(entry.url) ? { url: getString(entry.url) } : {}),
      },
    };
  }

  return null;
};
