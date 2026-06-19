import type {
  PerformanceMark,
  PerformanceMeasure,
  PerformanceMetric,
  PerformanceReactNativeMark,
  PerformanceResourceTiming,
} from 'react-native-performance';
import type {
  SerializedPerformanceMark,
  SerializedPerformanceMeasure,
  SerializedPerformanceMetric,
  SerializedPerformanceReactNativeMark,
  SerializedPerformanceResource,
} from '../shared/types';
import { toDateTimestamp } from './helpers';

export const serializeMark = (
  entry: PerformanceMark,
  origin: number,
): SerializedPerformanceMark => ({
  name: entry.name,
  startTime: toDateTimestamp(origin, entry.startTime),
  duration: entry.duration,
  entryType: 'mark',
  detail: entry.detail,
});

export const serializeMeasure = (
  entry: PerformanceMeasure,
  origin: number,
): SerializedPerformanceMeasure => ({
  name: entry.name,
  startTime: toDateTimestamp(origin, entry.startTime),
  duration: entry.duration,
  entryType: 'measure',
  detail: entry.detail,
});

export const serializeMetric = (
  entry: PerformanceMetric,
  origin: number,
): SerializedPerformanceMetric => ({
  name: entry.name,
  startTime: toDateTimestamp(origin, entry.startTime),
  duration: entry.duration,
  entryType: 'metric',
  value: entry.value,
  detail: entry.detail,
});

export const serializeReactNativeMark = (
  entry: PerformanceReactNativeMark,
  origin: number,
): SerializedPerformanceReactNativeMark => ({
  name: entry.name,
  startTime: toDateTimestamp(origin, entry.startTime),
  duration: entry.duration,
  entryType: 'react-native-mark',
  detail: entry.detail,
});

// Only the shared `startTime` is translated via toDateTimestamp.
// The sub-phase timing fields (fetchStart, requestStart, ...) stay as
// raw `performance.now()` values: they are computed relative to one
// another and the UI does not clock-shift them today; translating them
// here would silently break the timing math.
export const serializeResource = (
  entry: PerformanceResourceTiming,
  origin: number,
): SerializedPerformanceResource => ({
  name: entry.name,
  startTime: toDateTimestamp(origin, entry.startTime),
  duration: entry.duration,
  entryType: 'resource',
  initiatorType: entry.initiatorType,
  transferSize: entry.transferSize,
  encodedBodySize: entry.encodedBodySize,
  decodedBodySize: entry.decodedBodySize,
  fetchStart: entry.fetchStart,
  requestStart: entry.requestStart,
  responseStart: entry.responseStart,
  responseEnd: entry.responseEnd,
  connectStart: entry.connectStart,
  connectEnd: entry.connectEnd,
  domainLookupStart: entry.domainLookupStart,
  domainLookupEnd: entry.domainLookupEnd,
  redirectStart: entry.redirectStart,
  redirectEnd: entry.redirectEnd,
  secureConnectionStart: entry.secureConnectionStart,
  workerStart: entry.workerStart,
  serverTiming: entry.serverTiming,
  workerTiming: entry.workerTiming,
});
