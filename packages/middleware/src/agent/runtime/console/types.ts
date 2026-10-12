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
  /** Exclusive upper bound, decoded from the `before` anchor (a seq). */
  beforePosition?: number;
  /** Exclusive lower bound, decoded from the `after` anchor (a seq). */
  afterPosition?: number;
}

/**
 * A returned entry carries an anchor cursor so any row can bound a later range,
 * which is what makes "the ten entries before this error" a single follow-up
 * call rather than a scan. The cursor is the row's `seq` as a string, so the
 * `seq` column alone is enough to resume or anchor.
 */
export interface ConsoleLogRow extends ConsoleLogEntry {
  cursor: string;
}

export interface ConsoleMessagesRequest extends Omit<PageRequest, 'cursor'> {
  /** A `seq` (number or numeric string) or a cursor from a previous page. */
  cursor?: string | number;
  order?: PageOrder;
  levels?: ConsoleLogLevel[];
  text?: string;
  since?: number;
  /** A row's `seq` (or cursor); returns entries strictly older than it. */
  before?: string | number;
  /** A row's `seq` (or cursor); returns entries strictly newer than it. */
  after?: string | number;
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
