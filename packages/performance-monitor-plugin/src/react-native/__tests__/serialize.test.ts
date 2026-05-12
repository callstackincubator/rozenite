import { describe, expect, it, vi } from 'vitest';

// react-native-performance imports the runtime `performance` object,
// which transitively pulls native bindings. Mock the whole module so
// the serializers (which only use `performance.timeOrigin` via
// `toDateTimestamp`) run in plain Node. With `timeOrigin: 0`, the
// formula `origin - timeOrigin + startTime` reduces to
// `origin + startTime`, which is trivial to assert.
vi.mock('react-native-performance', () => ({
  default: { timeOrigin: 0 },
}));

import { serializeMark, serializeMeasure, serializeMetric } from '../serialize';
import type {
  PerformanceMark,
  PerformanceMeasure,
  PerformanceMetric,
} from 'react-native-performance';

const ORIGIN = 1_700_000_000_000;

describe('serializeMark', () => {
  it('copies name, duration, entryType, and translates startTime by origin', () => {
    const entry = {
      name: 'render-start',
      entryType: 'mark',
      startTime: 100,
      duration: 0,
    } as PerformanceMark;

    expect(serializeMark(entry, ORIGIN)).toEqual({
      name: 'render-start',
      startTime: ORIGIN + 100,
      duration: 0,
      entryType: 'mark',
      detail: undefined,
    });
  });

  it('preserves detail (regression for the dropped-detail bug)', () => {
    const detail = { tag: 'homepage', phase: 'mount' };
    const entry = {
      name: 'render-start',
      entryType: 'mark',
      startTime: 42,
      duration: 0,
      detail,
    } as PerformanceMark;

    expect(serializeMark(entry, ORIGIN).detail).toBe(detail);
  });
});

describe('serializeMeasure', () => {
  it('copies name, duration, entryType, detail, and translates startTime', () => {
    const detail = { reason: 'cold-start' };
    const entry = {
      name: 'first-paint',
      entryType: 'measure',
      startTime: 50,
      duration: 250,
      detail,
    } as PerformanceMeasure;

    expect(serializeMeasure(entry, ORIGIN)).toEqual({
      name: 'first-paint',
      startTime: ORIGIN + 50,
      duration: 250,
      entryType: 'measure',
      detail,
    });
  });
});

describe('serializeMetric', () => {
  it('copies name, duration, entryType, value, detail, and translates startTime', () => {
    const detail = { source: 'native' };
    const entry = {
      name: 'memory-rss',
      entryType: 'metric',
      startTime: 10,
      duration: 0,
      value: 1024 * 1024 * 200,
      detail,
    } as PerformanceMetric;

    expect(serializeMetric(entry, ORIGIN)).toEqual({
      name: 'memory-rss',
      startTime: ORIGIN + 10,
      duration: 0,
      entryType: 'metric',
      value: 1024 * 1024 * 200,
      detail,
    });
  });

  it('preserves a string value (PerformanceMetric.value is string | number)', () => {
    const entry = {
      name: 'app-state',
      entryType: 'metric',
      startTime: 0,
      duration: 0,
      value: 'active',
      detail: undefined,
    } as PerformanceMetric;

    expect(serializeMetric(entry, ORIGIN).value).toBe('active');
  });
});
