import type { ConsoleMessageInput, ConsoleLogLevel } from './types.js';

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const previewRemoteObject = (value: unknown): string => {
  const record = getRecord(value);
  if (!record) {
    if (value === null || value === undefined) {
      return String(value);
    }

    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  const directValue = record.value;
  if (directValue !== undefined) {
    try {
      return typeof directValue === 'string' ? directValue : JSON.stringify(directValue);
    } catch {
      return String(directValue);
    }
  }

  const description = getString(record.description);
  if (description) {
    return description;
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
    const argsPreview = args.map((arg) => previewRemoteObject(arg));
    const text = argsPreview.join(' ').trim() || `[${type || 'log'}]`;

    return {
      timestamp: typeof params.timestamp === 'number' ? params.timestamp : Date.now(),
      level: mapLevelFromConsoleType(type),
      text,
      source: 'console',
      argsPreview,
      context: {
        ...(type ? { type } : {}),
      },
    };
  }

  if (method === 'Runtime.exceptionThrown' && params) {
    const details = getRecord(params.exceptionDetails);
    const text = getString(details?.text)
      || getString(getRecord(details?.exception)?.description)
      || 'Unhandled exception';

    return {
      timestamp: typeof params.timestamp === 'number' ? params.timestamp : Date.now(),
      level: 'error',
      text,
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
      text,
      source: 'log',
      context: {
        ...(getString(entry.source) ? { source: getString(entry.source) } : {}),
        ...(getString(entry.url) ? { url: getString(entry.url) } : {}),
      },
    };
  }

  return null;
};
