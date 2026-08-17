import { useRozeniteDevToolsClient, Subscription } from '@rozenite/plugin-bridge';
import {
  Button,
  IndicatorDot,
  PluginShell,
  SearchField,
  Select,
  Split,
  Toolbar,
} from '@rozenite/ui';
import { Download, Play, Square, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  PerformanceMonitorEventMap,
  SerializedPerformanceMeasure,
  SerializedPerformanceMark,
  SerializedPerformanceMetric,
  SerializedPerformanceReactNativeMark,
  SerializedPerformanceResource,
  SerializedPerformanceEntry,
} from '../shared/types';
import { DetailPane } from './components/DetailPane';
import { EntriesTable } from './components/EntriesTable';
import { ExportDialog } from './components/ExportDialog';
import { SessionDuration } from './components/SessionDuration';
import { StartupSummaryCard } from './components/StartupSummaryCard';
import { WaterfallView } from './components/WaterfallView';
import { deriveStartupPhases } from './derive-startup-phases';
import { ENTRY_TYPE_OPTIONS, type EntryTypeFilter } from './entry-types';
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

const createEmptySessionData = () => ({
  measures: [] as SerializedPerformanceMeasure[],
  marks: [] as SerializedPerformanceMark[],
  metrics: [] as SerializedPerformanceMetric[],
  reactNativeMarks: [] as SerializedPerformanceReactNativeMark[],
  resources: [] as SerializedPerformanceResource[],
});

export default function PerformanceMonitorPanel() {
  const client = useRozeniteDevToolsClient<PerformanceMonitorEventMap>({
    pluginId: '@rozenite/performance-monitor-plugin',
  });
  const [session, setSession] = useState<PerformanceMonitorSession>({
    sessionStartedAt: 0,
    clockShift: 0,
    ...createEmptySessionData(),
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SerializedPerformanceEntry | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

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
          ...createEmptySessionData(),
        });
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

  const handleEntryClick = (entry: SerializedPerformanceEntry, entryId?: string) => {
    setSelectedItem(entry);
    setSelectedEntryId(entryId ?? null);
  };

  const handleClear = () => {
    setSession((oldSession) => ({
      ...oldSession,
      ...createEmptySessionData(),
    }));
    setSelectedItem(null);
    setSelectedEntryId(null);
  };

  // Derived measures live only in the UI: paired Start/End RN marks are
  // shown alongside user-created measures (with an "RN" badge) so the
  // unified table reflects startup phases without forcing manual
  // subtraction. The export still emits raw session data (see ExportDialog).
  const startupPhases = deriveStartupPhases(session.reactNativeMarks);
  const allMeasures = [...startupPhases, ...session.measures];
  const waterfallEntries: SerializedPerformanceEntry[] = [
    ...allMeasures,
    ...session.metrics,
    ...session.marks,
    ...session.reactNativeMarks,
    ...session.resources,
  ];

  const normalizedSearch = search.trim().toLowerCase();
  const filteredEntries = waterfallEntries.filter((entry) => {
    if (entryTypeFilter !== 'all' && entry.entryType !== entryTypeFilter) {
      return false;
    }
    if (normalizedSearch && !entry.name.toLowerCase().includes(normalizedSearch)) {
      return false;
    }
    return true;
  });

  const hasData = waterfallEntries.length > 0;

  return (
    <PluginShell>
      <PluginShell.Body>
        <Toolbar>
          <Toolbar.Group>
            <Button
              size="compact"
              variant="outline"
              onClick={handleStartSession}
              disabled={isSessionActive}
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
            <Button
              size="compact"
              variant="outline"
              onClick={handleStopSession}
              disabled={!isSessionActive}
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
          </Toolbar.Group>

          <Toolbar.Separator />

          <div className="flex items-center gap-1.5">
            <IndicatorDot variant={isSessionActive ? 'default' : 'destructive'} />
            <SessionDuration
              isActive={isSessionActive}
              sessionStartedAt={session.sessionStartedAt}
            />
          </div>

          <Toolbar.Separator />

          <Select
            value={entryTypeFilter}
            onValueChange={(value) => {
              if (value) {
                setEntryTypeFilter(value as EntryTypeFilter);
              }
            }}
          >
            <Select.Trigger className="w-32">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {ENTRY_TYPE_OPTIONS.map((option) => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>

          <div className="min-w-40 flex-1">
            <SearchField
              placeholder="Search by name…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch('')}
            />
          </div>

          <Toolbar.Group>
            <Button
              size="compact"
              variant="outline"
              onClick={() => setIsExportDialogOpen(true)}
              disabled={!hasData}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="compact" variant="outline" onClick={handleClear} disabled={!hasData}>
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          </Toolbar.Group>
        </Toolbar>

        <div className="min-h-0 flex-1">
          <Split direction="vertical" autoSaveId="performance-monitor">
            <Split.Pane defaultSize={45} minSize={20}>
              <div className="flex h-full min-h-0 flex-col">
                <StartupSummaryCard reactNativeMarks={session.reactNativeMarks} />
                <div className="min-h-0 flex-1 overflow-hidden">
                  <WaterfallView
                    entries={filteredEntries}
                    selectedEntry={selectedItem}
                    selectedEntryId={selectedEntryId}
                    onEntrySelect={handleEntryClick}
                  />
                </div>
              </div>
            </Split.Pane>
            <Split.Handle />
            <Split.Pane defaultSize={55} minSize={20}>
              <Split direction="horizontal">
                <Split.Pane defaultSize={62} minSize={30}>
                  <EntriesTable
                    entries={filteredEntries}
                    onRowClick={(entry) => handleEntryClick(entry)}
                  />
                </Split.Pane>
                <Split.Handle />
                <Split.Pane defaultSize={38} minSize={25}>
                  <DetailPane entry={selectedItem} />
                </Split.Pane>
              </Split>
            </Split.Pane>
          </Split>
        </div>
      </PluginShell.Body>

      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        measures={session.measures}
        metrics={session.metrics}
        marks={session.marks}
        reactNativeMarks={session.reactNativeMarks}
        resources={session.resources}
        sessionStartedAt={session.sessionStartedAt}
        clockShift={session.clockShift}
      />
    </PluginShell>
  );
}
