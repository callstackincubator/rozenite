import performance, {
  PerformanceEntry,
  PerformanceMark,
} from 'react-native-performance';
import {
  SerializedPerformanceMark,
  SerializedPerformanceMeasure,
  SerializedPerformanceMetric,
} from '../shared/types';

export const getNativeMarkMap = (
  entries:
    | PerformanceEntry[]
    | SerializedPerformanceMark[] = performance.getEntriesByType(
    'react-native-mark'
  )
) => entries.reduce((acc, item) => acc.set(item.name, item), new Map());

// The bundle download trace can be very long but has no real impact on
// perf so we try to alter the marks to act as if it wasn't there
export const subtractDownloadDuration = (
  entries: PerformanceEntry[],
  entryMap = getNativeMarkMap()
): SerializedPerformanceMark[] =>
  entries.map((entry) => {
    const downloadEnd = entryMap.get('downloadEnd');
    const transformed = entry.toJSON ? entry.toJSON() : { ...entry };
    if (
      downloadEnd &&
      entry.name !== 'downloadStart' &&
      entry.name !== 'downloadEnd' &&
      entry.startTime <= downloadEnd.startTime
    ) {
      const downloadStart = entryMap.get('downloadStart');
      transformed.startTime += downloadEnd.startTime - downloadStart.startTime;
    }
    return transformed;
  });

export const calculateNativeMeasures = (
  newEntries: SerializedPerformanceMark[],
  entryMap = getNativeMarkMap()
): SerializedPerformanceMeasure[] =>
  newEntries
    .filter(
      (entry) =>
        entry.name.endsWith('End') &&
        entry.name !== 'nativeLaunchEnd' &&
        entry.name !== 'downloadEnd'
    )
    .map((end) => {
      const name = end.name.replace(/End$/, '');
      const { startTime } = entryMap.get(`${name}Start`);
      const duration = end.startTime - startTime;
      return {
        name,
        startTime,
        duration,
        category: 'Native',
      };
    });

export const calculateNativeMetrics = (
  newEntries: SerializedPerformanceMark[],
  entryMap = getNativeMarkMap()
): SerializedPerformanceMetric[] =>
  newEntries
    .filter((entry) => entry.name === 'nativeLaunchEnd')
    .map((end) => {
      const name = end.name.replace(/End$/, '');
      const { startTime } = entryMap.get(`${name}Start`);
      const value = end.startTime - startTime;
      return {
        name,
        startTime,
        value,
        unit: 'milliseconds',
      };
    });

export const calculateNativeMarks = (
  newEntries: SerializedPerformanceMark[]
): SerializedPerformanceMark[] =>
  newEntries
    .filter((entry) => !isMeasureMark(entry))
    .map((entry) => ({
      name: entry.name,
      startTime: entry.startTime,
    }));

export const isMeasureMark = (
  entry: PerformanceEntry | SerializedPerformanceMark
): entry is PerformanceMark =>
  entry.name.endsWith('End') || entry.name.endsWith('Start');

export const getResourceName = (url: string): string => {
  const [urlSansQuery] = url.split('?');
  return urlSansQuery.replace(/^https?:\/\//i, '');
};

export const toDateTimestamp = (origin: number, startTime: number): number =>
  origin - performance.timeOrigin + startTime;
