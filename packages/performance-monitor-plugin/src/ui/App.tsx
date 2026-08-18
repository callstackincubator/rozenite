import { useRozeniteDevToolsClient, Subscription } from '@rozenite/plugin-bridge';
import { IconButton, PluginShell, SearchField, Select, Toolbar } from '@rozenite/ui';
import { Download, Play, Square, Trash2, X } from 'lucide-react';
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
import { ExportDialog } from './components/ExportDialog';
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

  const handleToggleSession = () => {
    if (isSessionActive) {
      handleStopSession();
    } else {
      handleStartSession();
    }
  };

  const handleEntryClick = (entry: SerializedPerformanceEntry, entryId?: string) => {
    setSelectedItem(entry);
    setSelectedEntryId(entryId ?? null);
  };

  const handleCloseDetail = () => {
    setSelectedItem(null);
    setSelectedEntryId(null);
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
  // waterfall reflects startup phases without forcing manual subtraction.
  // The export still emits raw session data (see ExportDialog).
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
            <Toolbar.Button
              onClick={handleToggleSession}
              aria-label={isSessionActive ? 'Stop' : 'Start'}
              title={isSessionActive ? 'Stop' : 'Start'}
              className="w-6 px-0"
            >
              {isSessionActive ? (
                <Square className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Toolbar.Button>
            <Toolbar.Button
              onClick={handleClear}
              disabled={!hasData}
              aria-label="Clear"
              title="Clear"
              className="w-6 px-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Toolbar.Button>
          </Toolbar.Group>

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
              <Select.Value>
                {(value: EntryTypeFilter) =>
                  ENTRY_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
                }
              </Select.Value>
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
            <Toolbar.Button
              onClick={() => setIsExportDialogOpen(true)}
              disabled={!hasData}
              aria-label="Export"
              title="Export"
              className="w-6 px-0"
            >
              <Download className="h-3.5 w-3.5" />
            </Toolbar.Button>
          </Toolbar.Group>
        </Toolbar>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-hidden">
            <WaterfallView
              entries={filteredEntries}
              selectedEntry={selectedItem}
              selectedEntryId={selectedEntryId}
              onEntrySelect={handleEntryClick}
            />
          </div>

          {selectedItem && (
            <div className="flex w-[360px] shrink-0 flex-col border-l border-border bg-card">
              <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
                <span
                  className="truncate text-sm font-medium text-foreground"
                  title={selectedItem.name}
                >
                  {selectedItem.name}
                </span>
                <IconButton
                  label="Close details"
                  tone="neutral"
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseDetail}
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1">
                <DetailPane entry={selectedItem} />
              </div>
            </div>
          )}
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
