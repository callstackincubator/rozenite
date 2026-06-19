import { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/types';
import performance, {
  setResourceLoggingEnabled,
} from 'react-native-performance';

const NETWORK_TEST_URL = 'https://jsonplaceholder.typicode.com/posts/1';

export const PerformanceMonitorScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  // Install the resource logger so any fetch from this screen produces
  // a PerformanceResourceTiming entry the panel can show in the
  // Resources tab.
  useEffect(() => {
    setResourceLoggingEnabled(true);
  }, []);

  const firePerformanceMetric = () => {
    // Create a custom performance metric
    const metric = performance.metric('custom-metric', {
      startTime: performance.now(),
      value: Math.random() * 100,
      detail: {
        unit: 'ms',
      },
    });

    Alert.alert(
      'Performance Metric Fired',
      `Metric "${metric.name}" with value ${metric.value}${
        metric.detail?.unit ? ` ${metric.detail.unit}` : ''
      } has been created.`,
    );
  };

  const firePerformanceMark = () => {
    const markName = `mark-${Date.now()}`;
    performance.mark(markName);

    Alert.alert(
      'Performance Mark Fired',
      `Mark "${markName}" has been created at ${new Date().toLocaleTimeString()}.`,
    );
  };

  const firePerformanceMeasure = () => {
    const startMark = `start-${Date.now()}`;
    const endMark = `end-${Date.now()}`;
    const measureName = `measure-${Date.now()}`;

    // Create start mark
    performance.mark(startMark);

    // Simulate some work
    setTimeout(() => {
      // Create end mark
      performance.mark(endMark);

      // Create measure between the two marks
      performance.measure(measureName, {
        start: startMark,
        end: endMark,
        detail: {
          lorem: 'ipsum',
          foo: 'bar',
          baz: [1, 2, 3],
        },
      });

      Alert.alert(
        'Performance Measure Fired',
        `Measure "${measureName}" has been created between "${startMark}" and "${endMark}".`,
      );
    }, 100);

    Alert.alert(
      'Performance Measure Started',
      `Started measure "${measureName}". End mark will be created in 100ms.`,
    );
  };

  const fireNetworkRequest = async () => {
    try {
      const response = await fetch(NETWORK_TEST_URL);
      await response.text();
      Alert.alert(
        'Network Request Completed',
        `GET ${NETWORK_TEST_URL} (${response.status}). A resource timing entry was logged.`,
      );
    } catch (error) {
      Alert.alert(
        'Network Request Failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  };

  const fireComplexPerformanceScenario = () => {
    const scenarioId = Date.now();
    const startMark = `scenario-start-${scenarioId}`;
    const processMark = `scenario-process-${scenarioId}`;
    const endMark = `scenario-end-${scenarioId}`;

    // Start the scenario
    performance.mark(startMark);

    // Kick off a network request in parallel so the scenario also
    // exercises the Resources tab. Errors are swallowed — the marks
    // and measures still complete regardless.
    void fetch(NETWORK_TEST_URL)
      .then((response) => response.text())
      .catch(() => undefined);

    // Simulate processing
    setTimeout(() => {
      performance.mark(processMark);

      // Create intermediate measure
      performance.measure(
        `processing-time-${scenarioId}`,
        startMark,
        processMark,
      );

      // Simulate more work
      setTimeout(() => {
        performance.mark(endMark);

        // Create final measure
        performance.measure(`total-time-${scenarioId}`, startMark, endMark);
        performance.measure(`final-phase-${scenarioId}`, processMark, endMark);

        Alert.alert(
          'Complex Performance Scenario',
          `Scenario ${scenarioId} completed with multiple marks, measures, and a network request.`,
        );
      }, 200);
    }, 150);

    Alert.alert(
      'Complex Scenario Started',
      `Performance scenario ${scenarioId} started. This will create multiple marks, measures, and a network request.`,
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Performance Monitor</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Use these buttons to generate performance data that will be captured
            by the Performance Monitor plugin.
          </Text>
          <Text style={styles.infoText}>
            Open the Performance Monitor DevTools to see the captured metrics,
            marks, and measures in real-time.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.metricButton]}
            onPress={firePerformanceMetric}
          >
            <Text style={styles.buttonText}>Fire Performance Metric</Text>
            <Text style={styles.buttonSubtext}>
              Creates a custom performance metric
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.markButton]}
            onPress={firePerformanceMark}
          >
            <Text style={styles.buttonText}>Fire Performance Mark</Text>
            <Text style={styles.buttonSubtext}>
              Creates a performance mark at current time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.measureButton]}
            onPress={firePerformanceMeasure}
          >
            <Text style={styles.buttonText}>Fire Performance Measure</Text>
            <Text style={styles.buttonSubtext}>
              Creates marks and measures between them
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.resourceButton]}
            onPress={fireNetworkRequest}
          >
            <Text style={styles.buttonText}>Fire Network Request</Text>
            <Text style={styles.buttonSubtext}>
              Performs a fetch that logs a resource timing entry
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.scenarioButton]}
            onPress={fireComplexPerformanceScenario}
          >
            <Text style={styles.buttonText}>Complex Performance Scenario</Text>
            <Text style={styles.buttonSubtext}>
              Marks, measures, and a network request together
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>How to use:</Text>
          <Text style={styles.instructionsText}>
            • Performance Metric: Creates a custom metric with a random value
          </Text>
          <Text style={styles.instructionsText}>
            • Performance Mark: Creates a timestamp marker
          </Text>
          <Text style={styles.instructionsText}>
            • Performance Measure: Creates two marks and measures the time
            between them
          </Text>
          <Text style={styles.instructionsText}>
            • Network Request: Performs a fetch which logs a resource timing
            entry on the Resources tab
          </Text>
          <Text style={styles.instructionsText}>
            • Complex Scenario: Marks, measures, and a network request together
          </Text>
          <Text style={styles.instructionsText}>
            • React Native Marks (nativeLaunchStart, runJSBundleStart, ...) are
            emitted by the native runtime during app startup. They appear
            automatically when you start a session — no button needed.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  infoContainer: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#8232FF',
  },
  infoText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  metricButton: {
    borderColor: '#34C759',
  },
  markButton: {
    borderColor: '#007AFF',
  },
  measureButton: {
    borderColor: '#FF9500',
  },
  resourceButton: {
    borderColor: '#00B4D8',
  },
  scenarioButton: {
    borderColor: '#8232FF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  buttonSubtext: {
    color: '#999',
    fontSize: 12,
  },
  instructionsContainer: {
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  instructionsText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
});
