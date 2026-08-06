import type { PageOrder, PageRequest, PageResult } from '../pagination/types.js';

export type ConsoleLogLevel = 'verbose' | 'info' | 'warning' | 'error';

export interface ConsoleLogEntry {
  seq: number;
  timestamp: number;
  level: ConsoleLogLevel;
  text: string;
  source: 'console' | 'exception' | 'log';
  argsPreview?: string[];
  context?: Record<string, unknown>;
}

export interface ConsoleLogFilters {
  levels?: ConsoleLogLevel[];
  text?: string;
  since?: number;
}

export interface ConsoleMessagesRequest extends PageRequest, ConsoleLogFilters {
  order?: PageOrder;
}

export interface ConsoleMessagesMeta {
  droppedCount: number;
  lastSeq: number;
  bufferSize: number;
}

export type ConsoleMessagesResult = PageResult<ConsoleLogEntry, ConsoleMessagesMeta>;

export interface ConsoleMessageInput {
  timestamp?: number;
  level?: ConsoleLogLevel;
  text: string;
  source?: 'console' | 'exception' | 'log';
  argsPreview?: string[];
  context?: Record<string, unknown>;
}
