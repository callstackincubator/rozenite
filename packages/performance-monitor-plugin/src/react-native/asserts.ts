import type {
  PerformanceMark,
  PerformanceMeasure,
  PerformanceMetric,
} from 'react-native-performance';

export function assertPerformanceMark(
  entry: PerformanceEntry
): asserts entry is PerformanceMark {
  if (entry.entryType !== 'mark') {
    throw new Error('Entry is not a PerformanceMark');
  }
}

export function assertPerformanceMeasure(
  entry: PerformanceEntry
): asserts entry is PerformanceMeasure {
  if (entry.entryType !== 'measure') {
    throw new Error('Entry is not a PerformanceMeasure');
  }
}

export function assertPerformanceMetric(
  entry: PerformanceEntry
): asserts entry is PerformanceMetric {
  if (entry.entryType !== 'metric') {
    throw new Error('Entry is not a PerformanceMetric');
  }
}
