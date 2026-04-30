import {
  useRozeniteDevToolsClient,
  type Subscription,
} from '@rozenite/plugin-bridge';
import { useEffect, useState } from 'react';
import {
  Button,
  Chip,
  PluginHeader,
  PluginTheme,
  Tabs,
} from '@rozenite/ui';
import type {
  PerformanceMonitorEventMap,
  SerializedPerformanceEntry,
  SerializedPerformanceMark,
  SerializedPerformanceMeasure,
  SerializedPerformanceMetric,
} from '../shared/types';
import { DetailsSidebar } from './components/DetailsSidebar';
import { ExportModal } from './components/ExportModal';
import { MarksTable } from './components/MarksTable';
import { MeasuresTable } from './components/MeasuresTable';
import { MetricsTable } from './components/MetricsTable';
import { SessionDuration } from './components/SessionDuration';
import './globals.css';

type PerformanceMonitorSession = {
  sessionStartedAt: number;
  clockShift: number;
  measures: SerializedPerformanceMeasure[];
  marks: SerializedPerformanceMark[];
  metrics: SerializedPerformanceMetric[];
};

type ActiveTabId = 'measures' | 'metrics' | 'marks';

export default function PerformanceMonitorPanel() {
  const client = useRozeniteDevToolsClient<PerformanceMonitorEventMap>({
    pluginId: '@rozenite/performance-monitor-plugin',
  });
  const [activeTabId, setActiveTabId] = useState<ActiveTabId>('measures');
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
          clockShift: receivedAt - sessionStartedAt,
          measures: [],
          marks: [],
          metrics: [],
        });
        setSelectedItem(null);
        setIsSessionActive(true);
      }),
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
      }),
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
      }),
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
      }),
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

  return (
    <PluginTheme
      className="flex h-screen flex-col bg-background text-foreground"
      defaultTheme="dark"
      storageKey="@rozenite/performance-monitor-plugin.theme"
    >
      <PluginHeader
        subtitle="Track measures, marks, and metrics captured by react-native-performance."
        title="Performance Monitor"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SessionDuration
              isActive={isSessionActive}
              sessionStartedAt={session.sessionStartedAt}
            />
            <Chip
              color={isSessionActive ? 'success' : 'default'}
              size="sm"
              variant="soft"
            >
              {isSessionActive ? 'Session Active' : 'Session Inactive'}
            </Chip>
            <Button
              isDisabled={!client || isSessionActive}
              onPress={handleStartSession}
              size="sm"
            >
              Start Session
            </Button>
            <Button
              isDisabled={!client || !isSessionActive}
              onPress={handleStopSession}
              size="sm"
              variant="danger"
            >
              Stop Session
            </Button>
            <ExportModal
              clockShift={session.clockShift}
              marks={session.marks}
              measures={session.measures}
              metrics={session.metrics}
              sessionStartedAt={session.sessionStartedAt}
            />
          </div>
        }
      />

      <Tabs.Root
        className="flex min-h-0 flex-1 flex-col"
        selectedKey={activeTabId}
        onSelectionChange={(key) => {
          setActiveTabId(String(key) as ActiveTabId);
        }}
      >
        <Tabs.ListContainer className="overflow-x-auto px-3">
          <Tabs.List
            aria-label="Performance monitor views"
            className="w-fit min-w-max justify-start"
          >
            <Tabs.Tab className="w-auto shrink-0 whitespace-nowrap" id="measures">
              Measures ({session.measures.length})
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab className="w-auto shrink-0 whitespace-nowrap" id="metrics">
              Metrics ({session.metrics.length})
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab className="w-auto shrink-0 whitespace-nowrap" id="marks">
              Marks ({session.marks.length})
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-3"
          id="measures"
        >
          <MeasuresTable
            measures={session.measures}
            onRowClick={setSelectedItem}
          />
        </Tabs.Panel>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-3"
          id="metrics"
        >
          <MetricsTable metrics={session.metrics} onRowClick={setSelectedItem} />
        </Tabs.Panel>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-3"
          id="marks"
        >
          <MarksTable marks={session.marks} onRowClick={setSelectedItem} />
        </Tabs.Panel>
      </Tabs.Root>

      <DetailsSidebar
        onClose={() => setSelectedItem(null)}
        selectedItem={selectedItem}
      />
    </PluginTheme>
  );
}
