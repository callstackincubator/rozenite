import { createRingBufferSource } from './ring-buffer-source.js';
import { paginateSource } from '../pagination/paginate.js';
import type {
  ConsoleLogEntry,
  ConsoleMessageInput,
  ConsoleMessagesResult,
  ConsoleLogFilters,
} from './types.js';

const DEFAULT_CONSOLE_BUFFER_CAPACITY = 5000;

type DeviceLogState = {
  entries: ConsoleLogEntry[];
  nextSeq: number;
  droppedCount: number;
};

const normalizeTimestamp = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Date.now();
  }

  if (numeric > 0 && numeric < 1_000_000_000_000) {
    return Math.round(numeric * 1000);
  }

  return Math.round(numeric);
};

const normalizeLevel = (value: unknown): ConsoleLogEntry['level'] => {
  if (value === 'error') {
    return 'error';
  }
  if (value === 'warning') {
    return 'warning';
  }
  if (value === 'verbose') {
    return 'verbose';
  }
  return 'info';
};

const normalizeSource = (value: unknown): ConsoleLogEntry['source'] => {
  if (value === 'exception') {
    return 'exception';
  }
  if (value === 'log') {
    return 'log';
  }
  return 'console';
};

const applyConsoleFilters = (
  items: readonly ConsoleLogEntry[],
  filters: ConsoleLogFilters,
): ConsoleLogEntry[] => {
  const hasLevels = Array.isArray(filters.levels) && filters.levels.length > 0;
  const levelSet = hasLevels ? new Set(filters.levels) : null;
  const text =
    typeof filters.text === 'string' ? filters.text.trim().toLowerCase() : '';
  const since =
    typeof filters.since === 'number' && Number.isFinite(filters.since)
      ? Math.round(filters.since)
      : undefined;

  return items.filter((item) => {
    if (levelSet && !levelSet.has(item.level)) {
      return false;
    }

    if (text && !item.text.toLowerCase().includes(text)) {
      return false;
    }

    if (since !== undefined && item.timestamp < since) {
      return false;
    }

    return true;
  });
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

export const createConsoleLogStore = (
  capacity = DEFAULT_CONSOLE_BUFFER_CAPACITY,
) => {
  const normalizedCapacity =
    Number.isFinite(capacity) && capacity > 0
      ? Math.round(capacity)
      : DEFAULT_CONSOLE_BUFFER_CAPACITY;

  const states = new Map<string, DeviceLogState>();

  const getOrCreateState = (deviceId: string): DeviceLogState => {
    const existing = states.get(deviceId);
    if (existing) {
      return existing;
    }

    const created: DeviceLogState = {
      entries: [],
      nextSeq: 1,
      droppedCount: 0,
    };
    states.set(deviceId, created);
    return created;
  };

  const registerDevice = (deviceId: string): void => {
    getOrCreateState(deviceId);
  };

  const unregisterDevice = (deviceId: string): void => {
    states.delete(deviceId);
  };

  const clear = (deviceId: string): { cleared: number } => {
    const state = getOrCreateState(deviceId);
    const cleared = state.entries.length;
    state.entries = [];
    return { cleared };
  };

  const append = (deviceId: string, input: ConsoleMessageInput): void => {
    const state = getOrCreateState(deviceId);
    const entry: ConsoleLogEntry = {
      seq: state.nextSeq,
      timestamp: normalizeTimestamp(input.timestamp),
      level: normalizeLevel(input.level),
      text: input.text,
      source: normalizeSource(input.source),
      ...(Array.isArray(input.argsPreview) && input.argsPreview.length > 0
        ? { argsPreview: input.argsPreview.slice(0, 20) }
        : {}),
      ...(input.context ? { context: input.context } : {}),
    };

    state.nextSeq += 1;
    state.entries.push(entry);

    const overflow = state.entries.length - normalizedCapacity;
    if (overflow > 0) {
      state.entries.splice(0, overflow);
      state.droppedCount += overflow;
    }
  };

  const getMessages = (
    deviceId: string,
    rawRequest: unknown,
  ): ConsoleMessagesResult => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const filters: ConsoleLogFilters = {
      ...(Array.isArray(request.levels)
        ? {
            levels: request.levels.filter(
              (level): level is ConsoleLogEntry['level'] =>
                level === 'verbose' ||
                level === 'info' ||
                level === 'warning' ||
                level === 'error',
            ),
          }
        : {}),
      ...(typeof request.text === 'string' ? { text: request.text } : {}),
      ...(typeof request.since === 'number' && Number.isFinite(request.since)
        ? { since: Math.round(request.since) }
        : {}),
    };

    const source = createRingBufferSource({
      items: state.entries,
      applyFilters: applyConsoleFilters,
    });

    const paged = paginateSource(source, {
      tool: 'getMessages',
      deviceId,
      request: {
        limit: request.limit,
        cursor: request.cursor,
        order: request.order,
        filters,
      },
    });

    return {
      ...paged,
      meta: {
        droppedCount: state.droppedCount,
        lastSeq: Math.max(0, state.nextSeq - 1),
        bufferSize: state.entries.length,
      },
    };
  };

  return {
    registerDevice,
    unregisterDevice,
    append,
    clear,
    getMessages,
  };
};
