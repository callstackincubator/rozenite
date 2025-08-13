import {
  useRozeniteDevToolsClient,
  Subscription,
} from '@rozenite/plugin-bridge';
import {
  PerformanceMonitorEventMap,
  SerializedPerformanceMeasure,
  SerializedPerformanceMark,
  SerializedPerformanceMetric,
  SerializedPerformanceEntry,
} from '../shared/types';
import { useEffect, useState } from 'react';
import {
  Theme,
  Tabs,
  Button,
  Heading,
  Text,
  Flex,
  Box,
} from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import './App.css';
import { MeasuresTable } from './components/MeasuresTable';
import { MetricsTable } from './components/MetricsTable';
import { MarksTable } from './components/MarksTable';
import { DetailsSidebar } from './components/DetailsSidebar';
import { SessionDuration } from './components/SessionDuration';
import { ExportModal } from './components/ExportModal';

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
  const [selectedItem, setSelectedItem] =
    useState<SerializedPerformanceEntry | null>(null);

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

  const handleEntryClick = (entry: SerializedPerformanceEntry) => {
    setSelectedItem(entry);
  };

  const handleCloseSidebar = () => {
    setSelectedItem(null);
  };

  return (
    <Theme appearance="dark" accentColor="blue" radius="medium">
      <Box
        p="4"
        height="100vh"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <Box mb="4" style={{ flexShrink: 0 }}>
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
        <Flex gap="3" align="center" mb="4" style={{ flexShrink: 0 }}>
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
          <ExportModal
            measures={session.measures}
            metrics={session.metrics}
            marks={session.marks}
            sessionStartedAt={session.sessionStartedAt}
            clockShift={session.clockShift}
          />
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
        <Box
          style={{
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <Tabs.Root
            defaultValue="measures"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <Tabs.List style={{ flexShrink: 0 }}>
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

            <Box
              style={{
                flexGrow: '1',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <Tabs.Content
                value="measures"
                style={{
                  display: 'contents',
                }}
              >
                <MeasuresTable
                  measures={session.measures}
                  onRowClick={handleEntryClick}
                />
              </Tabs.Content>

              <Tabs.Content
                value="metrics"
                style={{
                  display: 'contents',
                }}
              >
                <MetricsTable
                  metrics={session.metrics}
                  onRowClick={handleEntryClick}
                />
              </Tabs.Content>

              <Tabs.Content
                value="marks"
                style={{
                  display: 'contents',
                }}
              >
                <MarksTable
                  marks={session.marks}
                  onRowClick={handleEntryClick}
                />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Box>
      </Box>

      <DetailsSidebar
        selectedItem={selectedItem}
        onClose={handleCloseSidebar}
      />
    </Theme>
  );
}
