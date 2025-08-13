import {
  useRozeniteDevToolsClient,
  Subscription,
} from '@rozenite/plugin-bridge';
import {
  PerformanceMonitorEventMap,
  SerializedPerformanceMeasure,
  SerializedPerformanceMark,
  SerializedPerformanceMetric,
} from '../shared/types';
import { useEffect, useState } from 'react';
import {
  Theme,
  Tabs,
  Button,
  Container,
  Heading,
  Text,
  Flex,
  Box,
  ScrollArea,
} from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import './App.css';
import { MeasuresTable } from './components/MeasuresTable';
import { MetricsTable } from './components/MetricsTable';
import { MarksTable } from './components/MarksTable';
import { DetailsSidebar } from './components/DetailsSidebar';
import { SessionDuration } from './components/SessionDuration';

type PerformanceMonitorSession = {
  sessionStartedAt: number;
  clockShift: number;
  measures: SerializedPerformanceMeasure[];
  marks: SerializedPerformanceMark[];
  metrics: SerializedPerformanceMetric[];
};

export default function PerformanceMonitorPanel() {
  const client = useRozeniteDevToolsClient<PerformanceMonitorEventMap>({
    pluginId: '@rozenite/performance-monitor-plugin',
  });
  const [session, setSession] = useState<PerformanceMonitorSession>({
    sessionStartedAt: 0,
    clockShift: 0,
    measures: [],
    marks: [],
    metrics: [],
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [selectedItem, setSelectedItem] = useState<
    | {
        type: 'measure';
        data: SerializedPerformanceMeasure;
      }
    | {
        type: 'metric';
        data: SerializedPerformanceMetric;
      }
    | {
        type: 'mark';
        data: SerializedPerformanceMark;
      }
    | null
  >(null);

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions: Subscription[] = [];

    subscriptions.push(
      client.onMessage('setSession', ({ sessionStartedAt }) => {
        const receivedAt = Date.now();
        setSession({
          sessionStartedAt: receivedAt,
          // It's likely that there is a small clock shift between the device and the DevTools.
          clockShift: receivedAt - sessionStartedAt,
          measures: [],
          marks: [],
          metrics: [],
        });
        setIsSessionActive(true);
      })
    );

    subscriptions.push(
      client.onMessage('appendMeasures', ({ measures }) => {
        setSession((oldSession) => ({
          ...oldSession,
          measures: [
            ...oldSession.measures,
            ...measures.map((measure) => ({
              ...measure,
              startTime: measure.startTime + oldSession.clockShift,
            })),
          ],
        }));
      })
    );

    subscriptions.push(
      client.onMessage('appendMarks', ({ marks }) => {
        setSession((oldSession) => ({
          ...oldSession,
          marks: [
            ...oldSession.marks,
            ...marks.map((mark) => ({
              ...mark,
              startTime: mark.startTime + oldSession.clockShift,
            })),
          ],
        }));
      })
    );

    subscriptions.push(
      client.onMessage('setMetrics', ({ metrics }) => {
        setSession((oldSession) => ({
          ...oldSession,
          metrics: [
            ...oldSession.metrics,
            ...metrics.map((metric) => ({
              ...metric,
              startTime: metric.startTime + oldSession.clockShift,
            })),
          ],
        }));
      })
    );

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      client.send('setEnabled', { enabled: false });
    };
  }, [client]);

  const handleStartSession = () => {
    if (client && !isSessionActive) {
      client.send('setEnabled', { enabled: true });
      setIsSessionActive(true);
    }
  };

  const handleStopSession = () => {
    if (client && isSessionActive) {
      client.send('setEnabled', { enabled: false });
      setIsSessionActive(false);
    }
  };

  const handleMeasureClick = (measure: SerializedPerformanceMeasure) => {
    setSelectedItem({ type: 'measure', data: measure });
  };

  const handleMetricClick = (metric: SerializedPerformanceMetric) => {
    setSelectedItem({ type: 'metric', data: metric });
  };

  const handleMarkClick = (mark: SerializedPerformanceMark) => {
    setSelectedItem({ type: 'mark', data: mark });
  };

  const handleCloseSidebar = () => {
    setSelectedItem(null);
  };

  return (
    <Theme appearance="dark" accentColor="blue" radius="medium">
      <ScrollArea style={{ height: '100vh' }}>
        <Container size="4" style={{ padding: '20px' }}>
          {/* Header */}
          <Box mb="4">
            <Heading size="6" mb="2">
              Performance Monitor
            </Heading>
            <Flex gap="4" align="center">
              <SessionDuration
                isActive={isSessionActive}
                sessionStartedAt={session.sessionStartedAt}
              />
            </Flex>
          </Box>

          {/* Toolbar */}
          <Flex gap="3" align="center" mb="4">
            <Button
              onClick={handleStartSession}
              disabled={isSessionActive}
              color="green"
            >
              Start Session
            </Button>
            <Button
              onClick={handleStopSession}
              disabled={!isSessionActive}
              color="red"
            >
              Stop Session
            </Button>
            <Flex gap="2" align="center" ml="auto">
              <Box
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isSessionActive ? '#10b981' : '#ef4444',
                }}
              />
              <Text size="2" color="gray">
                {isSessionActive ? 'Session Active' : 'Session Inactive'}
              </Text>
            </Flex>
          </Flex>

          {/* Tabs */}
          <Tabs.Root defaultValue="measures">
            <Tabs.List>
              <Tabs.Trigger value="measures">
                Measures ({session.measures.length})
              </Tabs.Trigger>
              <Tabs.Trigger value="metrics">
                Metrics ({session.metrics.length})
              </Tabs.Trigger>
              <Tabs.Trigger value="marks">
                Marks ({session.marks.length})
              </Tabs.Trigger>
            </Tabs.List>

            <Box pt="4">
              <Tabs.Content value="measures">
                <MeasuresTable
                  measures={session.measures}
                  onRowClick={handleMeasureClick}
                />
              </Tabs.Content>

              <Tabs.Content value="metrics">
                <MetricsTable
                  metrics={session.metrics}
                  onRowClick={handleMetricClick}
                />
              </Tabs.Content>

              <Tabs.Content value="marks">
                <MarksTable
                  marks={session.marks}
                  onRowClick={handleMarkClick}
                />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Container>
      </ScrollArea>

      <DetailsSidebar
        selectedItem={selectedItem}
        onClose={handleCloseSidebar}
      />
    </Theme>
  );
}
