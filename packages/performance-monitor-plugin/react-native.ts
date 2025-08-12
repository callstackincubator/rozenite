export let usePerformanceMonitorDevTools: typeof import('./src/react-native/usePerformanceMonitorDevTools').usePerformanceMonitorDevTools;

if (process.env.NODE_ENV !== 'production') {
  usePerformanceMonitorDevTools =
    require('./src/react-native/usePerformanceMonitorDevTools').usePerformanceMonitorDevTools;
} else {
  usePerformanceMonitorDevTools = () => null;
}
