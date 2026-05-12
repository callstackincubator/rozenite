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

import {
  serializeMark,
  serializeMeasure,
  serializeMetric,
  serializeReactNativeMark,
  serializeResource,
} from '../serialize';
import type {
  PerformanceMark,
  PerformanceMeasure,
  PerformanceMetric,
  PerformanceReactNativeMark,
  PerformanceResourceTiming,
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

describe('serializeReactNativeMark', () => {
  it('copies name, duration, entryType, detail, and translates startTime', () => {
    const detail = { phase: 'native-launch' };
    const entry = {
      name: 'nativeLaunchStart',
      entryType: 'react-native-mark',
      startTime: 7,
      duration: 0,
      detail,
    } as PerformanceReactNativeMark;

    expect(serializeReactNativeMark(entry, ORIGIN)).toEqual({
      name: 'nativeLaunchStart',
      startTime: ORIGIN + 7,
      duration: 0,
      entryType: 'react-native-mark',
      detail,
    });
  });

  it('passes detail=undefined through unchanged', () => {
    const entry = {
      name: 'runJSBundleStart',
      entryType: 'react-native-mark',
      startTime: 100,
      duration: 0,
    } as PerformanceReactNativeMark;

    expect(serializeReactNativeMark(entry, ORIGIN).detail).toBeUndefined();
  });
});

describe('serializeResource', () => {
  // Build a fully-populated resource entry. The serializer is mostly a
  // mechanical field copy of ~20 fields; this fixture pins every one
  // down so a typo in any field name fails the test immediately.
  const buildEntry = (): PerformanceResourceTiming =>
    ({
      name: 'https://example.com/api/users',
      entryType: 'resource',
      startTime: 50,
      duration: 250,
      initiatorType: 'fetch',
      transferSize: 1024,
      encodedBodySize: 800,
      decodedBodySize: 1500,
      fetchStart: 55,
      requestStart: 60,
      responseStart: 200,
      responseEnd: 300,
      connectStart: 70,
      connectEnd: 90,
      domainLookupStart: 60,
      domainLookupEnd: 65,
      redirectStart: 50,
      redirectEnd: 55,
      secureConnectionStart: 80,
      workerStart: 0,
      serverTiming: [10, 20, 30],
      workerTiming: [1, 2],
    }) as PerformanceResourceTiming;

  it('copies every ResourceTiming field with startTime translated by origin', () => {
    expect(serializeResource(buildEntry(), ORIGIN)).toEqual({
      name: 'https://example.com/api/users',
      startTime: ORIGIN + 50,
      duration: 250,
      entryType: 'resource',
      initiatorType: 'fetch',
      transferSize: 1024,
      encodedBodySize: 800,
      decodedBodySize: 1500,
      fetchStart: 55,
      requestStart: 60,
      responseStart: 200,
      responseEnd: 300,
      connectStart: 70,
      connectEnd: 90,
      domainLookupStart: 60,
      domainLookupEnd: 65,
      redirectStart: 50,
      redirectEnd: 55,
      secureConnectionStart: 80,
      workerStart: 0,
      serverTiming: [10, 20, 30],
      workerTiming: [1, 2],
    });
  });

  it('does not clock-shift sub-phase timing fields', () => {
    // Only startTime is translated; the sub-phase fields are passed
    // through unchanged, since they are relative timings that the UI
    // does not shift.
    const result = serializeResource(buildEntry(), ORIGIN);
    expect(result.fetchStart).toBe(55);
    expect(result.responseEnd).toBe(300);
    expect(result.startTime).toBe(ORIGIN + 50);
  });

  it('passes optional initiatorType and secureConnectionStart through when undefined', () => {
    const entry = {
      ...buildEntry(),
      initiatorType: undefined,
      secureConnectionStart: undefined,
    } as PerformanceResourceTiming;

    const result = serializeResource(entry, ORIGIN);
    expect(result.initiatorType).toBeUndefined();
    expect(result.secureConnectionStart).toBeUndefined();
  });
});
