import type {
  PerformanceMark,
  PerformanceMeasure,
  PerformanceMetric,
} from 'react-native-performance';
import type {
  SerializedPerformanceMark,
  SerializedPerformanceMeasure,
  SerializedPerformanceMetric,
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
