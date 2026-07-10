import { Drawer } from '@rozenite/ui';
import type { SerializedPerformanceEntry } from '../../shared/types';
import { MarkDetails } from './MarkDetails';
import { MeasureDetails } from './MeasureDetails';
import { MetricDetails } from './MetricDetails';
import { ReactNativeMarkDetails } from './ReactNativeMarkDetails';
import { ResourceDetails } from './ResourceDetails';

export type DetailsSidebarProps = {
  selectedItem: SerializedPerformanceEntry | null;
  onClose: () => void;
};

const entryTypeLabel: Record<SerializedPerformanceEntry['entryType'], string> = {
  mark: 'Mark details',
  measure: 'Measure details',
  metric: 'Metric details',
  'react-native-mark': 'React Native Mark details',
  resource: 'Resource details',
};

export const DetailsSidebar = ({
  selectedItem,
  onClose,
}: DetailsSidebarProps) => {
  if (!selectedItem) {
    return null;
  }

  const renderDetails = () => {
    switch (selectedItem.entryType) {
      case 'measure':
        return <MeasureDetails measure={selectedItem} />;
      case 'metric':
        return <MetricDetails metric={selectedItem} />;
      case 'mark':
        return <MarkDetails mark={selectedItem} />;
      case 'react-native-mark':
        return <ReactNativeMarkDetails mark={selectedItem} />;
      case 'resource':
        return <ResourceDetails resource={selectedItem} />;
      default:
        return null;
    }
  };

  return (
    <Drawer
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <Drawer.Backdrop variant="blur">
        <Drawer.Content className="w-full max-w-2xl" placement="right">
          <Drawer.Dialog
            aria-label={entryTypeLabel[selectedItem.entryType]}
            className="p-0 flex h-full flex-col overflow-hidden w-140! max-w-[90vw]!"
          >
            <Drawer.Header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div className="min-w-0">
                <Drawer.Heading className="truncate">
                  {selectedItem.name}
                </Drawer.Heading>
                <p className="mt-1 text-xs text-muted">
                  {entryTypeLabel[selectedItem.entryType]}
                </p>
              </div>
              <Drawer.CloseTrigger aria-label="Close details panel" />
            </Drawer.Header>

            <Drawer.Body className="min-h-0 flex-1 overflow-auto p-5">
              {renderDetails()}
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
};
