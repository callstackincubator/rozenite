import performance, {
  EntryType,
  PerformanceEntry,
  PerformanceMetric,
  PerformanceObserver,
} from 'react-native-performance';
import type {
  PerformanceMonitorDevToolsClient,
  SerializedPerformanceMark,
  SerializedPerformanceMeasure,
  SerializedPerformanceMetric,
} from '../shared/types';
import {
  subtractDownloadDuration,
  getNativeMarkMap,
  calculateNativeMeasures,
  calculateNativeMarks,
  calculateNativeMetrics,
  getResourceName,
  toDateTimestamp,
} from './helpers';

type PerformanceObserverOptions = { type: EntryType; buffered?: boolean };

type PerformanceObserverEntryList = {
  entries: PerformanceEntry[];
  getEntries(): PerformanceEntry[];
  getEntriesByType(type: EntryType): PerformanceEntry[];
  getEntriesByName(name: string, type?: EntryType): PerformanceEntry[];
};

type PerformanceObserverCallback = (
  list: PerformanceObserverEntryList,
  observer: PerformanceObserver
) => void;

export type PerformanceMonitor = {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  dispose: () => void;
};

export const getPerformanceMonitor = (
  client: PerformanceMonitorDevToolsClient
): PerformanceMonitor => {
  let observers: PerformanceObserver[] = [];
  let sessionStartedAt = 0;
  let origin = 0;
  let isObserving = false;

  const addObserver = (
    callback: PerformanceObserverCallback,
    options: PerformanceObserverOptions
  ) => {
    const observer = new PerformanceObserver(callback);
    observer.observe(options);
    observers.push(observer);
  };

  const enable = (): void => {
    isObserving = true;
    origin = Date.now();
    sessionStartedAt = toDateTimestamp(origin, performance.now());
    client.send('setSession', {
      sessionStartedAt,
      timeOrigin: performance.timeOrigin,
    });

    const appendMeasures = (measures: SerializedPerformanceMeasure[]) => {
      client.send('appendMeasures', {
        measures,
      });
    };

    const appendMarks = (marks: SerializedPerformanceMark[]) => {
      client.send('appendMarks', {
        marks,
      });
    };

    const setMetrics = (metrics: SerializedPerformanceMetric[]) => {
      client.send('setMetrics', {
        metrics,
      });
    };

    addObserver(
      (list) => {
        const entries = subtractDownloadDuration(list.getEntries());
        const entryMap = getNativeMarkMap(entries);
        const measures = calculateNativeMeasures(entries, entryMap);
        if (measures.length !== 0) {
          appendMeasures(measures);
        }
        const marks = calculateNativeMarks(entries);
        if (marks.length !== 0) {
          appendMarks(marks);
        }
        const metrics = calculateNativeMetrics(entries, entryMap);
        if (metrics.length !== 0) {
          setMetrics(metrics);
        }
      },
      {
        type: 'react-native-mark',
        buffered: true,
      }
    );
    addObserver(
      (list) => {
        appendMeasures(
          list.getEntries().map((entry) => ({
            name: getResourceName(entry.name),
            startTime: toDateTimestamp(origin, entry.startTime),
            duration: entry.duration,
            category: 'Network',
          }))
        );
      },
      {
        type: 'resource',
        buffered: true,
      }
    );
    addObserver(
      (list) => {
        appendMeasures(
          list.getEntries().map((entry) => ({
            name: entry.name,
            startTime: toDateTimestamp(origin, entry.startTime),
            duration: entry.duration,
            category: 'App',
          }))
        );
      },
      {
        type: 'measure',
        buffered: true,
      }
    );
    addObserver(
      (list) => {
        setMetrics(
          list.getEntries().map((entry) => ({
            name: entry.name,
            startTime: toDateTimestamp(origin, entry.startTime),
            value: (entry as PerformanceMetric).value,
            unit: entry.name === 'bundleSize' ? 'bytes' : undefined,
          }))
        );
      },
      {
        type: 'metric',
        buffered: true,
      }
    );
  };
  const disable = (): void => {
    observers.forEach((observer) => {
      observer.disconnect();
    });
    observers = [];
    isObserving = false;
    sessionStartedAt = 0;
  };
  const isEnabled = (): boolean => isObserving;
  const dispose = (): void => {
    disable();
  };

  return {
    enable,
    disable,
    isEnabled,
    dispose,
  };
};
