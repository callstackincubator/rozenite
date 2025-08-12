import type { RozeniteDevToolsClient } from '@rozenite/plugin-bridge';

export type SerializedPerformanceMeasure = {
  name: string;
  startTime: number;
  duration: number;
  category: string;
};

export type SerializedPerformanceMark = {
  name: string;
  startTime: number;
};

export type SerializedPerformanceMetric = {
  name: string;
  startTime: number;
  value: string | number;
  unit?: string;
};

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
