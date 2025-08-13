import performance from 'react-native-performance';

export const toDateTimestamp = (origin: number, startTime: number): number =>
  origin - performance.timeOrigin + startTime;
