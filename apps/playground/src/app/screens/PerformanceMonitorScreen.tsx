import { useEffect } from 'react';
import { Button, Card, PluginHeader, Screen } from '../components/ui';
import performance, { setResourceLoggingEnabled } from 'react-native-performance';

const NETWORK_TEST_URL = 'https://jsonplaceholder.typicode.com/posts/1';

export const PerformanceMonitorScreen = () => {
  // Install the resource logger so any fetch from this screen produces a
  // PerformanceResourceTiming entry the Resources tab can show.
  useEffect(() => {
    setResourceLoggingEnabled(true);
  }, []);

  const firePerformanceMetric = () => {
    performance.metric('custom-metric', {
      startTime: performance.now(),
      value: Math.random() * 100,
      detail: { unit: 'ms' },
    });
  };

  const firePerformanceMark = () => {
    performance.mark(`mark-${Date.now()}`);
  };

  const firePerformanceMeasure = () => {
    const startMark = `start-${Date.now()}`;
    const endMark = `end-${Date.now()}`;
    performance.mark(startMark);

    setTimeout(() => {
      performance.mark(endMark);
      performance.measure(`measure-${Date.now()}`, { start: startMark, end: endMark });
    }, 100);
  };

  const fireNetworkRequest = async () => {
    const response = await fetch(NETWORK_TEST_URL);
    await response.text();
  };

  return (
    <Screen>
      <PluginHeader
        title="Performance Monitor"
        subtitle="Fire marks, measures, metrics, and resource timings. Inspect them in DevTools."
      />

      <Card>
        <Button label="Fire performance metric" onPress={firePerformanceMetric} />
        <Button label="Fire performance mark" onPress={firePerformanceMark} />
        <Button label="Fire performance measure" onPress={firePerformanceMeasure} />
        <Button label="Fire network request" onPress={() => void fireNetworkRequest()} />
      </Card>
    </Screen>
  );
};
