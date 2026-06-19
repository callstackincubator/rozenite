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

export type SerializedPerformanceReactNativeMark =
  SharedPerformanceEntryProperties & {
    entryType: 'react-native-mark';
    detail?: unknown;
  };

// PerformanceResourceTiming carries ~14 timing-phase fields plus size
// fields. We serialize all of them so the DetailsSidebar can render
// everything; the table view picks a small subset.
export type SerializedPerformanceResource = SharedPerformanceEntryProperties & {
  entryType: 'resource';
  initiatorType?: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  fetchStart: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  connectStart: number;
  connectEnd: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  redirectStart: number;
  redirectEnd: number;
  secureConnectionStart?: number;
  workerStart: number;
  serverTiming: number[];
  workerTiming: number[];
};

export type SerializedPerformanceEntry =
  | SerializedPerformanceMeasure
  | SerializedPerformanceMark
  | SerializedPerformanceMetric
  | SerializedPerformanceReactNativeMark
  | SerializedPerformanceResource;

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
  appendReactNativeMarks: {
    reactNativeMarks: SerializedPerformanceReactNativeMark[];
  };
  appendResources: {
    resources: SerializedPerformanceResource[];
  };
};

export type PerformanceMonitorDevToolsClient =
  RozeniteDevToolsClient<PerformanceMonitorEventMap>;
