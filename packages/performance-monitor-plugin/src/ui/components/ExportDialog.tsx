import { useState } from 'react';
import { Button, Dialog, List, Switch } from '@rozenite/ui';
import type {
  SerializedPerformanceMark,
  SerializedPerformanceMeasure,
  SerializedPerformanceMetric,
  SerializedPerformanceReactNativeMark,
  SerializedPerformanceResource,
} from '../../shared/types';
import { downloadFile } from '../utils';

export type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measures: SerializedPerformanceMeasure[];
  metrics: SerializedPerformanceMetric[];
  marks: SerializedPerformanceMark[];
  reactNativeMarks: SerializedPerformanceReactNativeMark[];
  resources: SerializedPerformanceResource[];
  sessionStartedAt: number;
  clockShift: number;
};

type ExportOptionKey = 'measures' | 'metrics' | 'marks' | 'reactNativeMarks' | 'resources';
type ExportOptions = Record<ExportOptionKey, boolean>;

const ALL_OPTIONS_ON: ExportOptions = {
  measures: true,
  metrics: true,
  marks: true,
  reactNativeMarks: true,
  resources: true,
};

const ALL_OPTIONS_OFF: ExportOptions = {
  measures: false,
  metrics: false,
  marks: false,
  reactNativeMarks: false,
  resources: false,
};

// G1: a Dialog with one List row per entry type (live count + include/exclude
// Switch), Select All/None, Cancel/Export. Replaces the Radix `ExportModal`'s
// toggle cards. Export logic (what's serialized, how the download fires) is
// unchanged from the original — only the UI framework changed.
export const ExportDialog = ({
  open,
  onOpenChange,
  measures,
  metrics,
  marks,
  reactNativeMarks,
  resources,
  sessionStartedAt,
  clockShift,
}: ExportDialogProps) => {
  const [exportOptions, setExportOptions] = useState<ExportOptions>(ALL_OPTIONS_ON);

  const handleExport = async () => {
    const exportData: Record<string, unknown> = {
      exportDate: new Date().toISOString(),
      sessionInfo: {
        sessionStartedAt: new Date(sessionStartedAt).toISOString(),
        clockShift,
        totalMeasures: measures.length,
        totalMetrics: metrics.length,
        totalMarks: marks.length,
        totalReactNativeMarks: reactNativeMarks.length,
        totalResources: resources.length,
      },
    };

    if (exportOptions.measures) exportData.measures = measures;
    if (exportOptions.metrics) exportData.metrics = metrics;
    if (exportOptions.marks) exportData.marks = marks;
    if (exportOptions.reactNativeMarks) exportData.reactNativeMarks = reactNativeMarks;
    if (exportOptions.resources) exportData.resources = resources;

    await downloadFile(exportData, 'performance-data.json');
    onOpenChange(false);
  };

  const toggle = (key: ExportOptionKey) =>
    setExportOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const noneSelected = Object.values(exportOptions).every((value) => !value);

  const rows: Array<{ key: ExportOptionKey; label: string; count: number }> = [
    { key: 'measures', label: 'Measures', count: measures.length },
    { key: 'metrics', label: 'Metrics', count: metrics.length },
    { key: 'marks', label: 'Marks', count: marks.length },
    { key: 'reactNativeMarks', label: 'React Native Marks', count: reactNativeMarks.length },
    { key: 'resources', label: 'Resources', count: resources.length },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-md">
        <Dialog.Header>
          <Dialog.Title>Export Performance Data</Dialog.Title>
          <Dialog.Description>
            Select which data types to include in the export file.
          </Dialog.Description>
        </Dialog.Header>

        <div className="flex items-center gap-2">
          <Button size="compact" variant="outline" onClick={() => setExportOptions(ALL_OPTIONS_ON)}>
            Select All
          </Button>
          <Button
            size="compact"
            variant="outline"
            onClick={() => setExportOptions(ALL_OPTIONS_OFF)}
          >
            Select None
          </Button>
        </div>

        <List>
          <List.Group>
            {rows.map((row) => (
              <div key={row.key} className="flex h-8 items-center justify-between gap-2 px-2">
                <span className="text-sm text-foreground">{row.label}</span>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-xs text-muted-foreground">{row.count}</span>
                  <Switch
                    checked={exportOptions[row.key]}
                    onCheckedChange={() => toggle(row.key)}
                    aria-label={`Include ${row.label}`}
                  />
                </div>
              </div>
            ))}
          </List.Group>
        </List>

        <Dialog.Footer>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleExport()} disabled={noneSelected}>
            Export
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
