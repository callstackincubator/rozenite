import { describe, expect, it } from 'vitest';
import type {
  SerializedPerformanceMeasure,
  SerializedPerformanceResource,
} from '../../shared/types';
import {
  buildWaterfallModel,
  formatTimelineTime,
  getResourcePhaseSegments,
  isSamePerformanceEntry,
} from '../waterfall';

const measure = (
  name: string,
  startTime: number,
  duration: number,
): SerializedPerformanceMeasure => ({
  name,
  startTime,
  duration,
  entryType: 'measure',
});

const resource = (
  overrides: Partial<SerializedPerformanceResource> = {},
): SerializedPerformanceResource => ({
  name: 'https://example.com/api/users',
  startTime: 1_000,
  duration: 300,
  entryType: 'resource',
  initiatorType: 'fetch',
  transferSize: 2048,
  encodedBodySize: 1024,
  decodedBodySize: 4096,
  fetchStart: 100,
  requestStart: 160,
  responseStart: 280,
  responseEnd: 400,
  connectStart: 130,
  connectEnd: 155,
  domainLookupStart: 110,
  domainLookupEnd: 125,
  redirectStart: 0,
  redirectEnd: 0,
  secureConnectionStart: 145,
  workerStart: 0,
  serverTiming: [],
  workerTiming: [],
  ...overrides,
});

describe('buildWaterfallModel', () => {
  it('sorts entries chronologically and computes offsets across the session', () => {
    const model = buildWaterfallModel([
      measure('later', 1_200, 300),
      measure('first', 1_000, 100),
    ]);

    expect(model.rows.map((row) => row.entry.name)).toEqual(['first', 'later']);
    expect(model.startTime).toBe(1_000);
    expect(model.duration).toBe(500);
    expect(model.rows[0].offsetPercent).toBe(0);
    expect(model.rows[1].offsetPercent).toBe(40);
    expect(model.rows[1].widthPercent).toBe(60);
  });

  it('keeps instant entries visible with a zero model duration fallback', () => {
    const model = buildWaterfallModel([measure('instant', 1_000, 0)]);

    expect(model.duration).toBe(1);
    expect(model.rows[0].duration).toBe(0);
    expect(model.rows[0].widthPercent).toBe(0);
  });

  it('compresses long idle gaps so short later events stay readable', () => {
    const model = buildWaterfallModel([
      measure('startup', 1_000, 500),
      measure('request', 61_000, 250),
    ]);

    expect(model.hasCompressedGaps).toBe(true);
    expect(model.gaps).toHaveLength(1);
    expect(model.gaps[0].duration).toBe(59_500);
    expect(model.rows[1].startOffset).toBe(60_000);
    expect(model.rows[1].visualStartOffset).toBeLessThan(
      model.rows[1].startOffset,
    );
    expect(model.rows[1].widthPercent).toBeGreaterThan(5);
  });

  it('formats ruler ticks as millisecond labels', () => {
    const model = buildWaterfallModel([measure('startup', 1_000, 2_000)]);

    expect(model.ticks.map((tick) => tick.label)).toEqual([
      '0 ms',
      '500 ms',
      '1,000 ms',
      '1,500 ms',
      '2,000 ms',
    ]);
  });

  it('uses normalized labels on the compressed timeline', () => {
    const model = buildWaterfallModel([
      measure('startup', 1_000, 500),
      measure('request', 61_000, 250),
    ]);

    const labels = model.ticks.map((tick) => tick.label);
    expect(labels.filter((label) => label === '0 ms')).toHaveLength(1);
    expect(labels).not.toContain('60,000 ms');
    expect(model.timelineDuration).toBeLessThan(model.duration);
  });
});

describe('formatTimelineTime', () => {
  it('keeps compact millisecond labels up to one second', () => {
    expect(formatTimelineTime(500)).toBe('500 ms');
    expect(formatTimelineTime(1000)).toBe('1,000 ms');
  });

  it('keeps larger values in milliseconds', () => {
    expect(formatTimelineTime(1500)).toBe('1,500 ms');
    expect(formatTimelineTime(90_000)).toBe('90,000 ms');
    expect(formatTimelineTime(774_990_543)).toBe('774,990,543 ms');
  });
});

describe('getResourcePhaseSegments', () => {
  it('projects resource phases relative to fetchStart', () => {
    const phases = getResourcePhaseSegments(resource());

    expect(phases.map((phase) => phase.label)).toEqual([
      'DNS',
      'Connect',
      'TLS',
      'Request / waiting',
      'Response',
    ]);
    const dns = phases.find((phase) => phase.label === 'DNS');
    expect(dns?.startPercent).toBeCloseTo(3.333, 3);
    expect(dns?.widthPercent).toBeCloseTo(5, 3);
  });

  it('uses inferred resource start so worker and redirect phases stay aligned', () => {
    const phases = getResourcePhaseSegments(
      resource({
        duration: 350,
        workerStart: 50,
        redirectStart: 70,
        redirectEnd: 90,
        fetchStart: 100,
        responseEnd: 400,
      }),
    );

    expect(phases.map((phase) => phase.label)).toEqual([
      'Worker',
      'Redirect',
      'DNS',
      'Connect',
      'TLS',
      'Request / waiting',
      'Response',
    ]);
    const worker = phases.find((phase) => phase.label === 'Worker');
    const redirect = phases.find((phase) => phase.label === 'Redirect');
    expect(worker?.startPercent).toBe(0);
    expect(worker?.widthPercent).toBeCloseTo(14.286, 3);
    expect(redirect?.startPercent).toBeCloseTo(5.714, 3);
    expect(redirect?.widthPercent).toBeCloseTo(5.714, 3);
  });
});

describe('isSamePerformanceEntry', () => {
  it('matches equivalent entries after derived entries are recreated', () => {
    expect(
      isSamePerformanceEntry(measure('nativeLaunch', 10, 20), {
        ...measure('nativeLaunch', 10, 20),
      }),
    ).toBe(true);
  });

  it('does not match different entry timing', () => {
    expect(
      isSamePerformanceEntry(
        measure('nativeLaunch', 10, 20),
        measure('nativeLaunch', 11, 20),
      ),
    ).toBe(false);
  });
});
