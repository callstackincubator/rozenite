import fs from 'node:fs';
import type { InspectOptions } from 'node:util';
import { inspect } from 'node:util';
import { getAgentDaemonLogPath } from './daemon-paths.js';

export type DaemonLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type DaemonLogger = {
  debug: (message: string, fields?: Record<string, unknown>) => void;
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
  child: (fields: Record<string, unknown>) => DaemonLogger;
  getLogPath: () => string;
};

const INSPECT_OPTIONS: InspectOptions = {
  breakLength: Infinity,
  depth: 6,
  maxArrayLength: 20,
};

const serializeValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeValue(entry)]),
    );
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  return value;
};

const formatLine = (entry: Record<string, unknown>): string => {
  try {
    return `${JSON.stringify(entry)}\n`;
  } catch {
    return `${inspect(entry, INSPECT_OPTIONS)}\n`;
  }
};

const writeLine = (logPath: string, line: string): void => {
  try {
    fs.appendFileSync(logPath, line, 'utf8');
  } catch {
    // Logging must never crash daemon/client control flow.
  }
};

const serializeFields = (fields: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, serializeValue(value)]),
  );
};

const createWriter = (
  logPath: string,
  baseFields: Record<string, unknown>,
): DaemonLogger => {
  const write = (level: DaemonLogLevel, message: string, fields?: Record<string, unknown>) => {
    writeLine(logPath, formatLine({
      ts: new Date().toISOString(),
      pid: process.pid,
      level,
      message,
      ...serializeFields(baseFields),
      ...(fields ? serializeFields(fields) : {}),
    }));
  };

  return {
    debug: (message, fields) => {
      write('debug', message, fields);
    },
    info: (message, fields) => {
      write('info', message, fields);
    },
    warn: (message, fields) => {
      write('warn', message, fields);
    },
    error: (message, fields) => {
      write('error', message, fields);
    },
    child: (fields) => createWriter(logPath, { ...baseFields, ...fields }),
    getLogPath: () => logPath,
  };
};

export const createAgentDaemonLogger = (
  workspace: string,
  fields?: Record<string, unknown>,
): DaemonLogger => {
  const logPath = getAgentDaemonLogPath(workspace);
  return createWriter(logPath, {
    workspace,
    ...(fields || {}),
  });
};
