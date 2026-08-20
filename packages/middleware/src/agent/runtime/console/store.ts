import { CircularBuffer } from '../collections/circular-buffer.js';
import { createCircularBufferSource } from '../pagination/circular-buffer-source.js';
import { decodeCursor, encodeCursor } from '../pagination/cursor.js';
import { paginateSource } from '../pagination/paginate.js';
import type { PaginatedSource } from '../pagination/types.js';
import type {
  ConsoleLogEntry,
  ConsoleMessageInput,
  ConsoleMessagesResult,
  ConsoleLogFilters,
} from './types.js';

const DEFAULT_CONSOLE_BUFFER_CAPACITY = 5000;

/** `seq` is the buffer index shifted so the first entry reads as 1 rather than 0. */
const SEQ_OFFSET = 1;

type DeviceLogState = {
  buffer: CircularBuffer<ConsoleLogEntry>;
  source: PaginatedSource<number, ConsoleLogEntry, ConsoleLogFilters>;
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

const createConsoleFilterPredicate = (
  filters: ConsoleLogFilters,
): ((entry: ConsoleLogEntry) => boolean) => {
  const hasLevels = Array.isArray(filters.levels) && filters.levels.length > 0;
  const levelSet = hasLevels ? new Set(filters.levels) : null;
  const text = typeof filters.text === 'string' ? filters.text.trim().toLowerCase() : '';
  const since =
    typeof filters.since === 'number' && Number.isFinite(filters.since)
      ? Math.round(filters.since)
      : undefined;
  const { beforePosition, afterPosition } = filters;

  return (entry) => {
    if (levelSet && !levelSet.has(entry.level)) {
      return false;
    }

    if (text && !entry.text.toLowerCase().includes(text)) {
      return false;
    }

    if (since !== undefined && entry.timestamp < since) {
      return false;
    }

    const position = entry.seq - SEQ_OFFSET;
    if (beforePosition !== undefined && position >= beforePosition) {
      return false;
    }

    if (afterPosition !== undefined && position <= afterPosition) {
      return false;
    }

    return true;
  };
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

export const createConsoleLogStore = (capacity = DEFAULT_CONSOLE_BUFFER_CAPACITY) => {
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

    const buffer = new CircularBuffer<ConsoleLogEntry>(normalizedCapacity);
    const created: DeviceLogState = {
      buffer,
      source: createCircularBufferSource<ConsoleLogEntry, ConsoleLogFilters>({
        buffer,
        createPredicate: createConsoleFilterPredicate,
      }),
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
    const cleared = state.buffer.size;
    state.buffer.clear();
    return { cleared };
  };

  const append = (deviceId: string, input: ConsoleMessageInput): void => {
    const state = getOrCreateState(deviceId);
    const entry: ConsoleLogEntry = {
      seq: state.buffer.next + SEQ_OFFSET,
      timestamp: normalizeTimestamp(input.timestamp),
      level: normalizeLevel(input.level),
      text: input.text,
      source: normalizeSource(input.source),
      ...(input.context ? { context: input.context } : {}),
    };

    const evictedBefore = state.buffer.first;
    state.buffer.append(entry);
    state.droppedCount += state.buffer.first - evictedBefore;
  };

  const readAnchor = (value: unknown, field: string): number | undefined => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return undefined;
    }

    return decodeCursor(value, field);
  };

  const getMessages = (deviceId: string, rawRequest: unknown): ConsoleMessagesResult => {
    const request = getRecord(rawRequest) || {};
    const state = getOrCreateState(deviceId);
    const beforePosition = readAnchor(request.before, 'before');
    const afterPosition = readAnchor(request.after, 'after');
    const filters: ConsoleLogFilters = {
      ...(Array.isArray(request.levels)
        ? {
            levels: request.levels.filter(
              (level): level is ConsoleLogEntry['level'] =>
                level === 'verbose' || level === 'info' || level === 'warning' || level === 'error',
            ),
          }
        : {}),
      ...(typeof request.text === 'string' ? { text: request.text } : {}),
      ...(typeof request.since === 'number' && Number.isFinite(request.since)
        ? { since: Math.round(request.since) }
        : {}),
      ...(beforePosition !== undefined ? { beforePosition } : {}),
      ...(afterPosition !== undefined ? { afterPosition } : {}),
    };

    const order = request.order === 'asc' ? 'asc' : 'desc';
    // Checkpoints are exclusive, so the bound the walk heads away from doubles
    // as the starting position: seek straight to it instead of scanning in from
    // the edge of the buffer.
    const seedCheckpoint = order === 'desc' ? beforePosition : afterPosition;

    const paged = paginateSource(state.source, {
      request: {
        limit: request.limit,
        cursor: request.cursor,
        order: request.order,
        filters,
        ...(seedCheckpoint !== undefined ? { seedCheckpoint } : {}),
      },
    });

    return {
      ...paged,
      items: paged.items.map((entry) => ({
        ...entry,
        // Identical in shape and meaning to the cursor `next` hands back, so an
        // item's cursor can resume a listing just as a page cursor can bound one.
        cursor: encodeCursor(entry.seq - SEQ_OFFSET),
      })),
      meta: {
        droppedCount: state.droppedCount,
        lastSeq: state.buffer.next,
        bufferSize: state.buffer.size,
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
