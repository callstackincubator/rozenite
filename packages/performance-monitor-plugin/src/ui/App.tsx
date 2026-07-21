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
  SerializedPerformanceReactNativeMark,
  SerializedPerformanceResource,
} from '../shared/types';
import { DetailsSidebar } from './components/DetailsSidebar';
import { ExportModal } from './components/ExportModal';
import { MarksTable } from './components/MarksTable';
import { MeasuresTable } from './components/MeasuresTable';
import { MetricsTable } from './components/MetricsTable';
import { ReactNativeMarksTable } from './components/ReactNativeMarksTable';
import { ResourcesTable } from './components/ResourcesTable';
import { WaterfallView } from './components/WaterfallView';
import { SessionDuration } from './components/SessionDuration';
import { deriveStartupPhases } from './derive-startup-phases';
import { StartupTab } from './components/StartupTab';
import './globals.css';

type PerformanceMonitorSession = {
  sessionStartedAt: number;
  clockShift: number;
  measures: SerializedPerformanceMeasure[];
  marks: SerializedPerformanceMark[];
  metrics: SerializedPerformanceMetric[];
  reactNativeMarks: SerializedPerformanceReactNativeMark[];
  resources: SerializedPerformanceResource[];
};

type ActiveTabId =
  | 'waterfall'
  | 'startup'
  | 'measures'
  | 'metrics'
  | 'marks'
  | 'reactNativeMarks'
  | 'resources';

export default function PerformanceMonitorPanel() {
  const client = useRozeniteDevToolsClient<PerformanceMonitorEventMap>({
    pluginId: '@rozenite/performance-monitor-plugin',
  });
  const [activeTabId, setActiveTabId] = useState<ActiveTabId>('waterfall');
  const [session, setSession] = useState<PerformanceMonitorSession>({
    sessionStartedAt: 0,
    clockShift: 0,
    measures: [],
    marks: [],
    metrics: [],
    reactNativeMarks: [],
    resources: [],
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<SerializedPerformanceEntry | null>(null);
  const [selectedWaterfallRowId, setSelectedWaterfallRowId] = useState<
    string | null
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
          clockShift: receivedAt - sessionStartedAt,
          measures: [],
          marks: [],
          metrics: [],
          reactNativeMarks: [],
          resources: [],
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

    subscriptions.push(
      client.onMessage('appendReactNativeMarks', ({ reactNativeMarks }) => {
        setSession((oldSession) => ({
          ...oldSession,
          reactNativeMarks: [
            ...oldSession.reactNativeMarks,
            ...reactNativeMarks.map((mark) => ({
              ...mark,
              startTime: mark.startTime + oldSession.clockShift,
            })),
          ],
        }));
      }),
    );

    subscriptions.push(
      client.onMessage('appendResources', ({ resources }) => {
        setSession((oldSession) => ({
          ...oldSession,
          resources: [
            ...oldSession.resources,
            ...resources.map((resource) => ({
              ...resource,
              startTime: resource.startTime + oldSession.clockShift,
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

  const handleEntryClick = (
    entry: SerializedPerformanceEntry,
    waterfallRowId?: string,
  ) => {
    setSelectedItem(entry);
    setSelectedWaterfallRowId(waterfallRowId ?? null);
  };

  const handleCloseSidebar = () => {
    setSelectedItem(null);
    setSelectedWaterfallRowId(null);
  };

  // Derived measures live only in the UI: paired Start/End RN marks
  // are shown alongside user-created measures so the Measures tab
  // reflects startup phases without forcing manual subtraction. The
  // export still emits raw session data (see ExportModal below).
  const startupPhases = deriveStartupPhases(session.reactNativeMarks);
  const allMeasures = [...startupPhases, ...session.measures];
  const waterfallEntries: SerializedPerformanceEntry[] = [
    ...allMeasures,
    ...session.metrics,
    ...session.marks,
    ...session.reactNativeMarks,
    ...session.resources,
  ];

  return (
    <PluginTheme
      className="flex h-screen flex-col bg-background text-foreground"
      defaultTheme="dark"
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
              reactNativeMarks={session.reactNativeMarks}
              resources={session.resources}
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
        <Tabs.ListContainer className="overflow-x-auto px-4 pt-3">
          <Tabs.List
            aria-label="Performance monitor views"
            className="w-fit min-w-max justify-start"
          >
            <Tabs.Tab className="w-auto shrink-0 whitespace-nowrap" id="waterfall">
              Waterfall ({waterfallEntries.length})
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab className="w-auto shrink-0 whitespace-nowrap" id="startup">
              Startup
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab className="w-auto shrink-0 whitespace-nowrap" id="measures">
              Measures ({allMeasures.length})
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
            <Tabs.Tab className="w-auto shrink-0 whitespace-nowrap" id="reactNativeMarks">
              React Native Marks ({session.reactNativeMarks.length})
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab className="w-auto shrink-0 whitespace-nowrap" id="resources">
              Resources ({session.resources.length})
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3"
          id="waterfall"
        >
          <WaterfallView
            entries={waterfallEntries}
            selectedEntry={selectedItem}
            selectedEntryId={selectedWaterfallRowId}
            onEntrySelect={handleEntryClick}
          />
        </Tabs.Panel>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3"
          id="startup"
        >
          <StartupTab
            reactNativeMarks={session.reactNativeMarks}
            isSessionActive={isSessionActive}
          />
        </Tabs.Panel>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3"
          id="measures"
        >
          <MeasuresTable
            measures={allMeasures}
            onRowClick={handleEntryClick}
          />
        </Tabs.Panel>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3"
          id="metrics"
        >
          <MetricsTable metrics={session.metrics} onRowClick={handleEntryClick} />
        </Tabs.Panel>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3"
          id="marks"
        >
          <MarksTable marks={session.marks} onRowClick={handleEntryClick} />
        </Tabs.Panel>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3"
          id="reactNativeMarks"
        >
          <ReactNativeMarksTable
            reactNativeMarks={session.reactNativeMarks}
            onRowClick={handleEntryClick}
          />
        </Tabs.Panel>

        <Tabs.Panel
          className="flex min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3"
          id="resources"
        >
          <ResourcesTable
            resources={session.resources}
            onRowClick={handleEntryClick}
          />
        </Tabs.Panel>
      </Tabs.Root>

      <DetailsSidebar
        onClose={handleCloseSidebar}
        selectedItem={selectedItem}
      />
    </PluginTheme>
  );
}
