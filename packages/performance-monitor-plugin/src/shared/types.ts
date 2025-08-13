import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';

export interface SerializedPerformanceEntry {
  entryType: 'mark' | 'measure' | 'metric';
  name: string;
  startTime: number;
  duration: number;
}

export interface SerializedPerformanceMeasure
  extends SerializedPerformanceEntry {
  entryType: 'measure';
  detail?: unknown;
}

export interface SerializedPerformanceMark extends SerializedPerformanceEntry {
  entryType: 'mark';
  detail?: unknown;
}

export interface SerializedPerformanceMetric
  extends SerializedPerformanceEntry {
  entryType: 'metric';
  value: string | number;
  detail?: unknown;
}

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
