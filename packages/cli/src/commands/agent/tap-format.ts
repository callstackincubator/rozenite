import type { TapEvent } from '@rozenite/agent-shared';

const ARROW_IN = '←';
const ARROW_OUT = '→';

/**
 * Width the `type` column is padded to in human-readable output, so the
 * payload starts at the same column on every line regardless of its
 * neighbors — the stream is unbounded, so alignment can't look ahead at
 * future lines the way a buffered table could.
 */
const TYPE_COLUMN_WIDTH = 28;

const pad2 = (value: number): string => String(value).padStart(2, '0');
const pad3 = (value: number): string => String(value).padStart(3, '0');

/** `HH:MM:SS.mmm` in local time, matching the issue's worked example. */
export const formatTapTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${pad3(date.getMilliseconds())}`;
};

/** Human-readable line: direction arrow, timestamp, type, payload. */
export const formatTapEventLine = (event: TapEvent): string => {
  const arrow = event.direction === 'in' ? ARROW_IN : ARROW_OUT;
  const time = formatTapTimestamp(event.timestamp);
  const type =
    event.type.length >= TYPE_COLUMN_WIDTH ? event.type : event.type.padEnd(TYPE_COLUMN_WIDTH);

  return `${arrow} ${time}  ${type}  ${JSON.stringify(event.payload)}`;
};

/** One compact JSON object per line — the documented `--json` shape. */
export const formatTapEventNdjson = (event: TapEvent): string => JSON.stringify(event);
