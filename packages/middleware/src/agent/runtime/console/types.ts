import type { PageOrder, PageRequest, PageResult } from '../pagination/types.js';

export type ConsoleLogLevel = 'verbose' | 'info' | 'warning' | 'error';

export interface ConsoleLogEntry {
  seq: number;
  timestamp: number;
  level: ConsoleLogLevel;
  text: string;
  source: 'console' | 'exception' | 'log';
  context?: Record<string, unknown>;
}

export interface ConsoleLogFilters {
  levels?: ConsoleLogLevel[];
  text?: string;
  since?: number;
  /** Exclusive upper bound, decoded from the `before` anchor cursor. */
  beforePosition?: number;
  /** Exclusive lower bound, decoded from the `after` anchor cursor. */
  afterPosition?: number;
}

/**
 * A returned entry carries an anchor cursor so any row can bound a later range,
 * which is what makes "the ten entries before this error" a single follow-up
 * call rather than a scan.
 */
export interface ConsoleLogRow extends ConsoleLogEntry {
  cursor: string;
}

export interface ConsoleMessagesRequest extends PageRequest {
  order?: PageOrder;
  levels?: ConsoleLogLevel[];
  text?: string;
  since?: number;
  /** Anchor cursor from a previous row; returns entries strictly older than it. */
  before?: string;
  /** Anchor cursor from a previous row; returns entries strictly newer than it. */
  after?: string;
}

export interface ConsoleMessagesMeta {
  droppedCount: number;
  lastSeq: number;
  bufferSize: number;
}

export type ConsoleMessagesResult = PageResult<ConsoleLogRow, ConsoleMessagesMeta>;

export interface ConsoleMessageInput {
  timestamp?: number;
  level?: ConsoleLogLevel;
  text: string;
  source?: 'console' | 'exception' | 'log';
  context?: Record<string, unknown>;
}
