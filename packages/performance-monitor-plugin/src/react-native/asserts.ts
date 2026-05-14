import type {
  PerformanceMark,
  PerformanceMeasure,
  PerformanceMetric,
  PerformanceReactNativeMark,
  PerformanceResourceTiming,
} from 'react-native-performance';

export function assertPerformanceMark(
  entry: PerformanceEntry,
): asserts entry is PerformanceMark {
  if (entry.entryType !== 'mark') {
    throw new Error('Entry is not a PerformanceMark');
  }
}

export function assertPerformanceMeasure(
  entry: PerformanceEntry,
): asserts entry is PerformanceMeasure {
  if (entry.entryType !== 'measure') {
    throw new Error('Entry is not a PerformanceMeasure');
  }
}

export function assertPerformanceMetric(
  entry: PerformanceEntry,
): asserts entry is PerformanceMetric {
  if (entry.entryType !== 'metric') {
    throw new Error('Entry is not a PerformanceMetric');
  }
}

export function assertPerformanceReactNativeMark(
  entry: PerformanceEntry,
): asserts entry is PerformanceReactNativeMark {
  if (entry.entryType !== 'react-native-mark') {
    throw new Error('Entry is not a PerformanceReactNativeMark');
  }
}

export function assertPerformanceResource(
  entry: PerformanceEntry,
): asserts entry is PerformanceResourceTiming {
  if (entry.entryType !== 'resource') {
    throw new Error('Entry is not a PerformanceResourceTiming');
  }
}
