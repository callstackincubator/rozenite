import { describe, expect, it, vi } from 'vitest';
import { createTapEmitter, isDevToolsPluginMessage, matchesTapFilter } from '../agent/tap.js';

describe('agent tap', () => {
  describe('createTapEmitter', () => {
    it('does nothing when there are no subscribers', () => {
      const tap = createTapEmitter();

      expect(() =>
        tap.emit('in', { pluginId: '@acme/sqlite-plugin', type: 'query', payload: {} }),
      ).not.toThrow();
    });

    it('delivers a timestamped event to every subscriber', () => {
      const tap = createTapEmitter();
      const listenerA = vi.fn();
      const listenerB = vi.fn();
      tap.subscribe(listenerA);
      tap.subscribe(listenerB);

      const before = Date.now();
      tap.emit('in', {
        pluginId: '@acme/sqlite-plugin',
        type: 'list-tables-request',
        payload: { requestId: 'a1' },
      });
      const after = Date.now();

      expect(listenerA).toHaveBeenCalledTimes(1);
      expect(listenerB).toHaveBeenCalledTimes(1);

      const event = listenerA.mock.calls[0][0];
      expect(event).toMatchObject({
        direction: 'in',
        pluginId: '@acme/sqlite-plugin',
        type: 'list-tables-request',
        payload: { requestId: 'a1' },
      });
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
      expect(listenerB.mock.calls[0][0]).toEqual(event);
    });

    it('stops delivering to a listener after it unsubscribes', () => {
      const tap = createTapEmitter();
      const listener = vi.fn();
      const unsubscribe = tap.subscribe(listener);

      tap.emit('out', { pluginId: 'plugin', type: 'a', payload: null });
      unsubscribe();
      tap.emit('out', { pluginId: 'plugin', type: 'b', payload: null });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'a' }));
    });

    it('leaves other subscribers intact when one unsubscribes', () => {
      const tap = createTapEmitter();
      const listenerA = vi.fn();
      const listenerB = vi.fn();
      const unsubscribeA = tap.subscribe(listenerA);
      tap.subscribe(listenerB);

      unsubscribeA();
      tap.emit('in', { pluginId: 'plugin', type: 'a', payload: null });

      expect(listenerA).not.toHaveBeenCalled();
      expect(listenerB).toHaveBeenCalledTimes(1);
    });

    it('tolerates unsubscribing twice', () => {
      const tap = createTapEmitter();
      const unsubscribe = tap.subscribe(vi.fn());

      expect(() => {
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });
  });

  describe('isDevToolsPluginMessage', () => {
    it('accepts a well-formed plugin message', () => {
      expect(
        isDevToolsPluginMessage({ pluginId: '@acme/plugin', type: 'query', payload: { a: 1 } }),
      ).toBe(true);
    });

    it('accepts an explicit undefined payload, since the key is still present', () => {
      expect(isDevToolsPluginMessage({ pluginId: 'p', type: 't', payload: undefined })).toBe(true);
    });

    it.each([
      ['null', null],
      ['a string', 'not-an-object'],
      ['missing pluginId', { type: 't', payload: {} }],
      ['a non-string pluginId', { pluginId: 42, type: 't', payload: {} }],
      ['missing type', { pluginId: 'p', payload: {} }],
      ['a non-string type', { pluginId: 'p', type: 9, payload: {} }],
      ['missing payload entirely', { pluginId: 'p', type: 't' }],
    ])('rejects %s', (_label, value) => {
      expect(isDevToolsPluginMessage(value)).toBe(false);
    });
  });

  describe('matchesTapFilter', () => {
    const event = {
      direction: 'in' as const,
      timestamp: 1,
      pluginId: '@acme/sqlite-plugin',
      type: 'list-tables-request',
      payload: {},
    };

    it('matches everything when the filter is empty', () => {
      expect(matchesTapFilter(event, {})).toBe(true);
    });

    it('matches on pluginId alone', () => {
      expect(matchesTapFilter(event, { pluginId: '@acme/sqlite-plugin' })).toBe(true);
      expect(matchesTapFilter(event, { pluginId: '@other/plugin' })).toBe(false);
    });

    it('matches on type alone', () => {
      expect(matchesTapFilter(event, { type: 'list-tables-request' })).toBe(true);
      expect(matchesTapFilter(event, { type: 'list-tables-response' })).toBe(false);
    });

    it('requires both dimensions to match when both are given', () => {
      expect(
        matchesTapFilter(event, { pluginId: '@acme/sqlite-plugin', type: 'list-tables-request' }),
      ).toBe(true);
      expect(matchesTapFilter(event, { pluginId: '@acme/sqlite-plugin', type: 'wrong-type' })).toBe(
        false,
      );
      expect(
        matchesTapFilter(event, { pluginId: '@other/plugin', type: 'list-tables-request' }),
      ).toBe(false);
    });
  });
});
