import performance, {
  EntryType,
  PerformanceEntry,
  PerformanceObserver,
} from 'react-native-performance';
import type {
  PerformanceMonitorDevToolsClient,
  SerializedPerformanceMark,
  SerializedPerformanceMeasure,
  SerializedPerformanceMetric,
} from '../shared/types';
import { toDateTimestamp } from './helpers';
import {
  assertPerformanceMark,
  assertPerformanceMeasure,
  assertPerformanceMetric,
} from './asserts';

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
        const marks = list.getEntries().map((entry) => {
          assertPerformanceMark(entry);

          return {
            name: entry.name,
            startTime: toDateTimestamp(origin, entry.startTime),
            duration: entry.duration,
            entryType: 'mark' as const,
          };
        });

        appendMarks(marks);
      },
      {
        type: 'mark',
        buffered: true,
      }
    );
    addObserver(
      (list) => {
        appendMeasures(
          list.getEntries().map((entry) => {
            assertPerformanceMeasure(entry);

            return {
              name: entry.name,
              startTime: toDateTimestamp(origin, entry.startTime),
              duration: entry.duration,
              entryType: 'measure' as const,
              detail: entry.detail,
            };
          })
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
          list.getEntries().map((entry) => {
            assertPerformanceMetric(entry);

            return {
              name: entry.name,
              startTime: toDateTimestamp(origin, entry.startTime),
              duration: entry.duration,
              entryType: 'metric' as const,
              value: entry.value,
              detail: entry.detail,
            };
          })
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
    performance.clearMarks();
    performance.clearMeasures();
    performance.clearMetrics();
    observers = [];
    isObserving = false;
    sessionStartedAt = 0;
    origin = 0;
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
