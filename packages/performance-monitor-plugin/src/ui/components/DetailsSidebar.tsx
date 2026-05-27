import { ScrollArea, Box, Button, Flex } from '@radix-ui/themes';
import { Cross2Icon } from '@radix-ui/react-icons';
import { MeasureDetails } from './MeasureDetails';
import { MetricDetails } from './MetricDetails';
import { MarkDetails } from './MarkDetails';
import { ReactNativeMarkDetails } from './ReactNativeMarkDetails';
import { ResourceDetails } from './ResourceDetails';
import { SerializedPerformanceEntry } from '../../shared/types';

export type DetailsSidebarProps = {
  selectedItem: SerializedPerformanceEntry | null;
  onClose: () => void;
};

export const DetailsSidebar = ({
  selectedItem,
  onClose,
}: DetailsSidebarProps) => {
  const renderDetails = () => {
    if (!selectedItem) return null;

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

  if (!selectedItem) {
    return null;
  }

  return (
    <>
      <Box className="details-sidebar-backdrop" onClick={onClose} />
      <Box className="details-sidebar">
        <Flex p="4" direction="column" height="100%">
          <Flex justify="between" align="center" mb="4">
            <Box />
            <Button
              variant="ghost"
              size="2"
              onClick={onClose}
              style={{ padding: '4px' }}
              aria-label="Close details"
            >
              <Cross2Icon width="16" height="16" />
            </Button>
          </Flex>

          <ScrollArea style={{ flex: 1 }}>
            <Box pr="4">{renderDetails()}</Box>
          </ScrollArea>
        </Flex>
      </Box>
    </>
  );
};
