import {
  Button,
  Checkbox,
  Flex,
  Text,
  Box,
  Dialog,
  Callout,
} from '@radix-ui/themes';
import { useState, useEffect } from 'react';
import {
  SerializedPerformanceMeasure,
  SerializedPerformanceMark,
  SerializedPerformanceMetric,
} from '../../shared/types';
import { downloadFile } from '../utils';

export type ExportModalProps = {
  measures: SerializedPerformanceMeasure[];
  metrics: SerializedPerformanceMetric[];
  marks: SerializedPerformanceMark[];
  sessionStartedAt: number;
  clockShift: number;
};

type ExportOptions = {
  measures: boolean;
  metrics: boolean;
  marks: boolean;
};

type AlertMessage = {
  type: 'success' | 'error';
  message: string;
} | null;

type DataTypeCardProps = {
  title: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
};

const DataTypeCard = ({
  title,
  count,
  checked,
  onToggle,
}: DataTypeCardProps) => {
  return (
    <Box
      style={{
        padding: '16px',
        border: checked
          ? '1px solid var(--accent-9)'
          : '1px solid var(--gray-6)',
        borderRadius: 'var(--radius-3)',
        backgroundColor: checked ? 'var(--accent-2)' : 'var(--gray-2)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={onToggle}
    >
      <Flex align="center" justify="between">
        <Flex align="center" gap="3">
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggle()}
            onClick={(e) => e.stopPropagation()}
          />
          <Box>
            <Text size="3" weight="medium">
              {title}
            </Text>
          </Box>
        </Flex>
        <Text size="2" color="gray" style={{ fontWeight: 500 }}>
          {count}
        </Text>
      </Flex>
    </Box>
  );
};

export function ExportModal({
  measures,
  metrics,
  marks,
  sessionStartedAt,
  clockShift,
}: ExportModalProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    measures: true,
    metrics: true,
    marks: true,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<AlertMessage>(null);

  const handleExport = async () => {
    try {
      const exportData: Record<string, unknown> = {
        exportDate: new Date().toISOString(),
        sessionInfo: {
          sessionStartedAt: new Date(sessionStartedAt).toISOString(),
          clockShift,
          totalMeasures: measures.length,
          totalMetrics: metrics.length,
          totalMarks: marks.length,
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

  const handleSelectAll = () => {
    setExportOptions({
      measures: true,
      metrics: true,
      marks: true,
    });
  };

  const handleSelectNone = () => {
    setExportOptions({
      measures: false,
      metrics: false,
      marks: false,
    });
  };

  const hasData = measures.length > 0 || metrics.length > 0 || marks.length > 0;

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
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          clearAlert();
        }
      }}
    >
      <Dialog.Trigger>
        <Button disabled={!hasData} variant="outline">
          Export Data
        </Button>
      </Dialog.Trigger>
      <Dialog.Content style={{ maxWidth: 500, padding: '32px' }}>
        {alertMessage && (
          <Box mb="4">
            <Callout.Root
              color={alertMessage.type === 'success' ? 'green' : 'red'}
            >
              <Callout.Text>{alertMessage.message}</Callout.Text>
            </Callout.Root>
          </Box>
        )}

        <Box mb="4">
          <Dialog.Title size="5" mb="0">
            Export Performance Data
          </Dialog.Title>
          <Text size="2" color="gray">
            Select which data types to include in the export file
          </Text>
        </Box>

        <Box mb="5">
          <Box mb="2">
            <Text size="3" weight="medium">
              Data Types
            </Text>
          </Box>

          <Flex direction="column" gap="4">
            <DataTypeCard
              title="Measures"
              count={measures.length}
              checked={exportOptions.measures}
              onToggle={() =>
                setExportOptions((prev) => ({
                  ...prev,
                  measures: !prev.measures,
                }))
              }
            />

            <DataTypeCard
              title="Metrics"
              count={metrics.length}
              checked={exportOptions.metrics}
              onToggle={() =>
                setExportOptions((prev) => ({
                  ...prev,
                  metrics: !prev.metrics,
                }))
              }
            />

            <DataTypeCard
              title="Marks"
              count={marks.length}
              checked={exportOptions.marks}
              onToggle={() =>
                setExportOptions((prev) => ({
                  ...prev,
                  marks: !prev.marks,
                }))
              }
            />
          </Flex>
        </Box>

        <Box mb="6">
          <Flex gap="2">
            <Button size="2" variant="outline" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button size="2" variant="outline" onClick={handleSelectNone}>
              Select None
            </Button>
          </Flex>
        </Box>

        <Flex gap="3" justify="end">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={
              !exportOptions.measures &&
              !exportOptions.metrics &&
              !exportOptions.marks
            }
          >
            Export Data
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
