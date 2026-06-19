import { useState, useEffect } from 'react';
import {
  Button,
  Checkbox,
  Chip,
  Description,
  Modal,
  Surface,
} from '@rozenite/ui';
import type {
  SerializedPerformanceMark,
  SerializedPerformanceMeasure,
  SerializedPerformanceMetric,
  SerializedPerformanceReactNativeMark,
  SerializedPerformanceResource,
} from '../../shared/types';
import { downloadFile } from '../utils';

export type ExportModalProps = {
  measures: SerializedPerformanceMeasure[];
  metrics: SerializedPerformanceMetric[];
  marks: SerializedPerformanceMark[];
  reactNativeMarks: SerializedPerformanceReactNativeMark[];
  resources: SerializedPerformanceResource[];
  sessionStartedAt: number;
  clockShift: number;
};

type ExportOptions = {
  measures: boolean;
  metrics: boolean;
  marks: boolean;
  reactNativeMarks: boolean;
  resources: boolean;
};

type AlertMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

type DataTypeCardProps = {
  title: string;
  description: string;
  count: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const DataTypeCard = ({
  title,
  description,
  count,
  checked,
  onChange,
}: DataTypeCardProps) => {
  return (
    <Surface
      className={`p-4 transition-colors ${
        checked ? 'border-accent/40 bg-accent/5' : ''
      }`}
      variant="secondary"
    >
      <Checkbox className="w-full" isSelected={checked} onChange={onChange}>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Checkbox.Content className="flex w-full min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{title}</div>
            <Description className="mt-1 text-xs text-muted">
              {description}
            </Description>
          </div>
          <Chip className="shrink-0" size="sm" variant="secondary">
            {count}
          </Chip>
        </Checkbox.Content>
      </Checkbox>
    </Surface>
  );
};

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

export function ExportModal({
  measures,
  metrics,
  marks,
  reactNativeMarks,
  resources,
  sessionStartedAt,
  clockShift,
}: ExportModalProps) {
  const [exportOptions, setExportOptions] =
    useState<ExportOptions>(ALL_OPTIONS_ON);
  const [isOpen, setIsOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<AlertMessage>(null);

  const selectedCount = Object.values(exportOptions).filter(Boolean).length;

  const updateExportOption = (
    key: keyof ExportOptions,
    checked: boolean,
  ) => {
    setExportOptions((previous) => ({
      ...previous,
      [key]: checked,
    }));
  };

  const handleExport = async () => {
    setAlertMessage(null);

    try {
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

      if (exportOptions.measures) {
        exportData.measures = measures;
      }

      if (exportOptions.metrics) {
        exportData.metrics = metrics;
      }

      if (exportOptions.marks) {
        exportData.marks = marks;
      }

      if (exportOptions.reactNativeMarks) {
        exportData.reactNativeMarks = reactNativeMarks;
      }

      if (exportOptions.resources) {
        exportData.resources = resources;
      }

      await downloadFile(exportData, 'performance-data.json');
      setAlertMessage({
        type: 'success',
        message: 'Performance data exported successfully!',
      });
      setIsOpen(false);
    } catch {
      setAlertMessage({
        type: 'error',
        message: 'Failed to export performance data. Please try again.',
      });
    }
  };

  const handleSelectAll = () => setExportOptions(ALL_OPTIONS_ON);
  const handleSelectNone = () => setExportOptions(ALL_OPTIONS_OFF);

  const hasData =
    measures.length > 0 ||
    metrics.length > 0 ||
    marks.length > 0 ||
    reactNativeMarks.length > 0 ||
    resources.length > 0;

  const clearAlert = () => {
    setAlertMessage(null);
  };

  // Auto-clear success alerts after 3 seconds
  useEffect(() => {
    if (alertMessage?.type === 'success') {
      const timer = setTimeout(clearAlert, 3000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  return (
    <>
      <Button
        isDisabled={!hasData}
        onPress={() => {
          setAlertMessage(null);
          setIsOpen(true);
        }}
        size="sm"
        variant="secondary"
      >
        Export Data
      </Button>

      <Modal
        isOpen={isOpen}
        onOpenChange={(nextOpen) => {
          setIsOpen(nextOpen);

          if (!nextOpen) {
            clearAlert();
          }
        }}
      >
        <Modal.Backdrop variant="blur">
          <Modal.Container className="w-full max-w-xl" placement="center">
            <Modal.Dialog aria-label="Export performance data">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Export Performance Data</Modal.Heading>
              </Modal.Header>

              <Modal.Body className="flex flex-col gap-4 p-6">
                <Description className="text-sm text-muted">
                  Select which data types to include in the exported JSON file.
                </Description>

                {alertMessage ? (
                  <Surface
                    className={`px-3 py-2 text-sm ${
                      alertMessage.type === 'error'
                        ? 'border-danger/30 text-danger'
                        : 'border-success/30 text-success'
                    }`}
                    variant="secondary"
                  >
                    {alertMessage.message}
                  </Surface>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Data Types
                    </h3>
                    <Description className="mt-1 text-xs text-muted">
                      Counts reflect the entries captured in the current session.
                    </Description>
                  </div>
                  <Chip size="sm" variant="secondary">
                    {selectedCount} selected
                  </Chip>
                </div>

                <div className="flex flex-col gap-3">
                  <DataTypeCard
                    checked={exportOptions.measures}
                    count={measures.length}
                    description="Duration measurements captured between marks."
                    onChange={(checked) =>
                      updateExportOption('measures', checked)
                    }
                    title="Measures"
                  />
                  <DataTypeCard
                    checked={exportOptions.metrics}
                    count={metrics.length}
                    description="Numeric or string metrics emitted by your app."
                    onChange={(checked) =>
                      updateExportOption('metrics', checked)
                    }
                    title="Metrics"
                  />
                  <DataTypeCard
                    checked={exportOptions.marks}
                    count={marks.length}
                    description="Point-in-time marks recorded during the session."
                    onChange={(checked) => updateExportOption('marks', checked)}
                    title="Marks"
                  />
                  <DataTypeCard
                    checked={exportOptions.reactNativeMarks}
                    count={reactNativeMarks.length}
                    description="Internal React Native performance marks."
                    onChange={(checked) =>
                      updateExportOption('reactNativeMarks', checked)
                    }
                    title="React Native Marks"
                  />
                  <DataTypeCard
                    checked={exportOptions.resources}
                    count={resources.length}
                    description="Resource timing entries for network requests and assets."
                    onChange={(checked) =>
                      updateExportOption('resources', checked)
                    }
                    title="Resources"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onPress={handleSelectAll} size="sm" variant="secondary">
                    Select All
                  </Button>
                  <Button
                    onPress={handleSelectNone}
                    size="sm"
                    variant="secondary"
                  >
                    Select None
                  </Button>
                </div>
              </Modal.Body>

              <Modal.Footer className="flex justify-end gap-2">
                <Button onPress={() => setIsOpen(false)} variant="secondary">
                  Cancel
                </Button>
                <Button
                  isDisabled={!hasData || selectedCount === 0}
                  onPress={() => {
                    void handleExport();
                  }}
                >
                  Export Data
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
