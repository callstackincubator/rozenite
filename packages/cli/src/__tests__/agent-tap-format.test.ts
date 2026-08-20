import { describe, expect, it } from 'vitest';
import {
  formatTapEventLine,
  formatTapEventNdjson,
  formatTapTimestamp,
} from '../commands/agent/tap-format.js';

describe('tap output formatting', () => {
  describe('formatTapTimestamp', () => {
    it('renders local HH:MM:SS.mmm, zero-padded', () => {
      const date = new Date(2024, 0, 1, 9, 4, 5, 7);
      expect(formatTapTimestamp(date.getTime())).toBe('09:04:05.007');
    });

    it('pads a three-digit millisecond value without truncating it', () => {
      const date = new Date(2024, 0, 1, 12, 4, 31, 220);
      expect(formatTapTimestamp(date.getTime())).toBe('12:04:31.220');
    });
  });

  describe('formatTapEventLine', () => {
    it('renders an inbound message with a left arrow', () => {
      const line = formatTapEventLine({
        direction: 'in',
        timestamp: new Date(2024, 0, 1, 12, 4, 31, 220).getTime(),
        pluginId: '@acme/sqlite-plugin',
        type: 'list-tables-request',
        payload: { requestId: 'a1' },
      });

      expect(line.startsWith('← 12:04:31.220')).toBe(true);
      expect(line).toContain('list-tables-request');
      expect(line.endsWith('{"requestId":"a1"}')).toBe(true);
    });

    it('renders an outbound message with a right arrow', () => {
      const line = formatTapEventLine({
        direction: 'out',
        timestamp: new Date(2024, 0, 1, 12, 4, 31, 244).getTime(),
        pluginId: '@acme/sqlite-plugin',
        type: 'list-tables-response',
        payload: { requestId: 'a1', tables: ['users', 'posts'] },
      });

      expect(line.startsWith('→ 12:04:31.244')).toBe(true);
    });

    it('starts the payload at the same column for a short and a long type', () => {
      const short = formatTapEventLine({
        direction: 'in',
        timestamp: 0,
        pluginId: 'p',
        type: 'a',
        payload: 1,
      });
      const long = formatTapEventLine({
        direction: 'in',
        timestamp: 0,
        pluginId: 'p',
        type: 'b',
        payload: 2,
      });

      expect(short.indexOf('1')).toBe(long.indexOf('2'));
    });

    it('does not truncate a type longer than the padded column width', () => {
      const longType = 'a-very-long-message-type-name-that-exceeds-the-column';
      const line = formatTapEventLine({
        direction: 'in',
        timestamp: 0,
        pluginId: 'p',
        type: longType,
        payload: null,
      });

      expect(line).toContain(longType);
      expect(line.endsWith('null')).toBe(true);
    });
  });

  describe('formatTapEventNdjson', () => {
    it('serializes the full event as compact JSON', () => {
      const event = {
        direction: 'out' as const,
        timestamp: 1700000000000,
        pluginId: '@acme/sqlite-plugin',
        type: 'query',
        payload: { sql: 'select 1' },
      };

      expect(formatTapEventNdjson(event)).toBe(JSON.stringify(event));
      expect(formatTapEventNdjson(event)).not.toContain('\n');
    });
  });
});
