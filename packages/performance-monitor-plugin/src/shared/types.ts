import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';

export type SharedPerformanceEntryProperties = {
  name: string;
  startTime: number;
  duration: number;
};

export type SerializedPerformanceMeasure = SharedPerformanceEntryProperties & {
  entryType: 'measure';
  detail?: unknown;
};

export type SerializedPerformanceMark = SharedPerformanceEntryProperties & {
  entryType: 'mark';
  detail?: unknown;
};

export type SerializedPerformanceMetric = SharedPerformanceEntryProperties & {
  entryType: 'metric';
  value: string | number;
  detail?: unknown;
};

export type SerializedPerformanceEntry =
  | SerializedPerformanceMeasure
  | SerializedPerformanceMark
  | SerializedPerformanceMetric;

export type PerformanceMonitorEventMap = {
  setEnabled: {
    enabled: boolean;
  };
  setSession: {
    sessionStartedAt: number;
    timeOrigin: number;
  };
  appendMeasures: {
    measures: SerializedPerformanceMeasure[];
  };
  appendMarks: {
    marks: SerializedPerformanceMark[];
  };
  setMetrics: {
    metrics: SerializedPerformanceMetric[];
  };
};

export type PerformanceMonitorDevToolsClient =
  RozeniteDevToolsClient<PerformanceMonitorEventMap>;
