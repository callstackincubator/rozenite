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
  SerializedPerformanceReactNativeMark,
  SerializedPerformanceResource,
} from '../shared/types';
import { toDateTimestamp } from './helpers';
import {
  assertPerformanceMark,
  assertPerformanceMeasure,
  assertPerformanceMetric,
  assertPerformanceReactNativeMark,
  assertPerformanceResource,
} from './asserts';
import {
  serializeMark,
  serializeMeasure,
  serializeMetric,
  serializeReactNativeMark,
  serializeResource,
} from './serialize';

type PerformanceObserverOptions = { type: EntryType; buffered?: boolean };

type PerformanceObserverEntryList = {
  entries: PerformanceEntry[];
  getEntries(): PerformanceEntry[];
  getEntriesByType(type: EntryType): PerformanceEntry[];
  getEntriesByName(name: string, type?: EntryType): PerformanceEntry[];
};

type PerformanceObserverCallback = (
  list: PerformanceObserverEntryList,
  observer: PerformanceObserver,
) => void;

export type PerformanceMonitor = {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  dispose: () => void;
};

export const getPerformanceMonitor = (
  client: PerformanceMonitorDevToolsClient,
): PerformanceMonitor => {
  let observers: PerformanceObserver[] = [];
  let sessionStartedAt = 0;
  let origin = 0;
  let isObserving = false;

  const addObserver = (
    callback: PerformanceObserverCallback,
    options: PerformanceObserverOptions,
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

    const appendReactNativeMarks = (
      reactNativeMarks: SerializedPerformanceReactNativeMark[],
    ) => {
      client.send('appendReactNativeMarks', {
        reactNativeMarks,
      });
    };

    const appendResources = (resources: SerializedPerformanceResource[]) => {
      client.send('appendResources', {
        resources,
      });
    };

    addObserver(
      (list) => {
        appendMarks(
          list.getEntries().map((entry) => {
            assertPerformanceMark(entry);
            return serializeMark(entry, origin);
          }),
        );
      },
      {
        type: 'mark',
        buffered: true,
      },
    );
    addObserver(
      (list) => {
        appendMeasures(
          list.getEntries().map((entry) => {
            assertPerformanceMeasure(entry);
            return serializeMeasure(entry, origin);
          }),
        );
      },
      {
        type: 'measure',
        buffered: true,
      },
    );
    addObserver(
      (list) => {
        setMetrics(
          list.getEntries().map((entry) => {
            assertPerformanceMetric(entry);
            return serializeMetric(entry, origin);
          }),
        );
      },
      {
        type: 'metric',
        buffered: true,
      },
    );
    // react-native-marks fire during native startup, before the user
    // clicks "Start Session" — buffered:true is load-bearing so the
    // PerformanceObserver flushes entries emitted before subscription.
    addObserver(
      (list) => {
        appendReactNativeMarks(
          list.getEntries().map((entry) => {
            assertPerformanceReactNativeMark(entry);
            return serializeReactNativeMark(entry, origin);
          }),
        );
      },
      {
        type: 'react-native-mark',
        buffered: true,
      },
    );
    addObserver(
      (list) => {
        appendResources(
          list.getEntries().map((entry) => {
            assertPerformanceResource(entry);
            return serializeResource(entry, origin);
          }),
        );
      },
      {
        type: 'resource',
        buffered: true,
      },
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
